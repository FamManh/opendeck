import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UsersModule } from '../users/users.module'
import { AuthSession } from './auth-session.entity'
import { AuthController } from './auth.controller'
import { loginLimiterProvider } from './login-limiter'
import { MeController } from './me.controller'
import { PasswordService } from './password.service'
import { SessionGuard } from './session.guard'
import { SessionService } from './session.service'

@Module({
  imports: [TypeOrmModule.forFeature([AuthSession]), UsersModule],
  controllers: [AuthController, MeController],
  providers: [PasswordService, SessionService, SessionGuard, loginLimiterProvider],
  exports: [PasswordService, SessionService, SessionGuard],
})
export class AuthModule {}
