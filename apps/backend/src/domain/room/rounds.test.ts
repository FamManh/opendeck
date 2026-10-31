import { applyCommand } from './apply'
import { T0, room, run, user } from './testing'
import type { CreateRoomOptions } from './types'

type Opts = Partial<Pick<CreateRoomOptions, 'revealRule' | 'enabledSpecials'>>
/** H (host, voter), A, B voters; item i1 'Login' in round 1 voting. */
const voting = (opts: Opts = {}, now = T0) => run(room(opts), [
  { type: 'join', participant: user('A') },
  { type: 'join', participant: user('B') },
  { type: 'addItems', pid: 'H', items: [{ title: 'Login', externalRef: 'PROJ-1' }, { title: 'Logout', description: ' d ' }] },
  { type: 'startRound', pid: 'H', itemId: 'i1' },
], now).state

test('addItems assigns sequential ids, trims, rejects empty title', () => {
  const s = voting()
  expect(s.items.map(i => [i.id, i.externalRef, i.description, i.status])).toEqual([['i1', 'PROJ-1', '', 'pending'], ['i2', null, 'd', 'pending']])
  expect(() => applyCommand(s, { type: 'addItems', pid: 'H', items: [{ title: '  ' }] }, T0)).toThrow('ITEM_TITLE_EMPTY')
})
test('startRound: unknown item, invalid timer', () => {
  const s = voting()
  expect(() => applyCommand(s, { type: 'startRound', pid: 'H', itemId: 'nope' }, T0)).toThrow('UNKNOWN_ITEM')
  expect(() => applyCommand(s, { type: 'startRound', pid: 'H', itemId: 'i1', timerSec: 0 }, T0)).toThrow('TIMER_INVALID')
})
test('vote events never carry the card value; null withdraws', () => {
  const r = run(voting(), [{ type: 'vote', pid: 'A', cardId: '13' }, { type: 'vote', pid: 'A', cardId: null }])
  expect(JSON.stringify(r.events)).not.toContain('13')
  expect(r.events).toEqual([{ type: 'voted', pid: 'A' }, { type: 'unvoted', pid: 'A' }])
  expect(r.state.current!.votes).toEqual({})
})
test('vote after reveal throws ROUND_NOT_VOTING and stats unchanged', () => {
  const s = run(voting(), [{ type: 'vote', pid: 'A', cardId: '5' }, { type: 'reveal', pid: 'H' }]).state
  expect(() => applyCommand(s, { type: 'vote', pid: 'B', cardId: '8' }, T0)).toThrow('ROUND_NOT_VOTING')
  expect(s.current!.stats!.total).toBe(1)
})
test('observer vote throws NOT_VOTER', () => {
  const s = run(voting(), [{ type: 'join', participant: user('O', 'observer') }]).state
  expect(() => applyCommand(s, { type: 'vote', pid: 'O', cardId: '5' }, T0)).toThrow('NOT_VOTER')
})
test('disabled special card or unknown card throws CARD_NOT_IN_DECK', () => {
  const s = voting({ enabledSpecials: ['coffee'] })
  expect(s.enabledSpecials).toEqual(['coffee'])
  expect(() => applyCommand(s, { type: 'vote', pid: 'A', cardId: 'bomb' }, T0)).toThrow('CARD_NOT_IN_DECK')
  expect(() => applyCommand(s, { type: 'vote', pid: 'A', cardId: '99' }, T0)).toThrow('CARD_NOT_IN_DECK')
  expect(applyCommand(s, { type: 'vote', pid: 'A', cardId: 'coffee' }, T0).state.current!.votes.A).toBe('coffee')
})
test('onAllVoted: last online voter votes → auto reveal (offline voter not counted)', () => {
  const s = run(voting({ revealRule: { onAllVoted: true, timerSec: null } }), [
    { type: 'disconnect', pid: 'B' },
    { type: 'vote', pid: 'H', cardId: '3' },
  ]).state
  expect(s.current!.status).toBe('voting')
  const r = run(s, [{ type: 'vote', pid: 'A', cardId: '5' }])
  expect(r.state.current!.status).toBe('revealed')
  expect(r.events).toContainEqual({ type: 'revealed', itemId: 'i1', number: 1, auto: true })
})
test('timer: tick before deadline does nothing, at deadline reveals', () => {
  const s = voting({ revealRule: { onAllVoted: false, timerSec: 30 } })
  expect(s.current!.deadline).toBe(T0 + 30_000)
  expect(run(s, [{ type: 'tick' }], T0 + 29_999).state.current!.status).toBe('voting')
  const r = run(s, [{ type: 'tick' }], T0 + 30_000)
  expect(r.state.current).toMatchObject({ status: 'revealed', deadline: null })
  expect(r.events).toContainEqual({ type: 'revealed', itemId: 'i1', number: 1, auto: true })
})
test('startRound timerSec overrides room default', () => {
  const s = run(voting(), [{ type: 'startRound', pid: 'H', itemId: 'i2', timerSec: 10 }]).state
  expect(s.current).toMatchObject({ itemId: 'i2', number: 1, deadline: T0 + 10_000 })
})
test('startRound while voting discards the unrevealed round', () => {
  const s = run(voting(), [{ type: 'vote', pid: 'A', cardId: '5' }, { type: 'startRound', pid: 'H', itemId: 'i1' }]).state
  expect(s.history).toEqual([])
  expect(s.current).toMatchObject({ number: 1, votes: {} })
})
test('reveal with 3/13 emits discussionNeeded with lowPids/highPids', () => {
  const r = run(voting(), [
    { type: 'vote', pid: 'H', cardId: '3' },
    { type: 'vote', pid: 'A', cardId: '13' },
    { type: 'vote', pid: 'B', cardId: '5' },
    { type: 'reveal', pid: 'H' },
  ])
  expect(r.state.current!.stats!.needsDiscussion).toBe(true)
  expect(r.events).toContainEqual({ type: 'revealed', itemId: 'i1', number: 1, auto: false })
  expect(r.events).toContainEqual({ type: 'discussionNeeded', lowPids: ['H'], highPids: ['A'] })
})
test('revote keeps history: history.length===1, current.number===2, votes empty', () => {
  const s = run(voting(), [{ type: 'vote', pid: 'A', cardId: '5' }, { type: 'reveal', pid: 'H' }, { type: 'revote', pid: 'H' }]).state
  expect(s.history).toHaveLength(1)
  expect(s.current).toMatchObject({ itemId: 'i1', number: 2, status: 'voting', votes: {}, stats: null })
  expect(() => applyCommand(s, { type: 'revote', pid: 'H' }, T0)).toThrow('ROUND_NOT_REVEALED')
})
test('finalize with value differing from stats is allowed; item done; outcome.rounds===2', () => {
  const r = run(voting(), [
    { type: 'vote', pid: 'A', cardId: '3' }, { type: 'reveal', pid: 'H' }, { type: 'revote', pid: 'H' },
    { type: 'vote', pid: 'A', cardId: '5' }, { type: 'reveal', pid: 'H' },
    { type: 'finalize', pid: 'H', value: ' 4 ', note: ' agreed ' },
  ], T0 + 9)
  expect(r.state.items[0]!.status).toBe('done')
  expect(r.state.outcomes).toEqual([{ itemId: 'i1', value: '4', note: 'agreed', decidedBy: 'H', decidedAt: T0 + 9, rounds: 2 }])
  expect(r.state.current).toBeNull()
  expect(r.state.history).toHaveLength(2)
  expect(r.events).toContainEqual({ type: 'finalized', itemId: 'i1', value: '4' })
})
test('finalize guards: before reveal ROUND_NOT_REVEALED, blank FINAL_EMPTY', () => {
  const s = voting()
  expect(() => applyCommand(s, { type: 'finalize', pid: 'H', value: '5' }, T0)).toThrow('ROUND_NOT_REVEALED')
  const revealed = run(s, [{ type: 'vote', pid: 'A', cardId: '3' }, { type: 'reveal', pid: 'H' }]).state
  expect(() => applyCommand(revealed, { type: 'finalize', pid: 'H', value: '  ' }, T0)).toThrow('FINAL_EMPTY')
})
test('re-finalizing an item replaces its outcome', () => {
  let s = run(voting(), [{ type: 'vote', pid: 'A', cardId: '3' }, { type: 'reveal', pid: 'H' }, { type: 'finalize', pid: 'H', value: '3' }]).state
  s = run(s, [{ type: 'startRound', pid: 'H', itemId: 'i1' }, { type: 'vote', pid: 'A', cardId: '8' }, { type: 'reveal', pid: 'H' }, { type: 'finalize', pid: 'H', value: '8' }]).state
  expect(s.outcomes).toEqual([expect.objectContaining({ itemId: 'i1', value: '8', rounds: 2 })])
})
test('reason: trimmed, empty clears, >200 chars REASON_TOO_LONG, observer NOT_VOTER, no round NO_ROUND', () => {
  const s = run(voting(), [{ type: 'join', participant: user('O', 'observer') }, { type: 'reason', pid: 'A', text: '  big  ' }]).state
  expect(s.current!.reasons).toEqual({ A: 'big' })
  expect(applyCommand(s, { type: 'reason', pid: 'A', text: ' ' }, T0).state.current!.reasons).toEqual({})
  expect(() => applyCommand(s, { type: 'reason', pid: 'A', text: 'x'.repeat(201) }, T0)).toThrow('REASON_TOO_LONG')
  expect(() => applyCommand(s, { type: 'reason', pid: 'O', text: 'hi' }, T0)).toThrow('NOT_VOTER')
  expect(() => applyCommand(room(), { type: 'reason', pid: 'H', text: 'hi' }, T0)).toThrow('NO_ROUND')
})

test('reveal with no votes is refused for the host; the timer still reveals and the empty round stays out of history', () => {
  expect(() => applyCommand(voting(), { type: 'reveal', pid: 'H' }, T0)).toThrow('NO_VOTES')
  const timed = voting({ revealRule: { onAllVoted: false, timerSec: 30 } })
  const expired = run(timed, [{ type: 'tick' }], T0 + 30_000).state
  expect(expired.current!.status).toBe('revealed')
  const again = run(expired, [{ type: 'revote', pid: 'H' }], T0 + 30_000).state
  expect(again.history).toEqual([])
  expect(again.current!.number).toBe(1)
})

test('setRevealRule is host-only, validates the timer and applies to the next round', () => {
  const s = voting()
  expect(() => applyCommand(s, { type: 'setRevealRule', pid: 'A', onAllVoted: true }, T0)).toThrow('NOT_HOST')
  expect(() => applyCommand(s, { type: 'setRevealRule', pid: 'H', timerSec: 0 }, T0)).toThrow('TIMER_INVALID')
  const next = run(s, [{ type: 'setRevealRule', pid: 'H', onAllVoted: true, timerSec: 60 }]).state
  expect(next.revealRule).toEqual({ onAllVoted: true, timerSec: 60 })
  expect(next.current!.deadline).toBeNull()
  expect(run(next, [{ type: 'startRound', pid: 'H', itemId: 'i2' }]).state.current!.deadline).toBe(T0 + 60_000)
  expect(run(next, [{ type: 'setRevealRule', pid: 'H', timerSec: null }]).state.revealRule.timerSec).toBeNull()
})

test('editItem changes pending items only', () => {
  const s = voting()
  const r = run(s, [{ type: 'editItem', pid: 'H', itemId: 'i2', title: ' New ', description: ' d2 ', externalRef: ' ' }])
  expect(r.state.items[1]).toMatchObject({ title: 'New', description: 'd2', externalRef: null })
  expect(r.events).toEqual([{ type: 'itemsChanged', ids: ['i2'] }])
  expect(() => applyCommand(s, { type: 'editItem', pid: 'H', itemId: 'i2', title: ' ' }, T0)).toThrow('ITEM_TITLE_EMPTY')
  const done = run(s, [{ type: 'vote', pid: 'A', cardId: '3' }, { type: 'reveal', pid: 'H' }, { type: 'finalize', pid: 'H', value: '3' }]).state
  expect(() => applyCommand(done, { type: 'editItem', pid: 'H', itemId: 'i1', title: 'x' }, T0)).toThrow('ITEM_NOT_EDITABLE')
})

test('deleteItem refuses a task that has rounds', () => {
  const s = voting()
  expect(() => applyCommand(s, { type: 'deleteItem', pid: 'H', itemId: 'i1' }, T0)).toThrow('ITEM_HAS_ROUNDS')
  const r = run(s, [{ type: 'deleteItem', pid: 'H', itemId: 'i2' }])
  expect(r.state.items.map(i => i.id)).toEqual(['i1'])
  expect(r.events).toEqual([{ type: 'itemDeleted', id: 'i2' }])
  const moved = run(s, [{ type: 'vote', pid: 'A', cardId: '3' }, { type: 'reveal', pid: 'H' }, { type: 'revote', pid: 'H' }, { type: 'startRound', pid: 'H', itemId: 'i2' }]).state
  expect(() => applyCommand(moved, { type: 'deleteItem', pid: 'H', itemId: 'i1' }, T0)).toThrow('ITEM_HAS_ROUNDS')
})

test('startSession clears the session, drops offline seats and keeps counting item ids', () => {
  const s = run(voting(), [
    { type: 'vote', pid: 'A', cardId: '3' }, { type: 'reveal', pid: 'H' }, { type: 'finalize', pid: 'H', value: '3' },
    { type: 'disconnect', pid: 'B' },
  ]).state
  expect(() => applyCommand(s, { type: 'startSession', pid: 'A' }, T0)).toThrow('NOT_HOST')
  const r = run(s, [{ type: 'startSession', pid: 'H' }, { type: 'addItems', pid: 'H', items: [{ title: 'Next sprint' }] }])
  expect(r.state.items.map(i => i.id)).toEqual(['i3'])
  expect(r.state.history).toEqual([])
  expect(r.state.outcomes).toEqual([])
  expect(Object.keys(r.state.participants).sort()).toEqual(['A', 'H'])
  expect(r.state.banned).toEqual([])
})

test('questions and notes: anyone in the room, tied to the current task', () => {
  const s = run(voting(), [{ type: 'join', participant: user('O', 'observer') }]).state
  const r = run(s, [{ type: 'ask', pid: 'O', text: ' Gồm trả góp không? ' }, { type: 'addNote', pid: 'A', text: 'Cần sandbox' }], T0 + 5)
  expect(r.state.questions).toEqual([{ id: 'q1', itemId: 'i1', pid: 'O', text: 'Gồm trả góp không?', at: T0 + 5, answered: false }])
  expect(r.state.notes[0]).toMatchObject({ id: 'n2', itemId: 'i1', pid: 'A', text: 'Cần sandbox' })
  expect(() => applyCommand(s, { type: 'ask', pid: 'O', text: '  ' }, T0)).toThrow('QNA_EMPTY')
  expect(() => applyCommand(s, { type: 'ask', pid: 'O', text: 'x'.repeat(201) }, T0)).toThrow('QNA_TOO_LONG')
  expect(() => applyCommand(r.state, { type: 'answerQuestion', pid: 'B', questionId: 'q1', answered: true }, T0)).toThrow('NOT_HOST')
  expect(run(r.state, [{ type: 'answerQuestion', pid: 'O', questionId: 'q1', answered: true }]).state.questions[0]!.answered).toBe(true)
  expect(run(r.state, [{ type: 'answerQuestion', pid: 'H', questionId: 'q1', answered: true }]).state.questions[0]!.answered).toBe(true)
  const idle = run(room(), [{ type: 'addItems', pid: 'H', items: [{ title: 'x' }] }]).state
  expect(() => applyCommand(idle, { type: 'ask', pid: 'H', text: 'q' }, T0)).toThrow('NO_ROUND')
})

test('questions per task are capped', () => {
  let s = voting()
  for (let i = 0; i < 100; i++) s = run(s, [{ type: 'ask', pid: 'A', text: `q${i}` }]).state
  expect(() => applyCommand(s, { type: 'ask', pid: 'A', text: 'one more' }, T0)).toThrow('QNA_LIMIT')
})
