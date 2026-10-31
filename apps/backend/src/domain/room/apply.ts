import { SPECIAL_IDS, deckOf } from '../deck'
import * as P from './participants'
import * as R from './rounds'
import type { Command, CommandResult, CreateRoomOptions, DomainEvent, RoomState } from './types'

export function createRoom(o: CreateRoomOptions): RoomState {
  const requested = o.enabledSpecials ?? SPECIAL_IDS
  deckOf(o.scale, requested) // throws UNKNOWN_SPECIAL for bad ids
  return {
    id: o.id,
    ownerId: o.owner.userId,
    hostId: o.owner.id,
    successorId: null,
    participants: { [o.owner.id]: { ...o.owner, joinedAt: o.now, online: true, offlineSince: null } },
    pending: {},
    banned: [],
    access: { locked: false, requireApproval: false, ...o.access },
    scale: o.scale,
    enabledSpecials: SPECIAL_IDS.filter(id => requested.includes(id)),
    revealRule: o.revealRule ?? { onAllVoted: false, timerSec: null },
    items: [],
    itemSeq: 0,
    current: null,
    history: [],
    outcomes: [],
    questions: [],
    notes: [],
    qnaSeq: 0,
  }
}

/** Pure: works on a clone, so a thrown DomainError leaves `prev` untouched and commands are atomic. */
export function applyCommand(prev: RoomState, c: Command, now: number): CommandResult {
  const s = structuredClone(prev)
  const ev: DomainEvent[] = []
  switch (c.type) {
    case 'join': P.join(s, c.participant, now, ev); break
    case 'disconnect': P.disconnect(s, c.pid, now, ev); break
    case 'rename': P.rename(s, c.pid, c.name, c.avatar, ev); break
    case 'setRole': P.setRole(s, c.pid, c.target, c.role, ev); break
    case 'transferHost': P.transferHost(s, c.pid, c.target, ev); break
    case 'setSuccessor': P.setSuccessor(s, c.pid, c.target); break
    case 'kick': P.kick(s, c.pid, c.target, ev); break
    case 'approve': P.approve(s, c.pid, c.target, now, ev); break
    case 'reject': P.reject(s, c.pid, c.target, ev); break
    case 'setAccess': P.setAccess(s, c.pid, c, now, ev); break
    case 'setRevealRule': R.setRevealRule(s, c.pid, c); break
    case 'addItems': R.addItems(s, c.pid, c.items, ev); break
    case 'editItem': R.editItem(s, c.pid, c, ev); break
    case 'deleteItem': R.deleteItem(s, c.pid, c.itemId, ev); break
    case 'startSession': R.startSession(s, c.pid, ev); break
    case 'ask': R.ask(s, c.pid, c.text, now); break
    case 'answerQuestion': R.answerQuestion(s, c.pid, c.questionId, c.answered); break
    case 'addNote': R.addNote(s, c.pid, c.text, now); break
    case 'startRound': R.startRound(s, c.pid, c.itemId, c.timerSec, now, ev); break
    case 'vote': R.vote(s, c.pid, c.cardId, ev); break
    case 'reveal': R.revealCmd(s, c.pid, ev); break
    case 'revote': R.revote(s, c.pid, now, ev); break
    case 'reason': R.reason(s, c.pid, c.text); break
    case 'finalize': R.finalize(s, c.pid, c.value, c.note, now, ev); break
    case 'tick': P.checkHostTimeout(s, now, ev); R.tickRound(s, now, ev); break
    default: { const never: never = c; throw new Error(`Unhandled command ${JSON.stringify(never)}`) }
  }
  return { state: s, events: ev }
}
