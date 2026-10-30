import { Injectable } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import { parse } from 'cookie'
import type { Socket } from 'socket.io'
import { SID_COOKIE } from '../auth/session-cookie'
import { GID_COOKIE } from '../guests/guest-cookie'
import { IdentityService } from '../guests/identity.service'
import { cookieSecret } from '../common/cookie-secret'
import { ticketCookie } from '../rooms/room-access.service'
import { RoomStoreService } from '../rooms/room-store.service'

export interface WsIdentity { pid: string; userId: string | null; name: string; avatar: string; slug: string }

export class WsAuthError extends Error {
  constructor(readonly code: 'UNAUTHENTICATED' | 'NO_TICKET' | 'ROOM_NOT_FOUND') { super(code) }
}

/** Nest không chạy guard ở handleConnection, nên xác thực thủ công từ cookie trong handshake. */
@Injectable()
export class WsAuthService {
  constructor(private readonly identities: IdentityService, private readonly store: RoomStoreService) {}

  async authenticate(socket: Socket): Promise<WsIdentity> {
    const slug = (socket.handshake.auth as { slug?: unknown } | undefined)?.slug
    if (typeof slug !== 'string' || slug.length === 0) throw new WsAuthError('ROOM_NOT_FOUND')
    const cookies = parse(socket.handshake.headers.cookie ?? '')
    const unsign = (name: string): string | undefined => {
      const raw = cookies[name]
      const v = raw ? cookieParser.signedCookie(raw, cookieSecret()) : false
      return typeof v === 'string' ? v : undefined
    }
    const who = await this.identities.resolve({ sid: cookies[SID_COOKIE], gid: unsign(GID_COOKIE) })
    if (!who) throw new WsAuthError('UNAUTHENTICATED')
    const state = await this.store.load(slug).catch(() => { throw new WsAuthError('ROOM_NOT_FOUND') })
    const isOwner = who.userId !== null && who.userId === state.ownerId
    if (!isOwner && unsign(ticketCookie(slug)) !== who.pid) throw new WsAuthError('NO_TICKET')
    return { ...who, slug }
  }
}
