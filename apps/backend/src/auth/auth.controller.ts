import {
  Body, ConflictException, Controller, HttpCode, HttpException, HttpStatus, Inject, Post, Req, Res, UnauthorizedException,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { QueryFailedError } from 'typeorm'
import type { AttemptLimiter } from '../common/attempt-limiter'
import { UsersService, normalizeEmail, toPublicUser, type PublicUser } from '../users/users.service'
import { LoginDto, RegisterDto } from './dto'
import { LOGIN_LIMITER } from './login-limiter'
import { PasswordService } from './password.service'
import { SessionService } from './session.service'
import { SID_COOKIE, clearSessionCookie, setSessionCookie } from './session-cookie'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    @Inject(LOGIN_LIMITER) private readonly limiter: AttemptLimiter,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response): Promise<{ user: PublicUser }> {
    if (await this.users.findByEmail(dto.email)) throw new ConflictException({ code: 'EMAIL_TAKEN' })
    let user
    try {
      user = await this.users.create({ email: dto.email, displayName: dto.displayName, passwordHash: await this.passwords.hash(dto.password) })
    } catch (e) {
      // Hai request đăng ký cùng email chạy đua: unique index chặn, trả cùng mã lỗi.
      if (e instanceof QueryFailedError && (e.driverError as { code?: string }).code === '23505')
        throw new ConflictException({ code: 'EMAIL_TAKEN' })
      throw e
    }
    await this.startSession(user.id, res)
    return { user: toPublicUser(user) }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ user: PublicUser }> {
    const key = `${normalizeEmail(dto.email)}|${req.ip ?? ''}`
    if (this.limiter.isBlocked(key)) throw new HttpException({ code: 'TOO_MANY_ATTEMPTS' }, HttpStatus.TOO_MANY_REQUESTS)
    const user = await this.users.findByEmail(dto.email)
    if (!user || !(await this.passwords.verify(user.passwordHash, dto.password))) {
      this.limiter.recordFailure(key)
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' })
    }
    this.limiter.reset(key)
    await this.startSession(user.id, res)
    return { user: toPublicUser(user) }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.sessions.revoke(req.cookies?.[SID_COOKIE])
    clearSessionCookie(res)
  }

  private async startSession(userId: string, res: Response): Promise<void> {
    const { token, expiresAt } = await this.sessions.create(userId)
    setSessionCookie(res, token, expiresAt)
  }
}
