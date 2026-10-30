import request from 'supertest'
import { createTestApp, type TestApp } from './test-app'

let t: TestApp
beforeAll(async () => { t = await createTestApp() })
afterAll(() => t.close())

test('createTestApp boots the full app with fakes', async () => {
  await request(t.app.getHttpServer()).post('/api/auth/forgot').send({ email: 'none@x.io' }).expect(204)
  expect(t.mailer.sent).toHaveLength(0)
  const [{ n }] = await t.ds.query('SELECT count(*)::int AS n FROM users')
  expect(n).toBe(0)
})
