import type { INestApplication } from '@nestjs/common'

export const API_PREFIX = 'api'

/** Shared HTTP setup for main.ts and tests, so tests hit the same routes as production. */
export function configureApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix(API_PREFIX)
  app.enableShutdownHooks()
  return app
}
