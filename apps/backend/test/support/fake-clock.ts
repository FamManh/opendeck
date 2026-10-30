import type { Clock } from '../../src/common/clock'

export function fakeClock(start = Date.UTC(2026, 9, 30, 12)): { now: Clock; advance(ms: number): void } {
  let t = start
  return { now: () => t, advance: (ms: number) => { t += ms } }
}
