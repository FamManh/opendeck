import 'reflect-metadata'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { HealthModule } from './health.module'
import { configureApp } from '../app.setup'

async function boot(query: () => Promise<unknown>): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [HealthModule] })
    .useMocker(token => (token === DataSource ? { query } : undefined))
    .compile()
  const app = configureApp(moduleRef.createNestApplication())
  await app.init()
  return app
}

test('GET /api/health → 200 when database answers', async () => {
  const app = await boot(async () => [{ '?column?': 1 }])
  await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok', db: 'up' })
  await app.close()
})

test('GET /api/health → 503 when database is down', async () => {
  const app = await boot(async () => { throw new Error('ECONNREFUSED') })
  const res = await request(app.getHttpServer()).get('/api/health').expect(503)
  expect(res.body).toMatchObject({ status: 'error', db: 'down' })
  await app.close()
})
