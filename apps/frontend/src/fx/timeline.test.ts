import { expect, test } from 'vitest'
import type { RoundStats } from '@/domain'
import { planFinalize, planReveal } from './timeline'

const baseStats = {
  total: 3, distribution: [{ card: { id: '5', label: '5', numeric: 5 }, count: 3 }], min: null, max: null,
  spreadSteps: 0, needsDiscussion: false, consensus: 1, consensusLevel: 'absolute', average: 5,
  nearestCard: null, modes: [],
} as unknown as RoundStats
const st = (o: Partial<RoundStats>): RoundStats => ({ ...baseStats, ...o })
const seats = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`)

test('full: countdown 0/500/1000, flips from 1500 every 150ms, results after last flip + 650', () => {
  const s = planReveal('full', ['a', 'b', 'c'], st({}))
  expect(s.filter(x => x.kind === 'countdown').map(x => x.at)).toEqual([0, 500, 1000])
  expect(s.filter(x => x.kind === 'flip').map(x => x.at)).toEqual([1500, 1650, 1800])
  expect(s.find(x => x.kind === 'results')!.at).toBe(1800 + 650)
})

test('full with 50 seats: last flip <= 1500 + 1000', () => {
  const flips = planReveal('full', seats(50), st({})).filter(x => x.kind === 'flip')
  expect(flips).toHaveLength(50)
  expect(flips.at(-1)!.at).toBeLessThanOrEqual(2950)
})

test('medium: countdown then single flipAll at 1500, results at 2150', () => {
  const s = planReveal('medium', seats(5), st({}))
  expect(s.filter(x => x.kind === 'countdown')).toHaveLength(3)
  expect(s.filter(x => x.kind === 'flip')).toHaveLength(0)
  expect(s.find(x => x.kind === 'flipAll')!.at).toBe(1500)
  expect(s.find(x => x.kind === 'results')!.at).toBe(2150)
})

test('minimal: no countdown, flipAll at 0, results at 50', () => {
  const s = planReveal('minimal', seats(5), st({}))
  expect(s.some(x => x.kind === 'countdown')).toBe(false)
  expect(s.find(x => x.kind === 'flipAll')!.at).toBe(0)
  expect(s.find(x => x.kind === 'results')!.at).toBe(50)
})

test('consensus moment only when absolute and >=2 numeric votes', () => {
  const has = (s: ReturnType<typeof planReveal>) => s.some(x => x.kind === 'moment' && x.name === 'consensus')
  expect(has(planReveal('full', seats(3), st({})))).toBe(true)
  const one = st({ distribution: [{ card: { id: '5', label: '5', numeric: 5 }, count: 1 }] } as Partial<RoundStats>)
  expect(has(planReveal('full', seats(1), one))).toBe(false)
  expect(has(planReveal('full', seats(3), st({ consensusLevel: 'high' })))).toBe(false)
})

test('twist moment when needsDiscussion', () => {
  const s = planReveal('full', seats(3), st({ needsDiscussion: true, consensusLevel: 'medium' }))
  expect(s.some(x => x.kind === 'moment' && x.name === 'twist')).toBe(true)
})

test('planFinalize full: stamp at 0, slideDone at 800; minimal: both at 0', () => {
  expect(planFinalize('full', 'i1').map(s => s.at)).toEqual([0, 800])
  expect(planFinalize('minimal', 'i1').map(s => s.at)).toEqual([0, 0])
})

test('a 3+ step gap sets off the bomb instead of the plot twist; a 2 step gap is still a twist', () => {
  const names = (s: ReturnType<typeof planReveal>) => s.flatMap(x => (x.kind === 'moment' ? [x.name] : []))
  expect(names(planReveal('full', [], st({ spreadSteps: 3, needsDiscussion: true, consensusLevel: 'low' })))).toEqual(['bomb'])
  expect(names(planReveal('full', [], st({ spreadSteps: 2, needsDiscussion: true, consensusLevel: 'medium' })))).toEqual(['twist'])
})

test('a ☕ vote makes everyone yawn, at every level', () => {
  const coffee = st({ distribution: [{ card: { id: 'coffee', label: 'coffee', numeric: null, special: true }, count: 1 }] as RoundStats['distribution'] })
  for (const level of ['full', 'medium', 'minimal'] as const) expect(planReveal(level, [], coffee).some(x => x.kind === 'yawn')).toBe(true)
  expect(planReveal('full', [], st({})).some(x => x.kind === 'yawn')).toBe(false)
})
