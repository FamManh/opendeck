import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { AppModule } from '../../src/app.module'
import { configureApp } from '../../src/app.setup'
import { CLOCK } from '../../src/common/clock'
import { MAILER } from '../../src/mail/mailer'
import { fakeClock } from '../support/fake-clock'
import { FakeMailer } from '../support/fake-mailer'
import { createTestDb, type TestDb } from '../support/test-db'

export interface TestApp {
  app: INestApplication
  ds: DataSource
  clock: ReturnType<typeof fakeClock>
  mailer: FakeMailer
  db: TestDb
  /** keepDb: giữ schema để dựng lại app trên cùng DB (test restart); app cuối cùng gọi close() để xoá. */
  close(opts?: { keepDb?: boolean }): Promise<void>
}

/** Full AppModule on an isolated, migrated Postgres schema with fake clock and mailer. Call in beforeAll, close() in afterAll. */
export async function createTestApp(opts: { db?: TestDb } = {}): Promise<TestApp> {
  const db = opts.db ?? await createTestDb()
  const originalUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = db.url
  const clock = fakeClock()
  const mailer = new FakeMailer()
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK).useValue(clock.now)
    .overrideProvider(MAILER).useValue(mailer)
    .compile()
  const app = configureApp(mod.createNestApplication())
  await app.init()
  return {
    app, ds: app.get<DataSource>(DataSource), clock, mailer, db,
    async close({ keepDb = false } = {}) {
      await app.close()
      if (!keepDb) await db.drop()
      process.env.DATABASE_URL = originalUrl
    },
  }
}
