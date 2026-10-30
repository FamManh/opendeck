import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { CommonModule } from './common/common.module'
import { DatabaseModule } from './database/database.module'
import { GuestsModule } from './guests/guests.module'
import { HealthModule } from './health/health.module'
import { MailModule } from './mail/mail.module'
import { RealtimeModule } from './realtime/realtime.module'
import { RoomsModule } from './rooms/rooms.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CommonModule, MailModule, DatabaseModule, HealthModule, UsersModule, AuthModule, GuestsModule, RoomsModule, RealtimeModule],
})
export class AppModule {}
