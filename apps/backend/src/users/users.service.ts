import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { User } from './user.entity'

export interface PublicUser { id: string; email: string; displayName: string; avatar: string | null }

export function normalizeEmail(email: string): string { return email.trim().toLowerCase() }

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, email: u.email, displayName: u.displayName, avatar: u.avatar }
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findByEmail(email: string): Promise<User | null> { return this.repo.findOneBy({ email: normalizeEmail(email) }) }
  findById(id: string): Promise<User | null> { return this.repo.findOneBy({ id }) }

  create(input: { email: string; passwordHash: string; displayName: string; avatar?: string | null }): Promise<User> {
    return this.repo.save(this.repo.create({
      email: normalizeEmail(input.email), passwordHash: input.passwordHash, displayName: input.displayName.trim(), avatar: input.avatar ?? null,
    }))
  }

  async updateProfile(user: User, patch: { displayName?: string; avatar?: string }): Promise<User> {
    if (patch.displayName !== undefined) user.displayName = patch.displayName
    if (patch.avatar !== undefined) user.avatar = patch.avatar
    return this.repo.save(user)
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.repo.update({ id: userId }, { passwordHash })
  }
}
