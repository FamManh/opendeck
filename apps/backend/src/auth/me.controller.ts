import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { toPublicUser, UsersService, type PublicUser } from '../users/users.service'
import type { User } from '../users/user.entity'
import { CurrentUser } from './current-user.decorator'
import { UpdateMeDto } from './dto'
import { SessionGuard } from './session.guard'

@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get() @UseGuards(SessionGuard)
  me(@CurrentUser() user: User): { user: PublicUser } {
    return { user: toPublicUser(user) }
  }

  @Patch() @UseGuards(SessionGuard)
  async update(@CurrentUser() user: User, @Body() dto: UpdateMeDto): Promise<{ user: PublicUser }> {
    return { user: toPublicUser(await this.users.updateProfile(user, dto)) }
  }
}
