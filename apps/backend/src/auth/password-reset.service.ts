import { randomBytes } from 'node:crypto'
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, IsNull, type Repository } from 'typeorm'
import { CLOCK, type Clock } from '../common/clock'
import { MAILER, type Mailer } from '../mail/mailer'
import { User } from '../users/user.entity'
import { UsersService } from '../users/users.service'
import { AuthSession } from './auth-session.entity'
import { PasswordReset } from './password-reset.entity'
import { PasswordService } from './password.service'
import { hashToken } from './session.service'

export const RESET_TTL_MS = 30 * 60_000

@Injectable()
export class PasswordResetService {
  private readonly log = new Logger(PasswordResetService.name)

  constructor(
    @InjectRepository(PasswordReset) private readonly resets: Repository<PasswordReset>,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  async request(email: string): Promise<void> {
    const user = await this.users.findByEmail(email)
    if (!user) return
    const token = randomBytes(32).toString('base64url')
    await this.resets.insert({ tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(this.now() + RESET_TTL_MS) })
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173'
    const link = `${appUrl}/reset?token=${token}`
    try {
      await this.mailer.send(user.email, 'OpenDeck — Đặt lại mật khẩu / Reset your password',
        `Mở link sau trong 30 phút để đặt lại mật khẩu.\nOpen this link within 30 minutes to reset your password.\n\n${link}\n`)
    } catch (e) {
      this.log.error(`reset mail to user ${user.id} failed: ${(e as Error).message}`)
    }
  }

  async reset(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token)
    const row = await this.resets.findOneBy({ tokenHash })
    if (!row || row.usedAt || row.expiresAt.getTime() <= this.now()) throw invalid()
    const passwordHash = await this.passwords.hash(newPassword)
    const usedAt = new Date(this.now())
    await this.dataSource.transaction(async m => {
      // Điều kiện usedAt IS NULL chặn 2 request reset cùng token chạy đua.
      const claimed = await m.update(PasswordReset, { tokenHash, usedAt: IsNull() }, { usedAt })
      if (!claimed.affected) throw invalid()
      await m.update(User, { id: row.userId }, { passwordHash })
      await m.update(PasswordReset, { userId: row.userId, usedAt: IsNull() }, { usedAt })
      await m.delete(AuthSession, { userId: row.userId })
    })
  }
}

function invalid(): BadRequestException {
  return new BadRequestException({ code: 'RESET_TOKEN_INVALID' })
}
