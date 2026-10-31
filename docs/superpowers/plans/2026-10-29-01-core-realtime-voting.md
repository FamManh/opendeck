# Plan 1 — Core: phòng + bỏ phiếu realtime — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ra phiên bản Planning Poker chạy được end-to-end: tài khoản, khách, phòng công khai/có mật khẩu, bỏ phiếu bí mật realtime, lật bài, thống kê, bỏ phiếu lại, chốt điểm, tổng kết + CSV. Plan này chưa có Jira và chưa có hiệu ứng nặng.

**Architecture:** Domain thuần nằm trong `apps/backend/src/domain` (frontend import trực tiếp qua `apps/frontend/src/domain.ts`): reducer `applyCommand` và `computeRoundStats`, không I/O, dùng chung cho server và client. Server NestJS + Socket.IO (`@nestjs/websockets`) giữ `RoomState` trong bộ nhớ (nguồn sự thật duy nhất), ghi Postgres qua TypeORM, và gửi cho mỗi socket bản đã che phiếu (`toPublicState`). Web React chỉ render state đã nhận và gửi command.

**Tech Stack:** TypeScript 5, pnpm workspaces, Node 20+, NestJS 10 + TypeORM 0.3 + PostgreSQL 16 (docker compose, port 5433), Socket.IO 4, argon2, nanoid, React 19 + Vite 7 + Tailwind CSS v4 + shadcn/ui + Zustand + react-router, i18next, Vitest (backend chạy qua `unplugin-swc` để có decorator metadata; e2e: `test/**/*.e2e.test.ts` trên Postgres thật), Playwright. *(Đổi từ Fastify/Prisma/React 18 ngày 2026-10-30.)*

**Spec:** `docs/Đặc tả sản phẩm — Planning Poker.md` · Phân tích + quyết định: `docs/superpowers/plans/2026-10-29-00-roadmap-phan-tich.md` §2

## Global Constraints

- Mật khẩu user và mật khẩu phòng băm bằng **argon2id**; không bao giờ lưu plaintext (§7).
- Slug phòng: mã ngẫu nhiên khó đoán, `nanoid` alphabet base58, **10 ký tự**, không dùng số tăng dần (§7).
- Đăng nhập sai: tối đa **5 lần / 15 phút** cho mỗi cặp email+IP. Nhập sai mật khẩu phòng: tối đa **5 lần / 10 phút** cho mỗi cặp phòng+IP (§7).
- Giá trị phiếu **không bao giờ** rời server trước khi lật, kể cả trong snapshot lúc join hoặc reconnect (§6).
- Host phải có tài khoản. Host offline **> 60 giây** thì chuyển quyền host (§6, roadmap §2.5).
- Phòng mặc định công khai; `requireApproval` mặc định **false** (§2).
- Bộ bài: Fibonacci `1,2,3,5,8,13,21`; T-shirt `XS,S,M,L,XL`; giờ `0.5,1,2,4,8,16,24`; ngày `0.5,1,2,3,5,8`. 7 lá đặc biệt; host bật/tắt từng lá, mặc định bật đủ 7 (quyết định 2026-10-30, theo design màn 03).
- Discussion trigger: `spreadSteps >= 2` (§3).
- Mọi chuỗi UI đi qua i18next, hỗ trợ `vi` + `en` (mặc định `vi`, lưu lựa chọn ở localStorage `opendeck.lang`). Domain không chứa chuỗi hiển thị: lá đặc biệt dịch qua `cards.special.<id>`, bộ bài preset qua `scales.<id>`.
- Mô hình dữ liệu theo §8: Session/Item/Criterion/Scale/Vote(round, anonymous)/Outcome. MVP dùng 1 criterion nhưng schema hỗ trợ nhiều criterion.
- Không có thống kê theo cá nhân (§7).
- **Backend (NestJS):** mỗi tính năng một module; `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` toàn cục, cấu hình trong `configureApp` để test và production giống nhau; schema chỉ đổi qua migration (`synchronize: false`); thời gian lấy qua provider `Clock`, không gọi `Date.now()` trong service.
- **Frontend:** dùng component shadcn/ui có sẵn và chỉnh lại theo design, không tự viết lại; màu chỉ đi qua CSS variable hoặc token `@theme`, không hardcode hex trong component (trừ SVG nhân vật); import domain qua `@/domain`.
- Lý do (reason) bị che giống phiếu cho tới khi lật; `pending`/`banned` chỉ host thấy (2026-10-30).
- Bị kick → vào `banned`, không join lại được trong vòng đời phòng. Chủ phòng (`ownerId`) luôn vào được dù phòng khóa hoặc cần duyệt (2026-10-30).

## Review Focus

1. **Reload tab / rớt mạng giữa vòng:** người đó quay lại đúng ghế, phiếu vẫn còn, không sinh ghế mới → test trong Task 3 và Task 6.
2. **Cùng một người mở 2 tab:** chỉ có 1 participant; phiếu từ tab nào cũng ghi đè cùng một phiếu → test trong Task 6.
3. **Lộ phiếu qua snapshot:** join hoặc reconnect khi đang `voting` không được nhận `cardId` của người khác, chỉ nhận phiếu của chính mình → test trong Task 4 và Task 6.
4. **Phiếu đến sau khi đã lật** (race giữa người vote và host bấm lật) → bị từ chối với `ROUND_NOT_VOTING`, thống kê không đổi → test trong Task 3.
5. **Tất cả phiếu là lá đặc biệt / chỉ 1 phiếu / 0 phiếu** → thống kê ra `average: null`, `needsDiscussion: false`, không crash → test trong Task 2.

---

## File Structure

```
package.json, pnpm-workspace.yaml (chỉ apps/*), tsconfig.base.json, docker-compose.yml (postgres)
apps/backend/src/domain/   — domain thuần, không I/O; frontend import qua apps/frontend/src/domain.ts
  errors.ts      — DomainError
  deck.ts        — Card, Scale, preset, lá đặc biệt (bật/tắt), bộ bài tuỳ chỉnh
  stats.ts       — computeRoundStats
  room/types.ts  — RoomState, Participant, Command, DomainEvent, DomainError
  room/participants.ts — join/leave/reconnect/role/host transfer
  room/rounds.ts — start/vote/reveal/revote/finalize/reason, auto-reveal
  room/apply.ts  — applyCommand (dispatcher) + tick
  redact.ts      — toPublicState
  summary.ts     — buildSummary, toCsv
apps/backend/src/                 — NestJS 10, mỗi tính năng một module
  app.module.ts, app.setup.ts (configureApp: prefix /api, cookie-parser, ValidationPipe)
  common/ (clock.ts, current-user.decorator.ts)
  database/ (typeorm.options.ts, data-source.ts, migrations/*)
  users/user.entity.ts
  auth/   (auth.module, auth.controller, auth.service, password.service, login-attempts.service,
           session.guard, auth-session.entity, password-reset.entity, mailer.service, dto/*)
  guests/ (guests.module, guests.controller, guests.service, guest-cookie.ts)
  rooms/  (rooms.module, rooms.controller, rooms.service, room-access.service,
           room-store.service, room-persistence.service, entities/{room,item,criterion,vote,outcome}.entity.ts, dto/*)
  realtime/ (realtime.module, room.gateway, ws-auth.service, cmd-rate-limiter)
apps/backend/test/ (helpers/test-app.ts, *.e2e.test.ts)
apps/frontend/src/                — React 19 + Tailwind 4 + shadcn/ui (style radix-nova)
  domain.ts (re-export ../../backend/src/domain)
  index.css (Tailwind 4 + theme shadcn đã map sang design), components/ui/* (shadcn)
  components/game/ (Mascot.tsx, PokerCard.tsx)
  i18n/{index.ts,vi.json,en.json}
  lib/api.ts, realtime/socket.ts, store/roomStore.ts
  pages/ (Login, Register, Forgot, Reset, Home, CreateRoom, Room, Summary)
  room/ (Table, Seat, CardFan, TaskPanel, ResultsPanel, JoinDialog, AddItemsDialog).tsx
e2e/voting.spec.ts, e2e/load.ts
```

---

### Task 1: Scaffold monorepo + `deck.ts` — ✅ ĐÃ XONG (2026-10-30)

Chi tiết + log thực hiện: `2026-10-30-01-task1-scaffold-deck.md`.

**Files đã tạo:** root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`; `apps/backend/{package.json,tsconfig.json,vitest.config.ts}`, `apps/backend/src/domain/{errors,deck,index}.ts` + `deck.test.ts`; `apps/frontend` (Vite + React 18 + i18next vi/en) + `src/i18n/resources.test.ts`. *(Sau đó nâng lên React 19 + Tailwind 4 + shadcn/ui ở commit `75cc25b`.)*

**Interfaces (các task sau dùng):**
  ```ts
  class DomainError extends Error { readonly code: string }                    // domain/errors.ts
  type SpecialId = 'coffee'|'question'|'bug'|'bomb'|'puzzle'|'infinity'|'shrug'  // trùng value CardV3 trong design
  const SPECIAL_IDS: readonly SpecialId[]                                       // thứ tự cố định ở trên
  interface Card { id: string; label: string; numeric: number|null; special: boolean }
  interface Scale { id: string; name: string; kind: 'numeric'|'ordinal'; cards: Card[] } // cards: chỉ lá thường, đúng thứ tự thang
  const PRESET_SCALES: Record<'fibonacci'|'tshirt'|'hours'|'days', Scale>       // name chỉ là fallback; UI dịch qua `scales.<id>`
  const SPECIAL_CARDS: Card[]            // 7 lá; label = id (UI dịch qua `cards.special.<id>`)
  function isSpecialId(id: string): id is SpecialId
  function deckOf(scale: Scale, enabledSpecials?: readonly SpecialId[]): Card[]  // cards + lá đặc biệt đang bật (mặc định đủ 7), throws UNKNOWN_SPECIAL
  function createCustomScale(name: string, labels: string[]): Scale             // throws SCALE_TOO_SMALL | SCALE_EMPTY_LABEL | SCALE_RESERVED_LABEL | SCALE_DUPLICATE
  ```

**Ghi chú cho Task 3:** room settings có `enabledSpecials: SpecialId[]` (mặc định `SPECIAL_IDS`); vote lá không có trong `deckOf(scale, enabledSpecials)` → `CARD_NOT_IN_DECK`. `DomainError` import từ `domain/errors.ts`.

---

### Task 2: `computeRoundStats` — ✅ ĐÃ XONG (2026-10-30)

Chi tiết + log thực hiện: `2026-10-30-03-task2-4-stats-room-redact.md`. Code: `apps/backend/src/domain/stats.ts` (+ `stats.test.ts`).

  ```ts
  type ConsensusLevel = 'absolute'|'high'|'medium'|'low'|'unknown'   // spreadSteps 0/1/2/≥3; không có phiếu thường → unknown
  interface RoundStats {
    total: number; distribution: { card: Card; count: number }[]      // theo thứ tự thang, lá đặc biệt ở cuối
    min: Card|null; max: Card|null; spreadSteps: number; needsDiscussion: boolean   // spreadSteps >= 2
    consensus: number; consensusLevel: ConsensusLevel
    average: number|null; nearestCard: Card|null; modes: Card[]        // hòa → lá lớn hơn / tất cả mode
  }
  function computeRoundStats(scale: Scale, cardIds: readonly string[]): RoundStats   // throws UNKNOWN_CARD
  ```

---

### Task 3: Room reducer (`room/*`) — ✅ ĐÃ XONG (2026-10-30)

Chi tiết (toàn bộ type, luật, test): `2026-10-30-03-task2-4-stats-room-redact.md`. Code: `apps/backend/src/domain/room/{types,guards,participants,rounds,apply,testing}.ts` + `{participants,access,rounds}.test.ts`.

**Khác bản thiết kế ban đầu:**
- `Role = 'voter'|'observer'`; host là `RoomState.hostId` (tách khỏi role, host mặc định là voter).
- `createRoom({ id, owner, scale, now, enabledSpecials?, revealRule?, access? })` — object options. `RoomState` có thêm `ownerId`, `pending`, `banned`, `access {locked, requireApproval}`, `enabledSpecials`, `itemSeq`.
- Command thêm `kick`, `approve`, `reject`, `setAccess`; event thêm `kicked`, `rejected`, `approvalRequested`, `accessChanged`, `offline`, `renamed`, `unvoted`; `hostChanged.reason` có `'claimed'`.
- `startRound` khi vòng đang voting → vòng đó bị bỏ (không vào `history`). Auto-reveal `onAllVoted` chỉ xét khi có phiếu mới. `revealRule` mặc định `{ onAllVoted: false, timerSec: null }`.
- Mã lỗi: `NOT_IN_ROOM, NOT_HOST, NOT_VOTER, UNKNOWN_PARTICIPANT, INVALID_TARGET, HOST_NEEDS_ACCOUNT, KICKED, ROOM_LOCKED, NAME_INVALID, ITEM_TITLE_EMPTY, UNKNOWN_ITEM, TIMER_INVALID, ROUND_NOT_VOTING, ROUND_NOT_REVEALED, NO_ROUND, CARD_NOT_IN_DECK, REASON_TOO_LONG, FINAL_EMPTY`.
- Hằng số: `HOST_OFFLINE_MS=60000`, `REASON_MAX=200`, `NAME_MAX=40`, `TIMER_MAX_SEC=3600`.

---

### Task 4: `toPublicState` + summary/CSV — ✅ ĐÃ XONG (2026-10-30)

Code: `apps/backend/src/domain/{redact,summary}.ts` + test.

  ```ts
  interface PublicRound extends Omit<Round,'votes'|'reasons'> { voted: string[]; myVote: string|null; votes: Record<string,string>|null; reasons: Record<string,string> }
  type PublicRoomState = Omit<RoomState,'current'> & { current: PublicRound|null }   // pending/banned rỗng nếu viewer không phải host
  function toPublicState(s: RoomState, viewerPid: string): PublicRoomState            // voting: votes=null, reasons chỉ của viewer
  interface SummaryRow { key: string|null; title: string; final: string; rounds: number; notes: string; specialCards: SpecialId[] }
  function buildSummary(s: RoomState): { rows: SummaryRow[]; totals: { items; finalized; rounds; mostUsedSpecial: SpecialId|null } }
  function toCsv(rows: SummaryRow[]): string   // BOM, CRLF, RFC 4180, prefix ' cho ô bắt đầu bằng = + - @ \t \r
  ```

---

### Task 5: Backend — entity, migration, auth (NestJS + TypeORM) ✅ ĐÃ XONG (2026-10-30)

> As-built: `CLOCK`/`MAILER` là injection token (không phải abstract class); test DB dùng schema riêng cho mỗi file (`createTestDb`), `createTestApp` trong `test/helpers/test-app.ts`. Chi tiết: `.superpowers/sdd/2026-10-29-01-core-realtime-voting/task-5-report.md`.

**Files:**
- Create: `apps/backend/src/common/{clock,current-user.decorator}.ts`, `apps/backend/src/users/user.entity.ts`, `apps/backend/src/auth/*`, `apps/backend/src/rooms/entities/*.entity.ts`, migration `apps/backend/src/database/migrations/<ts>-Init.ts` (sinh bằng `migration:generate`), `docker/initdb/01-test-db.sql` (tạo DB `opendeck_test`), `apps/backend/test/helpers/test-app.ts`
- Modify: `apps/backend/src/app.module.ts`, `apps/backend/src/app.setup.ts`, `docker-compose.yml` (mount `./docker/initdb` vào `/docker-entrypoint-initdb.d`), `apps/backend/vitest.e2e.config.ts` (`fileParallelism: false`), `apps/backend/package.json`
- Test: `apps/backend/test/auth.e2e.test.ts`

**Interfaces:**
- Dependencies thêm: `argon2`, `cookie-parser`, `class-validator`, `class-transformer`, `nanoid`; dev: `@types/cookie-parser`.
- `configureApp` (đã có) bổ sung `cookieParser(COOKIE_SECRET)`, `useGlobalPipes(new ValidationPipe({ whitelist:true, forbidNonWhitelisted:true, transform:true }))` và `ClassSerializerInterceptor` toàn cục. Test dùng chung hàm này nên chạy đúng như production.
- Entity (§8), tên bảng snake_case số nhiều, khóa chính uuid:
  `User{id, email unique (lưu lowercase), passwordHash @Exclude, displayName, avatar, emailVerifiedAt: timestamptz|null, createdAt}`
  `AuthSession{id, user, expiresAt}` (30 ngày) · `PasswordReset{id, tokenHash, user, expiresAt, usedAt|null}`
  `Room{id, slug unique, owner: User, name, passwordHash|null @Exclude, templateId='estimate', config jsonb, liveState jsonb|null @Exclude, createdAt, updatedAt}`
  `Item{id, room, domainId (id trong RoomState), source, externalRef|null, title, description, order, status}` · `Criterion{id, room, name, scale jsonb}`
  `Vote{id, item, criterion, participantKey, round, cardId, anonymous=false, createdAt}` index `(item, round)` · `Outcome{id, item unique, value, note, decidedBy, decidedAt}`
- `abstract class Clock { abstract now(): number }`, mặc định `SystemClock`; test dùng `FakeClock { advance(ms) }`.
- `abstract class MailerService { abstract send(to, subject, body): Promise<void> }`, mặc định `ConsoleMailerService`; test dùng `FakeMailer { sent: {to,subject,body}[] }`.
- `LoginAttemptsService { hit(key, now); blocked(key, now): boolean; reset(key) }`, key `email|ip`, in-memory, cửa sổ trượt 15 phút.
- `SessionGuard` đọc cookie `sid` → gắn `req.user`; `@CurrentUser()`; `OptionalSessionGuard` dùng cho route mà khách cũng gọi được.
- HTTP (`AuthController`): `POST /api/auth/register {email,password,displayName}` → 201 + cookie `sid` (httpOnly, SameSite=Lax, Secure khi `NODE_ENV=production`) · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/me` · `POST /api/auth/forgot {email}` → luôn 204 · `POST /api/auth/reset {token,password}`.
- `test/helpers/test-app.ts`: `createTestApp(): Promise<{ app: INestApplication; ds: DataSource; clock: FakeClock; mailer: FakeMailer; close(): Promise<void> }>`. Dùng `DATABASE_URL_TEST`, override `Clock`/`MailerService`, và `TRUNCATE ... CASCADE` mọi bảng trước mỗi test.

- [ ] **Step 1: Viết test fail** (`auth.e2e.test.ts`, supertest + `createTestApp`): register → `GET /api/me` trả về user và **không** có `passwordHash` · trùng email (khác hoa thường) → 409 · password < 8 ký tự, email sai định dạng, hoặc có field lạ → 400 · login sai 5 lần → lần 6 trả 429 kể cả khi đúng mật khẩu, sau `clock.advance(15*60_000)` thì login lại được · forgot với email không tồn tại → 204 và `mailer.sent.length===0` · reset token chỉ dùng được 1 lần, hết hạn sau 30 phút · cột `password_hash` trong DB bắt đầu bằng `$argon2id$`.
- [ ] **Step 2: Chạy** `pnpm db:up && pnpm --filter @opendeck/backend test:e2e -- auth`. Kỳ vọng: FAIL.
- [ ] **Step 3: Implement** entity và `AuthModule`, rồi chạy `pnpm --filter @opendeck/backend migration:generate src/database/migrations/Init`. Đọc lại migration được sinh ra (index, unique, `ON DELETE CASCADE` cho bảng con của `Room`). Token reset là 32 byte random, DB chỉ lưu sha256.
- [ ] **Step 4: Chạy test.** Kỳ vọng: PASS. Chạy thêm `pnpm --filter @opendeck/backend test` (unit domain) để chắc domain không bị ảnh hưởng.
- [ ] **Step 5: Commit** `feat(backend): entities, migration, email/password auth`

---

### Task 6: ✅ ĐÃ XONG (2026-10-30) — Backend — phòng, khách, realtime gateway

> As-built: xem `.superpowers/sdd/2026-10-29-01-core-realtime-voting/task-6-report.md` (thêm bảng `guests`, `COOKIE_SECRET`, vé `rj_<slug>` bắt buộc trừ chủ phòng, giao thức REST/socket).

**Files:**
- Create: `apps/backend/src/guests/*`, `apps/backend/src/rooms/{rooms.module,rooms.controller,rooms.service,room-access.service,room-store.service,room-persistence.service}.ts` + `dto/*`, `apps/backend/src/realtime/{realtime.module,room.gateway,ws-auth.service,cmd-rate-limiter}.ts`
- Test: `apps/backend/test/rooms.e2e.test.ts`, `apps/backend/test/realtime.e2e.test.ts` (`app.listen(0)` + `socket.io-client`); unit `apps/backend/src/realtime/cmd-rate-limiter.test.ts`, `apps/backend/src/rooms/room-store.service.test.ts`

**Interfaces:**
- Dependencies thêm: `@nestjs/websockets@^10`, `@nestjs/platform-socket.io@^10`, `socket.io`; dev: `socket.io-client`.
- Consumes: `applyCommand`, `createRoom`, `toPublicState`, `buildSummary`, `toCsv`, `PRESET_SCALES`, `createCustomScale`, `SPECIAL_IDS` (`src/domain`); `SessionGuard`, `OptionalSessionGuard`, `Clock`, `createTestApp` (Task 5).
- HTTP:
  - `POST /api/guests {name, avatar}` → cookie `gid` (signed, 128-bit random, hạn 1 năm) · `PATCH /api/guests/me`
  - `POST /api/rooms {name, scaleId | customScale{name,labels}, enabledSpecials?, password?, requireApproval?}` (`SessionGuard`) → `{slug}` · `GET /api/rooms/mine` (danh sách phòng của host, màn 01)
  - `GET /api/rooms/:slug` → `{name, hasPassword, requireApproval, locked}`
  - `POST /api/rooms/:slug/join {password?}` → 204 + cookie `rj_<slug>` (vé vào phòng, signed, gắn với `pid`); sai mật khẩu → 403; 5 lần sai / 10 phút / (phòng+IP) → 429
  - `PATCH /api/rooms/:slug {password?, locked?, requireApproval?}` (chỉ owner) · `GET /api/rooms/:slug/summary.csv` (thành viên phòng)
- `RoomStoreService`: `load(slug): Promise<RoomState>` (lấy từ bộ nhớ, nếu không có thì nạp từ `liveState`) · `dispatch(slug, cmd): Promise<CommandResult>` chạy tuần tự từng phòng (hàng đợi promise cho mỗi slug), `now` lấy từ `Clock` · `onModuleInit` gửi `tick` mỗi 1s cho các phòng đang mở · `events$: Subject<{slug, state, events}>` để gateway và persistence cùng nghe.
- `RoomPersistenceService`: ghi `Vote` (mọi phiếu của vòng) khi có `revealed`, ghi `Outcome` + `Item.status` khi có `finalized`, upsert `Item` khi có `itemsAdded`, lưu `liveState` debounce 2s cho mỗi phòng và flush trong `onModuleDestroy`.
- `RoomGateway` — `@WebSocketGateway({ namespace: '/room', cors: { origin: process.env.WEB_ORIGIN, credentials: true } })`, implements `OnGatewayConnection`, `OnGatewayDisconnect`:
  - **Nest không chạy guard ở `handleConnection`**, nên xác thực thủ công: `WsAuthService.authenticate(socket): Promise<{ pid, userId|null, name, avatar, slug }>` đọc cookie `sid` hoặc `gid` + `rj_<slug>` từ `socket.handshake.headers.cookie`, `slug` lấy từ `handshake.auth.slug`. Lỗi thì `socket.disconnect(true)`. Kết quả gắn vào `socket.data`. `pid = 'u:'+userId | 'g:'+guestId`. Socket join room `slug` và `pid:<pid>`, rồi dispatch `join`.
  - `@SubscribeMessage('cmd')` với `@Ack()` → `{ok:true}|{ok:false, code}`. **`pid` luôn ghi đè bằng `socket.data.pid`**, không tin `pid` client gửi lên. `join`/`disconnect`/`tick` từ client → `FORBIDDEN_CMD`. `DomainError` → `{ok:false, code}`.
  - Sau mỗi dispatch: emit `events` cho room `slug`, emit `state = toPublicState(state, pid)` riêng cho từng `pid:<pid>` đang online. Người đang `pending` chỉ nhận `approval:pending`. Có event `approvalRequested` → host nhận `approval:request`. Có event `kicked` → `kicked` + `disconnectSockets(true)` cho `pid:<target>`.
  - `handleDisconnect`: dispatch `disconnect` chỉ khi pid đó không còn socket nào khác (2 tab).
  - `CmdRateLimiter`: tối đa 10 cmd/giây cho mỗi socket, vượt thì ack `RATE_LIMITED`.

- [ ] **Step 1: Viết test fail — rooms.e2e.test.ts:** khách tạo phòng → 401 · slug khớp `/^[1-9A-HJ-NP-Za-km-z]{10}$/` · `enabledSpecials` có id lạ → 400 · phòng có mật khẩu: sai → 403, sai 5 lần → 429, đúng → 204 + cookie `rj_<slug>` · response không bao giờ có `passwordHash` hoặc `liveState` · `GET /api/rooms/mine` chỉ trả phòng của chính mình.
- [ ] **Step 2: Viết test fail — realtime.e2e.test.ts:**
  - Kết nối không có cookie, hoặc có `gid` nhưng chưa có `rj_<slug>` → bị disconnect, không nhận `state`.
  - Client gửi `{type:'vote', pid:'u:OTHER', cardId:'5'}` → phiếu ghi cho chính người gửi. Gửi `{type:'tick'}` → `FORBIDDEN_CMD`.
  - A, B join; A vote `13` → B nhận `events:[{type:'voted',pid:'u:A'}]` và không frame nào B nhận được chứa `"13"` (bắt qua `onAny`).
  - B join muộn khi đang voting → snapshot không chứa phiếu của A.
  - A mở 2 socket → `participants` có 1 bản ghi; vote từ socket 2 ghi đè; đóng 1 socket thì A vẫn online.
  - A đóng hết socket rồi connect lại → `myVote==='13'`.
  - Phòng `requireApproval`: khách join → host nhận `approval:request`, khách chỉ nhận `approval:pending`, không nhận `state`; host `approve` → khách nhận `state`.
  - Host kick → mọi socket của người bị kick nhận `kicked` và bị disconnect; connect lại → bị từ chối (`banned`).
  - Spam 30 `cmd` trong 1 giây từ 1 socket → tối đa 10 cmd được xử lý, phần còn lại ack `RATE_LIMITED`.
  - Restart app (close + `createTestApp` trên cùng DB) → phòng nạp lại từ `liveState`, items và outcomes còn nguyên.
  - Latency: 20 client, vote → nhận event < 300ms trên localhost (p95).
- [ ] **Step 3: Chạy** `pnpm --filter @opendeck/backend test:e2e`. Kỳ vọng: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Chạy test.** Kỳ vọng: PASS (cả `test` và `test:e2e`).
- [ ] **Step 6: Commit** `feat(backend): rooms, guests, realtime gateway`

---

### Task 7: Frontend — theme, component game, auth, vào phòng ✅ ĐÃ XONG (2026-10-30)

**Files:**
- Create: `apps/frontend/src/components/game/{Mascot,PokerCard}.tsx`, `apps/frontend/src/lib/api.ts`, `apps/frontend/src/pages/{Login,Register,Forgot,Reset,Home,CreateRoom}.tsx`, `apps/frontend/src/room/JoinDialog.tsx`, shadcn components (`pnpm dlx shadcn@latest add input label dialog sheet tabs switch radio-group sonner tooltip badge`)
- Modify: `apps/frontend/src/index.css`, `apps/frontend/src/main.tsx`, `apps/frontend/src/App.tsx` (router), `apps/frontend/src/i18n/{vi,en}.json`, `apps/frontend/vite.config.ts` (proxy `/api` và `/socket.io` → `localhost:3001`, `ws: true`)
- Test: `apps/frontend/src/components/game/{Mascot,PokerCard}.test.tsx`, `apps/frontend/src/room/JoinDialog.test.tsx` (Vitest + `@testing-library/react` + jsdom)

**Interfaces:**
- Dependencies thêm: `react-router@^7`, `zustand`, `@fontsource-variable/hanken-grotesk` (gỡ `@fontsource-variable/geist`); dev: `@testing-library/react`, `@testing-library/user-event`, `jsdom`.
- Consumes: HTTP API của Task 5 và 6.
- Produces: `api.get/post/patch<T>(path, body?): Promise<T>` (ném `ApiError{status, code}`, luôn gửi `credentials:'include'`); `useMe(): { user: User|null; loading: boolean }`; `localStorage['opendeck.guest'] = {name, avatar}`; `<Mascot species state size? />`; `<PokerCard value faceUp? selected? dim? compact? />`.

- [x] **Step 1: Đưa file design vào repo.** Đã đồng bộ ngày 2026-10-30 vào `docs/design/` (xem `docs/design/README.md`).
- [ ] **Step 2: Map design token vào theme shadcn** trong `index.css` (Tailwind 4: giữ `@theme inline` và `@custom-variant dark` hiện có, chỉ đổi giá trị biến). Light (style 3a), hex chuyển sang oklch cũng được:
  `--background` `#FFFFFF` · `--foreground` `#141414` · `--card` `#FFFFFF` · `--muted`/`--secondary` `#F3F3F3` · `--input` `#ECECEC` · `--border` `#E0E0E0` · `--muted-foreground` `#707070` · `--primary` `#FFB627` + `--primary-foreground` `#141414` · `--ring` `#FFB627` · `--radius: 1.5rem`.
  Dark: lấy các biến `--bg/--soft/--ink/--accent…` trong `rootStyle` theme dark của `docs/design/RoomV3.dc.html`.
  Token riêng thêm vào `@theme inline`: `--color-felt` (`#2F4B7C`), `--color-stamp` (`#F26A2E`), `--color-card-back` (`#2B4170`), `--color-special-{coffee,question,bug,bomb,puzzle,infinity,shrug}` (nền và chữ lấy từ `CardV3.dc.html`).
  Font: `--font-sans: 'Hanken Grotesk Variable'`; tiêu đề 650, nội dung 450, phụ đề 300.
  Chỉnh variant shadcn cho giống design: Button và Badge `rounded-full`, không shadow; Input không viền, nền `bg-input`, `rounded-full`; Dialog và Sheet bo `rounded-3xl`. Màu vàng `primary` chỉ dùng cho hành động chính và lá đang chọn. Dark mode: class `.dark` trên `<html>`, mặc định theo `prefers-color-scheme`, có nút chuyển.
- [ ] **Step 3: Viết test fail — Mascot/PokerCard** (port từ `Mascot.dc.html`, `CardV3.dc.html`, giữ nguyên SVG; màu lấy qua token, không hardcode trong JSX trừ màu riêng của từng nhân vật): render đủ 8 loài × 5 trạng thái mà không lỗi · `<PokerCard value="bug" />` hiện nhãn i18n `cards.special.bug` · `faceUp={false}` thì DOM không chứa giá trị · `compact` ẩn nhãn và góc · lật bài chỉ dùng `transform` (snapshot style có `rotateY`, không có `width`).
- [ ] **Step 4: Viết test fail — JoinDialog** (shadcn `Dialog`; dưới 768px dùng `Sheet side="bottom"`): có `opendeck.guest` → gọi thẳng `POST /api/guests`, không hiện dialog · không có → hiện dialog nhập tên + lưới 8 nhân vật; nút "Vào phòng" disable khi tên rỗng hoặc dài hơn `NAME_MAX` (40) · phòng có mật khẩu → hiện ô mật khẩu; 403 → "Mật khẩu chưa đúng, thử lại nhé."; 429 → thông báo "thử lại sau" · người đã đăng nhập thì bỏ qua bước nhập tên.
- [ ] **Step 5: Chạy** `pnpm --filter @opendeck/frontend test`. Kỳ vọng: FAIL.
- [ ] **Step 6: Implement** component, các page auth, Home (màn 01: tạo phòng hoặc nhập mã; danh sách phòng của host) và CreateRoom (màn 03: tên, bộ bài, bật/tắt từng lá đặc biệt, mật khẩu, "Cần host duyệt" mặc định tắt), theo `Planning Poker Screens.dc.html`.
- [ ] **Step 7: Chạy test + typecheck.** `pnpm --filter @opendeck/frontend test && pnpm typecheck`. Kỳ vọng: PASS.
- [ ] **Step 8: Commit** `feat(frontend): design theme, mascot/card components, auth and join flow`

---

### Task 8: ✅ ĐÃ XONG (2026-10-30) — Frontend — màn phòng chơi (màn 06, 10, trạng thái của 07/09/11)

**Files:**
- Create: `apps/frontend/src/realtime/socket.ts`, `apps/frontend/src/store/roomStore.ts`, `apps/frontend/src/pages/Room.tsx`, `apps/frontend/src/room/{Table,Seat,CardFan,TaskPanel,ResultsPanel}.tsx`
- Dependencies thêm: `socket.io-client`
- Test: `apps/frontend/src/room/{CardFan,ResultsPanel,Seat,TaskPanel}.test.tsx`, `apps/frontend/src/store/roomStore.test.ts`

**Interfaces:**
- Consumes: `PublicRoomState`, `Command`, `DomainEvent`, `RoundStats`, `deckOf` (`@/domain`); giao thức socket của Task 6; `Mascot`, `PokerCard` (Task 7).
- Produces: `useRoom(): { state: PublicRoomState|null; me: Participant|null; isHost: boolean; send(cmd: ClientCommand): Promise<void>; connection: 'connecting'|'online'|'reconnecting'|'pending'|'kicked' }` với `type ClientCommand = DistributiveOmit<Exclude<Command, {type:'join'|'disconnect'|'tick'}>, 'pid'>`; `roomStore.lastEvents: DomainEvent[]` (Plan 2 dùng để chạy hiệu ứng).

Bố cục theo §5 và `RoomV3.dc.html` (layout `round`): thanh trên nổi dạng viên thuốc, bàn tròn nền nỉ ở giữa (task hiện tại, AC thu gọn được), ghế quanh bàn, quạt bài ở dưới, khối bên phải (shadcn `Tabs`: Task `x/y` · Câu hỏi · Ghi chú · Lý do). Dưới 768px: lưới nhân vật + task trên nỉ, panel phải chuyển thành `Sheet side="bottom"` mở bằng nút "4/12" (mọi hàng cao tối thiểu 44px). Hiệu ứng ở plan này chỉ là transition `transform`/`opacity` ≤ 0,3s; hiệu ứng đầy đủ để Plan 2.

- [ ] **Step 1: Viết test fail:**
  - CardFan: bấm lá → `send({type:'vote', cardId})`; bấm lại lá đang chọn → `cardId:null`; chỉ hiện lá trong `deckOf(scale, enabledSpecials)`; observer không thấy quạt bài; phím 1–9 chọn lá tương ứng.
  - Seat: trạng thái `voted` (lá úp), `thinking`, `offline` (`Mascot state="away"`, mờ 45%); không bao giờ hiện giá trị trước khi lật.
  - ResultsPanel (màn 10): phân bố, thấp/cao nhất, chip "Đồng thuận: …" theo `consensusLevel`, trung bình + lá gần nhất với bộ số, modes với bộ T-shirt; `needsDiscussion` → "Mời {thấp} và {cao} nói trước" (lấy từ event `discussionNeeded`); host thấy chọn điểm cuối (lá hoặc nhập giá trị) + "Chốt điểm" + "Bỏ phiếu lại"; non-host không thấy.
  - TaskPanel: tiến độ `done/total`; task đã chốt hiện điểm; host thấy nút bắt đầu ở task `pending`.
  - roomStore: nhận `state` thì thay thế toàn bộ state · nhận `kicked` → `connection==='kicked'` · nhận `approval:pending` → `'pending'` · `send` reject khi ack `{ok:false}` và hiện toast (Sonner) theo mã lỗi đã dịch.
  - Khi `connection==='reconnecting'` hiện banner; khi có lại state mới thì banner ẩn.
- [ ] **Step 2: Chạy test.** Kỳ vọng: FAIL.
- [ ] **Step 3: Implement.** Socket.IO bật reconnect mặc định, `auth: { slug }`, `withCredentials: true`.
- [ ] **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat(frontend): room screen`

---

### Task 9: Nhập task, tổng kết, E2E + test tải — ✅ ĐÃ XONG (2026-10-30)

**Files:**
- Create: `apps/frontend/src/room/AddItemsDialog.tsx`, `apps/frontend/src/lib/items-import.ts`, `apps/frontend/src/pages/Summary.tsx`, `e2e/{voting.spec.ts,load.ts}`, `playwright.config.ts` (`webServer` chạy backend + frontend)
- Modify: root `package.json` (script `e2e`, `load`; `pnpm-workspace.yaml` không đổi, Playwright đặt ở root devDependencies)
- Test: `apps/frontend/src/lib/items-import.test.ts`, các file e2e

**Interfaces:**
- Consumes: command `addItems` (`NewItem[]`), `buildSummary`, `GET /api/rooms/:slug/summary.csv`.
- Produces: `parseItemLines(text: string): NewItem[]` (dán nhiều dòng; bỏ dòng rỗng; `title | description` tách ở dấu `|` đầu tiên; dòng bắt đầu bằng `ABC-123` thì đưa vào `externalRef`) · `parseItemsCsv(text: string): NewItem[]` (header `title,description[,key]`; throw `TOO_MANY_ITEMS` khi > 500 dòng).

- [ ] **Step 1: Viết test fail:** `parseItemLines('A\n\n B | mô tả | x ')` → `[{title:'A',description:''},{title:'B',description:'mô tả | x'}]` · `parseItemLines('PAY-142 Tích hợp VNPay')` → `externalRef:'PAY-142'` · CSV có ngoặc kép và xuống dòng trong ô parse đúng · CSV > 500 dòng → `TOO_MANY_ITEMS`.
- [ ] **Step 2: Chạy test.** Kỳ vọng: FAIL. **Step 3: Implement** parser, `AddItemsDialog` (shadcn `Dialog` + `Tabs`: Gõ tay / Dán nhiều dòng / Import CSV) và `Summary` (màn 13: số task, số vòng, lá đặc biệt dùng nhiều nhất, nút Xuất CSV; nút "Đẩy điểm về Jira" và "Xuất Excel" ẩn đi vì Plan 3/4). **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Viết E2E** `e2e/voting.spec.ts` (3 browser context: host, voter đã đăng ký, khách): host tạo phòng → dán 2 task → bắt đầu → 2 người vote `3` và `13` → host lật → thấy lời mời thảo luận → bỏ phiếu lại → cả hai vote `8` → chốt `8` → task 2 → khách reload trang giữa vòng thì vẫn giữ phiếu → kết thúc → trang tổng kết có 2 dòng, `rounds` lần lượt là `2` và `1` → tải CSV và so nội dung.
- [ ] **Step 6: Viết load test** `e2e/load.ts` (`socket.io-client`, chạy bằng `tsx`): 50 client vào cùng một phòng, vote ngẫu nhiên rồi lật; in p95 latency. Ngưỡng: p95 < 300ms với 20 client; với 50 client không có lỗi hay mất phiếu.
- [ ] **Step 7: Chạy** `pnpm e2e && pnpm load`. Kỳ vọng: mọi test PASS, in `p95(20) < 300ms`.
- [ ] **Step 8: Commit** `feat: item import, summary/csv, e2e and load tests`

---

## Ngoài phạm vi Plan 1 (đã có plan khác nhận)

- Hiệu ứng 3-2-1, lật bài theo nhịp, confetti canvas, plot twist, con dấu chốt, nhân vật có trạng thái, reaction, ném giấy, vòng quay, 3 mức hiệu ứng, auto-hạ theo fps, lazy-load âm thanh/sprite → **Plan 2**
- Jira OAuth, import JQL/board, cấu hình trường, preview push, phát hiện xung đột, nhật ký đẩy điểm, mã hóa token → **Plan 3**
- Excel, retention 12 tháng, huy hiệu, trang phục, chủ đề mùa, các template ngoài Estimate → **Plan 4**
