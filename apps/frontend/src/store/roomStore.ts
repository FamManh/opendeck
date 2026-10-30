import { create } from 'zustand'
import { toast } from 'sonner'
import i18n from '@/i18n'
import type { Command, DomainEvent, PublicRoomState } from '@/domain'
import { createRoomSocket, type RoomSocket, type SocketFactory } from '@/realtime/socket'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type ClientCommand = DistributiveOmit<Exclude<Command, { type: 'join' | 'disconnect' | 'tick' }>, 'pid'>
export type Connection = 'connecting' | 'online' | 'reconnecting' | 'pending' | 'kicked'
export interface ApprovalRequest { pid: string; name: string; avatar: string }

const ACK_TIMEOUT_MS = 8000

interface RoomStore {
  state: PublicRoomState | null
  pid: string | null
  connection: Connection
  connError: string | null
  /** Events of the most recent command (for Plan 2 effects). Replaced on every `events` frame. */
  lastEvents: DomainEvent[]
  /** Live join requests pushed to the host; `state.pending` is the authoritative list. */
  approvalRequests: ApprovalRequest[]
  setPid: (pid: string | null) => void
  connect: (slug: string, factory?: SocketFactory) => void
  disconnect: () => void
  send: (cmd: ClientCommand) => Promise<void>
}

const initial = { state: null, connection: 'connecting' as Connection, connError: null, lastEvents: [], approvalRequests: [] }

let socket: RoomSocket | null = null

export function errorToastMessage(code: string): string {
  const msg = i18n.t(`errors.${code}`, { defaultValue: '' })
  return msg || i18n.t('errors.generic')
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  ...initial,
  pid: null,
  setPid: pid => set({ pid }),
  connect: (slug, factory = createRoomSocket) => {
    socket?.disconnect()
    set({ ...initial })
    const s = factory(slug)
    socket = s
    const live = (fn: () => void) => () => { if (socket === s) fn() }

    s.on('state', (state: PublicRoomState) => { if (socket === s) set({ state, connection: 'online', connError: null }) })
    s.on('events', (events: DomainEvent[]) => { if (socket === s) set({ lastEvents: events }) })
    s.on('approval:pending', live(() => set({ connection: 'pending' })))
    const gone = live(() => set({ connection: 'kicked' }))
    s.on('kicked', gone)
    s.on('rejected', gone)
    s.on('conn:error', (e: { code: string }) => { if (socket === s) set({ connError: e.code, connection: e.code === 'banned' ? 'kicked' : get().connection }) })
    s.on('approval:request', (r: ApprovalRequest) => {
      if (socket === s) set(st => ({ approvalRequests: [...st.approvalRequests.filter(x => x.pid !== r.pid), r] }))
    })
    const lost = live(() => {
      const { connection, connError } = get()
      if (connection === 'kicked' || connError) return
      if (get().state || connection === 'online') set({ connection: 'reconnecting' })
    })
    s.on('disconnect', (reason: string) => { if (reason !== 'io client disconnect') lost() })
    s.on('connect_error', lost)
  },
  disconnect: () => {
    socket?.disconnect()
    socket = null
    set({ ...initial })
  },
  send: cmd =>
    new Promise<void>((resolve, reject) => {
      const s = socket
      if (!s) { reject(new Error('NOT_READY')); return }
      const fail = (code: string) => {
        toast.error(errorToastMessage(code))
        reject(new Error(code))
      }
      const timer = setTimeout(() => fail('TIMEOUT'), ACK_TIMEOUT_MS)
      s.emit('cmd', cmd, (ack: { ok: true } | { ok: false; code: string }) => {
        clearTimeout(timer)
        if (ack.ok) resolve()
        else fail(ack.code)
      })
    }),
}))
