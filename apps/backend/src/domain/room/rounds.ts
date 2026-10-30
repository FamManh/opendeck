import { deckOf } from '../deck'
import { DomainError } from '../errors'
import { computeRoundStats } from '../stats'
import { requireHost, requireParticipant } from './guards'
import { REASON_MAX, TIMER_MAX_SEC, type DomainEvent, type NewItem, type Round, type RoomState } from './types'

type Ev = DomainEvent[]

export function addItems(s: RoomState, pid: string, items: NewItem[], ev: Ev): void {
  requireHost(s, pid)
  const ids: string[] = []
  for (const it of items) {
    const title = it.title.trim()
    if (!title) throw new DomainError('ITEM_TITLE_EMPTY')
    s.itemSeq += 1
    const id = `i${s.itemSeq}`
    s.items.push({ id, source: 'manual', externalRef: it.externalRef ?? null, title, description: (it.description ?? '').trim(), status: 'pending' })
    ids.push(id)
  }
  ev.push({ type: 'itemsAdded', ids })
}

const roundsOf = (s: RoomState, itemId: string) => s.history.filter(r => r.itemId === itemId).length

function openRound(s: RoomState, itemId: string, timerSec: number | null, now: number, ev: Ev): void {
  const number = roundsOf(s, itemId) + 1
  s.current = { itemId, number, status: 'voting', votes: {}, reasons: {}, deadline: timerSec === null ? null : now + timerSec * 1000, stats: null }
  ev.push({ type: 'roundStarted', itemId, number })
}

export function startRound(s: RoomState, pid: string, itemId: string, timerSec: number | undefined, now: number, ev: Ev): void {
  requireHost(s, pid)
  if (!s.items.some(i => i.id === itemId)) throw new DomainError('UNKNOWN_ITEM')
  const timer = timerSec ?? s.revealRule.timerSec
  if (timer !== null && !(Number.isInteger(timer) && timer > 0 && timer <= TIMER_MAX_SEC)) throw new DomainError('TIMER_INVALID')
  // An unrevealed round is discarded rather than archived, so history never stores secret votes.
  if (s.current?.status === 'revealed') s.history.push(s.current)
  openRound(s, itemId, timer, now, ev)
}

function votingRound(s: RoomState): Round {
  const r = s.current
  if (!r || r.status !== 'voting') throw new DomainError('ROUND_NOT_VOTING')
  return r
}

function revealedRound(s: RoomState): Round {
  const r = s.current
  if (!r || r.status !== 'revealed') throw new DomainError('ROUND_NOT_REVEALED')
  return r
}

function reveal(s: RoomState, r: Round, auto: boolean, ev: Ev): void {
  r.status = 'revealed'
  r.deadline = null
  const stats = computeRoundStats(s.scale, Object.values(r.votes))
  r.stats = stats
  ev.push({ type: 'revealed', itemId: r.itemId, number: r.number, auto })
  if (stats.needsDiscussion) {
    const pidsWith = (cardId: string | undefined) => Object.entries(r.votes).filter(([, c]) => c === cardId).map(([p]) => p)
    ev.push({ type: 'discussionNeeded', lowPids: pidsWith(stats.min?.id), highPids: pidsWith(stats.max?.id) })
  }
}

export function vote(s: RoomState, pid: string, cardId: string | null, ev: Ev): void {
  const p = requireParticipant(s, pid)
  const r = votingRound(s)
  if (p.role !== 'voter') throw new DomainError('NOT_VOTER')
  if (cardId === null) {
    if (r.votes[pid] !== undefined) {
      delete r.votes[pid]
      ev.push({ type: 'unvoted', pid })
    }
    return
  }
  if (!deckOf(s.scale, s.enabledSpecials).some(c => c.id === cardId)) throw new DomainError('CARD_NOT_IN_DECK')
  r.votes[pid] = cardId
  ev.push({ type: 'voted', pid })
  if (s.revealRule.onAllVoted) {
    const voters = Object.values(s.participants).filter(x => x.role === 'voter' && x.online)
    if (voters.length > 0 && voters.every(x => r.votes[x.id] !== undefined)) reveal(s, r, true, ev)
  }
}

export function revealCmd(s: RoomState, pid: string, ev: Ev): void {
  requireHost(s, pid)
  reveal(s, votingRound(s), false, ev)
}

export function revote(s: RoomState, pid: string, now: number, ev: Ev): void {
  requireHost(s, pid)
  const r = revealedRound(s)
  s.history.push(r)
  openRound(s, r.itemId, s.revealRule.timerSec, now, ev)
}

export function reason(s: RoomState, pid: string, text: string): void {
  const p = requireParticipant(s, pid)
  const r = s.current
  if (!r) throw new DomainError('NO_ROUND')
  if (p.role !== 'voter') throw new DomainError('NOT_VOTER')
  const t = text.trim()
  if (t.length > REASON_MAX) throw new DomainError('REASON_TOO_LONG')
  if (t) r.reasons[pid] = t
  else delete r.reasons[pid]
}

export function finalize(s: RoomState, pid: string, value: string, note: string | undefined, now: number, ev: Ev): void {
  requireHost(s, pid)
  const r = revealedRound(s)
  const v = value.trim()
  if (!v) throw new DomainError('FINAL_EMPTY')
  s.history.push(r)
  s.current = null
  const item = s.items.find(i => i.id === r.itemId)
  if (item) item.status = 'done'
  const outcome = { itemId: r.itemId, value: v, note: (note ?? '').trim(), decidedBy: pid, decidedAt: now, rounds: roundsOf(s, r.itemId) }
  s.outcomes = [...s.outcomes.filter(o => o.itemId !== r.itemId), outcome]
  ev.push({ type: 'finalized', itemId: r.itemId, value: v })
}

export function tickRound(s: RoomState, now: number, ev: Ev): void {
  const r = s.current
  if (r?.status === 'voting' && r.deadline !== null && now >= r.deadline) reveal(s, r, true, ev)
}
