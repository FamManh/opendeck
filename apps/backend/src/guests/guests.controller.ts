import { Body, Controller, Get, Patch, Post, Req, Res, UnauthorizedException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { CreateGuestDto, UpdateGuestDto } from './dto'
import { GID_COOKIE, setGuestCookie } from './guest-cookie'
import { GuestsService, toPublicGuest, type PublicGuest } from './guests.service'

@Controller('guests')
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  /** Nếu đã có cookie `gid` hợp lệ thì cập nhật hồ sơ và giữ nguyên danh tính (ghế cũ). */
  @Post()
  async create(@Body() dto: CreateGuestDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ guest: PublicGuest }> {
    const existing = await this.guests.update(req.signedCookies?.[GID_COOKIE] ?? '', dto)
    const guest = existing ?? (await this.guests.create(dto.name, dto.avatar))
    setGuestCookie(res, guest.id)
    return { guest: toPublicGuest(guest) }
  }

  @Get('me')
  async me(@Req() req: Request): Promise<{ guest: PublicGuest }> {
    const guest = await this.guests.find(req.signedCookies?.[GID_COOKIE])
    if (!guest) throw new UnauthorizedException({ code: 'NO_GUEST' })
    return { guest: toPublicGuest(guest) }
  }

  @Patch('me')
  async update(@Body() dto: UpdateGuestDto, @Req() req: Request): Promise<{ guest: PublicGuest }> {
    const guest = await this.guests.update(req.signedCookies?.[GID_COOKIE] ?? '', dto)
    if (!guest) throw new UnauthorizedException({ code: 'NO_GUEST' })
    return { guest: toPublicGuest(guest) }
  }
}
