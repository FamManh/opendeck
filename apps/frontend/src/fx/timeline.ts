import type { RoundStats } from '@/domain'
import type { FxLevel } from './prefs'

export type Step =
  | { at: number; kind: 'countdown'; n: 3 | 2 | 1 }
  | { at: number; kind: 'flip'; pid: string }
  | { at: number; kind: 'flipAll' }
  | { at: number; kind: 'results' }
  | { at: number; kind: 'stamp' }
  | { at: number; kind: 'slideDone'; itemId: string }
  | { at: number; kind: 'moment'; name: 'consensus' | 'twist' }

export const COUNT_STEP_MS = 500
export const FIRST_FLIP_MS = 1500
export const FLIP_STEP_MS = 150
export const FLIP_TOTAL_MAX_MS = 1000
export const RESULTS_AFTER_FLIP_MS = 650
export const MINIMAL_SETTLE_MS = 50
export const STAMP_MS = 800

function moments(at: number, stats: RoundStats): Step[] {
  const out: Step[] = []
  const numericVotes = stats.distribution.reduce((n, d) => (d.card.special ? n : n + d.count), 0)
  if (stats.consensusLevel === 'absolute' && numericVotes >= 2) out.push({ at, kind: 'moment', name: 'consensus' })
  if (stats.needsDiscussion) out.push({ at, kind: 'moment', name: 'twist' })
  return out
}

export function planReveal(level: FxLevel, seatOrder: string[], stats: RoundStats): Step[] {
  if (level === 'minimal') {
    const at = MINIMAL_SETTLE_MS
    return [{ at: 0, kind: 'flipAll' }, { at, kind: 'results' }, ...moments(at, stats)]
  }
  const steps: Step[] = ([3, 2, 1] as const).map((n, i) => ({ at: i * COUNT_STEP_MS, kind: 'countdown', n }))
  let resultsAt: number
  if (level === 'medium') {
    steps.push({ at: FIRST_FLIP_MS, kind: 'flipAll' })
    resultsAt = FIRST_FLIP_MS + RESULTS_AFTER_FLIP_MS
  } else {
    const n = seatOrder.length
    const gap = n > 1 ? Math.min(FLIP_STEP_MS, FLIP_TOTAL_MAX_MS / n) : 0
    seatOrder.forEach((pid, i) => steps.push({ at: Math.round(FIRST_FLIP_MS + i * gap), kind: 'flip', pid }))
    const lastFlip = n > 0 ? Math.round(FIRST_FLIP_MS + (n - 1) * gap) : FIRST_FLIP_MS
    resultsAt = lastFlip + RESULTS_AFTER_FLIP_MS
  }
  steps.push({ at: resultsAt, kind: 'results' }, ...moments(resultsAt, stats))
  return steps
}

export function planFinalize(level: FxLevel, itemId: string): Step[] {
  if (level === 'minimal') return [{ at: 0, kind: 'stamp' }, { at: 0, kind: 'slideDone', itemId }]
  return [{ at: 0, kind: 'stamp' }, { at: STAMP_MS, kind: 'slideDone', itemId }]
}
