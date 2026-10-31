import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Subject } from 'rxjs'
import type { Repository } from 'typeorm'
import { CLOCK, type Clock } from '../common/clock'
import { DomainError, applyCommand, type Command, type CommandResult, type DomainEvent, type RoomState } from '../domain'
import { Room } from './entities/room.entity'

export interface RoomUpdate { slug: string; state: RoomState; events: DomainEvent[] }
export const TICK_MS = 1000

/** Nguồn sự thật của phòng đang mở: state nằm trong bộ nhớ, mỗi phòng chạy lệnh tuần tự qua hàng đợi promise. */
@Injectable()
export class RoomStoreService implements OnModuleInit, OnModuleDestroy {
  readonly events$ = new Subject<RoomUpdate>()
  private readonly rooms = new Map<string, RoomState>()
  private readonly queues = new Map<string, Promise<unknown>>()
  private timer: NodeJS.Timeout | undefined
  private readonly log = new Logger(RoomStoreService.name)

  constructor(@InjectRepository(Room) private readonly repo: Repository<Room>, @Inject(CLOCK) private readonly now: Clock) {}

  onModuleInit(): void {
    this.timer = setInterval(() => this.tickAll(), TICK_MS)
    this.timer.unref()
  }

  onModuleDestroy(): void {
    clearInterval(this.timer)
  }

  load(slug: string): Promise<RoomState> {
    return this.enqueue(slug, () => this.ensure(slug))
  }

  /** Trạng thái đang giữ trong bộ nhớ (không nạp từ DB); dùng cho persistence. */
  peek(slug: string): RoomState | undefined {
    return this.rooms.get(slug)
  }

  dispatch(slug: string, cmd: Command): Promise<CommandResult> {
    return this.exec(slug, (s, now) => applyCommand(s, cmd, now))
  }

  /** Chạy một biến đổi thuần trên state hiện tại, tuần tự với các lệnh khác của phòng; ném DomainError thì state giữ nguyên. */
  exec(slug: string, fn: (s: RoomState, now: number) => CommandResult): Promise<CommandResult> {
    return this.enqueue(slug, async () => {
      const result = fn(await this.ensure(slug), this.now())
      this.rooms.set(slug, result.state)
      this.events$.next({ slug, state: result.state, events: result.events })
      return result
    })
  }

  private async ensure(slug: string): Promise<RoomState> {
    const cached = this.rooms.get(slug)
    if (cached) return cached
    const row = await this.repo.findOneBy({ slug })
    if (!row?.liveState) throw new DomainError('ROOM_NOT_FOUND')
    const state = row.liveState as RoomState
    // Sau khi nạp lại không ai đang kết nối: mọi người offline cho tới khi socket join lại.
    const at = this.now()
    for (const p of Object.values(state.participants)) if (p.online) { p.online = false; p.offlineSince = at }
    state.pending = {}
    // Phòng lưu trước khi có hỏi đáp: bổ sung các trường mới để lệnh và client không gặp undefined.
    state.questions ??= []
    state.notes ??= []
    state.qnaSeq ??= 0
    this.rooms.set(slug, state)
    return state
  }

  private enqueue<T>(slug: string, job: () => Promise<T>): Promise<T> {
    const run = (this.queues.get(slug) ?? Promise.resolve()).then(job)
    const tail = run.catch(() => undefined)
    this.queues.set(slug, tail)
    void tail.then(() => { if (this.queues.get(slug) === tail) this.queues.delete(slug) })
    return run
  }

  private tickAll(): void {
    for (const [slug, s] of this.rooms) {
      if (!Object.values(s.participants).some(p => p.online)) continue
      this.dispatch(slug, { type: 'tick' }).catch(e => this.log.error(`tick ${slug}: ${String(e)}`))
    }
  }
}
