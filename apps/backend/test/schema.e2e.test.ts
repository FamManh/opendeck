import 'reflect-metadata'
import { createTestDb, type TestDb } from './support/test-db'
import { User } from '../src/users/user.entity'

let db: TestDb
beforeAll(async () => { db = await createTestDb() })
afterAll(async () => { await db.drop() })

test('migrations create every §8 table', async () => {
  const rows: { table_name: string }[] = await db.dataSource.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`)
  const names = rows.map(r => r.table_name)
  for (const t of ['users','auth_sessions','password_resets','rooms','items','criteria','votes','outcomes'])
    expect(names).toContain(t)
})

test('users.email is unique', async () => {
  const repo = db.dataSource.getRepository(User)
  await repo.insert({ email: 'a@x.io', passwordHash: 'h', displayName: 'A' })
  await expect(repo.insert({ email: 'a@x.io', passwordHash: 'h', displayName: 'B' }))
    .rejects.toMatchObject({ code: '23505' })
})

test('each TestDb lives in its own schema', async () => {
  const other = await createTestDb()
  const [{ s: s1 }] = await db.dataSource.query('SELECT current_schema() AS s')
  const [{ s: s2 }] = await other.dataSource.query('SELECT current_schema() AS s')
  expect(s1).not.toBe(s2)
  await other.drop()
})
