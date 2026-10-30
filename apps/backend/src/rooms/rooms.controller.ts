import {
  Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Req, Res, UnauthorizedException, UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { CurrentUser } from '../auth/current-user.decorator'
import { SessionGuard } from '../auth/session.guard'
import { SID_COOKIE } from '../auth/session-cookie'
import { CLOCK, type Clock } from '../common/clock'
import { GID_COOKIE, signedCookieOptions } from '../guests/guest-cookie'
import { IdentityService, type Identity } from '../guests/identity.service'
import type { User } from '../users/user.entity'
import { CreateRoomDto } from './dto/create-room.dto'
import { JoinRoomDto, UpdateRoomDto } from './dto/update-room.dto'
import { TICKET_TTL_MS, ticketCookie } from './room-access.service'
import { RoomsService, type RoomInfo, type RoomListItem } from './rooms.service'

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly identities: IdentityService,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  @Post() @UseGuards(SessionGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateRoomDto): Promise<{ slug: string }> {
    return this.rooms.create(user, dto, this.now())
  }

  @Get('mine') @UseGuards(SessionGuard)
  async mine(@CurrentUser() user: User): Promise<{ rooms: RoomListItem[] }> {
    return { rooms: await this.rooms.mine(user.id) }
  }

  @Get(':slug')
  info(@Param('slug') slug: string): Promise<RoomInfo> {
    return this.rooms.info(slug)
  }

  @Post(':slug/join') @HttpCode(HttpStatus.NO_CONTENT)
  async join(@Param('slug') slug: string, @Body() dto: JoinRoomDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const pid = await this.rooms.join(slug, await this.identity(req), req.ip ?? '', dto.password)
    res.cookie(ticketCookie(slug), pid, signedCookieOptions(TICKET_TTL_MS))
  }

  @Patch(':slug') @UseGuards(SessionGuard)
  update(@Param('slug') slug: string, @CurrentUser() user: User, @Body() dto: UpdateRoomDto): Promise<RoomInfo> {
    return this.rooms.update(slug, user, dto)
  }

  @Get(':slug/summary.csv')
  async csv(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const body = await this.rooms.csv(slug, await this.identity(req))
    res.type('text/csv; charset=utf-8').attachment(`${slug}.csv`).send(body)
  }

  private async identity(req: Request): Promise<Identity> {
    const who = await this.identities.resolve({ sid: req.cookies?.[SID_COOKIE], gid: req.signedCookies?.[GID_COOKIE] })
    if (!who) throw new UnauthorizedException({ code: 'IDENTITY_REQUIRED' })
    return who
  }
}
