import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FxDirector } from './director'
import type { Step } from './timeline'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const steps: Step[] = [
  { at: 100, kind: 'results' },
  { at: 0, kind: 'countdown', n: 3 },
  { at: 50, kind: 'flipAll' },
]

test('steps fire in order at their offsets', () => {
  const seen: string[] = []
  new FxDirector().play(steps, s => seen.push(s.kind))
  vi.advanceTimersByTime(0)
  expect(seen).toEqual(['countdown'])
  vi.advanceTimersByTime(50)
  expect(seen).toEqual(['countdown', 'flipAll'])
  vi.advanceTimersByTime(50)
  expect(seen).toEqual(['countdown', 'flipAll', 'results'])
})

test('play() while running drops every step of the old timeline', () => {
  const d = new FxDirector()
  const a: string[] = []
  const b: string[] = []
  d.play(steps, s => a.push(s.kind))
  vi.advanceTimersByTime(60)
  d.play([{ at: 10, kind: 'stamp' }], s => b.push(s.kind))
  vi.advanceTimersByTime(500)
  expect(a).toEqual(['countdown', 'flipAll'])
  expect(b).toEqual(['stamp'])
})

test('cancel() clears all timers', () => {
  const d = new FxDirector()
  d.play(steps, () => {})
  d.cancel()
  expect(vi.getTimerCount()).toBe(0)
  expect(d.running).toBe(false)
})

test('flush() delivers the remaining steps immediately, once', () => {
  const d = new FxDirector()
  const seen: string[] = []
  d.play(steps, s => seen.push(s.kind))
  vi.advanceTimersByTime(60)
  d.flush()
  expect(seen).toEqual(['countdown', 'flipAll', 'results'])
  vi.advanceTimersByTime(500)
  expect(seen).toHaveLength(3)
  expect(vi.getTimerCount()).toBe(0)
})
