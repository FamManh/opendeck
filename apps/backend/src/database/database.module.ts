import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { typeOrmOptions } from './typeorm.options'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...typeOrmOptions(config.getOrThrow<string>('DATABASE_URL')),
        migrationsRun: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
