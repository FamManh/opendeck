# Task 5 — Server: DB schema + đăng nhập (NestJS + TypeORM) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend có schema Postgres theo §8, có đăng ký, đăng nhập, đăng xuất, `/me`, quên mật khẩu và đặt lại mật khẩu. Rate limit, argon2id và cookie session đúng §7.

**Architecture:** Dựng tiếp trên skeleton NestJS 10 + TypeORM 0.3 mà session kia đang làm (`AppModule`, `DatabaseModule`, `configureApp`, `HealthModule`). Mỗi phần là một provider Nest nhỏ, chỉ làm một việc. Test chạm DB dùng Postgres thật, mỗi file test có **schema riêng** (`t_<random>`), nên các subagent chạy test song song không giẫm lên nhau. Thời gian và mailer được inject qua token `CLOCK`/`MAILER` để test giả được.

**Tech Stack:** NestJS 10, TypeORM 0.3 + pg, PostgreSQL 16 (container `opendeck-db-1`, port 5433), argon2, cookie-parser, class-validator + class-transformer, Vitest 2 + unplugin-swc, supertest.

**Nguồn:** Plan 1 Task 5 (`docs/superpowers/plans/2026-10-29-01-core-realtime-voting.md`), spec §7, §8; roadmap §3 (không xác minh email; schema có `emailVerifiedAt`).

**Nơi lưu khi được duyệt:** copy sang `docs/superpowers/plans/2026-10-30-05-task5-server-auth.md`.

## Global Constraints

- Mật khẩu băm bằng **argon2id**; DB không bao giờ chứa plaintext (`passwordHash` bắt đầu bằng `$argon2id$`).
- Mật khẩu tối thiểu **8** ký tự, tối đa 200. `displayName` sau khi trim dài 1–40 ký tự. Email trim + lowercase trước khi lưu và tra cứu.
- Đăng nhập sai: tối đa **5 lần / 15 phút**, cửa sổ trượt, key `email|ip`. Lần thứ 6 trả **429** kể cả khi mật khẩu đúng. Đăng nhập thành công thì xoá bộ đếm.
- Cookie `sid`: httpOnly, SameSite=Lax, `Secure` khi `NODE_ENV=production`, path `/`, sống **30 ngày**. Cookie chứa token ngẫu nhiên 32 byte (base64url); DB chỉ lưu **sha256 hex**.
- Token reset: 32 byte ngẫu nhiên, DB chỉ lưu sha256 hex, hết hạn sau **30 phút**, chỉ dùng **1 lần**. Reset thành công thì xoá mọi `AuthSession` của user và vô hiệu các token reset còn lại.
- `POST /api/auth/forgot` **luôn trả 204**, không lộ email có tồn tại hay không.
- Mã lỗi trong body: `EMAIL_TAKEN` (409), `INVALID_CREDENTIALS` (401), `TOO_MANY_ATTEMPTS` (429), `RESET_TOKEN_INVALID` (400), `UNAUTHENTICATED` (401). Lỗi validation dùng định dạng mặc định của Nest (400).
- Không thêm dependency ngoài danh sách ở Task 5.0. **Chỉ Task 5.0 được sửa `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml`**, để tránh conflict với nhánh Task 2–4.
- Không đụng `apps/backend/src/domain/**` (thuộc chuỗi Task 2–4).

## Quyết định trong task này

- **Stack: NestJS + TypeORM + pg**, thay Fastify + Prisma của Plan 1 (user chốt 2026-10-30). HTTP API vẫn giữ y như Plan 1.
- **Entity và migration khai báo bằng mảng tường minh** (`ENTITIES`, `MIGRATIONS`), không dùng glob `*.entity.{ts,js}`. Lý do: dưới Vitest, glob khiến TypeORM `require` file `.ts` lần thứ hai ngoài pipeline SWC, làm hỏng decorator metadata. Phải sửa `typeorm.options.ts`.
- **Migration viết tay bằng SQL** (`1761800000000-Init.ts`), tên cột camelCase có quote, khớp naming mặc định của TypeORM.
- **Cách ly test:** `createTestDb()` tạo schema `t_xxxx`, nối bằng `?options=-c search_path=t_xxxx`, chạy migration, rồi `DROP SCHEMA … CASCADE` khi xong. DB lấy từ `DATABASE_URL_TEST`, nếu không có thì `DATABASE_URL` (đọc từ `apps/backend/.env`).
- `AttemptLimiter` viết generic để Task 6 dùng lại cho mật khẩu phòng (5 lần / 10 phút).
- Bảng `rooms/items/criteria/votes/outcomes` tạo ở đây (theo Plan 1). Entity nằm ở `src/rooms/entities/`, nhưng **chưa** có `RoomsModule`; Task 6 sẽ tạo.
- IP lấy từ `req.ip`. Chưa cấu hình `trust proxy`, ghi chú lại cho bước deploy.

## Song song hoá

Thứ tự giữa Task 5 và phần còn lại của roadmap:

```
Task 1 ✅ ──┬── Task 2 → Task 3 → Task 4   (session/nhánh khác, chỉ sửa src/domain)
            └── Task 5 (plan này, worktree riêng)
                      └─ cả hai xong → Task 6
```

Bên trong Task 5 có 4 wave. Các task trong cùng một wave sửa **các file tách biệt**, nên giao cho subagent chạy song song được:

| Wave | Task | Chạy song song? | Cần xong trước |
|---|---|---|---|
| 0 | **5.0** Nền: deps, entity, migration, Users, Clock, Mailer, test helpers | — (1 subagent) | skeleton Nest đã commit |
| 1 | **5.1** PasswordService + AttemptLimiter | ✅ cùng 5.2 | 5.0 |
| 1 | **5.2** SessionService + cookie + SessionGuard + @CurrentUser | ✅ cùng 5.1 | 5.0 |
| 2 | **5.3** AuthController (register/login/logout) + MeController + AuthModule | ✅ cùng 5.4 | 5.1, 5.2 |
| 2 | **5.4** PasswordResetService + Controller (forgot/reset) | ✅ cùng 5.3 | 5.1, 5.2 |
| 3 | **5.5** Nối vào AppModule + e2e toàn luồng + docs | — (orchestrator) | 5.3, 5.4 |

**Luật khi chạy song song:**
1. **Tiền đề:** skeleton Nest + `docker-compose.yml` của session kia phải được commit lên `main` trước, và `pnpm --filter @opendeck/backend test` phải xanh.
2. Tạo worktree: `git worktree add ../opendeck-task5 -b feat/task5-auth main`, sau đó `pnpm install` và `cp apps/backend/.env ../opendeck-task5/apps/backend/.env`. Mọi subagent của Task 5 làm việc trong `../opendeck-task5`.
3. Subagent **không tự commit**, vì commit song song sẽ đụng `index.lock`. Orchestrator review từng task, rồi commit đúng các path của task đó với message đã ghi.
4. Subagent chỉ sửa các file liệt kê trong mục **Files** của task mình. Cần thêm file nào khác thì báo orchestrator.
5. Test DB của mỗi file chạy trong schema riêng, nên chạy `test:e2e` song song vẫn an toàn.
6. Merge về `main`: rebase `feat/task5-auth` lên `main` (lúc đó có thể đã có Task 2–4). Conflict, nếu có, chỉ nằm ở `pnpm-lock.yaml`; giải bằng cách chạy lại `pnpm install`.

---

## File Structure

```
apps/backend/
  package.json                         (5.0) + deps, script test:e2e
  .env.example                         (5.0) + DATABASE_URL_TEST, APP_URL
  src/app.setup.ts                     (5.0) + cookieParser, ValidationPipe
  src/app.module.ts                    (5.5) import CommonModule, MailModule, UsersModule, AuthModule
  src/common/clock.ts                  (5.0) CLOCK token, Clock type
  src/common/common.module.ts          (5.0) @Global, cung cấp CLOCK
  src/common/attempt-limiter.ts (+test)(5.1) generic sliding-window limiter
  src/mail/mailer.ts                   (5.0) Mailer interface, MAILER token
  src/mail/console.mailer.ts           (5.0) log ra console
  src/mail/mail.module.ts              (5.0) @Global, MAILER → ConsoleMailer
  src/database/typeorm.options.ts      (5.0) dùng ENTITIES/MIGRATIONS
  src/database/entities.ts             (5.0) ENTITIES
  src/database/migrations/index.ts     (5.0) MIGRATIONS
  src/database/migrations/1761800000000-Init.ts (5.0)
  src/users/{user.entity,users.service,users.module}.ts (5.0)
  src/auth/{auth-session,password-reset}.entity.ts      (5.0)
  src/rooms/entities/{room,item,criterion,vote,outcome}.entity.ts (5.0)
  src/auth/password.service.ts (+test) (5.1)
  src/auth/login-limiter.ts            (5.1) LOGIN_LIMITER provider
  src/auth/session.service.ts          (5.2)
  src/auth/session-cookie.ts           (5.2)
  src/auth/session.guard.ts            (5.2)
  src/auth/current-user.decorator.ts   (5.2)
  src/auth/dto.ts                      (5.3) RegisterDto, LoginDto
  src/auth/auth.controller.ts          (5.3)
  src/auth/me.controller.ts            (5.3)
  src/auth/auth.module.ts              (5.3; 5.5 bổ sung reset)
  src/auth/password-reset.dto.ts       (5.4)
  src/auth/password-reset.service.ts   (5.4)
  src/auth/password-reset.controller.ts(5.4)
  test/support/{test-db,fake-clock,fake-mailer}.ts (5.0)
  test/schema.e2e.test.ts              (5.0)
  test/auth/session.e2e.test.ts        (5.2)
  test/auth/auth.e2e.test.ts           (5.3)
  test/auth/password-reset.e2e.test.ts (5.4)
  test/auth/full-flow.e2e.test.ts      (5.5)
```

Lệnh test (chạy trong `apps/backend` hoặc dùng filter):
- Unit: `pnpm --filter @opendeck/backend test`
- DB: `pnpm --filter @opendeck/backend test:e2e` (cần container `opendeck-db-1` đang chạy, xem `docker compose up -d db`)

---
### Task 5.0: Nền — deps, schema, Users, Clock, Mailer, test helpers (Wave 0)

**Files:**
- Modify: `apps/backend/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `apps/backend/.env.example`, `apps/backend/src/app.setup.ts`, `apps/backend/src/database/typeorm.options.ts`
- Create: `src/common/{clock,common.module}.ts`, `src/mail/{mailer,console.mailer,mail.module}.ts`, `src/database/entities.ts`, `src/database/migrations/{index,1761800000000-Init}.ts`, `src/users/{user.entity,users.service,users.module}.ts`, `src/auth/{auth-session,password-reset}.entity.ts`, `src/rooms/entities/{room,item,criterion,vote,outcome}.entity.ts`, `test/support/{test-db,fake-clock,fake-mailer}.ts`
- Test: `test/schema.e2e.test.ts`

**Interfaces — Produces:**
```ts
// common/clock.ts
export const CLOCK = Symbol('CLOCK'); export type Clock = () => number   // epoch ms
// mail/mailer.ts
export const MAILER = Symbol('MAILER')
export interface Mailer { send(to: string, subject: string, body: string): Promise<void> }
// users/users.service.ts
export function normalizeEmail(email: string): string
export interface PublicUser { id: string; email: string; displayName: string; avatar: string | null }
export function toPublicUser(u: User): PublicUser
class UsersService {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  create(input: { email: string; passwordHash: string; displayName: string }): Promise<User>
  setPasswordHash(userId: string, passwordHash: string): Promise<void>
}
// entities: User, AuthSession{id(sha256 hex),userId,expiresAt,createdAt}, PasswordReset{tokenHash,userId,expiresAt,usedAt|null,createdAt},
//           Room, Item, Criterion, Vote, Outcome  (các field như migration bên dưới)
// test/support
export interface TestDb { url: string; dataSource: DataSource; drop(): Promise<void> }
export function createTestDb(): Promise<TestDb>
export function fakeClock(start?: number): { now: Clock; advance(ms: number): void }
export class FakeMailer implements Mailer { sent: { to: string; subject: string; body: string }[] }
```

- [ ] **Step 1: Thêm deps** (chạy ở root repo):
```bash
pnpm --filter @opendeck/backend add argon2@^0.41.1 cookie-parser@^1.4.7 class-validator@^0.14.1 class-transformer@^0.5.1
pnpm --filter @opendeck/backend add -D @types/cookie-parser@^1.4.8
```
Thêm `argon2: true` vào `allowBuilds` trong `pnpm-workspace.yaml`, rồi chạy `pnpm install` để build binary native. Thêm script vào `apps/backend/package.json`: `"test:e2e": "vitest run -c vitest.e2e.config.ts"` (nếu chưa có). Thêm vào `.env.example`:
```
DATABASE_URL_TEST=postgres://opendeck:opendeck@localhost:5433/opendeck
APP_URL=http://localhost:5173
```
Kiểm tra: `node -e "require('argon2')"` chạy trong `apps/backend` không lỗi.

- [ ] **Step 2: Viết test fail `test/schema.e2e.test.ts`**
```ts
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
```

- [ ] **Step 3: Chạy** `pnpm --filter @opendeck/backend test:e2e -- schema`. Kỳ vọng: FAIL (`Cannot find module './support/test-db'`).

- [ ] **Step 4: Implement common + mail**
```ts
// src/common/clock.ts
export const CLOCK = Symbol('CLOCK')
export type Clock = () => number
```
```ts
// src/common/common.module.ts
import { Global, Module } from '@nestjs/common'
import { CLOCK, type Clock } from './clock'

@Global()
@Module({ providers: [{ provide: CLOCK, useValue: (() => Date.now()) satisfies Clock }], exports: [CLOCK] })
export class CommonModule {}
```
```ts
// src/mail/mailer.ts
export const MAILER = Symbol('MAILER')
export interface Mailer { send(to: string, subject: string, body: string): Promise<void> }
```
```ts
// src/mail/console.mailer.ts
import { Injectable, Logger } from '@nestjs/common'
import type { Mailer } from './mailer'

/** Dev mailer: chưa có SMTP, chỉ log thư ra console. */
@Injectable()
export class ConsoleMailer implements Mailer {
  private readonly log = new Logger('Mail')
  async send(to: string, subject: string, body: string): Promise<void> {
    this.log.log(`to=${to} subject=${subject}\n${body}`)
  }
}
```
```ts
// src/mail/mail.module.ts
import { Global, Module } from '@nestjs/common'
import { MAILER } from './mailer'
import { ConsoleMailer } from './console.mailer'

@Global()
@Module({ providers: [{ provide: MAILER, useClass: ConsoleMailer }], exports: [MAILER] })
export class MailModule {}
```

- [ ] **Step 5: Implement migration** `src/database/migrations/1761800000000-Init.ts`
```ts
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
```
```ts
// src/database/migrations/index.ts
import { Init1761800000000 } from './1761800000000-Init'
export const MIGRATIONS = [Init1761800000000]
```

- [ ] **Step 6: Implement entities** (TypeORM; tên cột = tên property, khớp migration)
```ts
// src/users/user.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'varchar', length: 254, unique: true }) email: string
  @Column({ type: 'text' }) passwordHash: string
  @Column({ type: 'varchar', length: 40 }) displayName: string
  @Column({ type: 'varchar', length: 32, nullable: true }) avatar: string | null
  @Column({ type: 'timestamptz', nullable: true }) emailVerifiedAt: Date | null
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
}
```
```ts
// src/auth/auth-session.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

@Entity('auth_sessions')
export class AuthSession {
  @PrimaryColumn({ type: 'char', length: 64 }) id: string   // sha256 hex của token trong cookie
  @Column({ type: 'uuid' }) userId: string
  @Column({ type: 'timestamptz' }) expiresAt: Date
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
}
```
```ts
// src/auth/password-reset.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

@Entity('password_resets')
export class PasswordReset {
  @PrimaryColumn({ type: 'char', length: 64 }) tokenHash: string
  @Column({ type: 'uuid' }) userId: string
  @Column({ type: 'timestamptz' }) expiresAt: Date
  @Column({ type: 'timestamptz', nullable: true }) usedAt: Date | null
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
}
```
```ts
// src/rooms/entities/room.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'char', length: 10, unique: true }) slug: string
  @Column({ type: 'uuid' }) ownerId: string
  @Column({ type: 'varchar', length: 80 }) name: string
  @Column({ type: 'text', nullable: true }) passwordHash: string | null
  @Column({ type: 'boolean', default: false }) requireApproval: boolean
  @Column({ type: 'boolean', default: false }) locked: boolean
  @Column({ type: 'varchar', length: 32, default: 'estimate' }) templateId: string
  @Column({ type: 'jsonb' }) config: unknown
  @Column({ type: 'jsonb', nullable: true }) liveState: unknown | null
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
}
```
```ts
// src/rooms/entities/item.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) roomId: string
  @Column({ type: 'varchar', length: 16, default: 'manual' }) source: string
  @Column({ type: 'varchar', length: 64, nullable: true }) externalRef: string | null
  @Column({ type: 'text' }) title: string
  @Column({ type: 'text', default: '' }) description: string
  @Column({ type: 'integer' }) order: number
  @Column({ type: 'varchar', length: 16, default: 'pending' }) status: string
}
```
```ts
// src/rooms/entities/criterion.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('criteria')
export class Criterion {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) roomId: string
  @Column({ type: 'varchar', length: 80 }) name: string
  @Column({ type: 'jsonb' }) scale: unknown
}
```
```ts
// src/rooms/entities/vote.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm'

@Entity('votes')
@Unique(['itemId', 'criterionId', 'participantKey', 'round'])
export class Vote {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) itemId: string
  @Column({ type: 'uuid' }) criterionId: string
  @Column({ type: 'varchar', length: 64 }) participantKey: string
  @Column({ type: 'integer' }) round: number
  @Column({ type: 'varchar', length: 32 }) cardId: string
  @Column({ type: 'boolean', default: false }) anonymous: boolean
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
}
```
```ts
// src/rooms/entities/outcome.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('outcomes')
export class Outcome {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) itemId: string
  @Column({ type: 'varchar', length: 32 }) value: string
  @Column({ type: 'text', default: '' }) note: string
  @Column({ type: 'varchar', length: 64 }) decidedBy: string
  @Column({ type: 'timestamptz', default: () => 'now()' }) decidedAt: Date
}
```
```ts
// src/database/entities.ts
import { User } from '../users/user.entity'
import { AuthSession } from '../auth/auth-session.entity'
import { PasswordReset } from '../auth/password-reset.entity'
import { Room } from '../rooms/entities/room.entity'
import { Item } from '../rooms/entities/item.entity'
import { Criterion } from '../rooms/entities/criterion.entity'
import { Vote } from '../rooms/entities/vote.entity'
import { Outcome } from '../rooms/entities/outcome.entity'

export const ENTITIES = [User, AuthSession, PasswordReset, Room, Item, Criterion, Vote, Outcome]
```
```ts
// src/database/typeorm.options.ts  (thay toàn bộ)
import type { DataSourceOptions } from 'typeorm'
import { ENTITIES } from './entities'
import { MIGRATIONS } from './migrations'

// Mảng tường minh, không dùng glob: glob làm TypeORM require lại file .ts ngoài SWC khi chạy Vitest.
export function typeOrmOptions(databaseUrl: string): DataSourceOptions {
  return { type: 'postgres', url: databaseUrl, entities: ENTITIES, migrations: MIGRATIONS, synchronize: false }
}
```

- [ ] **Step 7: Implement Users**
```ts
// src/users/users.service.ts
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { User } from './user.entity'

export interface PublicUser { id: string; email: string; displayName: string; avatar: string | null }

export function normalizeEmail(email: string): string { return email.trim().toLowerCase() }

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, email: u.email, displayName: u.displayName, avatar: u.avatar }
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findByEmail(email: string): Promise<User | null> { return this.repo.findOneBy({ email: normalizeEmail(email) }) }
  findById(id: string): Promise<User | null> { return this.repo.findOneBy({ id }) }

  create(input: { email: string; passwordHash: string; displayName: string }): Promise<User> {
    return this.repo.save(this.repo.create({
      email: normalizeEmail(input.email), passwordHash: input.passwordHash, displayName: input.displayName.trim(),
    }))
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.repo.update({ id: userId }, { passwordHash })
  }
}
```
```ts
// src/users/users.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from './user.entity'
import { UsersService } from './users.service'

@Module({ imports: [TypeOrmModule.forFeature([User])], providers: [UsersService], exports: [UsersService, TypeOrmModule] })
export class UsersModule {}
```

- [ ] **Step 8: Implement `app.setup.ts`** (thêm cookie + validation, giữ nguyên phần cũ)
```ts
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import cookieParser from 'cookie-parser'

export const API_PREFIX = 'api'

/** Shared HTTP setup for main.ts and tests, so tests hit the same routes as production. */
export function configureApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix(API_PREFIX)
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.enableShutdownHooks()
  return app
}
```

- [ ] **Step 9: Implement test helpers**
```ts
// test/support/test-db.ts
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
```
```ts
// test/support/fake-clock.ts
import type { Clock } from '../../src/common/clock'

export function fakeClock(start = Date.UTC(2026, 9, 30, 12)): { now: Clock; advance(ms: number): void } {
  let t = start
  return { now: () => t, advance: (ms: number) => { t += ms } }
}
```
```ts
// test/support/fake-mailer.ts
import type { Mailer } from '../../src/mail/mailer'

export class FakeMailer implements Mailer {
  readonly sent: { to: string; subject: string; body: string }[] = []
  async send(to: string, subject: string, body: string): Promise<void> { this.sent.push({ to, subject, body }) }
}
```

- [ ] **Step 10: Chạy** `pnpm --filter @opendeck/backend test:e2e && pnpm --filter @opendeck/backend test && pnpm --filter @opendeck/backend typecheck`. Kỳ vọng: PASS hết, kể cả `test/app.e2e.test.ts` và `health` có sẵn (chứng minh đổi glob sang mảng không làm hỏng app).

- [ ] **Step 11: Commit** (orchestrator)
```bash
git add pnpm-workspace.yaml pnpm-lock.yaml apps/backend
git commit -m "feat(server): schema, users, clock/mailer and isolated test DB"
```

---
### Task 5.1: PasswordService + AttemptLimiter (Wave 1, chạy song song với 5.2)

**Files:**
- Create: `apps/backend/src/auth/password.service.ts`, `apps/backend/src/common/attempt-limiter.ts`, `apps/backend/src/auth/login-limiter.ts`
- Test: `apps/backend/src/auth/password.service.test.ts`, `apps/backend/src/common/attempt-limiter.test.ts` (unit, không DB)

**Interfaces:**
- Consumes: `Clock` (5.0)
- Produces:
```ts
class PasswordService { hash(plain: string): Promise<string>; verify(hash: string, plain: string): Promise<boolean> }
class AttemptLimiter {
  constructor(max: number, windowMs: number, now: Clock)
  isBlocked(key: string): boolean      // true khi đã có >= max lần fail trong cửa sổ
  recordFailure(key: string): void
  reset(key: string): void
}
const LOGIN_LIMITER: unique symbol
const loginLimiterProvider: Provider  // AttemptLimiter(5, 15 phút, CLOCK)
```

- [ ] **Step 1: Viết test fail**
```ts
// src/auth/password.service.test.ts
import { PasswordService } from './password.service'

const svc = new PasswordService()

test('hash is argon2id and never contains plaintext', async () => {
  const h = await svc.hash('correct horse')
  expect(h.startsWith('$argon2id$')).toBe(true)
  expect(h).not.toContain('correct horse')
})

test('verify accepts the right password and rejects others', async () => {
  const h = await svc.hash('correct horse')
  expect(await svc.verify(h, 'correct horse')).toBe(true)
  expect(await svc.verify(h, 'wrong horse')).toBe(false)
})

test('verify returns false on a malformed hash instead of throwing', async () => {
  expect(await svc.verify('not-a-hash', 'x')).toBe(false)
})
```
```ts
// src/common/attempt-limiter.test.ts
import { AttemptLimiter } from './attempt-limiter'

function setup() {
  let t = 0
  const lim = new AttemptLimiter(5, 15 * 60_000, () => t)
  return { lim, advance: (ms: number) => { t += ms } }
}

test('blocks after max failures within the window', () => {
  const { lim } = setup()
  for (let i = 0; i < 4; i++) lim.recordFailure('a|1')
  expect(lim.isBlocked('a|1')).toBe(false)
  lim.recordFailure('a|1')
  expect(lim.isBlocked('a|1')).toBe(true)
})

test('keys are independent', () => {
  const { lim } = setup()
  for (let i = 0; i < 5; i++) lim.recordFailure('a|1')
  expect(lim.isBlocked('a|2')).toBe(false)
  expect(lim.isBlocked('b|1')).toBe(false)
})

test('sliding window: old failures expire one by one', () => {
  const { lim, advance } = setup()
  lim.recordFailure('k')                       // t=0
  advance(60_000)
  for (let i = 0; i < 4; i++) lim.recordFailure('k') // t=1m
  expect(lim.isBlocked('k')).toBe(true)
  advance(14 * 60_000 + 1)                     // t=15m+1ms → lần đầu hết hạn
  expect(lim.isBlocked('k')).toBe(false)
})

test('reset clears the key', () => {
  const { lim } = setup()
  for (let i = 0; i < 5; i++) lim.recordFailure('k')
  lim.reset('k')
  expect(lim.isBlocked('k')).toBe(false)
})
```

- [ ] **Step 2: Chạy** `pnpm --filter @opendeck/backend test -- password attempt-limiter`. Kỳ vọng: FAIL (module not found).

- [ ] **Step 3: Implement**
```ts
// src/auth/password.service.ts
import { Injectable } from '@nestjs/common'
import argon2 from 'argon2'

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id })
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain)
    } catch {
      return false
    }
  }
}
```
```ts
// src/common/attempt-limiter.ts
import type { Clock } from './clock'

/** Đếm số lần thất bại theo key trong cửa sổ trượt. Lưu trong bộ nhớ (một instance server). */
export class AttemptLimiter {
  private readonly failures = new Map<string, number[]>()

  constructor(private readonly max: number, private readonly windowMs: number, private readonly now: Clock) {}

  isBlocked(key: string): boolean {
    return this.recent(key).length >= this.max
  }

  recordFailure(key: string): void {
    const list = this.recent(key)
    list.push(this.now())
    this.failures.set(key, list)
  }

  reset(key: string): void {
    this.failures.delete(key)
  }

  private recent(key: string): number[] {
    const cutoff = this.now() - this.windowMs
    const list = (this.failures.get(key) ?? []).filter(t => t > cutoff)
    if (list.length === 0) this.failures.delete(key)
    else this.failures.set(key, list)
    return list
  }
}
```
```ts
// src/auth/login-limiter.ts
import type { Provider } from '@nestjs/common'
import { AttemptLimiter } from '../common/attempt-limiter'
import { CLOCK, type Clock } from '../common/clock'

export const LOGIN_LIMITER = Symbol('LOGIN_LIMITER')
export const LOGIN_MAX_FAILURES = 5
export const LOGIN_WINDOW_MS = 15 * 60_000

export const loginLimiterProvider: Provider = {
  provide: LOGIN_LIMITER,
  inject: [CLOCK],
  useFactory: (now: Clock) => new AttemptLimiter(LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, now),
}
```

- [ ] **Step 4: Chạy** lại lệnh ở Step 2. Kỳ vọng: PASS. Chạy thêm `pnpm --filter @opendeck/backend typecheck`.

- [ ] **Step 5: Commit** (orchestrator)
```bash
git add apps/backend/src/auth/password.service* apps/backend/src/common/attempt-limiter* apps/backend/src/auth/login-limiter.ts
git commit -m "feat(server): argon2id password service and sliding-window attempt limiter"
```

---

### Task 5.2: SessionService + cookie + SessionGuard + @CurrentUser (Wave 1, chạy song song với 5.1)

**Files:**
- Create: `apps/backend/src/auth/{session.service,session-cookie,session.guard,current-user.decorator}.ts`
- Test: `apps/backend/test/auth/session.e2e.test.ts` (DB thật)

**Interfaces:**
- Consumes: `AuthSession`, `User`, `UsersService`, `UsersModule`, `CLOCK`, `CommonModule`, `createTestDb`, `fakeClock`, `configureApp` (5.0)
- Produces:
```ts
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000
function hashToken(token: string): string          // sha256 hex
class SessionService {
  create(userId: string): Promise<{ token: string; expiresAt: Date }>
  resolve(token: string | undefined): Promise<User | null>   // null nếu không có, sai, hoặc hết hạn
  revoke(token: string | undefined): Promise<void>
  revokeAllForUser(userId: string): Promise<void>
}
const SID_COOKIE = 'sid'
function setSessionCookie(res: Response, token: string, expiresAt: Date): void
function clearSessionCookie(res: Response): void
class SessionGuard implements CanActivate   // gắn req.user: User, nếu không có thì 401 {code:'UNAUTHENTICATED'}
const CurrentUser: ParameterDecorator        // @CurrentUser() user: User
```

- [ ] **Step 1: Viết test fail** `test/auth/session.e2e.test.ts`
```ts
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
```
Thêm một unit test nhỏ cho cookie trong cùng file:
```ts
import { setSessionCookie, clearSessionCookie, SID_COOKIE } from '../../src/auth/session-cookie'

test('session cookie flags', () => {
  const calls: unknown[][] = []
  const res = { cookie: (...a: unknown[]) => calls.push(a), clearCookie: (...a: unknown[]) => calls.push(a) } as never
  const exp = new Date(0)
  setSessionCookie(res, 'tok', exp)
  expect(calls[0]).toEqual([SID_COOKIE, 'tok', { httpOnly: true, sameSite: 'lax', secure: false, path: '/', expires: exp }])
  clearSessionCookie(res)
  expect(calls[1]).toEqual([SID_COOKIE, { httpOnly: true, sameSite: 'lax', secure: false, path: '/' }])
})
```

- [ ] **Step 2: Chạy** `pnpm --filter @opendeck/backend test:e2e -- session`. Kỳ vọng: FAIL (module not found).

- [ ] **Step 3: Implement**
```ts
// src/auth/session.service.ts
import { createHash, randomBytes } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { CLOCK, type Clock } from '../common/clock'
import { UsersService } from '../users/users.service'
import type { User } from '../users/user.entity'
import { AuthSession } from './auth-session.entity'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(AuthSession) private readonly repo: Repository<AuthSession>,
    private readonly users: UsersService,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  async create(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(this.now() + SESSION_TTL_MS)
    await this.repo.insert({ id: hashToken(token), userId, expiresAt })
    return { token, expiresAt }
  }

  async resolve(token: string | undefined): Promise<User | null> {
    if (!token) return null
    const s = await this.repo.findOneBy({ id: hashToken(token) })
    if (!s || s.expiresAt.getTime() <= this.now()) return null
    return this.users.findById(s.userId)
  }

  async revoke(token: string | undefined): Promise<void> {
    if (token) await this.repo.delete({ id: hashToken(token) })
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repo.delete({ userId })
  }
}
```
```ts
// src/auth/session-cookie.ts
import type { CookieOptions, Response } from 'express'

export const SID_COOKIE = 'sid'

function baseOptions(): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SID_COOKIE, token, { ...baseOptions(), expires: expiresAt })
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SID_COOKIE, baseOptions())
}
```
```ts
// src/auth/session.guard.ts
import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { SessionService } from './session.service'
import { SID_COOKIE } from './session-cookie'

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>()
    const user = await this.sessions.resolve(req.cookies?.[SID_COOKIE])
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHENTICATED' })
    req.user = user
    return true
  }
}
```
```ts
// src/auth/current-user.decorator.ts
import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<{ user: unknown }>().user)
```

- [ ] **Step 4: Chạy** lại lệnh ở Step 2. Kỳ vọng: PASS. Chạy thêm `pnpm --filter @opendeck/backend typecheck`.

- [ ] **Step 5: Commit** (orchestrator)
```bash
git add apps/backend/src/auth/session.service.ts apps/backend/src/auth/session-cookie.ts apps/backend/src/auth/session.guard.ts apps/backend/src/auth/current-user.decorator.ts apps/backend/test/auth/session.e2e.test.ts
git commit -m "feat(server): hashed cookie sessions, session guard and current-user decorator"
```

---
### Task 5.3: AuthController (register/login/logout) + MeController + AuthModule (Wave 2, chạy song song với 5.4)

**Files:**
- Create: `apps/backend/src/auth/{dto,auth.controller,me.controller,auth.module}.ts`
- Test: `apps/backend/test/auth/auth.e2e.test.ts`

**Interfaces:**
- Consumes: `PasswordService`, `LOGIN_LIMITER`, `loginLimiterProvider`, `AttemptLimiter` (5.1); `SessionService`, `SessionGuard`, `CurrentUser`, `setSessionCookie`, `clearSessionCookie`, `SID_COOKIE` (5.2); `UsersService`, `UsersModule`, `toPublicUser`, `normalizeEmail`, `CommonModule`, `CLOCK`, `AuthSession` (5.0)
- Produces:
  - HTTP `POST /api/auth/register {email,password,displayName}` → 201 `{user: PublicUser}` + cookie `sid` · 409 `EMAIL_TAKEN` · 400 validation
  - HTTP `POST /api/auth/login {email,password}` → 200 `{user}` + cookie · 401 `INVALID_CREDENTIALS` · 429 `TOO_MANY_ATTEMPTS`
  - HTTP `POST /api/auth/logout` → 204, xoá cookie và session (không cần đăng nhập)
  - HTTP `GET /api/me` → 200 `{user}` · 401 `UNAUTHENTICATED`
  - `AuthModule` exports `SessionService`, `SessionGuard`, `PasswordService` (Task 6 dùng guard)

- [ ] **Step 1: Viết test fail** `test/auth/auth.e2e.test.ts`
```ts
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
```

- [ ] **Step 2: Chạy** `pnpm --filter @opendeck/backend test:e2e -- auth.e2e`. Kỳ vọng: FAIL (module not found).

- [ ] **Step 3: Implement**
```ts
// src/auth/dto.ts
import { Transform } from 'class-transformer'
import { IsEmail, IsString, Length, MaxLength } from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class RegisterDto {
  @Transform(trim) @IsEmail() @MaxLength(254) email: string
  @IsString() @Length(8, 200) password: string
  @Transform(trim) @IsString() @Length(1, 40) displayName: string
}

export class LoginDto {
  @Transform(trim) @IsEmail() email: string
  @IsString() @MaxLength(200) password: string
}
```
```ts
// src/auth/auth.controller.ts
import {
  Body, ConflictException, Controller, HttpCode, HttpException, HttpStatus, Inject, Post, Req, Res, UnauthorizedException,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { QueryFailedError } from 'typeorm'
import type { AttemptLimiter } from '../common/attempt-limiter'
import { UsersService, normalizeEmail, toPublicUser, type PublicUser } from '../users/users.service'
import { LoginDto, RegisterDto } from './dto'
import { LOGIN_LIMITER } from './login-limiter'
import { PasswordService } from './password.service'
import { SessionService } from './session.service'
import { SID_COOKIE, clearSessionCookie, setSessionCookie } from './session-cookie'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    @Inject(LOGIN_LIMITER) private readonly limiter: AttemptLimiter,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response): Promise<{ user: PublicUser }> {
    if (await this.users.findByEmail(dto.email)) throw new ConflictException({ code: 'EMAIL_TAKEN' })
    let user
    try {
      user = await this.users.create({ email: dto.email, displayName: dto.displayName, passwordHash: await this.passwords.hash(dto.password) })
    } catch (e) {
      // Hai request đăng ký cùng email chạy đua: unique index chặn, trả cùng mã lỗi.
      if (e instanceof QueryFailedError && (e.driverError as { code?: string }).code === '23505')
        throw new ConflictException({ code: 'EMAIL_TAKEN' })
      throw e
    }
    await this.startSession(user.id, res)
    return { user: toPublicUser(user) }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ user: PublicUser }> {
    const key = `${normalizeEmail(dto.email)}|${req.ip ?? ''}`
    if (this.limiter.isBlocked(key)) throw new HttpException({ code: 'TOO_MANY_ATTEMPTS' }, HttpStatus.TOO_MANY_REQUESTS)
    const user = await this.users.findByEmail(dto.email)
    if (!user || !(await this.passwords.verify(user.passwordHash, dto.password))) {
      this.limiter.recordFailure(key)
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' })
    }
    this.limiter.reset(key)
    await this.startSession(user.id, res)
    return { user: toPublicUser(user) }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.sessions.revoke(req.cookies?.[SID_COOKIE])
    clearSessionCookie(res)
  }

  private async startSession(userId: string, res: Response): Promise<void> {
    const { token, expiresAt } = await this.sessions.create(userId)
    setSessionCookie(res, token, expiresAt)
  }
}
```
```ts
// src/auth/me.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common'
import { toPublicUser, type PublicUser } from '../users/users.service'
import type { User } from '../users/user.entity'
import { CurrentUser } from './current-user.decorator'
import { SessionGuard } from './session.guard'

@Controller('me')
export class MeController {
  @Get() @UseGuards(SessionGuard)
  me(@CurrentUser() user: User): { user: PublicUser } {
    return { user: toPublicUser(user) }
  }
}
```
```ts
// src/auth/auth.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UsersModule } from '../users/users.module'
import { AuthSession } from './auth-session.entity'
import { AuthController } from './auth.controller'
import { loginLimiterProvider } from './login-limiter'
import { MeController } from './me.controller'
import { PasswordService } from './password.service'
import { SessionGuard } from './session.guard'
import { SessionService } from './session.service'

@Module({
  imports: [TypeOrmModule.forFeature([AuthSession]), UsersModule],
  controllers: [AuthController, MeController],
  providers: [PasswordService, SessionService, SessionGuard, loginLimiterProvider],
  exports: [PasswordService, SessionService, SessionGuard],
})
export class AuthModule {}
```

- [ ] **Step 4: Chạy** lại lệnh ở Step 2. Kỳ vọng: PASS. Chạy thêm `pnpm --filter @opendeck/backend typecheck`.

- [ ] **Step 5: Commit** (orchestrator)
```bash
git add apps/backend/src/auth/dto.ts apps/backend/src/auth/auth.controller.ts apps/backend/src/auth/me.controller.ts apps/backend/src/auth/auth.module.ts apps/backend/test/auth/auth.e2e.test.ts
git commit -m "feat(server): register, login with rate limit, logout and /me"
```

---
### Task 5.4: Quên mật khẩu + đặt lại mật khẩu (Wave 2, chạy song song với 5.3)

**Files:**
- Create: `apps/backend/src/auth/{password-reset.dto,password-reset.service,password-reset.controller}.ts`
- Test: `apps/backend/test/auth/password-reset.e2e.test.ts`
- **Không** sửa `auth.module.ts` (thuộc 5.3). Việc nối vào AuthModule để Task 5.5 làm.

**Interfaces:**
- Consumes: `PasswordService` (5.1); `SessionService`, `hashToken`, `SESSION_TTL_MS` (5.2); `PasswordReset`, `AuthSession`, `User`, `UsersService`, `UsersModule`, `MAILER`, `Mailer`, `CLOCK`, `FakeMailer` (5.0)
- Produces:
```ts
const RESET_TTL_MS = 30 * 60_000
class PasswordResetService {
  request(email: string): Promise<void>                    // email không tồn tại thì im lặng; lỗi mailer chỉ log
  reset(token: string, newPassword: string): Promise<void> // throws BadRequestException({code:'RESET_TOKEN_INVALID'})
}
// HTTP: POST /api/auth/forgot {email} → 204 luôn luôn · POST /api/auth/reset {token,password} → 204 | 400
// Link trong mail: `${APP_URL}/reset?token=<token>` (APP_URL từ ConfigService, mặc định http://localhost:5173)
```

- [ ] **Step 1: Viết test fail** `test/auth/password-reset.e2e.test.ts`
```ts
import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'
import { createTestDb, type TestDb } from '../support/test-db'
import { fakeClock } from '../support/fake-clock'
import { FakeMailer } from '../support/fake-mailer'
import { typeOrmOptions } from '../../src/database/typeorm.options'
import { configureApp } from '../../src/app.setup'
import { CLOCK } from '../../src/common/clock'
import { MAILER } from '../../src/mail/mailer'
import { UsersModule } from '../../src/users/users.module'
import { UsersService } from '../../src/users/users.service'
import { AuthSession } from '../../src/auth/auth-session.entity'
import { PasswordReset } from '../../src/auth/password-reset.entity'
import { PasswordService } from '../../src/auth/password.service'
import { SessionService, hashToken } from '../../src/auth/session.service'
import { PasswordResetService, RESET_TTL_MS } from '../../src/auth/password-reset.service'
import { PasswordResetController } from '../../src/auth/password-reset.controller'

let db: TestDb, app: INestApplication
let users: UsersService, passwords: PasswordService, sessions: SessionService
const clock = fakeClock()
const mailer = new FakeMailer()
const http = () => request(app.getHttpServer())

beforeAll(async () => {
  db = await createTestDb()
  const mod = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ APP_URL: 'http://app.test' })] }),
      TypeOrmModule.forRoot(typeOrmOptions(db.url)),
      TypeOrmModule.forFeature([AuthSession, PasswordReset]),
      UsersModule,
    ],
    controllers: [PasswordResetController],
    providers: [
      { provide: CLOCK, useValue: clock.now },
      { provide: MAILER, useValue: mailer },
      PasswordService, SessionService, PasswordResetService,
    ],
  }).compile()
  app = configureApp(mod.createNestApplication())
  await app.init()
  users = app.get(UsersService); passwords = app.get(PasswordService); sessions = app.get(SessionService)
})
afterAll(async () => { await app.close(); await db.drop() })
beforeEach(() => { mailer.sent.length = 0 })

async function newUser(email: string) {
  return users.create({ email, displayName: 'U', passwordHash: await passwords.hash('old-password') })
}
async function forgot(email: string): Promise<string> {
  await http().post('/api/auth/forgot').send({ email }).expect(204)
  const m = mailer.sent.at(-1)!.body.match(/token=([A-Za-z0-9_-]+)/)
  return m![1]!
}

test('unknown email → 204 and no mail', async () => {
  await http().post('/api/auth/forgot').send({ email: 'ghost@x.io' }).expect(204)
  expect(mailer.sent).toHaveLength(0)
})

test('known email (any case) → 204, one mail with app link; DB stores only sha256(token)', async () => {
  await newUser('f1@x.io')
  const token = await forgot('F1@X.io')
  expect(mailer.sent).toHaveLength(1)
  expect(mailer.sent[0]!.to).toBe('f1@x.io')
  expect(mailer.sent[0]!.body).toContain(`http://app.test/reset?token=${token}`)
  const rows = await db.dataSource.getRepository(PasswordReset).find()
  expect(rows.some(r => r.tokenHash === hashToken(token))).toBe(true)
  expect(rows.some(r => r.tokenHash === token)).toBe(false)
})

test('reset sets the new password and revokes every session', async () => {
  const u = await newUser('f2@x.io')
  const s = await sessions.create(u.id)
  const token = await forgot('f2@x.io')
  await http().post('/api/auth/reset').send({ token, password: 'new-password' }).expect(204)
  const after = await users.findById(u.id)
  expect(await passwords.verify(after!.passwordHash, 'new-password')).toBe(true)
  expect(await passwords.verify(after!.passwordHash, 'old-password')).toBe(false)
  expect(await sessions.resolve(s.token)).toBeNull()
})

test('token works only once', async () => {
  await newUser('f3@x.io')
  const token = await forgot('f3@x.io')
  await http().post('/api/auth/reset').send({ token, password: 'new-password' }).expect(204)
  const res = await http().post('/api/auth/reset').send({ token, password: 'another-pass' }).expect(400)
  expect(res.body).toMatchObject({ code: 'RESET_TOKEN_INVALID' })
})

test('token valid just before 30 min, invalid after', async () => {
  await newUser('f4@x.io')
  const t1 = await forgot('f4@x.io')
  clock.advance(RESET_TTL_MS - 1000)
  await http().post('/api/auth/reset').send({ token: t1, password: 'new-password' }).expect(204)
  const t2 = await forgot('f4@x.io')
  clock.advance(RESET_TTL_MS + 1)
  await http().post('/api/auth/reset').send({ token: t2, password: 'new-password' }).expect(400)
})

test('a successful reset invalidates other outstanding tokens', async () => {
  await newUser('f5@x.io')
  const a = await forgot('f5@x.io')
  const b = await forgot('f5@x.io')
  await http().post('/api/auth/reset').send({ token: b, password: 'new-password' }).expect(204)
  await http().post('/api/auth/reset').send({ token: a, password: 'other-pass1' }).expect(400)
})

test('garbage token → 400 RESET_TOKEN_INVALID; short password → 400', async () => {
  const r = await http().post('/api/auth/reset').send({ token: 'garbage', password: 'new-password' }).expect(400)
  expect(r.body).toMatchObject({ code: 'RESET_TOKEN_INVALID' })
  await newUser('f6@x.io')
  const token = await forgot('f6@x.io')
  await http().post('/api/auth/reset').send({ token, password: 'short' }).expect(400)
})

test('mailer failure still answers 204 (no enumeration)', async () => {
  await newUser('f7@x.io')
  const send = mailer.send
  mailer.send = async () => { throw new Error('smtp down') }
  await http().post('/api/auth/forgot').send({ email: 'f7@x.io' }).expect(204)
  mailer.send = send
})
```

- [ ] **Step 2: Chạy** `pnpm --filter @opendeck/backend test:e2e -- password-reset`. Kỳ vọng: FAIL (module not found).

- [ ] **Step 3: Implement**
```ts
// src/auth/password-reset.dto.ts
import { Transform } from 'class-transformer'
import { IsEmail, IsString, Length } from 'class-validator'

export class ForgotDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsEmail() email: string
}

export class ResetDto {
  @IsString() @Length(1, 200) token: string
  @IsString() @Length(8, 200) password: string
}
```
```ts
// src/auth/password-reset.service.ts
import { randomBytes } from 'node:crypto'
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, IsNull, type Repository } from 'typeorm'
import { CLOCK, type Clock } from '../common/clock'
import { MAILER, type Mailer } from '../mail/mailer'
import { User } from '../users/user.entity'
import { UsersService } from '../users/users.service'
import { AuthSession } from './auth-session.entity'
import { PasswordReset } from './password-reset.entity'
import { PasswordService } from './password.service'
import { hashToken } from './session.service'

export const RESET_TTL_MS = 30 * 60_000

@Injectable()
export class PasswordResetService {
  private readonly log = new Logger(PasswordResetService.name)

  constructor(
    @InjectRepository(PasswordReset) private readonly resets: Repository<PasswordReset>,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  async request(email: string): Promise<void> {
    const user = await this.users.findByEmail(email)
    if (!user) return
    const token = randomBytes(32).toString('base64url')
    await this.resets.insert({ tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(this.now() + RESET_TTL_MS) })
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173'
    const link = `${appUrl}/reset?token=${token}`
    try {
      await this.mailer.send(user.email, 'OpenDeck — Đặt lại mật khẩu / Reset your password',
        `Mở link sau trong 30 phút để đặt lại mật khẩu.\nOpen this link within 30 minutes to reset your password.\n\n${link}\n`)
    } catch (e) {
      this.log.error(`reset mail to user ${user.id} failed: ${(e as Error).message}`)
    }
  }

  async reset(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token)
    const row = await this.resets.findOneBy({ tokenHash })
    if (!row || row.usedAt || row.expiresAt.getTime() <= this.now()) throw invalid()
    const passwordHash = await this.passwords.hash(newPassword)
    const usedAt = new Date(this.now())
    await this.dataSource.transaction(async m => {
      // Điều kiện usedAt IS NULL chặn 2 request reset cùng token chạy đua.
      const claimed = await m.update(PasswordReset, { tokenHash, usedAt: IsNull() }, { usedAt })
      if (!claimed.affected) throw invalid()
      await m.update(User, { id: row.userId }, { passwordHash })
      await m.update(PasswordReset, { userId: row.userId, usedAt: IsNull() }, { usedAt })
      await m.delete(AuthSession, { userId: row.userId })
    })
  }
}

function invalid(): BadRequestException {
  return new BadRequestException({ code: 'RESET_TOKEN_INVALID' })
}
```
```ts
// src/auth/password-reset.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ForgotDto, ResetDto } from './password-reset.dto'
import { PasswordResetService } from './password-reset.service'

@Controller('auth')
export class PasswordResetController {
  constructor(private readonly resets: PasswordResetService) {}

  @Post('forgot') @HttpCode(HttpStatus.NO_CONTENT)
  async forgot(@Body() dto: ForgotDto): Promise<void> {
    await this.resets.request(dto.email)
  }

  @Post('reset') @HttpCode(HttpStatus.NO_CONTENT)
  async reset(@Body() dto: ResetDto): Promise<void> {
    await this.resets.reset(dto.token, dto.password)
  }
}
```

- [ ] **Step 4: Chạy** lại lệnh ở Step 2. Kỳ vọng: PASS. Chạy thêm `pnpm --filter @opendeck/backend typecheck`.

- [ ] **Step 5: Commit** (orchestrator)
```bash
git add apps/backend/src/auth/password-reset.* apps/backend/test/auth/password-reset.e2e.test.ts
git commit -m "feat(server): forgot/reset password with single-use 30-minute tokens"
```

---

### Task 5.5: Nối vào AppModule + e2e toàn luồng + docs (Wave 3, orchestrator)

**Files:**
- Modify: `apps/backend/src/auth/auth.module.ts`, `apps/backend/src/app.module.ts`, `apps/backend/test/auth/auth.e2e.test.ts` (chỉ phần `imports` trong `beforeAll`)
- Create: `apps/backend/test/auth/full-flow.e2e.test.ts`
- Docs: `docs/superpowers/plans/2026-10-29-01-core-realtime-voting.md` (Task 5 + Tech Stack/Architecture), `docs/superpowers/plans/2026-10-29-00-roadmap-phan-tich.md` §4 (stack). Bỏ qua phần nào session kia đã sửa.

**Interfaces:**
- Consumes: tất cả của 5.0–5.4.
- Produces: `AppModule` chạy được toàn bộ API auth. `AuthModule` exports `SessionService`, `SessionGuard`, `PasswordService`, đủ cho Task 6.

- [ ] **Step 1: Viết test fail** `test/auth/full-flow.e2e.test.ts`
```ts
import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { createTestDb, type TestDb } from '../support/test-db'
import { FakeMailer } from '../support/fake-mailer'
import { AppModule } from '../../src/app.module'
import { configureApp } from '../../src/app.setup'
import { MAILER } from '../../src/mail/mailer'

let db: TestDb, app: INestApplication
const mailer = new FakeMailer()
const http = () => request(app.getHttpServer())

beforeAll(async () => {
  db = await createTestDb()
  process.env.DATABASE_URL = db.url   // AppModule đọc DATABASE_URL qua ConfigService
  const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(MAILER).useValue(mailer).compile()
  app = configureApp(mod.createNestApplication())
  await app.init()
})
afterAll(async () => { await app.close(); await db.drop() })

test('register → logout → forgot → reset → login with new password → /me', async () => {
  const reg = await http().post('/api/auth/register').send({ email: 'flow@x.io', password: 'password1', displayName: 'Flow' }).expect(201)
  const sid = String(reg.headers['set-cookie']).split(';')[0]!
  await http().get('/api/me').set('Cookie', sid).expect(200)
  await http().post('/api/auth/logout').set('Cookie', sid).expect(204)
  await http().post('/api/auth/forgot').send({ email: 'flow@x.io' }).expect(204)
  const token = mailer.sent.at(-1)!.body.match(/token=([A-Za-z0-9_-]+)/)![1]!
  await http().post('/api/auth/reset').send({ token, password: 'brand-new-pass' }).expect(204)
  await http().post('/api/auth/login').send({ email: 'flow@x.io', password: 'password1' }).expect(401)
  const login = await http().post('/api/auth/login').send({ email: 'flow@x.io', password: 'brand-new-pass' }).expect(200)
  const me = await http().get('/api/me').set('Cookie', String(login.headers['set-cookie']).split(';')[0]!).expect(200)
  expect(me.body.user).toMatchObject({ email: 'flow@x.io', displayName: 'Flow' })
})

test('health still reports db up', async () => {
  await http().get('/api/health').expect(200, { status: 'ok', db: 'up' })
})
```

- [ ] **Step 2: Chạy** `pnpm --filter @opendeck/backend test:e2e -- full-flow`. Kỳ vọng: FAIL (404 ở `/api/auth/register`, vì `AppModule` chưa import `AuthModule`).

- [ ] **Step 3: Implement**
```ts
// src/auth/auth.module.ts  (thay toàn bộ)
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UsersModule } from '../users/users.module'
import { AuthSession } from './auth-session.entity'
import { AuthController } from './auth.controller'
import { loginLimiterProvider } from './login-limiter'
import { MeController } from './me.controller'
import { PasswordReset } from './password-reset.entity'
import { PasswordResetController } from './password-reset.controller'
import { PasswordResetService } from './password-reset.service'
import { PasswordService } from './password.service'
import { SessionGuard } from './session.guard'
import { SessionService } from './session.service'

@Module({
  imports: [TypeOrmModule.forFeature([AuthSession, PasswordReset]), UsersModule],
  controllers: [AuthController, MeController, PasswordResetController],
  providers: [PasswordService, SessionService, SessionGuard, loginLimiterProvider, PasswordResetService],
  exports: [PasswordService, SessionService, SessionGuard],
})
export class AuthModule {}
```
```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { CommonModule } from './common/common.module'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { MailModule } from './mail/mail.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CommonModule, MailModule, DatabaseModule, HealthModule, UsersModule, AuthModule],
})
export class AppModule {}
```
Trong `test/auth/auth.e2e.test.ts`, AuthModule giờ cần thêm `ConfigService` và `MAILER`. Sửa `imports` trong `beforeAll`:
```ts
imports: [
  ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
  CommonModule, MailModule,
  TypeOrmModule.forRoot(typeOrmOptions(db.url)), AuthModule,
],
```
Thêm `import { ConfigModule } from '@nestjs/config'` và `import { MailModule } from '../../src/mail/mail.module'`.

- [ ] **Step 4: Chạy toàn bộ**
```bash
pnpm --filter @opendeck/backend test && pnpm --filter @opendeck/backend test:e2e && pnpm -r typecheck
```
Kỳ vọng: PASS hết, kể cả `test/app.e2e.test.ts` và các test domain có sẵn.

- [ ] **Step 5: Smoke chạy thật**: `pnpm --filter @opendeck/backend build && node apps/backend/dist/main.js`, rồi
```bash
curl -si -X POST localhost:3001/api/auth/register -H 'content-type: application/json' \
  -d '{"email":"smoke@x.io","password":"password1","displayName":"Smoke"}' | head -5
curl -s -X POST localhost:3001/api/auth/forgot -H 'content-type: application/json' -d '{"email":"smoke@x.io"}' -o /dev/null -w '%{http_code}\n'
```
Kỳ vọng: `201` kèm `Set-Cookie: sid=…; HttpOnly; SameSite=Lax`, sau đó `204`, và console log thư chứa link reset. Dừng server, xoá user smoke (`DELETE FROM users WHERE email='smoke@x.io'`).

- [ ] **Step 6: Docs**: trong Plan 1, đánh dấu Task 5 là `✅ ĐÃ XONG`, trỏ sang file plan này, và sửa Tech Stack/Architecture thành NestJS + TypeORM. Ghi chú cho Task 6: dùng `SessionGuard`/`SessionService` từ `AuthModule`; rate limit mật khẩu phòng dùng `new AttemptLimiter(5, 10 * 60_000, clock)`; khi deploy sau proxy cần cấu hình `trust proxy` để `req.ip` đúng. Sửa roadmap §4 thành NestJS + TypeORM.

- [ ] **Step 7: Commit + merge**
```bash
git add apps/backend docs/superpowers/plans
git commit -m "feat(server): wire auth into app module, full-flow e2e, docs"
git fetch . main && git rebase main      # nếu conflict pnpm-lock.yaml: pnpm install && git add pnpm-lock.yaml && git rebase --continue
pnpm install && pnpm test && pnpm --filter @opendeck/backend test:e2e
```
Sau đó merge `feat/task5-auth` vào `main` (fast-forward) và `git worktree remove ../opendeck-task5`.

---

## Self-review

- **Phủ spec:** register/login/logout/me/forgot/reset (Plan 1 Task 5 HTTP) ✔ · argon2id ✔ · 5 lần / 15 phút, lần 6 = 429 dù mật khẩu đúng ✔ · forgot luôn 204, không gửi mail khi email lạ ✔ · token reset dùng 1 lần, 30 phút ✔ · cookie httpOnly/Lax/Secure khi prod ✔ · schema §8 (User, AuthSession, PasswordReset, Room, Item, Criterion, Vote, Outcome; `emailVerifiedAt`) ✔ · Mailer interface + ConsoleMailer ✔.
- **Song song:** 5.1 ∥ 5.2 và 5.3 ∥ 5.4 sửa các file tách biệt. Deps chỉ thêm ở 5.0. Test DB cách ly theo schema.
- **Nhất quán tên:** `hashToken` (5.2) được dùng ở 5.4. `LOGIN_LIMITER`/`loginLimiterProvider` (5.1) được dùng ở 5.3. `SID_COOKIE`, `setSessionCookie`, `clearSessionCookie` (5.2) được dùng ở 5.3. `RESET_TTL_MS` (5.4) được dùng trong test của 5.4.
