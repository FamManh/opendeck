import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { CommonModule } from './common/common.module'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { MailModule } from './mail/mail.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CommonModule, MailModule, DatabaseModule, HealthModule, UsersModule, AuthModule],
})
export class AppModule {}
