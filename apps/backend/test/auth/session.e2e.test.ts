import 'reflect-metadata'
import { Controller, Get, UseGuards, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'
import { createTestDb, type TestDb } from '../support/test-db'
import { fakeClock } from '../support/fake-clock'
import { typeOrmOptions } from '../../src/database/typeorm.options'
import { configureApp } from '../../src/app.setup'
import { CLOCK } from '../../src/common/clock'
import { UsersModule } from '../../src/users/users.module'
import { UsersService } from '../../src/users/users.service'
import { AuthSession } from '../../src/auth/auth-session.entity'
import { SessionService, SESSION_TTL_MS, hashToken } from '../../src/auth/session.service'
import { SessionGuard } from '../../src/auth/session.guard'
import { CurrentUser } from '../../src/auth/current-user.decorator'
import { setSessionCookie, clearSessionCookie, SID_COOKIE } from '../../src/auth/session-cookie'
import type { User } from '../../src/users/user.entity'

@Controller('probe')
class ProbeController {
  @Get() @UseGuards(SessionGuard)
  who(@CurrentUser() u: User) { return { id: u.id } }
}

let db: TestDb, app: INestApplication, sessions: SessionService, users: UsersService
const clock = fakeClock()

beforeAll(async () => {
  db = await createTestDb()
  const mod = await Test.createTestingModule({
    imports: [TypeOrmModule.forRoot(typeOrmOptions(db.url)), TypeOrmModule.forFeature([AuthSession]), UsersModule],
    controllers: [ProbeController],
    providers: [{ provide: CLOCK, useValue: clock.now }, SessionService, SessionGuard],
  }).compile()
  app = configureApp(mod.createNestApplication())
  await app.init()
  sessions = app.get(SessionService)
  users = app.get(UsersService)
})
afterAll(async () => { await app.close(); await db.drop() })

async function newUser(email: string) { return users.create({ email, passwordHash: 'x', displayName: 'U' }) }

test('create → resolve returns the user; DB stores only the sha256 of the token', async () => {
  const u = await newUser('s1@x.io')
  const { token, expiresAt } = await sessions.create(u.id)
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(expiresAt.getTime()).toBe(clock.now() + SESSION_TTL_MS)
  expect((await sessions.resolve(token))?.id).toBe(u.id)
  const rows = await db.dataSource.getRepository(AuthSession).findBy({ userId: u.id })
  expect(rows.map(r => r.id)).toEqual([hashToken(token)])
  expect(rows[0]!.id).not.toBe(token)
})

test('resolve returns null for unknown, undefined and expired tokens', async () => {
  const u = await newUser('s2@x.io')
  const { token } = await sessions.create(u.id)
  expect(await sessions.resolve(undefined)).toBeNull()
  expect(await sessions.resolve('nope')).toBeNull()
  clock.advance(SESSION_TTL_MS + 1)
  expect(await sessions.resolve(token)).toBeNull()
})

test('revoke and revokeAllForUser', async () => {
  const u = await newUser('s3@x.io')
  const a = await sessions.create(u.id)
  const b = await sessions.create(u.id)
  await sessions.revoke(a.token)
  expect(await sessions.resolve(a.token)).toBeNull()
  expect(await sessions.resolve(b.token)).not.toBeNull()
  await sessions.revokeAllForUser(u.id)
  expect(await sessions.resolve(b.token)).toBeNull()
})

test('SessionGuard: 401 UNAUTHENTICATED without cookie, 200 with valid sid', async () => {
  const res = await request(app.getHttpServer()).get('/api/probe').expect(401)
  expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED' })
  const u = await newUser('s4@x.io')
  const { token } = await sessions.create(u.id)
  await request(app.getHttpServer()).get('/api/probe').set('Cookie', `sid=${token}`).expect(200, { id: u.id })
})

test('session cookie flags', () => {
  const calls: unknown[][] = []
  const res = { cookie: (...a: unknown[]) => calls.push(a), clearCookie: (...a: unknown[]) => calls.push(a) } as never
  const exp = new Date(0)
  setSessionCookie(res, 'tok', exp)
  expect(calls[0]).toEqual([SID_COOKIE, 'tok', { httpOnly: true, sameSite: 'lax', secure: false, path: '/', expires: exp }])
  clearSessionCookie(res)
  expect(calls[1]).toEqual([SID_COOKIE, { httpOnly: true, sameSite: 'lax', secure: false, path: '/' }])
})
