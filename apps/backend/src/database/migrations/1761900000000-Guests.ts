import type { MigrationInterface, QueryRunner } from 'typeorm'

export class Guests1761900000000 implements MigrationInterface {
  name = 'Guests1761900000000'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "guests" (
      "id" char(32) PRIMARY KEY,
      "name" varchar(40) NOT NULL,
      "avatar" varchar(32) NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now())`)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "guests"`)
  }
}
