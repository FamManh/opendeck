import type { PublicRoomState } from '@/domain'

/** Highest and lowest vote this many scale steps apart (or more) sets the bomb off instead of the plot twist. */
export const BOMB_STEPS = 3

export interface Bomb {
  steps: number
  /** Everyone holding the lowest or the highest card, still in the room. */
  targets: string[]
  /** Targets who have not written a reason yet: smoke stays on them and the host can't lock the score. */
  waiting: string[]
}

/** Pure and derived from room state only, so smoke and the "explain" prompt survive a reload and agree on every screen. */
export function bombOf(state: PublicRoomState | null): Bomb | null {
  const cur = state?.current
  const stats = cur?.stats
  if (!state || !cur || cur.status !== 'revealed' || !stats || stats.spreadSteps < BOMB_STEPS || !stats.min || !stats.max) return null
  const ends = new Set([stats.min.id, stats.max.id])
  const targets = Object.entries(cur.votes ?? {})
    .filter(([pid, card]) => ends.has(card) && state.participants[pid])
    .map(([pid]) => pid)
  const waiting = targets.filter(pid => !cur.reasons[pid]?.trim())
  return { steps: stats.spreadSteps, targets, waiting }
}

/** Any ☕ on the table makes everyone yawn. */
export const COFFEE = 'coffee'
