import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'
import { createTestDb, type TestDb } from '../support/test-db'
import { fakeClock } from '../support/fake-clock'
import { typeOrmOptions } from '../../src/database/typeorm.options'
import { configureApp } from '../../src/app.setup'
import { CLOCK } from '../../src/common/clock'
import { CommonModule } from '../../src/common/common.module'
import { AuthModule } from '../../src/auth/auth.module'
import { User } from '../../src/users/user.entity'

let db: TestDb, app: INestApplication
const clock = fakeClock()
const http = () => request(app.getHttpServer())

beforeAll(async () => {
  db = await createTestDb()
  const mod = await Test.createTestingModule({
    imports: [CommonModule, TypeOrmModule.forRoot(typeOrmOptions(db.url)), AuthModule],
  }).overrideProvider(CLOCK).useValue(clock.now).compile()
  app = configureApp(mod.createNestApplication())
  await app.init()
})
afterAll(async () => { await app.close(); await db.drop() })

function sidFrom(res: request.Response): string {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? [])
  const c = raw.find(s => s.startsWith('sid='))
  if (!c) throw new Error('no sid cookie')
  return c.split(';')[0]!
}

test('register → 201 + httpOnly sid cookie → /me returns the user', async () => {
  const res = await http().post('/api/auth/register')
    .send({ email: ' Ann@X.io ', password: 'password1', displayName: ' Ann ' }).expect(201)
  expect(res.body.user).toMatchObject({ email: 'ann@x.io', displayName: 'Ann', avatar: null })
  expect(res.body.user.passwordHash).toBeUndefined()
  const setCookie = String(res.headers['set-cookie'])
  expect(setCookie).toMatch(/HttpOnly/i)
  expect(setCookie).toMatch(/SameSite=Lax/i)
  const me = await http().get('/api/me').set('Cookie', sidFrom(res)).expect(200)
  expect(me.body.user.email).toBe('ann@x.io')
})

test('stored password is argon2id, never plaintext', async () => {
  await http().post('/api/auth/register').send({ email: 'hash@x.io', password: 'password1', displayName: 'H' }).expect(201)
  const u = await db.dataSource.getRepository(User).findOneByOrFail({ email: 'hash@x.io' })
  expect(u.passwordHash.startsWith('$argon2id$')).toBe(true)
  expect(u.passwordHash).not.toContain('password1')
})

test('duplicate email (case-insensitive) → 409 EMAIL_TAKEN', async () => {
  await http().post('/api/auth/register').send({ email: 'dup@x.io', password: 'password1', displayName: 'D' }).expect(201)
  const res = await http().post('/api/auth/register').send({ email: 'DUP@x.io', password: 'password1', displayName: 'D' }).expect(409)
  expect(res.body).toMatchObject({ code: 'EMAIL_TAKEN' })
})

test.each([
  [{ email: 'short@x.io', password: '1234567', displayName: 'S' }],
  [{ email: 'not-an-email', password: 'password1', displayName: 'S' }],
  [{ email: 'blank@x.io', password: 'password1', displayName: '   ' }],
  [{ email: 'extra@x.io', password: 'password1', displayName: 'S', isAdmin: true }],
])('register validation → 400 (%o)', async body => {
  await http().post('/api/auth/register').send(body).expect(400)
})

test('login ok sets cookie; wrong password → 401 INVALID_CREDENTIALS; unknown email → 401', async () => {
  await http().post('/api/auth/register').send({ email: 'log@x.io', password: 'password1', displayName: 'L' }).expect(201)
  const ok = await http().post('/api/auth/login').send({ email: 'LOG@x.io', password: 'password1' }).expect(200)
  expect(ok.body.user.email).toBe('log@x.io')
  sidFrom(ok)
  const bad = await http().post('/api/auth/login').send({ email: 'log@x.io', password: 'nope-nope' }).expect(401)
  expect(bad.body).toMatchObject({ code: 'INVALID_CREDENTIALS' })
  await http().post('/api/auth/login').send({ email: 'ghost@x.io', password: 'password1' }).expect(401)
})

test('5 wrong logins → 6th is 429 even with the right password; unblocks after 15 min', async () => {
  await http().post('/api/auth/register').send({ email: 'rl@x.io', password: 'password1', displayName: 'R' }).expect(201)
  for (let i = 0; i < 5; i++)
    await http().post('/api/auth/login').send({ email: 'rl@x.io', password: 'wrong-pass' }).expect(401)
  const blocked = await http().post('/api/auth/login').send({ email: 'rl@x.io', password: 'password1' }).expect(429)
  expect(blocked.body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' })
  clock.advance(15 * 60_000 + 1)
  await http().post('/api/auth/login').send({ email: 'rl@x.io', password: 'password1' }).expect(200)
})

test('successful login resets the failure counter', async () => {
  await http().post('/api/auth/register').send({ email: 'reset@x.io', password: 'password1', displayName: 'R' }).expect(201)
  for (let i = 0; i < 4; i++)
    await http().post('/api/auth/login').send({ email: 'reset@x.io', password: 'wrong-pass' }).expect(401)
  await http().post('/api/auth/login').send({ email: 'reset@x.io', password: 'password1' }).expect(200)
  for (let i = 0; i < 4; i++)
    await http().post('/api/auth/login').send({ email: 'reset@x.io', password: 'wrong-pass' }).expect(401)
  await http().post('/api/auth/login').send({ email: 'reset@x.io', password: 'password1' }).expect(200)
})

test('logout → 204, clears cookie, old sid no longer works', async () => {
  const reg = await http().post('/api/auth/register').send({ email: 'out@x.io', password: 'password1', displayName: 'O' }).expect(201)
  const sid = sidFrom(reg)
  const out = await http().post('/api/auth/logout').set('Cookie', sid).expect(204)
  expect(String(out.headers['set-cookie'])).toMatch(/sid=;/)
  await http().get('/api/me').set('Cookie', sid).expect(401)
  await http().post('/api/auth/logout').expect(204)
})

test('/me without cookie → 401 UNAUTHENTICATED', async () => {
  const res = await http().get('/api/me').expect(401)
  expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED' })
})
