import type { Participant, PublicRoomState } from '@/domain'
import { useRoomStore, type ClientCommand, type Connection } from '@/store/roomStore'

export interface UseRoom {
  state: PublicRoomState | null
  me: Participant | null
  isHost: boolean
  send: (cmd: ClientCommand) => Promise<void>
  connection: Connection
}

export function useRoom(): UseRoom {
  const state = useRoomStore(s => s.state)
  const pid = useRoomStore(s => s.pid)
  const connection = useRoomStore(s => s.connection)
  const send = useRoomStore(s => s.send)
  const me = (state && pid && state.participants[pid]) || null
  return { state, me, isHost: !!state && !!pid && state.hostId === pid, send, connection }
}
