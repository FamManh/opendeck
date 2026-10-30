import { DomainError } from '../errors'
import { NAME_MAX, type Participant, type RoomState } from './types'

export function requireParticipant(s: RoomState, pid: string): Participant {
  const p = s.participants[pid]
  if (!p) throw new DomainError('NOT_IN_ROOM')
  return p
}

export function requireHost(s: RoomState, pid: string): Participant {
  const p = requireParticipant(s, pid)
  if (s.hostId !== pid) throw new DomainError('NOT_HOST')
  return p
}

export function requireTarget(s: RoomState, target: string): Participant {
  const p = s.participants[target]
  if (!p) throw new DomainError('UNKNOWN_PARTICIPANT')
  return p
}

export function validName(name: string): string {
  const n = name.trim()
  if (n.length === 0 || n.length > NAME_MAX) throw new DomainError('NAME_INVALID')
  return n
}
