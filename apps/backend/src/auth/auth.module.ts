import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UsersModule } from '../users/users.module'
import { AuthSession } from './auth-session.entity'
import { AuthController } from './auth.controller'
import { loginLimiterProvider } from './login-limiter'
import { MeController } from './me.controller'
import { PasswordReset } from './password-reset.entity'
import { PasswordResetController } from './password-reset.controller'
import { PasswordResetService } from './password-reset.service'
import { PasswordService } from './password.service'
import { SessionGuard } from './session.guard'
import { SessionService } from './session.service'

@Module({
  imports: [TypeOrmModule.forFeature([AuthSession, PasswordReset]), UsersModule],
  controllers: [AuthController, MeController, PasswordResetController],
  providers: [PasswordService, SessionService, SessionGuard, loginLimiterProvider, PasswordResetService],
  exports: [PasswordService, SessionService, SessionGuard],
})
export class AuthModule {}
