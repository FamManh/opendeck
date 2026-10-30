import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { SessionService } from './session.service'
import { SID_COOKIE } from './session-cookie'

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>()
    const user = await this.sessions.resolve(req.cookies?.[SID_COOKIE])
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHENTICATED' })
    req.user = user
    return true
  }
}
