import { toPublicState } from './redact'
import { guest, room, run, user } from './room/testing'

const voting = run(room({ access: { requireApproval: true } }), [
  { type: 'setAccess', pid: 'H', requireApproval: false },
  { type: 'join', participant: user('A') },
  { type: 'join', participant: user('B') },
  { type: 'setAccess', pid: 'H', requireApproval: true },
  { type: 'join', participant: guest('G') },        // waits in pending
  { type: 'addItems', pid: 'H', items: [{ title: 'Login' }] },
  { type: 'startRound', pid: 'H', itemId: 'i1' },
  { type: 'vote', pid: 'A', cardId: '13' },
  { type: 'reason', pid: 'A', text: 'too big' },
  { type: 'vote', pid: 'B', cardId: '3' },
]).state

test('voting: public state for B never contains A\'s card or reason', () => {
  const pub = toPublicState(voting, 'B')
  expect(JSON.stringify(pub.current)).not.toContain('13')
  expect(JSON.stringify(pub)).not.toMatch(/"A":"13"/)
  expect(JSON.stringify(pub)).not.toContain('too big')
  expect(pub.current!.voted).toEqual(['A', 'B'])
  expect(pub.current!.votes).toBeNull()
  expect(pub.current!.myVote).toBe('3')
})
test('viewer sees own vote and own reason only', () => {
  const pub = toPublicState(voting, 'A')
  expect(pub.current!.myVote).toBe('13')
  expect(pub.current!.reasons).toEqual({ A: 'too big' })
})
test('revealed: all votes and reasons visible', () => {
  const s = run(voting, [{ type: 'reveal', pid: 'H' }]).state
  const pub = toPublicState(s, 'B')
  expect(pub.current!.votes).toEqual({ A: '13', B: '3' })
  expect(pub.current!.reasons).toEqual({ A: 'too big' })
})
test('pending and banned are visible to host only', () => {
  const s = run(voting, [{ type: 'join', participant: guest('K') }, { type: 'kick', pid: 'H', target: 'K' }]).state
  expect(Object.keys(toPublicState(s, 'H').pending)).toEqual(['G'])
  expect(toPublicState(s, 'H').banned).toEqual(['K'])
  expect(toPublicState(s, 'A').pending).toEqual({})
  expect(toPublicState(s, 'A').banned).toEqual([])
})
test('does not mutate or alias the source state', () => {
  const snapshot = structuredClone(voting)
  const pub = toPublicState(voting, 'H')
  pub.participants.A!.name = 'changed'
  expect(voting).toEqual(snapshot)
})
