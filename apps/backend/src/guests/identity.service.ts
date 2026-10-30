import { Injectable } from '@nestjs/common'
import { SessionService } from '../auth/session.service'
import { GuestsService } from './guests.service'

export interface Identity { pid: string; userId: string | null; name: string; avatar: string }
export const DEFAULT_AVATAR = 'cat'

/** Xác định người dùng từ cookie đã xác minh: `sid` (tài khoản) ưu tiên hơn `gid` (khách đã ký). */
@Injectable()
export class IdentityService {
  constructor(private readonly sessions: SessionService, private readonly guests: GuestsService) {}

  async resolve(cookies: { sid?: string | undefined; gid?: string | undefined }): Promise<Identity | null> {
    const user = await this.sessions.resolve(cookies.sid)
    if (user) return { pid: `u:${user.id}`, userId: user.id, name: user.displayName, avatar: user.avatar ?? DEFAULT_AVATAR }
    const guest = await this.guests.find(cookies.gid)
    if (guest) return { pid: `g:${guest.id}`, userId: null, name: guest.name, avatar: guest.avatar }
    return null
  }
}
