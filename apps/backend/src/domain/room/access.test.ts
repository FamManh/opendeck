import { applyCommand } from './apply'
import { T0, guest, room, run, user } from './testing'

test('kick removes seat, vote and reason; kicked id cannot rejoin', () => {
  const r = run(room(), [
    { type: 'join', participant: guest('G') },
    { type: 'addItems', pid: 'H', items: [{ title: 'x' }] },
    { type: 'startRound', pid: 'H', itemId: 'i1' },
    { type: 'vote', pid: 'G', cardId: '3' },
    { type: 'reason', pid: 'G', text: 'easy' },
    { type: 'kick', pid: 'H', target: 'G' },
  ])
  expect(r.state.participants.G).toBeUndefined()
  expect(r.state.current!.votes).toEqual({})
  expect(r.state.current!.reasons).toEqual({})
  expect(r.state.banned).toEqual(['G'])
  expect(r.events).toContainEqual({ type: 'kicked', pid: 'G' })
  expect(() => applyCommand(r.state, { type: 'join', participant: guest('G') }, T0)).toThrow('KICKED')
})
test('kick guards: non-host NOT_HOST, self INVALID_TARGET, unknown UNKNOWN_PARTICIPANT', () => {
  const s = run(room(), [{ type: 'join', participant: user('A') }]).state
  expect(() => applyCommand(s, { type: 'kick', pid: 'A', target: 'H' }, T0)).toThrow('NOT_HOST')
  expect(() => applyCommand(s, { type: 'kick', pid: 'H', target: 'H' }, T0)).toThrow('INVALID_TARGET')
  expect(() => applyCommand(s, { type: 'kick', pid: 'H', target: 'Z' }, T0)).toThrow('UNKNOWN_PARTICIPANT')
})
test('requireApproval: newcomer waits in pending, host approves', () => {
  const r1 = run(room({ access: { requireApproval: true } }), [{ type: 'join', participant: guest('G') }], T0 + 1)
  expect(r1.state.participants.G).toBeUndefined()
  expect(r1.state.pending.G).toMatchObject({ name: 'G', requestedAt: T0 + 1 })
  expect(r1.events).toEqual([{ type: 'approvalRequested', pid: 'G', name: 'G' }])
  const r2 = run(r1.state, [{ type: 'approve', pid: 'H', target: 'G' }], T0 + 2)
  expect(r2.state.pending).toEqual({})
  expect(r2.state.participants.G).toMatchObject({ joinedAt: T0 + 2, online: true })
  expect(r2.events).toContainEqual({ type: 'joined', pid: 'G' })
})
test('requireApproval: reject removes request; pending disconnect drops request', () => {
  const s = run(room({ access: { requireApproval: true } }), [{ type: 'join', participant: guest('G') }, { type: 'join', participant: guest('K') }]).state
  const r = run(s, [{ type: 'reject', pid: 'H', target: 'G' }, { type: 'disconnect', pid: 'K' }])
  expect(r.state.pending).toEqual({})
  expect(r.events).toContainEqual({ type: 'rejected', pid: 'G' })
  expect(() => applyCommand(s, { type: 'approve', pid: 'G', target: 'K' }, T0)).toThrow('NOT_IN_ROOM')
})
test('turning requireApproval off admits everyone pending in request order', () => {
  let s = run(room({ access: { requireApproval: true } }), [{ type: 'join', participant: guest('G') }], T0 + 1).state
  s = run(s, [{ type: 'join', participant: guest('K') }], T0 + 2).state
  const r = run(s, [{ type: 'setAccess', pid: 'H', requireApproval: false }], T0 + 3)
  expect(Object.keys(r.state.participants)).toEqual(['H', 'G', 'K'])
  expect(r.events).toEqual([
    { type: 'joined', pid: 'G' }, { type: 'joined', pid: 'K' },
    { type: 'accessChanged', locked: false, requireApproval: false },
  ])
})
test('locked room: newcomers rejected, existing seats can come back', () => {
  const s = run(room(), [
    { type: 'join', participant: user('A') },
    { type: 'setAccess', pid: 'H', locked: true },
    { type: 'disconnect', pid: 'A' },
  ]).state
  expect(() => applyCommand(s, { type: 'join', participant: guest('G') }, T0)).toThrow('ROOM_LOCKED')
  expect(applyCommand(s, { type: 'join', participant: user('A') }, T0).state.participants.A!.online).toBe(true)
})
test('owner bypasses lock and approval even on a fresh participant id', () => {
  const s = run(room({ access: { locked: true, requireApproval: true } }), [])
    .state
  const ownerNewTab = { id: 'H2', userId: 'user-H', name: 'H', avatar: 'cat', role: 'voter' as const }
  expect(applyCommand(s, { type: 'join', participant: ownerNewTab }, T0).state.participants.H2).toBeDefined()
})
