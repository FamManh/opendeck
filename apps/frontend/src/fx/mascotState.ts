import type { Participant, RoundStats } from '@/domain'

export type MascotState = 'thinking' | 'voted' | 'sleeping' | 'celebrating' | 'dancing' | 'yawning' | 'away'
export const SLEEP_AFTER_MS = 45_000

export interface MascotContext {
  status: 'voting' | 'revealed' | 'idle'
  /** Whether this participant has a vote in the current round. */
  voted: boolean
  /** This participant's revealed card id (only known after reveal). */
  cardId: string | null
  stats: RoundStats | null
  now: number
  roundStartedAt: number
  moment: 'consensus' | null
  /** Someone played ☕ this round (after reveal): yawning is contagious. */
  yawn?: boolean
}

export function deriveMascotState(p: Participant, c: MascotContext): MascotState {
  if (!p.online) return 'away'
  if (c.moment === 'consensus' && c.cardId && c.stats?.modes.some(m => m.id === c.cardId)) return 'dancing'
  if (c.yawn && c.status === 'revealed') return 'yawning'
  if (c.status === 'voting') {
    if (c.voted) return 'voted'
    if (p.role !== 'observer' && c.now - c.roundStartedAt > SLEEP_AFTER_MS) return 'sleeping'
    return 'thinking'
  }
  return c.voted ? 'voted' : 'thinking'
}
