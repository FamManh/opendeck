import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { typeOrmOptions } from './typeorm.options'

// Used by the TypeORM CLI (migration:generate / migration:run) on the compiled dist/ output.
process.loadEnvFile?.('.env')
export default new DataSource(typeOrmOptions(process.env.DATABASE_URL ?? ''))
