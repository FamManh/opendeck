import { DomainError } from '../errors'
import { requireHost, requireParticipant, requireTarget, validName } from './guards'
import { HOST_OFFLINE_MS, type DomainEvent, type JoinInfo, type Participant, type Role, type RoomState } from './types'

type Ev = DomainEvent[]

export function join(s: RoomState, info: JoinInfo, now: number, ev: Ev): void {
  const name = validName(info.name)
  const existing = s.participants[info.id]
  if (existing) {
    existing.online = true
    existing.offlineSince = null
    existing.name = name
    existing.avatar = info.avatar
    ev.push({ type: 'rejoined', pid: info.id })
    claimHostIfHostless(s, existing, ev)
    return
  }
  if (s.banned.includes(info.id)) throw new DomainError('KICKED')
  const isOwner = info.userId !== null && info.userId === s.ownerId
  if (s.access.locked && !isOwner) throw new DomainError('ROOM_LOCKED')
  if (s.access.requireApproval && !isOwner) {
    if (!s.pending[info.id]) {
      s.pending[info.id] = { ...info, name, requestedAt: now }
      ev.push({ type: 'approvalRequested', pid: info.id, name })
    }
    return
  }
  admit(s, { ...info, name }, now, ev)
}

function admit(s: RoomState, info: JoinInfo, now: number, ev: Ev): void {
  const p: Participant = { id: info.id, userId: info.userId, name: info.name, avatar: info.avatar, role: info.role, joinedAt: now, online: true, offlineSince: null }
  s.participants[p.id] = p
  delete s.pending[p.id]
  ev.push({ type: 'joined', pid: p.id })
  claimHostIfHostless(s, p, ev)
}

function claimHostIfHostless(s: RoomState, p: Participant, ev: Ev): void {
  if (s.hostId !== null || p.userId === null) return
  s.hostId = p.id
  ev.push({ type: 'hostChanged', from: null, to: p.id, reason: 'claimed' })
}

export function disconnect(s: RoomState, pid: string, now: number, ev: Ev): void {
  if (s.pending[pid]) { delete s.pending[pid]; return }
  const p = s.participants[pid]
  if (!p || !p.online) return
  p.online = false
  p.offlineSince = now
  ev.push({ type: 'offline', pid })
}

export function rename(s: RoomState, pid: string, name: string, avatar: string | undefined, ev: Ev): void {
  const p = requireParticipant(s, pid)
  p.name = validName(name)
  if (avatar !== undefined) p.avatar = avatar
  ev.push({ type: 'renamed', pid })
}

export function setRole(s: RoomState, pid: string, target: string, role: Role, ev: Ev): void {
  if (pid === target) requireParticipant(s, pid)
  else requireHost(s, pid)
  const t = requireTarget(s, target)
  if (t.role === role) return
  t.role = role
  if (role === 'observer' && s.current?.status === 'voting') delete s.current.votes[target]
  ev.push({ type: 'roleChanged', pid: target, role })
}

function requireRegisteredTarget(s: RoomState, pid: string, target: string): Participant {
  const t = requireTarget(s, target)
  if (t.userId === null) throw new DomainError('HOST_NEEDS_ACCOUNT')
  if (target === pid) throw new DomainError('INVALID_TARGET')
  return t
}

export function transferHost(s: RoomState, pid: string, target: string, ev: Ev): void {
  requireHost(s, pid)
  requireRegisteredTarget(s, pid, target)
  s.hostId = target
  if (s.successorId === target) s.successorId = null
  ev.push({ type: 'hostChanged', from: pid, to: target, reason: 'manual' })
}

export function setSuccessor(s: RoomState, pid: string, target: string | null): void {
  requireHost(s, pid)
  if (target !== null) requireRegisteredTarget(s, pid, target)
  s.successorId = target
}

export function kick(s: RoomState, pid: string, target: string, ev: Ev): void {
  requireHost(s, pid)
  if (target === pid) throw new DomainError('INVALID_TARGET')
  if (!s.participants[target] && !s.pending[target]) throw new DomainError('UNKNOWN_PARTICIPANT')
  delete s.participants[target]
  delete s.pending[target]
  if (s.current) {
    delete s.current.votes[target]
    delete s.current.reasons[target]
  }
  if (s.successorId === target) s.successorId = null
  if (!s.banned.includes(target)) s.banned.push(target)
  ev.push({ type: 'kicked', pid: target })
}

export function approve(s: RoomState, pid: string, target: string, now: number, ev: Ev): void {
  requireHost(s, pid)
  const req = s.pending[target]
  if (!req) throw new DomainError('UNKNOWN_PARTICIPANT')
  admit(s, { id: req.id, userId: req.userId, name: req.name, avatar: req.avatar, role: req.role }, now, ev)
}

export function reject(s: RoomState, pid: string, target: string, ev: Ev): void {
  requireHost(s, pid)
  if (!s.pending[target]) throw new DomainError('UNKNOWN_PARTICIPANT')
  delete s.pending[target]
  ev.push({ type: 'rejected', pid: target })
}

export function setAccess(s: RoomState, pid: string, patch: { locked?: boolean; requireApproval?: boolean }, now: number, ev: Ev): void {
  requireHost(s, pid)
  if (patch.locked !== undefined) s.access.locked = patch.locked
  if (patch.requireApproval !== undefined) s.access.requireApproval = patch.requireApproval
  if (!s.access.requireApproval) {
    const waiting = Object.values(s.pending).sort((a, b) => a.requestedAt - b.requestedAt)
    for (const req of waiting) admit(s, { id: req.id, userId: req.userId, name: req.name, avatar: req.avatar, role: req.role }, now, ev)
  }
  ev.push({ type: 'accessChanged', locked: s.access.locked, requireApproval: s.access.requireApproval })
}

/** Hands host over when the current host has been offline longer than HOST_OFFLINE_MS (roadmap §2.5). */
export function checkHostTimeout(s: RoomState, now: number, ev: Ev): void {
  const from = s.hostId
  if (from === null) return
  const host = s.participants[from]
  if (host && (host.online || host.offlineSince === null || now - host.offlineSince <= HOST_OFFLINE_MS)) return
  const eligible = (p: Participant | undefined): p is Participant => !!p && p.online && p.userId !== null && p.id !== from
  const successor = s.successorId === null ? undefined : s.participants[s.successorId]
  const next = eligible(successor)
    ? successor
    : Object.values(s.participants).filter(eligible).sort((a, b) => a.joinedAt - b.joinedAt)[0]
  s.hostId = next?.id ?? null
  if (s.successorId === s.hostId) s.successorId = null
  ev.push({ type: 'hostChanged', from, to: s.hostId, reason: 'timeout' })
}
