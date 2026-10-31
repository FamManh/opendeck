import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Subscription } from 'rxjs'
import type { Repository } from 'typeorm'
import type { DomainEvent, RoomState } from '../domain'
import { Criterion } from './entities/criterion.entity'
import { Item } from './entities/item.entity'
import { Outcome } from './entities/outcome.entity'
import { Room } from './entities/room.entity'
import { Vote } from './entities/vote.entity'
import { RoomStoreService, type RoomUpdate } from './room-store.service'

export const LIVE_STATE_DEBOUNCE_MS = 2000
const itemOrder = (domainId: string): number => Number(domainId.slice(1))

interface RoomRef { id: string; criterionId: string }

/** Ghi Postgres từ luồng sự kiện của store: vote/outcome/item khi có sự kiện, liveState debounce 2s mỗi phòng. */
@Injectable()
export class RoomPersistenceService implements OnModuleInit, OnModuleDestroy {
  private sub: Subscription | undefined
  private chain: Promise<void> = Promise.resolve()
  private readonly timers = new Map<string, NodeJS.Timeout>()
  private readonly refs = new Map<string, RoomRef>()
  private readonly log = new Logger(RoomPersistenceService.name)

  constructor(
    private readonly store: RoomStoreService,
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(Criterion) private readonly criteria: Repository<Criterion>,
    @InjectRepository(Vote) private readonly votes: Repository<Vote>,
    @InjectRepository(Outcome) private readonly outcomes: Repository<Outcome>,
  ) {}

  onModuleInit(): void {
    this.sub = this.store.events$.subscribe(u => this.onUpdate(u))
  }

  async onModuleDestroy(): Promise<void> {
    this.sub?.unsubscribe()
    for (const [slug, t] of this.timers) { clearTimeout(t); this.timers.delete(slug); this.enqueue(() => this.saveLive(slug)) }
    await this.chain
  }

  /** Chờ mọi ghi đang chờ xong (dùng cho test và tắt server). */
  idle(): Promise<void> {
    return this.chain
  }

  private onUpdate(u: RoomUpdate): void {
    this.scheduleLive(u.slug)
    const relevant = u.events.filter(e => ['itemsAdded', 'itemsChanged', 'itemDeleted', 'revealed', 'finalized', 'accessChanged'].includes(e.type))
    if (relevant.length > 0) this.enqueue(() => this.applyEvents(u.slug, u.state, relevant))
  }

  private scheduleLive(slug: string): void {
    if (this.timers.has(slug)) return
    const t = setTimeout(() => {
      this.timers.delete(slug)
      this.enqueue(() => this.saveLive(slug))
    }, LIVE_STATE_DEBOUNCE_MS)
    t.unref()
    this.timers.set(slug, t)
  }

  private enqueue(job: () => Promise<void>): void {
    this.chain = this.chain.then(job).catch(e => this.log.error(String(e)))
  }

  private async ref(slug: string): Promise<RoomRef | null> {
    const cached = this.refs.get(slug)
    if (cached) return cached
    const room = await this.rooms.findOne({ where: { slug }, select: { id: true } })
    const criterion = room && (await this.criteria.findOne({ where: { roomId: room.id }, select: { id: true } }))
    if (!room || !criterion) return null
    const ref = { id: room.id, criterionId: criterion.id }
    this.refs.set(slug, ref)
    return ref
  }

  private async saveLive(slug: string): Promise<void> {
    const state = this.store.peek(slug)
    if (state) await this.rooms.update({ slug }, { liveState: state })
  }

  private async applyEvents(slug: string, state: RoomState, events: DomainEvent[]): Promise<void> {
    const ref = await this.ref(slug)
    if (!ref) return
    for (const e of events) {
      if (e.type === 'itemsAdded' || e.type === 'itemsChanged') await this.upsertItems(ref, state, e.ids)
      else if (e.type === 'itemDeleted') await this.items.delete({ roomId: ref.id, order: itemOrder(e.id) })
      else if (e.type === 'revealed') await this.saveVotes(ref, state, e.itemId, e.number)
      else if (e.type === 'finalized') await this.saveOutcome(ref, state, e.itemId)
      else if (e.type === 'accessChanged') await this.rooms.update({ id: ref.id }, { locked: e.locked, requireApproval: e.requireApproval })
    }
  }

  private async upsertItems(ref: RoomRef, state: RoomState, ids: string[]): Promise<void> {
    for (const id of ids) {
      const it = state.items.find(i => i.id === id)
      if (!it) continue
      const where = { roomId: ref.id, order: itemOrder(id) }
      const row = { source: it.source, externalRef: it.externalRef, title: it.title, description: it.description, status: it.status }
      const { affected } = await this.items.update(where, row)
      if (!affected) await this.items.insert({ ...where, ...row })
    }
  }

  private async itemRow(ref: RoomRef, domainItemId: string): Promise<Item | null> {
    return this.items.findOneBy({ roomId: ref.id, order: itemOrder(domainItemId) })
  }

  private async saveVotes(ref: RoomRef, state: RoomState, itemId: string, number: number): Promise<void> {
    const round = [state.current, ...state.history].find(r => r?.itemId === itemId && r.number === number)
    const item = await this.itemRow(ref, itemId)
    if (!round || !item) return
    const rows = Object.entries(round.votes).map(([pid, cardId]) => ({ itemId: item.id, criterionId: ref.criterionId, participantKey: pid, round: number, cardId, anonymous: false }))
    if (rows.length > 0) await this.votes.createQueryBuilder().insert().values(rows).orIgnore().execute()
  }

  private async saveOutcome(ref: RoomRef, state: RoomState, itemId: string): Promise<void> {
    const outcome = state.outcomes.find(o => o.itemId === itemId)
    const item = await this.itemRow(ref, itemId)
    if (!outcome || !item) return
    await this.outcomes.delete({ itemId: item.id })
    await this.outcomes.insert({ itemId: item.id, value: outcome.value, note: outcome.note, decidedBy: outcome.decidedBy, decidedAt: new Date(outcome.decidedAt) })
    await this.items.update({ id: item.id }, { status: 'done' })
  }
}
