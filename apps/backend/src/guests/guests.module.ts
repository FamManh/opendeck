import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { Guest } from './guest.entity'
import { GuestsController } from './guests.controller'
import { GuestsService } from './guests.service'
import { IdentityService } from './identity.service'

@Module({
  imports: [TypeOrmModule.forFeature([Guest]), AuthModule],
  controllers: [GuestsController],
  providers: [GuestsService, IdentityService],
  exports: [GuestsService, IdentityService],
})
export class GuestsModule {}
