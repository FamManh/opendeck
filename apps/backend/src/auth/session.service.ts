import { createHash, randomBytes } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { CLOCK, type Clock } from '../common/clock'
import { UsersService } from '../users/users.service'
import type { User } from '../users/user.entity'
import { AuthSession } from './auth-session.entity'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(AuthSession) private readonly repo: Repository<AuthSession>,
    private readonly users: UsersService,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  async create(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(this.now() + SESSION_TTL_MS)
    await this.repo.insert({ id: hashToken(token), userId, expiresAt })
    return { token, expiresAt }
  }

  async resolve(token: string | undefined): Promise<User | null> {
    if (!token) return null
    const s = await this.repo.findOneBy({ id: hashToken(token) })
    if (!s || s.expiresAt.getTime() <= this.now()) return null
    return this.users.findById(s.userId)
  }

  async revoke(token: string | undefined): Promise<void> {
    if (token) await this.repo.delete({ id: hashToken(token) })
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repo.delete({ userId })
  }
}
