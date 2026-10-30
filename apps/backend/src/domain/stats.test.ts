import { PRESET_SCALES, createCustomScale } from './deck'
import { computeRoundStats } from './stats'

const fib = PRESET_SCALES.fibonacci
const ts = PRESET_SCALES.tshirt

test('3,5,8 → spread 2, needs discussion, avg 5.33 → nearest 5', () => {
  const s = computeRoundStats(fib, ['3', '5', '8'])
  expect(s.spreadSteps).toBe(2)
  expect(s.needsDiscussion).toBe(true)
  expect(s.average).toBeCloseTo(5.333, 2)
  expect(s.nearestCard!.id).toBe('5')
})
test('3,5 → spread 1, no discussion; avg 4 ties 3/5 → picks 5', () => {
  const s = computeRoundStats(fib, ['3', '5'])
  expect(s.needsDiscussion).toBe(false)
  expect(s.nearestCard!.id).toBe('5')
  expect(s.consensusLevel).toBe('high')
})
test('consensusLevel mapping', () => {
  expect(computeRoundStats(fib, ['5', '5']).consensusLevel).toBe('absolute')
  expect(computeRoundStats(fib, ['3', '8']).consensusLevel).toBe('medium')
  expect(computeRoundStats(fib, ['2', '13']).consensusLevel).toBe('low')
  expect(computeRoundStats(fib, ['coffee']).consensusLevel).toBe('unknown')
})
test('min/max/distribution follow scale order, specials last', () => {
  const s = computeRoundStats(fib, ['8', 'coffee', '2', '2', 'bug'])
  expect(s.min!.id).toBe('2')
  expect(s.max!.id).toBe('8')
  expect(s.spreadSteps).toBe(3)
  expect(s.distribution.map(d => [d.card.id, d.count])).toEqual([['2', 2], ['8', 1], ['coffee', 1], ['bug', 1]])
  expect(s.modes.map(c => c.id)).toEqual(['2'])
  expect(s.consensus).toBeCloseTo(2 / 3)
})
test('special cards excluded from min/max/avg but counted in total', () => {
  const s = computeRoundStats(fib, ['2', '2', 'coffee'])
  expect(s.total).toBe(3)
  expect(s.consensus).toBe(1)
  expect(s.average).toBe(2)
  expect(s.distribution.at(-1)).toMatchObject({ card: { id: 'coffee' }, count: 1 })
})
test('tshirt: no average, modes instead, ties return both', () => {
  const s = computeRoundStats(ts, ['S', 'S', 'L', 'L'])
  expect(s.average).toBeNull()
  expect(s.nearestCard).toBeNull()
  expect(s.modes.map(c => c.id)).toEqual(['S', 'L'])
  expect(s.spreadSteps).toBe(2)
  expect(s.consensus).toBe(0.5)
})
test('unsorted custom numeric scale: nearest tie picks larger numeric, spread uses scale index', () => {
  const sc = createCustomScale('x', ['4', '2', '1'])
  const s = computeRoundStats(sc, ['4', '2'])   // avg 3 ties 2/4
  expect(s.nearestCard!.id).toBe('4')
  expect(s.spreadSteps).toBe(1)
})
test.each([[[]], [['shrug', 'infinity']], [['8']]])('degenerate %j does not crash', ids => {
  const s = computeRoundStats(fib, ids)
  expect(s.needsDiscussion).toBe(false)
  expect(s.spreadSteps).toBe(0)
})
test('only specials → average null, consensus 0, modes empty', () => {
  const s = computeRoundStats(fib, ['shrug', 'infinity'])
  expect(s).toMatchObject({ total: 2, average: null, nearestCard: null, min: null, max: null, consensus: 0, modes: [] })
})
test('unknown card id throws UNKNOWN_CARD', () => {
  expect(() => computeRoundStats(fib, ['99'])).toThrow('UNKNOWN_CARD')
})
