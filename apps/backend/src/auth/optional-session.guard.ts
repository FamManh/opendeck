import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { SessionService } from './session.service'
import { SID_COOKIE } from './session-cookie'

/** Gắn req.user nếu có phiên hợp lệ; khách (không cookie) vẫn đi tiếp với req.user = undefined. */
@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>()
    const user = await this.sessions.resolve(req.cookies?.[SID_COOKIE])
    if (user) req.user = user
    return true
  }
}
