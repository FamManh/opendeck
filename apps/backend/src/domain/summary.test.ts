import { room, run, user } from './room/testing'
import { buildSummary, toCsv } from './summary'

const played = run(room(), [
  { type: 'join', participant: user('A') },
  { type: 'join', participant: user('B') },
  { type: 'addItems', pid: 'H', items: [{ title: 'Login', externalRef: 'PROJ-1' }, { title: 'Logout' }] },
  { type: 'startRound', pid: 'H', itemId: 'i1' },
  { type: 'vote', pid: 'H', cardId: 'coffee' }, { type: 'vote', pid: 'A', cardId: '13' }, { type: 'vote', pid: 'B', cardId: '3' },
  { type: 'reason', pid: 'A', text: 'too big' },
  { type: 'reveal', pid: 'H' }, { type: 'revote', pid: 'H' },
  { type: 'vote', pid: 'H', cardId: 'coffee' }, { type: 'vote', pid: 'A', cardId: '5' }, { type: 'vote', pid: 'B', cardId: 'bug' },
  { type: 'reveal', pid: 'H' },
  { type: 'finalize', pid: 'H', value: '5', note: 'split later' },
]).state

test('summary rows: outcome, rounds, notes without names, specials in canonical order', () => {
  const { rows, totals } = buildSummary(played)
  expect(rows).toEqual([
    { key: 'PROJ-1', title: 'Login', final: '5', rounds: 2, notes: 'split later\ntoo big', specialCards: ['coffee', 'bug'] },
    { key: null, title: 'Logout', final: '', rounds: 0, notes: '', specialCards: [] },
  ])
  expect(totals).toEqual({ items: 2, finalized: 1, rounds: 2, mostUsedSpecial: 'coffee' })
})
test('unrevealed current round is ignored by summary', () => {
  const s = run(played, [{ type: 'startRound', pid: 'H', itemId: 'i2' }, { type: 'vote', pid: 'A', cardId: 'bomb' }]).state
  expect(buildSummary(s).rows[1]).toMatchObject({ rounds: 0, specialCards: [] })
})
test('csv escapes quotes, commas, newlines and starts with BOM', () => {
  expect(toCsv([{ key: null, title: 'a,"b"\nc', final: '5', rounds: 1, notes: '', specialCards: [] }]))
    .toBe('\uFEFFkey,title,final,rounds,notes,special_cards\r\n,"a,""b""\nc",5,1,,\r\n')
})
test('csv joins special cards with ";"', () => {
  expect(toCsv([{ key: 'K-1', title: 't', final: '', rounds: 2, notes: '', specialCards: ['coffee', 'bug'] }]))
    .toContain('\r\nK-1,t,,2,,coffee;bug\r\n')
})
test.each(['=cmd|calc', '+SUM(A1)', '-2+3', '@x', '\tx'])('csv neutralises formula injection: %j', title => {
  const line = toCsv([{ key: null, title, final: '', rounds: 0, notes: '', specialCards: [] }]).split('\r\n')[1]!
  expect(line.startsWith(`,'${title}`) || line.startsWith(`,"'${title}`)).toBe(true)
})
