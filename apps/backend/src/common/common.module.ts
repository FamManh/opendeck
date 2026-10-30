import { Global, Module } from '@nestjs/common'
import { CLOCK, type Clock } from './clock'

@Global()
@Module({ providers: [{ provide: CLOCK, useValue: (() => Date.now()) satisfies Clock }], exports: [CLOCK] })
export class CommonModule {}
