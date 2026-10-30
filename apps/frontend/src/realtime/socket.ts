import { io } from 'socket.io-client'

/** The slice of a Socket.IO client the room store relies on (lets tests inject a fake). */
export interface RoomSocket {
  on(event: string, handler: (...args: any[]) => void): unknown
  emit(event: string, ...args: any[]): unknown
  disconnect(): unknown
}

export type SocketFactory = (slug: string) => RoomSocket

// Reconnection is Socket.IO's default (exponential backoff); cookies carry the identity and room ticket.
export const createRoomSocket: SocketFactory = slug => io('/room', { auth: { slug }, withCredentials: true })
