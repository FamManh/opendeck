import 'reflect-metadata'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app.setup'

// Requires Postgres from docker-compose (`docker compose up -d db`) and DATABASE_URL in .env.
test('app boots against real Postgres and reports healthy', async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = configureApp(moduleRef.createNestApplication())
  await app.init()
  await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok', db: 'up' })
  await app.close()
})
