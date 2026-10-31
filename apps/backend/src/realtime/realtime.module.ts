import { Module } from '@nestjs/common'
import { GuestsModule } from '../guests/guests.module'
import { RoomsModule } from '../rooms/rooms.module'
import { CmdRateLimiter } from './cmd-rate-limiter'
import { FxService, RANDOM } from './fx.service'
import { RoomGateway } from './room.gateway'
import { WsAuthService } from './ws-auth.service'

@Module({
  imports: [RoomsModule, GuestsModule],
  providers: [RoomGateway, FxService, { provide: RANDOM, useValue: Math.random }, WsAuthService, { provide: CmdRateLimiter, useFactory: () => new CmdRateLimiter() }],
})
export class RealtimeModule {}
