import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { createTestDb, type TestDb } from '../support/test-db'
import { FakeMailer } from '../support/fake-mailer'
import { AppModule } from '../../src/app.module'
import { configureApp } from '../../src/app.setup'
import { MAILER } from '../../src/mail/mailer'

let db: TestDb, app: INestApplication
const mailer = new FakeMailer()
const http = () => request(app.getHttpServer())
const originalUrl = process.env.DATABASE_URL

beforeAll(async () => {
  db = await createTestDb()
  process.env.DATABASE_URL = db.url   // AppModule đọc DATABASE_URL qua ConfigService
  const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(MAILER).useValue(mailer).compile()
  app = configureApp(mod.createNestApplication())
  await app.init()
})
afterAll(async () => {
  await app.close()
  await db.drop()
  process.env.DATABASE_URL = originalUrl
})

const sidOf = (res: request.Response) => String(res.headers['set-cookie']).split(';')[0]!

test('register → logout → forgot → reset → login with new password → /me', async () => {
  const reg = await http().post('/api/auth/register').send({ email: 'flow@x.io', password: 'password1', displayName: 'Flow' }).expect(201)
  const sid = sidOf(reg)
  await http().get('/api/me').set('Cookie', sid).expect(200)
  await http().post('/api/auth/logout').set('Cookie', sid).expect(204)
  await http().post('/api/auth/forgot').send({ email: 'flow@x.io' }).expect(204)
  const token = mailer.sent.at(-1)!.body.match(/token=([A-Za-z0-9_-]+)/)![1]!
  await http().post('/api/auth/reset').send({ token, password: 'brand-new-pass' }).expect(204)
  await http().post('/api/auth/login').send({ email: 'flow@x.io', password: 'password1' }).expect(401)
  const login = await http().post('/api/auth/login').send({ email: 'flow@x.io', password: 'brand-new-pass' }).expect(200)
  const me = await http().get('/api/me').set('Cookie', sidOf(login)).expect(200)
  expect(me.body.user).toMatchObject({ email: 'flow@x.io', displayName: 'Flow' })
})

test('health still reports db up', async () => {
  await http().get('/api/health').expect(200, { status: 'ok', db: 'up' })
})
