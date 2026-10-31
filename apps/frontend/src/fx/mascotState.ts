import type { Participant, RoundStats } from '@/domain'

export type MascotState = 'thinking' | 'voted' | 'sleeping' | 'celebrating' | 'away'
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
}

export function deriveMascotState(p: Participant, c: MascotContext): MascotState {
  if (!p.online) return 'away'
  if (c.moment === 'consensus' && c.cardId && c.stats?.modes.some(m => m.id === c.cardId)) return 'celebrating'
  if (c.status === 'voting') {
    if (c.voted) return 'voted'
    if (p.role !== 'observer' && c.now - c.roundStartedAt > SLEEP_AFTER_MS) return 'sleeping'
    return 'thinking'
  }
  return c.voted ? 'voted' : 'thinking'
}
