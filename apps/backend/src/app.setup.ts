import { ValidationPipe, type INestApplication } from '@nestjs/common'
import cookieParser from 'cookie-parser'

export const API_PREFIX = 'api'

/** Shared HTTP setup for main.ts and tests, so tests hit the same routes as production. */
export function configureApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix(API_PREFIX)
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.enableShutdownHooks()
  return app
}
