import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable, type Provider } from '@nestjs/common'
import { PasswordService } from '../auth/password.service'
import { AttemptLimiter } from '../common/attempt-limiter'
import { CLOCK, type Clock } from '../common/clock'
import { Room } from './entities/room.entity'

export const JOIN_LIMITER = Symbol('JOIN_LIMITER')
export const JOIN_MAX_FAILURES = 5
export const JOIN_WINDOW_MS = 10 * 60_000
export const joinLimiterProvider: Provider = {
  provide: JOIN_LIMITER,
  inject: [CLOCK],
  useFactory: (now: Clock) => new AttemptLimiter(JOIN_MAX_FAILURES, JOIN_WINDOW_MS, now),
}

export const TICKET_COOKIE_PREFIX = 'rj_'
export const TICKET_TTL_MS = 7 * 24 * 60 * 60_000
export const ticketCookie = (slug: string): string => `${TICKET_COOKIE_PREFIX}${slug}`

/** Kiểm tra mật khẩu phòng (giới hạn 5 lần sai / 10 phút / phòng+IP) trước khi cấp vé vào phòng. */
@Injectable()
export class RoomAccessService {
  constructor(
    private readonly passwords: PasswordService,
    @Inject(JOIN_LIMITER) private readonly limiter: AttemptLimiter,
  ) {}

  async checkPassword(room: Pick<Room, 'slug' | 'passwordHash' | 'ownerId'>, userId: string | null, ip: string, password: string | undefined): Promise<void> {
    if (!room.passwordHash || userId === room.ownerId) return
    const key = `${room.slug}|${ip}`
    if (this.limiter.isBlocked(key)) throw new HttpException({ code: 'TOO_MANY_ATTEMPTS' }, HttpStatus.TOO_MANY_REQUESTS)
    if (password === undefined || !(await this.passwords.verify(room.passwordHash, password))) {
      this.limiter.recordFailure(key)
      throw new ForbiddenException({ code: 'WRONG_PASSWORD' })
    }
    this.limiter.reset(key)
  }
}
