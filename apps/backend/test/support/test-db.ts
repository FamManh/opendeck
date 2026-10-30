import 'reflect-metadata'
import { randomBytes } from 'node:crypto'
import { DataSource } from 'typeorm'
import { typeOrmOptions } from '../../src/database/typeorm.options'

try { process.loadEnvFile('.env') } catch { /* .env là tuỳ chọn khi đã có biến môi trường */ }

export interface TestDb { url: string; dataSource: DataSource; drop(): Promise<void> }

/** Mỗi lần gọi tạo một schema Postgres riêng đã chạy migration, để các file test chạy song song an toàn. */
export async function createTestDb(): Promise<TestDb> {
  const base = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL
  if (!base) throw new Error('Set DATABASE_URL_TEST or DATABASE_URL (apps/backend/.env)')
  const schema = `t_${randomBytes(6).toString('hex')}`
  const admin = new DataSource({ type: 'postgres', url: base })
  await admin.initialize()
  await admin.query(`CREATE SCHEMA "${schema}"`)
  await admin.destroy()
  const u = new URL(base)
  u.searchParams.set('options', `-c search_path=${schema}`)
  const url = u.toString()
  const dataSource = new DataSource(typeOrmOptions(url))
  await dataSource.initialize()
  await dataSource.runMigrations()
  return {
    url,
    dataSource,
    async drop() {
      await dataSource.query(`DROP SCHEMA "${schema}" CASCADE`)
      await dataSource.destroy()
    },
  }
}
