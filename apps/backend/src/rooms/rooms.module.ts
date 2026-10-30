import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { GuestsModule } from '../guests/guests.module'
import { Criterion } from './entities/criterion.entity'
import { Item } from './entities/item.entity'
import { Outcome } from './entities/outcome.entity'
import { Room } from './entities/room.entity'
import { Vote } from './entities/vote.entity'
import { RoomAccessService, joinLimiterProvider } from './room-access.service'
import { RoomPersistenceService } from './room-persistence.service'
import { RoomStoreService } from './room-store.service'
import { RoomsController } from './rooms.controller'
import { RoomsService } from './rooms.service'

@Module({
  imports: [TypeOrmModule.forFeature([Room, Item, Criterion, Vote, Outcome]), AuthModule, GuestsModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomAccessService, RoomStoreService, RoomPersistenceService, joinLimiterProvider],
  exports: [RoomStoreService, RoomPersistenceService],
})
export class RoomsModule {}
