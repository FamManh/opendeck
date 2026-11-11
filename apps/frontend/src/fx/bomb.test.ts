import { expect, test } from 'vitest'
import { PRESET_SCALES, computeRoundStats, createRoom, type PublicRoomState } from '@/domain'
import { BOMB_STEPS, bombOf } from './bomb'

const fib = PRESET_SCALES.fibonacci // 1 2 3 5 8 13 21
function revealed(votes: Record<string, string>, reasons: Record<string, string> = {}): PublicRoomState {
  const base = createRoom({ id: 'r', now: 0, scale: fib, owner: { id: 'H', userId: 'u', name: 'H', avatar: 'cat', role: 'voter' } })
  const participants = Object.fromEntries(Object.keys(votes).map(id => [id, { id, userId: null, name: id, avatar: 'cat', role: 'voter', joinedAt: 0, online: true, offlineSince: null }]))
  return {
    ...base, participants,
    current: { itemId: 'i', number: 1, status: 'revealed', voted: Object.keys(votes), myVote: null, votes, reasons, stats: computeRoundStats(fib, Object.values(votes)), deadline: null },
  } as unknown as PublicRoomState
}

test(`no bomb under ${BOMB_STEPS} steps (that is the plot twist)`, () => {
  expect(bombOf(revealed({ a: '2', b: '5' }))).toBeNull() // 2 → 5 = 2 steps
})

test('lowest and highest voters are targets; the middle is not', () => {
  const b = bombOf(revealed({ a: '1', b: '5', c: '8', d: '1' }))! // 1 → 8 = 4 steps
  expect(b.steps).toBe(4)
  expect(b.targets.sort()).toEqual(['a', 'c', 'd'])
  expect(b.waiting.sort()).toEqual(['a', 'c', 'd'])
})

test('writing a reason clears you from the waiting list; blank reasons do not count', () => {
  const b = bombOf(revealed({ a: '1', c: '13' }, { a: 'small change', c: '   ' }))!
  expect(b.waiting).toEqual(['c'])
})

test('nothing while still voting', () => {
  const s = revealed({ a: '1', c: '13' })
  expect(bombOf({ ...s, current: { ...s.current!, status: 'voting' } })).toBeNull()
})
