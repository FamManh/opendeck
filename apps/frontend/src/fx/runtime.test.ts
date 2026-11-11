import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DomainEvent, PublicRoomState } from '@/domain'
import { BOMB_MS, fxRuntime, REACTION_FLOAT_MS, useFxStore, YAWN_MS } from './runtime'
import { FLIGHT_MS, HIT_MS, MAX_HITS_PER_SEAT } from './throws'

const stats = { consensusLevel: 'absolute', needsDiscussion: false, modes: [{ id: '5', label: '5', numeric: 5, special: false }], distribution: [{ card: { id: '5', label: '5', numeric: 5, special: false }, count: 2 }], min: null, max: null }
const mk = (status: 'voting' | 'revealed', number = 1): PublicRoomState => ({
  participants: {
    a: { id: 'a', name: 'A', role: 'voter', joinedAt: 1, online: true },
    b: { id: 'b', name: 'B', role: 'voter', joinedAt: 2, online: true },
  },
  current: { itemId: 'i1', number, status, voted: ['a', 'b'], myVote: null, votes: status === 'revealed' ? { a: '5', b: '5' } : null, stats: status === 'revealed' ? stats : null, deadline: null },
}) as unknown as PublicRoomState
const revealedEvt = [{ type: 'revealed', itemId: 'i1' }] as unknown as DomainEvent[]

beforeEach(() => { vi.useFakeTimers(); fxRuntime.reset() })
afterEach(() => { vi.useRealTimers() })

test('a snapshot that is already revealed plays nothing', () => {
  fxRuntime.onState(null, mk('revealed'))
  expect(useFxStore.getState().hold).toBeNull()
  expect(useFxStore.getState().countdown).toBeNull()
})

test('voting → revealed holds cards immediately, then the events frame starts the timeline', () => {
  const v = mk('voting'); const r = mk('revealed')
  fxRuntime.onState(null, v)
  fxRuntime.onState(v, r)
  expect(useFxStore.getState().hold).not.toBeNull()
  fxRuntime.onEvents(revealedEvt, r)
  vi.advanceTimersByTime(10_000)
  expect(useFxStore.getState().hold).toBeNull()
})

test('hold is released if the events frame never arrives', () => {
  const v = mk('voting'); const r = mk('revealed')
  fxRuntime.onState(null, v)
  fxRuntime.onState(v, r)
  vi.advanceTimersByTime(1000)
  expect(useFxStore.getState().hold).toBeNull()
})

test('a new round cancels a running timeline', () => {
  const v = mk('voting'); const r = mk('revealed')
  fxRuntime.onState(null, v)
  fxRuntime.onState(v, r)
  fxRuntime.onEvents(revealedEvt, r)
  const next = mk('voting', 2)
  fxRuntime.onState(r, next)
  expect(useFxStore.getState().hold).toBeNull()
  vi.advanceTimersByTime(10_000)
  expect(useFxStore.getState().moment).toBeNull()
})

test('reactions are capped at 30 floating', () => {
  fxRuntime.addReactions([{ emoji: '👏', count: 50 }])
  expect(useFxStore.getState().floating).toHaveLength(30)
  vi.advanceTimersByTime(REACTION_FLOAT_MS)
  expect(useFxStore.getState().floating).toHaveLength(0)
})

test('a thrown item flies, then lands as a hit that clears itself', () => {
  fxRuntime.addThrow({ from: 'a', target: 'b', kind: 'tomato' })
  expect(useFxStore.getState().flights).toHaveLength(1)
  expect(useFxStore.getState().hits.b).toBeUndefined()
  vi.advanceTimersByTime(FLIGHT_MS)
  expect(useFxStore.getState().flights).toHaveLength(0)
  expect(useFxStore.getState().hits.b).toMatchObject([{ kind: 'tomato' }])
  vi.advanceTimersByTime(HIT_MS)
  expect(useFxStore.getState().hits.b).toBeUndefined()
})

test('hits on the same seat stack, each leaving after its own HIT_MS', () => {
  fxRuntime.addThrow({ from: 'a', target: 'b', kind: 'tomato' })
  vi.advanceTimersByTime(500)
  fxRuntime.addThrow({ from: 'c', target: 'b', kind: 'bomb' })
  vi.advanceTimersByTime(FLIGHT_MS)
  expect(useFxStore.getState().hits.b?.map(h => h.kind)).toEqual(['tomato', 'bomb'])
  vi.advanceTimersByTime(HIT_MS - 500)
  expect(useFxStore.getState().hits.b?.map(h => h.kind)).toEqual(['bomb'])
  vi.advanceTimersByTime(500)
  expect(useFxStore.getState().hits.b).toBeUndefined()
})

test('a pelted seat keeps only the newest MAX_HITS_PER_SEAT hits', () => {
  for (let i = 0; i < MAX_HITS_PER_SEAT + 3; i++) fxRuntime.addThrow({ from: 'a', target: 'b', kind: 'poop' })
  vi.advanceTimersByTime(FLIGHT_MS)
  expect(useFxStore.getState().hits.b).toHaveLength(MAX_HITS_PER_SEAT)
})

test('nudge kinds still go through the paper plane path', () => {
  fxRuntime.addThrow({ from: 'a', target: 'b', kind: 'plane' })
  expect(useFxStore.getState().planes).toHaveLength(1)
  expect(useFxStore.getState().flights).toHaveLength(0)
})

test('minimal level skips the flight and lands at once', () => {
  localStorage.setItem('pp.fx', JSON.stringify({ level: 'minimal', sound: true, followReducedMotion: true }))
  try {
    fxRuntime.addThrow({ from: 'a', target: 'b', kind: 'roll' })
    expect(useFxStore.getState().flights).toHaveLength(0)
    expect(useFxStore.getState().hits.b).toMatchObject([{ kind: 'roll', level: 'minimal' }])
  } finally { localStorage.removeItem('pp.fx') }
})

test('bomb: the blast moment ends by itself; a ☕ round yawns then stops', () => {
  const big = { ...stats, spreadSteps: 4, needsDiscussion: true, consensusLevel: 'low', distribution: [...stats.distribution, { card: { id: 'coffee', label: 'coffee', numeric: null, special: true }, count: 1 }] }
  const v = mk('voting'); const r = mk('revealed')
  r.current!.stats = big as never
  fxRuntime.onState(null, v); fxRuntime.onState(v, r); fxRuntime.onEvents(revealedEvt, r)
  vi.advanceTimersByTime(3000)
  expect(useFxStore.getState().yawn).toBe(true)
  vi.advanceTimersByTime(BOMB_MS + YAWN_MS)
  expect(useFxStore.getState().moment).toBeNull()
  expect(useFxStore.getState().yawn).toBe(false)
})
