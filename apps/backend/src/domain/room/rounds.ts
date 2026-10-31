import { deckOf } from '../deck'
import { DomainError } from '../errors'
import { computeRoundStats } from '../stats'
import { requireHost, requireParticipant } from './guards'
import { QNA_PER_ITEM_MAX, QNA_TEXT_MAX, REASON_MAX, TIMER_MAX_SEC, type DomainEvent, type NewItem, type Round, type RoomState } from './types'

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

export function editItem(s: RoomState, pid: string, patch: { itemId: string; title?: string; description?: string; externalRef?: string | null }, ev: Ev): void {
  requireHost(s, pid)
  const item = s.items.find(i => i.id === patch.itemId)
  if (!item) throw new DomainError('UNKNOWN_ITEM')
  if (item.status !== 'pending') throw new DomainError('ITEM_NOT_EDITABLE')
  if (patch.title !== undefined) {
    const title = patch.title.trim()
    if (!title) throw new DomainError('ITEM_TITLE_EMPTY')
    item.title = title
  }
  if (patch.description !== undefined) item.description = patch.description.trim()
  if (patch.externalRef !== undefined) item.externalRef = patch.externalRef?.trim() || null
  ev.push({ type: 'itemsChanged', ids: [item.id] })
}

export function deleteItem(s: RoomState, pid: string, itemId: string, ev: Ev): void {
  requireHost(s, pid)
  if (!s.items.some(i => i.id === itemId)) throw new DomainError('UNKNOWN_ITEM')
  if (s.current?.itemId === itemId || roundsOf(s, itemId) > 0) throw new DomainError('ITEM_HAS_ROUNDS')
  s.items = s.items.filter(i => i.id !== itemId)
  s.questions = s.questions.filter(q => q.itemId !== itemId)
  s.notes = s.notes.filter(n => n.itemId !== itemId)
  ev.push({ type: 'itemDeleted', id: itemId })
}

/** Clears the live session for the next sprint. `itemSeq` keeps counting because stored item rows are keyed by it. */
export function startSession(s: RoomState, pid: string, ev: Ev): void {
  requireHost(s, pid)
  s.items = []
  s.current = null
  s.history = []
  s.outcomes = []
  s.questions = []
  s.notes = []
  for (const p of Object.values(s.participants)) if (!p.online && p.id !== pid) delete s.participants[p.id]
  if (s.successorId && !s.participants[s.successorId]) s.successorId = null
  ev.push({ type: 'sessionStarted' })
}

/** A round nobody voted in (timer ran out) carries no information, so it stays out of the history. */
function archive(s: RoomState, r: Round): void {
  if (Object.keys(r.votes).length > 0) s.history.push(r)
}

function validTimer(timer: number | null): boolean {
  return timer === null || (Number.isInteger(timer) && timer > 0 && timer <= TIMER_MAX_SEC)
}

export function setRevealRule(s: RoomState, pid: string, patch: { onAllVoted?: boolean; timerSec?: number | null }): void {
  requireHost(s, pid)
  if (patch.onAllVoted !== undefined) s.revealRule.onAllVoted = patch.onAllVoted === true
  if (patch.timerSec !== undefined) {
    if (!validTimer(patch.timerSec)) throw new DomainError('TIMER_INVALID')
    s.revealRule.timerSec = patch.timerSec
  }
}

function openRound(s: RoomState, itemId: string, timerSec: number | null, now: number, ev: Ev): void {
  const number = roundsOf(s, itemId) + 1
  s.current = { itemId, number, status: 'voting', votes: {}, reasons: {}, deadline: timerSec === null ? null : now + timerSec * 1000, stats: null }
  ev.push({ type: 'roundStarted', itemId, number })
}

export function startRound(s: RoomState, pid: string, itemId: string, timerSec: number | undefined, now: number, ev: Ev): void {
  requireHost(s, pid)
  if (!s.items.some(i => i.id === itemId)) throw new DomainError('UNKNOWN_ITEM')
  const timer = timerSec ?? s.revealRule.timerSec
  if (!validTimer(timer)) throw new DomainError('TIMER_INVALID')
  // An unrevealed round is discarded rather than archived, so history never stores secret votes.
  if (s.current?.status === 'revealed') archive(s, s.current)
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
  const r = votingRound(s)
  if (Object.keys(r.votes).length === 0) throw new DomainError('NO_VOTES')
  reveal(s, r, false, ev)
}

export function revote(s: RoomState, pid: string, now: number, ev: Ev): void {
  requireHost(s, pid)
  const r = revealedRound(s)
  archive(s, r)
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

function qnaText(list: readonly { itemId: string }[], itemId: string, text: string): string {
  const t = text.trim()
  if (!t) throw new DomainError('QNA_EMPTY')
  if (t.length > QNA_TEXT_MAX) throw new DomainError('QNA_TOO_LONG')
  if (list.filter(x => x.itemId === itemId).length >= QNA_PER_ITEM_MAX) throw new DomainError('QNA_LIMIT')
  return t
}

function currentItemId(s: RoomState): string {
  if (!s.current) throw new DomainError('NO_ROUND')
  return s.current.itemId
}

export function ask(s: RoomState, pid: string, text: string, now: number): void {
  requireParticipant(s, pid)
  const itemId = currentItemId(s)
  const t = qnaText(s.questions, itemId, text)
  s.qnaSeq += 1
  s.questions.push({ id: `q${s.qnaSeq}`, itemId, pid, text: t, at: now, answered: false })
}

export function answerQuestion(s: RoomState, pid: string, questionId: string, answered: boolean): void {
  requireParticipant(s, pid)
  const q = s.questions.find(x => x.id === questionId)
  if (!q) throw new DomainError('UNKNOWN_QUESTION')
  if (q.pid !== pid && s.hostId !== pid) throw new DomainError('NOT_HOST')
  q.answered = answered === true
}

export function addNote(s: RoomState, pid: string, text: string, now: number): void {
  requireParticipant(s, pid)
  const itemId = currentItemId(s)
  const t = qnaText(s.notes, itemId, text)
  s.qnaSeq += 1
  s.notes.push({ id: `n${s.qnaSeq}`, itemId, pid, text: t, at: now })
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
