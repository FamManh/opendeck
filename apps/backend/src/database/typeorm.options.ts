import type { DataSourceOptions } from 'typeorm'
import { ENTITIES } from './entities'
import { MIGRATIONS } from './migrations'

// Mảng tường minh, không dùng glob: glob làm TypeORM require lại file .ts ngoài SWC khi chạy Vitest.
export function typeOrmOptions(databaseUrl: string): DataSourceOptions {
  return { type: 'postgres', url: databaseUrl, entities: ENTITIES, migrations: MIGRATIONS, synchronize: false }
}
