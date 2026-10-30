import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ForgotDto, ResetDto } from './password-reset.dto'
import { PasswordResetService } from './password-reset.service'

@Controller('auth')
export class PasswordResetController {
  constructor(private readonly resets: PasswordResetService) {}

  @Post('forgot') @HttpCode(HttpStatus.NO_CONTENT)
  async forgot(@Body() dto: ForgotDto): Promise<void> {
    await this.resets.request(dto.email)
  }

  @Post('reset') @HttpCode(HttpStatus.NO_CONTENT)
  async reset(@Body() dto: ResetDto): Promise<void> {
    await this.resets.reset(dto.token, dto.password)
  }
}
