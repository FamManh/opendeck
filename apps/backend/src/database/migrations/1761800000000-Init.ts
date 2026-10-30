import type { MigrationInterface, QueryRunner } from 'typeorm'

export class Init1761800000000 implements MigrationInterface {
  name = 'Init1761800000000'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "email" varchar(254) NOT NULL UNIQUE,
      "passwordHash" text NOT NULL,
      "displayName" varchar(40) NOT NULL,
      "avatar" varchar(32),
      "emailVerifiedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now())`)
    await q.query(`CREATE TABLE "auth_sessions" (
      "id" char(64) PRIMARY KEY,
      "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now())`)
    await q.query(`CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId")`)
    await q.query(`CREATE TABLE "password_resets" (
      "tokenHash" char(64) PRIMARY KEY,
      "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "expiresAt" timestamptz NOT NULL,
      "usedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now())`)
    await q.query(`CREATE TABLE "rooms" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "slug" char(10) NOT NULL UNIQUE,
      "ownerId" uuid NOT NULL REFERENCES "users"("id"),
      "name" varchar(80) NOT NULL,
      "passwordHash" text,
      "requireApproval" boolean NOT NULL DEFAULT false,
      "locked" boolean NOT NULL DEFAULT false,
      "templateId" varchar(32) NOT NULL DEFAULT 'estimate',
      "config" jsonb NOT NULL,
      "liveState" jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now())`)
    await q.query(`CREATE TABLE "items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "roomId" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
      "source" varchar(16) NOT NULL DEFAULT 'manual',
      "externalRef" varchar(64),
      "title" text NOT NULL,
      "description" text NOT NULL DEFAULT '',
      "order" integer NOT NULL,
      "status" varchar(16) NOT NULL DEFAULT 'pending')`)
    await q.query(`CREATE INDEX "items_roomId_idx" ON "items"("roomId")`)
    await q.query(`CREATE TABLE "criteria" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "roomId" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
      "name" varchar(80) NOT NULL,
      "scale" jsonb NOT NULL)`)
    await q.query(`CREATE TABLE "votes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "itemId" uuid NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
      "criterionId" uuid NOT NULL REFERENCES "criteria"("id") ON DELETE CASCADE,
      "participantKey" varchar(64) NOT NULL,
      "round" integer NOT NULL,
      "cardId" varchar(32) NOT NULL,
      "anonymous" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("itemId","criterionId","participantKey","round"))`)
    await q.query(`CREATE TABLE "outcomes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "itemId" uuid NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
      "value" varchar(32) NOT NULL,
      "note" text NOT NULL DEFAULT '',
      "decidedBy" varchar(64) NOT NULL,
      "decidedAt" timestamptz NOT NULL DEFAULT now())`)
  }
  async down(q: QueryRunner): Promise<void> {
    for (const t of ['outcomes','votes','criteria','items','rooms','password_resets','auth_sessions','users'])
      await q.query(`DROP TABLE "${t}"`)
  }
}
