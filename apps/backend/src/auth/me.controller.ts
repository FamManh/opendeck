import { Controller, Get, UseGuards } from '@nestjs/common'
import { toPublicUser, type PublicUser } from '../users/users.service'
import type { User } from '../users/user.entity'
import { CurrentUser } from './current-user.decorator'
import { SessionGuard } from './session.guard'

@Controller('me')
export class MeController {
  @Get() @UseGuards(SessionGuard)
  me(@CurrentUser() user: User): { user: PublicUser } {
    return { user: toPublicUser(user) }
  }
}
