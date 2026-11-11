import { applyCommand } from './apply'
import { T0, guest, room, run, user } from './testing'
import { HOST_OFFLINE_MS } from './types'

test('createRoom: owner is host, online voter; defaults', () => {
  const s = room()
  expect(s.hostId).toBe('H')
  expect(s.participants.H).toMatchObject({ online: true, role: 'voter', joinedAt: T0 })
  expect(s.access).toEqual({ locked: false, requireApproval: false })
  expect(s.revealRule).toEqual({ onAllVoted: false, timerSec: null })
  expect(s.enabledSpecials).toHaveLength(7)
})
test('applyCommand never mutates the previous state', () => {
  const s0 = run(room(), [{ type: 'join', participant: user('A') }]).state
  const snapshot = structuredClone(s0)
  applyCommand(s0, { type: 'rename', pid: 'A', name: 'Alice' }, T0)
  expect(() => applyCommand(s0, { type: 'rename', pid: 'A', name: '' }, T0)).toThrow('NAME_INVALID')
  expect(s0).toEqual(snapshot)
})
test('rejoin with same id keeps seat and vote', () => {
  const { state, events } = run(room(), [
    { type: 'join', participant: user('A') },
    { type: 'addItems', pid: 'H', items: [{ title: 'Login' }] },
    { type: 'startRound', pid: 'H', itemId: 'i1' },
    { type: 'vote', pid: 'A', cardId: '5' },
    { type: 'disconnect', pid: 'A' },
    { type: 'join', participant: user('A') },
  ])
  expect(Object.keys(state.participants)).toEqual(['H', 'A'])
  expect(state.participants.A).toMatchObject({ online: true, offlineSince: null })
  expect(state.current!.votes.A).toBe('5')
  expect(events).toContainEqual({ type: 'rejoined', pid: 'A' })
})
test('disconnect marks offline with timestamp', () => {
  const s = run(room(), [{ type: 'join', participant: user('A') }, { type: 'disconnect', pid: 'A' }], T0 + 5).state
  expect(s.participants.A).toMatchObject({ online: false, offlineSince: T0 + 5 })
})
test('voter→observer mid-round removes their vote', () => {
  const s = run(room(), [
    { type: 'join', participant: user('A') },
    { type: 'addItems', pid: 'H', items: [{ title: 'Login' }] },
    { type: 'startRound', pid: 'H', itemId: 'i1' },
    { type: 'vote', pid: 'A', cardId: '5' },
    { type: 'setRole', pid: 'A', target: 'A', role: 'observer' },
  ]).state
  expect(s.participants.A!.role).toBe('observer')
  expect(s.current!.votes.A).toBeUndefined()
})
test('only host can change someone else\'s role', () => {
  const s = run(room(), [{ type: 'join', participant: user('A') }, { type: 'join', participant: user('B') }]).state
  expect(() => applyCommand(s, { type: 'setRole', pid: 'A', target: 'B', role: 'observer' }, T0)).toThrow('NOT_HOST')
  expect(applyCommand(s, { type: 'setRole', pid: 'H', target: 'B', role: 'observer' }, T0).state.participants.B!.role).toBe('observer')
})
test('host offline 60_001ms → host goes to designated successor (registered, online)', () => {
  const s = run(room(), [
    { type: 'join', participant: user('A') },
    { type: 'join', participant: user('B') },
    { type: 'setSuccessor', pid: 'H', target: 'B' },
    { type: 'disconnect', pid: 'H' },
  ]).state
  const r = run(s, [{ type: 'tick' }], T0 + HOST_OFFLINE_MS + 1)
  expect(r.state.hostId).toBe('B')
  expect(r.state.successorId).toBeNull()
  expect(r.events).toContainEqual({ type: 'hostChanged', from: 'H', to: 'B', reason: 'timeout' })
})
test('no (online) successor → earliest-joined online registered user', () => {
  let s = run(room(), [{ type: 'join', participant: guest('G') }], T0).state
  s = run(s, [{ type: 'join', participant: user('B') }], T0 + 1).state
  s = run(s, [{ type: 'join', participant: user('A') }], T0 + 2).state
  s = run(s, [{ type: 'setSuccessor', pid: 'H', target: 'A' }, { type: 'disconnect', pid: 'A' }, { type: 'disconnect', pid: 'H' }], T0 + 10).state
  expect(run(s, [{ type: 'tick' }], T0 + 10 + HOST_OFFLINE_MS + 1).state.hostId).toBe('B')
})
test.each([HOST_OFFLINE_MS - 1, HOST_OFFLINE_MS])('host offline %ims → unchanged', ms => {
  const s = run(room(), [{ type: 'join', participant: user('A') }, { type: 'disconnect', pid: 'H' }]).state
  const r = run(s, [{ type: 'tick' }], T0 + ms)
  expect(r.state.hostId).toBe('H')
  expect(r.events).toEqual([])
})
test('only guests online → hostId null; next registered join becomes host', () => {
  let s = run(room(), [{ type: 'join', participant: guest('G') }, { type: 'disconnect', pid: 'H' }]).state
  s = run(s, [{ type: 'tick' }], T0 + HOST_OFFLINE_MS + 1).state
  expect(s.hostId).toBeNull()
  const r = run(s, [{ type: 'join', participant: user('A') }], T0 + HOST_OFFLINE_MS + 2)
  expect(r.state.hostId).toBe('A')
  expect(r.events).toContainEqual({ type: 'hostChanged', from: null, to: 'A', reason: 'claimed' })
})
test('returning old host does not reclaim host from the new one', () => {
  let s = run(room(), [{ type: 'join', participant: user('A') }, { type: 'disconnect', pid: 'H' }]).state
  s = run(s, [{ type: 'tick' }], T0 + HOST_OFFLINE_MS + 1).state
  s = run(s, [{ type: 'join', participant: user('H') }], T0 + HOST_OFFLINE_MS + 2).state
  expect(s.hostId).toBe('A')
})
test('transferHost: manual, guest target throws HOST_NEEDS_ACCOUNT', () => {
  const s = run(room(), [{ type: 'join', participant: guest('G') }, { type: 'join', participant: user('A') }]).state
  expect(() => applyCommand(s, { type: 'transferHost', pid: 'H', target: 'G' }, T0)).toThrow('HOST_NEEDS_ACCOUNT')
  expect(() => applyCommand(s, { type: 'setSuccessor', pid: 'H', target: 'G' }, T0)).toThrow('HOST_NEEDS_ACCOUNT')
  const r = applyCommand(s, { type: 'transferHost', pid: 'H', target: 'A' }, T0)
  expect(r.state.hostId).toBe('A')
  expect(r.events).toEqual([{ type: 'hostChanged', from: 'H', to: 'A', reason: 'manual' }])
})
test('non-host startRound throws NOT_HOST; stranger throws NOT_IN_ROOM', () => {
  const s = run(room(), [{ type: 'join', participant: user('A') }, { type: 'addItems', pid: 'H', items: [{ title: 'x' }] }]).state
  expect(() => applyCommand(s, { type: 'startRound', pid: 'A', itemId: 'i1' }, T0)).toThrow('NOT_HOST')
  expect(() => applyCommand(s, { type: 'vote', pid: 'Z', cardId: '1' }, T0)).toThrow('NOT_IN_ROOM')
})
test('rename trims and validates 1..40 chars', () => {
  const s = run(room(), [{ type: 'join', participant: guest('G') }]).state
  expect(applyCommand(s, { type: 'rename', pid: 'G', name: '  Mèo  ', avatar: 'fox' }, T0).state.participants.G).toMatchObject({ name: 'Mèo', avatar: 'fox' })
  expect(() => applyCommand(s, { type: 'rename', pid: 'G', name: '   ' }, T0)).toThrow('NAME_INVALID')
  expect(() => applyCommand(s, { type: 'rename', pid: 'G', name: 'x'.repeat(41) }, T0)).toThrow('NAME_INVALID')
})

describe('leave', () => {
  const base = () => run(room(), [
    { type: 'join', participant: user('U') }, { type: 'join', participant: guest('g') },
    { type: 'addItems', pid: 'H', items: [{ title: 'S' }] }, { type: 'startRound', pid: 'H', itemId: 'i1' },
    { type: 'vote', pid: 'g', cardId: '5' },
  ]).state

  test('removes the seat and its vote, without banning, so the link still works', () => {
    const r = run(base(), [{ type: 'leave', pid: 'g' }])
    expect(r.state.participants.g).toBeUndefined()
    expect(r.state.current?.votes.g).toBeUndefined()
    expect(r.state.banned).not.toContain('g')
    expect(r.events).toContainEqual({ type: 'left', pid: 'g' })
    expect(run(r.state, [{ type: 'join', participant: guest('g') }]).state.participants.g?.online).toBe(true)
  })

  test('host leaving hands host to the successor, else the earliest registered user online', () => {
    const withSuccessor = run(base(), [{ type: 'join', participant: user('V') }, { type: 'setSuccessor', pid: 'H', target: 'V' }, { type: 'leave', pid: 'H' }])
    expect(withSuccessor.state.hostId).toBe('V')
    expect(withSuccessor.state.successorId).toBeNull()
    const plain = run(base(), [{ type: 'leave', pid: 'H' }])
    expect(plain.state.hostId).toBe('U')
    expect(plain.events).toContainEqual({ type: 'hostChanged', from: 'H', to: 'U', reason: 'left' })
  })

  test('host leaving with only guests left makes the room hostless', () => {
    const r = run(base(), [{ type: 'leave', pid: 'U' }, { type: 'leave', pid: 'H' }])
    expect(r.state.hostId).toBeNull()
  })

  test('strangers cannot leave', () => {
    expect(() => run(base(), [{ type: 'leave', pid: 'zz' }])).toThrow()
  })
})
