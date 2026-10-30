import type { Provider } from '@nestjs/common'
import { AttemptLimiter } from '../common/attempt-limiter'
import { CLOCK, type Clock } from '../common/clock'

export const LOGIN_LIMITER = Symbol('LOGIN_LIMITER')
export const LOGIN_MAX_FAILURES = 5
export const LOGIN_WINDOW_MS = 15 * 60_000

export const loginLimiterProvider: Provider = {
  provide: LOGIN_LIMITER,
  inject: [CLOCK],
  useFactory: (now: Clock) => new AttemptLimiter(LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, now),
}
