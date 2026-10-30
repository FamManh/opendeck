import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'
import { createTestDb, type TestDb } from '../support/test-db'
import { fakeClock } from '../support/fake-clock'
import { FakeMailer } from '../support/fake-mailer'
import { typeOrmOptions } from '../../src/database/typeorm.options'
import { configureApp } from '../../src/app.setup'
import { CLOCK } from '../../src/common/clock'
import { MAILER } from '../../src/mail/mailer'
import { UsersModule } from '../../src/users/users.module'
import { UsersService } from '../../src/users/users.service'
import { AuthSession } from '../../src/auth/auth-session.entity'
import { PasswordReset } from '../../src/auth/password-reset.entity'
import { PasswordService } from '../../src/auth/password.service'
import { SessionService, hashToken } from '../../src/auth/session.service'
import { PasswordResetService, RESET_TTL_MS } from '../../src/auth/password-reset.service'
import { PasswordResetController } from '../../src/auth/password-reset.controller'

let db: TestDb, app: INestApplication
let users: UsersService, passwords: PasswordService, sessions: SessionService
const clock = fakeClock()
const mailer = new FakeMailer()
const http = () => request(app.getHttpServer())
// ConfigService.get prefers process.env (test-db loads .env) over `load`, so pin APP_URL there.
const prevAppUrl = process.env.APP_URL

beforeAll(async () => {
  db = await createTestDb()
  process.env.APP_URL = 'http://app.test'
  const mod = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      TypeOrmModule.forRoot(typeOrmOptions(db.url)),
      TypeOrmModule.forFeature([AuthSession, PasswordReset]),
      UsersModule,
    ],
    controllers: [PasswordResetController],
    providers: [
      { provide: CLOCK, useValue: clock.now },
      { provide: MAILER, useValue: mailer },
      PasswordService, SessionService, PasswordResetService,
    ],
  }).compile()
  app = configureApp(mod.createNestApplication())
  await app.init()
  users = app.get(UsersService); passwords = app.get(PasswordService); sessions = app.get(SessionService)
})
afterAll(async () => {
  if (prevAppUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = prevAppUrl
  await app.close(); await db.drop()
})
beforeEach(() => { mailer.sent.length = 0 })

async function newUser(email: string) {
  return users.create({ email, displayName: 'U', passwordHash: await passwords.hash('old-password') })
}
async function forgot(email: string): Promise<string> {
  await http().post('/api/auth/forgot').send({ email }).expect(204)
  const m = mailer.sent.at(-1)!.body.match(/token=([A-Za-z0-9_-]+)/)
  return m![1]!
}

test('unknown email → 204 and no mail', async () => {
  await http().post('/api/auth/forgot').send({ email: 'ghost@x.io' }).expect(204)
  expect(mailer.sent).toHaveLength(0)
})

test('known email (any case) → 204, one mail with app link; DB stores only sha256(token)', async () => {
  await newUser('f1@x.io')
  const token = await forgot('F1@X.io')
  expect(mailer.sent).toHaveLength(1)
  expect(mailer.sent[0]!.to).toBe('f1@x.io')
  expect(mailer.sent[0]!.body).toContain(`http://app.test/reset?token=${token}`)
  const rows = await db.dataSource.getRepository(PasswordReset).find()
  expect(rows.some(r => r.tokenHash === hashToken(token))).toBe(true)
  expect(rows.some(r => r.tokenHash === token)).toBe(false)
})

test('reset sets the new password and revokes every session', async () => {
  const u = await newUser('f2@x.io')
  const s = await sessions.create(u.id)
  const token = await forgot('f2@x.io')
  await http().post('/api/auth/reset').send({ token, password: 'new-password' }).expect(204)
  const after = await users.findById(u.id)
  expect(await passwords.verify(after!.passwordHash, 'new-password')).toBe(true)
  expect(await passwords.verify(after!.passwordHash, 'old-password')).toBe(false)
  expect(await sessions.resolve(s.token)).toBeNull()
})

test('token works only once', async () => {
  await newUser('f3@x.io')
  const token = await forgot('f3@x.io')
  await http().post('/api/auth/reset').send({ token, password: 'new-password' }).expect(204)
  const res = await http().post('/api/auth/reset').send({ token, password: 'another-pass' }).expect(400)
  expect(res.body).toMatchObject({ code: 'RESET_TOKEN_INVALID' })
})

test('token valid just before 30 min, invalid after', async () => {
  await newUser('f4@x.io')
  const t1 = await forgot('f4@x.io')
  clock.advance(RESET_TTL_MS - 1000)
  await http().post('/api/auth/reset').send({ token: t1, password: 'new-password' }).expect(204)
  const t2 = await forgot('f4@x.io')
  clock.advance(RESET_TTL_MS + 1)
  await http().post('/api/auth/reset').send({ token: t2, password: 'new-password' }).expect(400)
})

test('a successful reset invalidates other outstanding tokens', async () => {
  await newUser('f5@x.io')
  const a = await forgot('f5@x.io')
  const b = await forgot('f5@x.io')
  await http().post('/api/auth/reset').send({ token: b, password: 'new-password' }).expect(204)
  await http().post('/api/auth/reset').send({ token: a, password: 'other-pass1' }).expect(400)
})

test('garbage token → 400 RESET_TOKEN_INVALID; short password → 400', async () => {
  const r = await http().post('/api/auth/reset').send({ token: 'garbage', password: 'new-password' }).expect(400)
  expect(r.body).toMatchObject({ code: 'RESET_TOKEN_INVALID' })
  await newUser('f6@x.io')
  const token = await forgot('f6@x.io')
  await http().post('/api/auth/reset').send({ token, password: 'short' }).expect(400)
})

test('mailer failure still answers 204 (no enumeration)', async () => {
  await newUser('f7@x.io')
  const send = mailer.send
  mailer.send = async () => { throw new Error('smtp down') }
  await http().post('/api/auth/forgot').send({ email: 'f7@x.io' }).expect(204)
  mailer.send = send
})
