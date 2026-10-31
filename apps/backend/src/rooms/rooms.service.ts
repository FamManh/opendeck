import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { customAlphabet } from 'nanoid'
import { DataSource, QueryFailedError, type Repository } from 'typeorm'
import { PasswordService } from '../auth/password.service'
import {
  DomainError, PRESET_SCALES, applyCommand, buildSummary, createCustomScale, createRoom, toCsv,
  type CommandResult, type RoomState, type Scale,
} from '../domain'
import type { Identity } from '../guests/identity.service'
import { DEFAULT_AVATAR } from '../guests/identity.service'
import type { User } from '../users/user.entity'
import type { CreateRoomDto } from './dto/create-room.dto'
import type { UpdateRoomDto } from './dto/update-room.dto'
import { Criterion } from './entities/criterion.entity'
import { Room } from './entities/room.entity'
import { RoomAccessService } from './room-access.service'
import { RoomStoreService } from './room-store.service'

const slugId = customAlphabet('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', 10)

export interface RoomInfo { name: string; hasPassword: boolean; requireApproval: boolean; locked: boolean }
export interface RoomListItem extends RoomInfo { slug: string; createdAt: Date; itemsTotal: number; itemsDone: number }

const toInfo = (r: Room): RoomInfo => ({ name: r.name, hasPassword: r.passwordHash !== null, requireApproval: r.requireApproval, locked: r.locked })

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    private readonly ds: DataSource,
    private readonly passwords: PasswordService,
    private readonly access: RoomAccessService,
    private readonly store: RoomStoreService,
  ) {}

  async create(user: User, dto: CreateRoomDto, now: number): Promise<{ slug: string }> {
    const scale = this.scaleOf(dto)
    const hash = dto.password ? await this.passwords.hash(dto.password) : null
    for (let attempt = 0; ; attempt++) {
      const slug = slugId()
      try {
        await this.ds.transaction(async m => {
          const room = await m.save(m.create(Room, {
            slug, ownerId: user.id, name: dto.name, passwordHash: hash, requireApproval: dto.requireApproval ?? false,
            config: { scale, enabledSpecials: dto.enabledSpecials ?? null }, liveState: null,
          }))
          await m.save(m.create(Criterion, { roomId: room.id, name: 'Estimate', scale }))
          const state = this.initialState(room.id, user, scale, dto, now)
          await m.update(Room, { id: room.id }, { liveState: state })
        })
        return { slug }
      } catch (e) {
        const dup = e instanceof QueryFailedError && (e.driverError as { code?: string }).code === '23505'
        if (!dup || attempt >= 3) throw e
      }
    }
  }

  private scaleOf(dto: CreateRoomDto): Scale {
    if ((dto.scaleId === undefined) === (dto.customScale === undefined)) throw new BadRequestException({ code: 'SCALE_REQUIRED' })
    try {
      return dto.scaleId ? PRESET_SCALES[dto.scaleId] : createCustomScale(dto.customScale!.name, dto.customScale!.labels)
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException({ code: e.code })
      throw e
    }
  }

  private initialState(id: string, user: User, scale: Scale, dto: CreateRoomDto, now: number): RoomState {
    const state = createRoom({
      id, scale, now, ...(dto.enabledSpecials && { enabledSpecials: dto.enabledSpecials }), access: { requireApproval: dto.requireApproval ?? false }, ...(dto.revealRule && { revealRule: { onAllVoted: dto.revealRule.onAllVoted, timerSec: dto.revealRule.timerSec } }),
      owner: { id: `u:${user.id}`, userId: user.id, name: user.displayName, avatar: user.avatar ?? DEFAULT_AVATAR, role: 'voter' },
    })
    // Chủ phòng chưa kết nối: không để ghế host "online" vĩnh viễn.
    const owner = state.participants[`u:${user.id}`]!
    owner.online = false
    owner.offlineSince = now
    return state
  }

  async mine(userId: string): Promise<RoomListItem[]> {
    const rows = await this.rooms.find({ where: { ownerId: userId }, order: { createdAt: 'DESC' } })
    return rows.map(r => {
      const live = r.liveState as RoomState | null
      return {
        ...toInfo(r), slug: r.slug, createdAt: r.createdAt,
        itemsTotal: live?.items.length ?? 0, itemsDone: live?.items.filter(i => i.status === 'done').length ?? 0,
      }
    })
  }

  async find(slug: string): Promise<Room> {
    const room = await this.rooms.findOneBy({ slug })
    if (!room) throw new NotFoundException({ code: 'ROOM_NOT_FOUND' })
    return room
  }

  async info(slug: string): Promise<RoomInfo> {
    return toInfo(await this.find(slug))
  }

  /** Trả `pid` để controller ký vào vé `rj_<slug>`. */
  async join(slug: string, who: Identity, ip: string, password: string | undefined): Promise<string> {
    const room = await this.find(slug)
    await this.access.checkPassword(room, who.userId, ip, password)
    return who.pid
  }

  async update(slug: string, user: User, dto: UpdateRoomDto): Promise<RoomInfo> {
    const room = await this.find(slug)
    if (room.ownerId !== user.id) throw new ForbiddenException({ code: 'NOT_OWNER' })
    if (dto.password !== undefined) {
      room.passwordHash = dto.password === null ? null : await this.passwords.hash(dto.password)
      await this.rooms.update({ id: room.id }, { passwordHash: room.passwordHash })
    }
    if (dto.locked !== undefined || dto.requireApproval !== undefined) {
      await this.store.exec(slug, (s, now) => this.setAccess(s, dto, now))
      const live = await this.store.load(slug)
      room.locked = live.access.locked
      room.requireApproval = live.access.requireApproval
      await this.rooms.update({ id: room.id }, { locked: room.locked, requireApproval: room.requireApproval })
    }
    return toInfo(room)
  }

  /** Owner đổi quyền truy cập qua HTTP: chạy như lệnh của host hiện tại; phòng không host thì sửa trực tiếp. */
  private setAccess(s: RoomState, dto: UpdateRoomDto, now: number): CommandResult {
    if (s.hostId) return applyCommand(s, { type: 'setAccess', pid: s.hostId, ...(dto.locked !== undefined && { locked: dto.locked }), ...(dto.requireApproval !== undefined && { requireApproval: dto.requireApproval }) }, now)
    const next = structuredClone(s)
    if (dto.locked !== undefined) next.access.locked = dto.locked
    if (dto.requireApproval !== undefined) next.access.requireApproval = dto.requireApproval
    return { state: next, events: [{ type: 'accessChanged', ...next.access }] }
  }

  async csv(slug: string, who: Identity): Promise<string> {
    await this.find(slug)
    const state = await this.store.load(slug)
    if (!state.participants[who.pid]) throw new ForbiddenException({ code: 'NOT_MEMBER' })
    return toCsv(buildSummary(state).rows)
  }
}
