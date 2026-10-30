import type { Scale, SpecialId } from '../deck'
import type { RoundStats } from '../stats'

export const HOST_OFFLINE_MS = 60_000
export const REASON_MAX = 200
export const NAME_MAX = 40
export const TIMER_MAX_SEC = 3600

export type Role = 'voter' | 'observer'
export interface JoinInfo { id: string; userId: string | null; name: string; avatar: string; role: Role }
export interface Participant extends JoinInfo { joinedAt: number; online: boolean; offlineSince: number | null }
export interface PendingJoin extends JoinInfo { requestedAt: number }
export interface Item {
  id: string; source: 'manual' | 'jira'; externalRef: string | null
  title: string; description: string; status: 'pending' | 'done'
}
export interface Round {
  itemId: string; number: number; status: 'voting' | 'revealed'
  votes: Record<string, string>; reasons: Record<string, string>
  deadline: number | null; stats: RoundStats | null
}
export interface Outcome { itemId: string; value: string; note: string; decidedBy: string; decidedAt: number; rounds: number }
export interface RevealRule { onAllVoted: boolean; timerSec: number | null }
export interface RoomAccess { locked: boolean; requireApproval: boolean }
export interface RoomState {
  id: string
  ownerId: string                 // userId của người tạo phòng
  hostId: string | null           // participant id; null = hostless
  successorId: string | null
  participants: Record<string, Participant>
  pending: Record<string, PendingJoin>
  banned: string[]
  access: RoomAccess
  scale: Scale
  enabledSpecials: SpecialId[]    // luôn theo thứ tự SPECIAL_IDS
  revealRule: RevealRule
  items: Item[]
  itemSeq: number
  current: Round | null
  history: Round[]                // chỉ chứa vòng đã lật
  outcomes: Outcome[]
}
export interface NewItem { title: string; description?: string; externalRef?: string | null }
export interface CreateRoomOptions {
  id: string
  owner: JoinInfo & { userId: string }
  scale: Scale
  now: number
  enabledSpecials?: readonly SpecialId[]
  revealRule?: RevealRule
  access?: Partial<RoomAccess>
}

export type Command =
  | { type: 'join'; participant: JoinInfo }
  | { type: 'disconnect'; pid: string }
  | { type: 'rename'; pid: string; name: string; avatar?: string }
  | { type: 'setRole'; pid: string; target: string; role: Role }
  | { type: 'transferHost'; pid: string; target: string }
  | { type: 'setSuccessor'; pid: string; target: string | null }
  | { type: 'kick'; pid: string; target: string }
  | { type: 'approve'; pid: string; target: string }
  | { type: 'reject'; pid: string; target: string }
  | { type: 'setAccess'; pid: string; locked?: boolean; requireApproval?: boolean }
  | { type: 'addItems'; pid: string; items: NewItem[] }
  | { type: 'startRound'; pid: string; itemId: string; timerSec?: number }
  | { type: 'vote'; pid: string; cardId: string | null }
  | { type: 'reveal'; pid: string }
  | { type: 'revote'; pid: string }
  | { type: 'reason'; pid: string; text: string }
  | { type: 'finalize'; pid: string; value: string; note?: string }
  | { type: 'tick' }

export type DomainEvent =
  | { type: 'joined' | 'rejoined' | 'offline' | 'renamed' | 'kicked' | 'rejected' | 'voted' | 'unvoted'; pid: string }
  | { type: 'approvalRequested'; pid: string; name: string }
  | { type: 'roleChanged'; pid: string; role: Role }
  | { type: 'hostChanged'; from: string | null; to: string | null; reason: 'manual' | 'timeout' | 'claimed' }
  | { type: 'accessChanged'; locked: boolean; requireApproval: boolean }
  | { type: 'itemsAdded'; ids: string[] }
  | { type: 'roundStarted'; itemId: string; number: number }
  | { type: 'revealed'; itemId: string; number: number; auto: boolean }
  | { type: 'discussionNeeded'; lowPids: string[]; highPids: string[] }
  | { type: 'finalized'; itemId: string; value: string }

export interface CommandResult { state: RoomState; events: DomainEvent[] }
