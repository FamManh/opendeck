import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DomainEvent, PublicRoomState } from '@/domain'
import { fxRuntime, useFxStore } from './runtime'

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
  vi.advanceTimersByTime(2000)
  expect(useFxStore.getState().floating).toHaveLength(0)
})
