import { randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { Guest } from './guest.entity'

export interface PublicGuest { id: string; name: string; avatar: string }
export const toPublicGuest = (g: Guest): PublicGuest => ({ id: g.id, name: g.name, avatar: g.avatar })

@Injectable()
export class GuestsService {
  constructor(@InjectRepository(Guest) private readonly repo: Repository<Guest>) {}

  /** 128-bit ngẫu nhiên, hex. */
  create(name: string, avatar: string): Promise<Guest> {
    return this.repo.save(this.repo.create({ id: randomBytes(16).toString('hex'), name, avatar }))
  }

  find(id: string | undefined): Promise<Guest | null> {
    return id ? this.repo.findOneBy({ id }) : Promise.resolve(null)
  }

  async update(id: string, patch: { name?: string; avatar?: string }): Promise<Guest | null> {
    const g = await this.find(id)
    if (!g) return null
    if (patch.name !== undefined) g.name = patch.name
    if (patch.avatar !== undefined) g.avatar = patch.avatar
    return this.repo.save(g)
  }
}
