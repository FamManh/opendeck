import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, type Clock } from '../common/clock'
import type { RoomState } from '../domain'
import { REACTION_EMOJI_LIST } from './reaction-emojis'

export const RANDOM = Symbol('RANDOM')
export type Random = () => number

/** Noto Animated Emoji set; same list as the frontend picker (`apps/frontend/src/fx/noto-emoji.ts`). */
export const REACTION_EMOJIS: ReadonlySet<string> = new Set(REACTION_EMOJI_LIST)
export const REACTION_MAX = 5
export const REACTION_WINDOW_MS = 2000
export const THROW_COOLDOWN_MS = 10_000
/** Nhắc người ngủ gật: chỉ ném vào voter chưa chọn bài, cooldown theo cặp. */
export const NUDGE_KINDS = ['paper', 'plane'] as const
/** Ném cho vui: vào bất kỳ ai trong phòng (kể cả đang offline), lúc nào cũng được, giới hạn theo người ném. */
export const ITEM_KINDS = ['tomato', 'poop', 'roll', 'arrow', 'bomb', 'heart'] as const
export type ThrowKind = (typeof NUDGE_KINDS)[number] | (typeof ITEM_KINDS)[number]
export const ITEM_MAX = 5
export const ITEM_WINDOW_MS = 3000
const isIn = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T)
export const FX_FLUSH_MS = 250

export type FxResult<T = void> = { ok: true; value: T } | { ok: false; code: string }
const fail = (code: string): { ok: false; code: string } => ({ ok: false, code })

export interface SpinResult { chosen: 'low' | 'high'; pid: string; turns: number }

/** Trạng thái tạm thời của kênh fx: không ghi DB, không đi qua RoomState (§6). */
@Injectable()
export class FxService {
  private readonly hits = new Map<string, number[]>()
  private readonly pending = new Map<string, Map<string, number>>()
  private readonly throws = new Map<string, number>()
  private readonly itemHits = new Map<string, number[]>()
  private readonly spun = new Map<string, string>()

  constructor(@Inject(CLOCK) private readonly now: Clock, @Inject(RANDOM) private readonly rand: Random) {}

  /** Giới hạn theo participant (không theo socket) để 2 tab không nhân đôi hạn mức. */
  react(slug: string, pid: string, emoji: unknown): FxResult {
    if (typeof emoji !== 'string' || !REACTION_EMOJIS.has(emoji)) return fail('BAD_EMOJI')
    const t = this.now()
    const key = `${slug}|${pid}`
    const recent = (this.hits.get(key) ?? []).filter(h => h > t - REACTION_WINDOW_MS)
    if (recent.length >= REACTION_MAX) { this.hits.set(key, recent); return fail('RATE_LIMITED') }
    recent.push(t)
    this.hits.set(key, recent)
    const room = this.pending.get(slug) ?? new Map<string, number>()
    room.set(emoji, (room.get(emoji) ?? 0) + 1)
    this.pending.set(slug, room)
    return { ok: true, value: undefined }
  }

  /** Lấy và xoá lô reaction đang chờ của phòng (ẩn danh: không có pid). */
  drain(slug: string): { emoji: string; count: number }[] {
    const room = this.pending.get(slug)
    this.pending.delete(slug)
    return room ? [...room].map(([emoji, count]) => ({ emoji, count })) : []
  }

  throwAt(slug: string, state: RoomState, from: string, target: unknown, kind: unknown): FxResult {
    const nudge = isIn(NUDGE_KINDS, kind)
    if (!nudge && !isIn(ITEM_KINDS, kind)) return fail('BAD_KIND')
    if (typeof target !== 'string' || target === from) return fail('BAD_TARGET')
    const sender = state.participants[from]
    const victim = state.participants[target]
    if (!sender || sender.role !== 'voter' || !victim) return fail('BAD_TARGET')
    const t = this.now()
    if (!nudge) {
      const key = `${slug}|${from}`
      const recent = (this.itemHits.get(key) ?? []).filter(h => h > t - ITEM_WINDOW_MS)
      if (recent.length >= ITEM_MAX) { this.itemHits.set(key, recent); return fail('RATE_LIMITED') }
      recent.push(t)
      this.itemHits.set(key, recent)
      return { ok: true, value: undefined }
    }
    const cur = state.current
    if (!cur || cur.status !== 'voting' || victim.role !== 'voter' || !victim.online || target in cur.votes) return fail('TARGET_NOT_IDLE')
    const key = `${slug}|${from}|${target}`
    const last = this.throws.get(key)
    if (last !== undefined && t - last < THROW_COOLDOWN_MS) return fail('RATE_LIMITED')
    this.throws.set(key, t)
    return { ok: true, value: undefined }
  }

  spin(slug: string, state: RoomState, pid: string): FxResult<SpinResult> {
    if (state.hostId !== pid) return fail('NOT_HOST')
    const cur = state.current
    if (!cur || cur.status !== 'revealed' || !cur.stats?.needsDiscussion) return fail('NOT_DISCUSSION')
    const key = `${cur.itemId}:${cur.number}`
    if (this.spun.get(slug) === key) return fail('ALREADY_SPUN')
    const idsOf = (cardId: string | undefined) =>
      Object.entries(cur.votes).filter(([, v]) => v === cardId).map(([p]) => p)
    const low = idsOf(cur.stats.min?.id)
    const high = idsOf(cur.stats.max?.id)
    if (low.length === 0 && high.length === 0) return fail('NOT_DISCUSSION')
    let chosen: 'low' | 'high' = this.rand() < 0.5 ? 'low' : 'high'
    if ((chosen === 'low' ? low : high).length === 0) chosen = chosen === 'low' ? 'high' : 'low'
    const pool = chosen === 'low' ? low : high
    const pid2 = pool[Math.min(pool.length - 1, Math.floor(this.rand() * pool.length))]!
    this.spun.set(slug, key)
    return { ok: true, value: { chosen, pid: pid2, turns: 3 + Math.floor(this.rand() * 2) } }
  }
}
