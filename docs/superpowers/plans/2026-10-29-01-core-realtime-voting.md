# Plan 1 — Core: phòng + bỏ phiếu realtime — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ra phiên bản Planning Poker chạy được end-to-end: tài khoản, khách, phòng công khai/có mật khẩu, bỏ phiếu bí mật realtime, lật bài, thống kê, bỏ phiếu lại, chốt điểm, tổng kết + CSV. Plan này chưa có Jira và chưa có hiệu ứng nặng.

**Architecture:** Domain thuần nằm trong `apps/backend/src/domain` (frontend import trực tiếp qua `apps/frontend/src/domain.ts`): reducer `applyCommand` và `computeRoundStats`, không I/O, dùng chung cho server và client. Server NestJS + Socket.IO (`@nestjs/websockets`) giữ `RoomState` trong bộ nhớ (nguồn sự thật duy nhất), ghi Postgres qua TypeORM, và gửi cho mỗi socket bản đã che phiếu (`toPublicState`). Web React chỉ render state đã nhận và gửi command.

**Tech Stack:** TypeScript 5, pnpm workspaces, Node 20+, NestJS 10 + TypeORM 0.3 + PostgreSQL 16 (docker compose, port 5433), Socket.IO 4, argon2, nanoid, React 19 + Vite 7 + Tailwind CSS v4 + shadcn/ui + Zustand + react-router, i18next, Vitest, Playwright. *(Đổi từ Fastify/Prisma/React 18 ngày 2026-10-30.)*

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
apps/backend/src/
  prisma/schema.prisma
  auth/  (routes.ts, password.ts, rateLimit.ts, session.ts)
  rooms/ (routes.ts, roomStore.ts, persistence.ts)
  realtime/gateway.ts
apps/frontend/src/
  domain.ts (re-export ../../backend/src/domain)
  styles/tokens.css, i18n/{index.ts,vi.json,en.json}
  api/client.ts, realtime/socket.ts, store/roomStore.ts
  pages/ (Login, Register, Forgot, Reset, Home, Room, Summary)
  room/ (Table.tsx, Seat.tsx, CardFan.tsx, TaskPanel.tsx, ResultsPanel.tsx, JoinDialog.tsx)
e2e/voting.spec.ts, e2e/load.ts
```

---

### Task 1: Scaffold monorepo + `deck.ts` — ✅ ĐÃ XONG (2026-10-30)

Chi tiết + log thực hiện: `2026-10-30-01-task1-scaffold-deck.md`.

**Files đã tạo:** root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`; `apps/backend/{package.json,tsconfig.json,vitest.config.ts}`, `apps/backend/src/domain/{errors,deck,index}.ts` + `deck.test.ts`; `apps/frontend` (Vite + React 18 + i18next vi/en) + `src/i18n/resources.test.ts`.

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

### Task 2: `computeRoundStats`

**Files:** Create `apps/backend/src/domain/stats.ts` · Test `apps/backend/src/domain/stats.test.ts`

**Interfaces:**
- Consumes: `Scale`, `Card`, `SPECIAL_CARDS` (Task 1)
- Produces:
  ```ts
  interface RoundStats {
    total: number                                   // gồm cả lá đặc biệt
    distribution: { card: Card; count: number }[]   // chỉ card count>0; thứ tự theo thang, lá đặc biệt cuối
    min: Card|null; max: Card|null                  // theo thứ tự thang, bỏ lá đặc biệt
    spreadSteps: number                             // index(max)-index(min), 0 nếu <2 phiếu thường
    needsDiscussion: boolean                        // spreadSteps >= 2
    consensus: number                               // số phiếu của mode / số phiếu thường, 0..1; 0 nếu không có phiếu thường
    consensusLevel: 'absolute'|'high'|'medium'|'low'|'unknown' // theo design: spreadSteps 0/1/2/≥3; không có phiếu thường → unknown
    average: number|null                            // chỉ numeric scale
    nearestCard: Card|null                          // lá gần average nhất; hoà → lá lớn hơn
    modes: Card[]                                   // các lá nhiều phiếu nhất (hoà → tất cả)
  }
  function computeRoundStats(scale: Scale, cardIds: string[]): RoundStats
  ```

- [ ] **Step 1: Viết test fail** (giá trị chính xác):

```ts
const fib = PRESET_SCALES.fibonacci, ts = PRESET_SCALES.tshirt
test('3,5,8 → spread 2, needs discussion, avg 5.33 → nearest 5', () => {
  const s = computeRoundStats(fib, ['3','5','8'])
  expect(s.spreadSteps).toBe(2); expect(s.needsDiscussion).toBe(true)
  expect(s.average).toBeCloseTo(5.333, 2); expect(s.nearestCard!.id).toBe('5')
})
test('3,5 → spread 1, no discussion; avg 4 ties 3/5 → picks 5', () => {
  const s = computeRoundStats(fib, ['3','5'])
  expect(s.needsDiscussion).toBe(false); expect(s.nearestCard!.id).toBe('5')
  expect(s.consensusLevel).toBe('high')
})
test('consensusLevel mapping', () => {
  expect(computeRoundStats(fib, ['5','5']).consensusLevel).toBe('absolute')
  expect(computeRoundStats(fib, ['3','8']).consensusLevel).toBe('medium')
  expect(computeRoundStats(fib, ['2','13']).consensusLevel).toBe('low')
  expect(computeRoundStats(fib, ['coffee']).consensusLevel).toBe('unknown')
})
test('special cards excluded from min/max/avg but counted in total', () => {
  const s = computeRoundStats(fib, ['2','2','coffee'])
  expect(s.total).toBe(3); expect(s.consensus).toBe(1); expect(s.average).toBe(2)
  expect(s.distribution.at(-1)).toMatchObject({ card: { id: 'coffee' }, count: 1 })
})
test('tshirt: no average, modes instead, ties return both', () => {
  const s = computeRoundStats(ts, ['S','S','L','L'])
  expect(s.average).toBeNull(); expect(s.modes.map(c => c.id)).toEqual(['S','L'])
  expect(s.spreadSteps).toBe(2)
})
test.each([[[]], [['shrug','infinity']], [['8']]])('degenerate %j does not crash', (ids) => {
  const s = computeRoundStats(fib, ids)
  expect(s.needsDiscussion).toBe(false); expect(s.spreadSteps).toBe(0)
})
test('unknown card id throws UNKNOWN_CARD', () => {
  expect(() => computeRoundStats(fib, ['99'])).toThrow('UNKNOWN_CARD')
})
```

- [ ] **Step 2: Chạy test.** Kỳ vọng: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat(backend/domain): round statistics`

---

### Task 3: Room reducer (`room/*`)

**Files:** Create `apps/backend/src/domain/room/{types,participants,rounds,apply}.ts` · Test `apps/backend/src/domain/room/{participants,rounds}.test.ts`

**Interfaces:**
- Consumes: `Scale`, `deckOf`, `computeRoundStats`
- Produces:
  ```ts
  type Role = 'host'|'voter'|'observer'
  interface Participant { id: string; userId: string|null; name: string; avatar: string; role: Role; joinedAt: number; online: boolean; offlineSince: number|null }
  interface Item { id: string; source: 'manual'|'jira'; externalRef: string|null; title: string; description: string; status: 'pending'|'done' }
  interface Round { itemId: string; number: number; status: 'voting'|'revealed'; votes: Record<string,string>; reasons: Record<string,string>; deadline: number|null; stats: RoundStats|null }
  interface Outcome { itemId: string; value: string; note: string; decidedBy: string; decidedAt: number; rounds: number }
  interface RoomState { id: string; hostId: string|null; successorId: string|null; participants: Record<string,Participant>;
    items: Item[]; scale: Scale; revealRule: { onAllVoted: boolean; timerSec: number|null };
    current: Round|null; history: Round[]; outcomes: Outcome[] }
  type Command =
    | { type:'join'; participant: Omit<Participant,'online'|'offlineSince'|'joinedAt'> }
    | { type:'disconnect'; pid:string } | { type:'setRole'; pid:string; target:string; role:'voter'|'observer' }
    | { type:'transferHost'; pid:string; target:string } | { type:'setSuccessor'; pid:string; target:string }
    | { type:'addItems'; pid:string; items: Pick<Item,'title'|'description'>[] }
    | { type:'startRound'; pid:string; itemId:string; timerSec?: number } | { type:'vote'; pid:string; cardId:string|null }
    | { type:'reveal'; pid:string } | { type:'revote'; pid:string } | { type:'reason'; pid:string; text:string }
    | { type:'finalize'; pid:string; value:string; note?:string } | { type:'rename'; pid:string; name:string; avatar?:string }
    | { type:'tick' }
  type DomainEvent = { type:'voted'|'unvoted'|'revealed'|'roundStarted'|'finalized'|'hostChanged'|'joined'|'left'|'discussionNeeded'; [k:string]: unknown }
  function applyCommand(s: RoomState, c: Command, now: number): { state: RoomState; events: DomainEvent[] }  // throws DomainError(code)
  function createRoom(id: string, host: Omit<Participant,'online'|'offlineSince'|'joinedAt'|'role'>, scale: Scale, now: number): RoomState
  ```
  Mã lỗi: `NOT_HOST`, `NOT_VOTER`, `ROUND_NOT_VOTING`, `ROUND_NOT_REVEALED`, `UNKNOWN_CARD`, `UNKNOWN_ITEM`, `HOST_NEEDS_ACCOUNT`, `REASON_TOO_LONG` (>200 ký tự).

Quy tắc (spec §2/§3/§6 + roadmap §2): `join` với `id` đã tồn tại → chỉ set `online=true`, giữ nguyên role và phiếu. `vote` khi `cardId=null` → rút phiếu. `revote` → đưa `current` vào `history`, mở round `number+1` cho cùng item. `finalize` được gọi khi `revealed`; `value` có thể là bất kỳ lá nào hoặc chuỗi tự do; set `Item.status='done'` và thêm `Outcome` với `rounds` = số vòng của item. `reveal` tính `stats`; nếu `needsDiscussion` thì emit `discussionNeeded { lowPids, highPids }`.

- [ ] **Step 1: Viết test fail — participants.test.ts**

```ts
test('rejoin with same id keeps seat and vote', ...)            // join→vote '5'→disconnect→join → votes[pid]==='5', 1 participant
test('voter→observer mid-round removes their vote', ...)
test('host offline 60_001ms → host goes to designated successor (registered, online)', ...)
test('no successor → earliest-joined online registered user', ...)
test('only guests online → hostId null; next registered join becomes host', ...)
test('host offline 59_999ms → unchanged', ...)
test('transferHost to guest throws HOST_NEEDS_ACCOUNT', ...)
test('non-host startRound throws NOT_HOST', ...)
```

- [ ] **Step 2: Viết test fail — rounds.test.ts**

```ts
test('vote after reveal throws ROUND_NOT_VOTING and stats unchanged', ...)
test('observer vote throws NOT_VOTER', ...)
test('onAllVoted: last online voter votes → auto reveal event', ...)  // voter offline không tính
test('timer: tick at deadline reveals; tick before does not', ...)
test('revote keeps history: history.length===1, current.number===2, votes empty', ...)
test('finalize with value differing from stats is allowed; item done; outcome.rounds===2', ...)
test('reveal with 3/13 emits discussionNeeded with lowPids/highPids', ...)
test('reason >200 chars throws REASON_TOO_LONG', ...)
```

- [ ] **Step 3: Chạy test.** Kỳ vọng: FAIL.
- [ ] **Step 4: Implement.** Mỗi handler là hàm thuần trả về state mới (không mutate state cũ). `tick` lo cả auto-reveal theo timer lẫn chuyển host khi host offline quá 60 giây.
- [ ] **Step 5: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 6: Commit** `feat(backend/domain): room state machine`

---

### Task 4: `toPublicState` + summary/CSV

**Files:** Create `apps/backend/src/domain/{redact,summary}.ts` · Test `apps/backend/src/domain/{redact,summary}.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type PublicRound = Omit<Round,'votes'> & { voted: string[]; myVote: string|null; votes: Record<string,string>|null } // votes chỉ != null khi revealed
  type PublicRoomState = Omit<RoomState,'current'|'history'> & { current: PublicRound|null; history: Round[] }
  function toPublicState(s: RoomState, viewerPid: string): PublicRoomState
  interface SummaryRow { key: string|null; title: string; final: string; rounds: number; notes: string; specialCards: string[] }
  function buildSummary(s: RoomState): { rows: SummaryRow[]; totals: { items: number; rounds: number; mostUsedSpecial: string|null } }
  function toCsv(rows: SummaryRow[]): string   // header: key,title,final,rounds,notes,special_cards ; RFC 4180 quoting; BOM UTF-8
  ```

- [ ] **Step 1: Viết test fail**

```ts
test('voting: JSON of public state for viewer B never contains A\'s cardId', () => {
  // A vote '13' (giá trị duy nhất trong phòng); B nhìn
  const json = JSON.stringify(toPublicState(s, 'B'))
  expect(json).not.toContain('"13"'); expect(pub.current!.voted).toContain('A')
})
test('viewer sees own vote as myVote', ...)
test('revealed: votes visible', ...)
test('csv escapes quotes, commas, newlines and starts with BOM', () => {
  expect(toCsv([{ key:null, title:'a,"b"\nc', final:'5', rounds:1, notes:'', specialCards:[] }]))
    .toBe('﻿key,title,final,rounds,notes,special_cards\r\n,"a,""b""\nc",5,1,,\r\n')
})
test('csv neutralises formula injection: title "=cmd" → "\'=cmd"', ...)
```

- [ ] **Step 2: Chạy test.** Kỳ vọng: FAIL.
- [ ] **Step 3: Implement.** `notes` = các dòng lý do của mọi vòng nối bằng `\n` (§3 "gom lại thành ghi chú"), **không kèm tên người** (§7).
- [ ] **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat(backend/domain): vote redaction, summary, csv`

---

### Task 5: Server — DB schema + auth

> **Stack đã đổi (2026-10-30):** phần dưới vẫn viết theo Fastify/Prisma. Khi bắt đầu task này, viết lại chi tiết theo NestJS: module/controller/guard, TypeORM entity + migration, `@nestjs/websockets` + Socket.IO adapter. Skeleton đã có: `/api/health`, `DatabaseModule` (`migrationsRun: true`), `pnpm db:up`.

**Files:**
- Create: `docker-compose.yml`, `apps/backend/{package.json,tsconfig.json}`, `apps/backend/prisma/schema.prisma`, `apps/backend/src/{app.ts,main.ts}`, `apps/backend/src/auth/{routes,password,rateLimit,session}.ts`
- Test: `apps/backend/test/auth.test.ts` (dùng `app.inject` + Postgres test DB lấy từ `DATABASE_URL_TEST`)

**Interfaces:**
- Prisma models (theo §8): `User{id,email unique,passwordHash,displayName,avatar,emailVerifiedAt?}`, `Room{id,slug unique,ownerId,name,passwordHash?,requireApproval=false,locked=false,templateId='estimate',config Json,liveState Json?,createdAt}`, `Item{id,roomId,source,externalRef?,title,description,order,status}`, `Criterion{id,roomId,name,scale Json}`, `Vote{id,itemId,criterionId,participantKey,round,cardId,anonymous=false,createdAt}`, `Outcome{id,itemId,value,note,decidedBy,decidedAt}`, `PasswordReset{tokenHash,userId,expiresAt,usedAt?}`, `AuthSession{id,userId,expiresAt}`.
- HTTP: `POST /api/auth/register {email,password,displayName}` → 201 + cookie `sid` (httpOnly, SameSite=Lax, Secure khi prod) · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/me` · `POST /api/auth/forgot {email}` → luôn trả 204 · `POST /api/auth/reset {token,password}`.
- `buildApp(opts:{ db: PrismaClient; mailer: Mailer; now?: ()=>number }): FastifyInstance`, `interface Mailer { send(to:string, subject:string, body:string): Promise<void> }`.

- [ ] **Step 1: Viết test fail:** register→me trả về user · trùng email → 409 · password <8 ký tự → 400 · login sai 5 lần → lần 6 trả 429 kể cả khi đúng mật khẩu · forgot với email không tồn tại → 204 và không gửi mail · reset token chỉ dùng được 1 lần và hết hạn sau 30 phút · DB không chứa plaintext password (`passwordHash` bắt đầu bằng `$argon2id$`).
- [ ] **Step 2: Chạy** `pnpm --filter server test`. Kỳ vọng: FAIL.
- [ ] **Step 3: Implement.** Rate limit lưu in-memory (`Map`, key `email|ip`, cửa sổ trượt 15 phút). Token reset: 32 byte random, DB chỉ lưu sha256.
- [ ] **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat(server): schema and email/password auth`

---

### Task 6: Server — phòng, khách, realtime gateway

> **Stack đã đổi (2026-10-30):** phần dưới vẫn viết theo Fastify/Prisma. Khi bắt đầu task này, viết lại chi tiết theo NestJS: module/controller/guard, TypeORM entity + migration, `@nestjs/websockets` + Socket.IO adapter. Skeleton đã có: `/api/health`, `DatabaseModule` (`migrationsRun: true`), `pnpm db:up`.

**Files:**
- Create: `apps/backend/src/rooms/{routes,roomStore,persistence}.ts`, `apps/backend/src/realtime/gateway.ts`, `apps/backend/src/guests.ts`
- Test: `apps/backend/test/rooms.test.ts`, `apps/backend/test/realtime.test.ts` (dùng `socket.io-client` thật, server listen trên port 0)

**Interfaces:**
- Consumes: `applyCommand`, `createRoom`, `toPublicState`, `PRESET_SCALES` (backend/domain); `buildApp` (Task 5).
- HTTP: `POST /api/guests {name,avatar}` → cookie `gid` (đã ký, 128-bit random, hạn 1 năm) · `PATCH /api/guests/me` · `POST /api/rooms {name, scaleId|customScale, password?, requireApproval?}` (bắt buộc đăng nhập) → `{slug}` · `GET /api/rooms/:slug` → `{name, hasPassword, requireApproval}` · `POST /api/rooms/:slug/join {password?}` → 204 + cookie `rj_<slug>` (vé vào phòng); sai mật khẩu → 403; quá giới hạn → 429 · `PATCH /api/rooms/:slug` (host đổi mật khẩu/khóa/bật duyệt) · `GET /api/rooms/:slug/summary.csv`.
- Socket.IO namespace `/room`, handshake `{slug}`; xác thực bằng cookie `sid` hoặc `gid` + `rj_<slug>`. Participant id = `u:<userId>` hoặc `g:<guestId>`, nên 2 tab là cùng 1 người.
  - client→server: `cmd` (Command không có `pid`; server tự gắn), ack `{ok:true}|{ok:false,code}`
  - server→client: `state` (PublicRoomState, emit riêng từng socket), `events` (DomainEvent[]), `approval:request` (chỉ gửi host), `kicked`.
- `RoomStore`: `get(slug)`, `dispatch(slug, cmd, now)` chạy tuần tự từng phòng (hàng đợi promise cho mỗi phòng), `setInterval` gửi `tick` mỗi 1s. `persistence`: ghi `Vote`/`Outcome` khi có event `revealed`/`finalized`; lưu snapshot `liveState` debounce 2s; nạp lại snapshot khi khởi động.

- [ ] **Step 1: Viết test fail — rooms.test.ts:** khách tạo phòng → 401 · slug khớp `/^[1-9A-HJ-NP-Za-km-z]{10}$/` · phòng có mật khẩu: sai → 403, sai 5 lần → 429, đúng → 204 · `liveState`/`passwordHash` không bao giờ xuất hiện trong response.
- [ ] **Step 2: Viết test fail — realtime.test.ts:**
  - A, B join; A vote `13` → B nhận `events:[{type:'voted',pid:'u:A'}]` và payload B nhận được không chứa `"13"` (bắt mọi frame qua `onAny`).
  - B join muộn khi đang voting → snapshot không chứa phiếu của A.
  - A mở 2 socket → `participants` có 1 bản ghi; vote từ socket 2 ghi đè.
  - A disconnect rồi connect lại → `myVote==='13'`.
  - Phòng `requireApproval`: khách join → host nhận `approval:request`; trước khi được duyệt, khách không nhận `state`.
  - Host kick → socket bị kick nhận `kicked` và bị disconnect.
  - Spam 30 `cmd` vote/giây từ 1 socket → server vẫn phản hồi, chỉ xử lý tối đa 10 cmd/giây (vượt thì ack `RATE_LIMITED`).
  - Latency: 20 client, vote → nhận event < 300ms trên localhost (p95).
- [ ] **Step 3: Chạy test.** Kỳ vọng: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 6: Commit** `feat(server): rooms, guests, realtime gateway`

---

### Task 7: Web — nhập design, shell, auth, vào phòng

**Files:**
- Create: `apps/frontend/*` (Vite), `apps/frontend/src/styles/tokens.css`, `apps/frontend/src/i18n/{vi,en}.json`, `apps/frontend/src/api/client.ts`, `apps/frontend/src/pages/{Login,Register,Forgot,Reset,Home}.tsx`, `apps/frontend/src/room/JoinDialog.tsx`, `docs/design/Planning Poker Screens.dc.html`, `docs/design/support.js`
- Test: `apps/frontend/src/room/JoinDialog.test.tsx` (Vitest + Testing Library)

**Interfaces:**
- Consumes: HTTP API của Task 5 và 6.
- Produces: `api.get/post/patch<T>(path, body?) : Promise<T>` (ném `ApiError{status,code}`); `useMe(): User|null`; `localStorage['pp.guest'] = {name, avatar}`.

- [x] **Step 1: Đưa file design vào repo.** Đã đồng bộ ngày 2026-10-30 vào `docs/design/` (xem `docs/design/README.md` để biết màn nào thuộc task nào). Mở file `.dc.html` trong trình duyệt (cùng thư mục với `support.js`) để xem.
- [ ] **Step 2: Rút design token** từ `RoomV3.dc.html` (biến `--soft`, `--accent`, `--orange`… trong `rootStyle`, cho cả light và dark) sang `tokens.css`, dark mode bằng `[data-theme=dark]` + `prefers-color-scheme`. Bộ màu chuẩn (style 3a): Canvas `#FFFFFF`, Soft `#F3F3F3`, Field `#ECECEC`, Hairline `#E0E0E0`, Ink `#141414`, Muted `#707070`, Nỉ bàn `#2F4B7C`, Hành động `#FFB627`, Con dấu `#F26A2E`. Font Hanken Grotesk: tiêu đề 650, nội dung 450, phụ đề 300. Nút, chip, toggle là hình viên thuốc; khối chứa bo 24px; không dùng bóng đổ. Màu vàng chỉ dùng cho hành động chính và lá đang chọn.
- [ ] **Step 2b: Port component `Mascot` (8 loài × 5 trạng thái) và `CardV3` (lá số + 7 lá đặc biệt, mặt úp, selected, dim, compact)** sang `apps/frontend/src/ui/{Mascot,Card}.tsx`, giữ nguyên SVG và màu. Test: render đủ mọi tổ hợp loài × trạng thái mà không lỗi; `<Card value="bug" />` hiện nhãn "Mùi bug"; `faceUp={false}` không có giá trị trong DOM.
- [ ] **Step 3: Viết test fail — JoinDialog:** có `pp.guest` trong localStorage → gọi thẳng `POST /api/guests`, không hiện dialog · không có → hiện dialog nhập tên + chọn avatar, nút "Vào phòng" bị disable khi tên rỗng hoặc dài quá 30 ký tự · phòng có mật khẩu → hiện ô mật khẩu; lỗi 403 hiện thông báo; lỗi 429 hiện thông báo "thử lại sau".
- [ ] **Step 4: Chạy** `pnpm --filter web test`. Kỳ vọng: FAIL.
- [ ] **Step 5: Implement** các page auth và Home (danh sách phòng của host, tạo phòng: tên, bộ bài, mật khẩu, duyệt) theo design.
- [ ] **Step 6: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 7: Commit** `feat(web): design tokens, auth pages, join flow`

---

### Task 8: Web — màn phòng chơi

**Files:**
- Create: `apps/frontend/src/realtime/socket.ts`, `apps/frontend/src/store/roomStore.ts`, `apps/frontend/src/pages/Room.tsx`, `apps/frontend/src/room/{Table,Seat,CardFan,TaskPanel,ResultsPanel}.tsx`
- Test: `apps/frontend/src/room/{CardFan,ResultsPanel,Seat}.test.tsx`

**Interfaces:**
- Consumes: `PublicRoomState`, `Command`, `RoundStats`, `deckOf` (backend/domain); socket protocol (Task 6).
- Produces: `useRoom(): { state: PublicRoomState|null; me: Participant|null; send(cmd): Promise<void>; connection: 'connecting'|'online'|'reconnecting' }`

Bố cục theo §5 và file design: bàn chơi ở giữa (task hiện tại, AC thu gọn được), ghế quanh bàn, quạt bài ở dưới, panel phải (danh sách task, tiến độ `x/y`, ghi chú). Dưới 768px: bàn chơi thành danh sách dọc, panel phải thành tab. Hiệu ứng ở plan này chỉ là CSS transition `transform`/`opacity` ≤ 0,3s; hiệu ứng đầy đủ để Plan 2.

- [ ] **Step 1: Viết test fail:**
  - CardFan: bấm lá → `send({type:'vote',cardId})`; bấm lại lá đang chọn → `cardId:null`; observer không thấy quạt bài; phím 1–9 chọn lá tương ứng.
  - Seat: trạng thái `voted` (lá úp), `thinking`, `offline` (mờ); không bao giờ hiện giá trị trước khi lật.
  - ResultsPanel: render phân bố, min/max, chip "Đồng thuận: {Tuyệt đối|Cao|Vừa phải|Thấp|Chưa rõ}" theo `consensusLevel`, consensus %, average + nearestCard với bộ số; bộ T-shirt hiện modes thay cho average; `needsDiscussion` hiện lời mời người thấp nhất/cao nhất nói trước (kèm tên); host thấy nút "Chốt" (chọn lá hoặc nhập giá trị) và "Bỏ phiếu lại".
  - Khi `connection==='reconnecting'` hiện banner; khi có lại state mới thì banner ẩn.
- [ ] **Step 2: Chạy test.** Kỳ vọng: FAIL.
- [ ] **Step 3: Implement.** Store nhận `state` và thay thế toàn bộ state. `send` resolve hoặc reject theo ack. Socket.IO bật reconnect mặc định.
- [ ] **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat(web): room screen`

---

### Task 9: Web — quản lý task, tổng kết, E2E + tải

**Files:**
- Create: `apps/frontend/src/room/AddItemsDialog.tsx`, `apps/frontend/src/pages/Summary.tsx`, `e2e/voting.spec.ts`, `e2e/load.ts`, `playwright.config.ts`
- Test: `apps/frontend/src/room/AddItemsDialog.test.tsx`, các file e2e

**Interfaces:**
- Consumes: `addItems` command, `buildSummary`, `GET /api/rooms/:slug/summary.csv`.
- Produces: `parseItemLines(text: string): {title:string; description:string}[]` (dán nhiều dòng; dòng rỗng bị bỏ; `title | description` tách bằng `|` đầu tiên); `parseItemsCsv(text: string)` (cột `title,description`, có header).

- [ ] **Step 1: Viết test fail:** `parseItemLines('A\n\n B | mô tả | x ')` → `[{title:'A',description:''},{title:'B',description:'mô tả | x'}]` · CSV có ngoặc kép và xuống dòng parse đúng · file CSV > 500 dòng → báo lỗi `TOO_MANY_ITEMS`.
- [ ] **Step 2: Chạy test.** Kỳ vọng: FAIL. **Step 3: Implement.** **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Viết E2E** `e2e/voting.spec.ts` (3 browser context: host, voter đã đăng ký, khách): host tạo phòng → dán 2 task → bắt đầu → 2 người vote `3` và `13` → host lật → thấy lời mời thảo luận → bỏ phiếu lại → cả hai vote `8` → chốt `8` → task 2 → khách reload trang giữa vòng thì vẫn giữ phiếu → kết thúc → trang tổng kết có 2 dòng, `rounds` lần lượt là `2` và `1` → tải CSV và so nội dung.
- [ ] **Step 6: Viết load test** `e2e/load.ts`: 50 client socket vào cùng một phòng, mỗi client vote ngẫu nhiên rồi lật; in p95 latency. Ngưỡng: p95 < 300ms với 20 client; với 50 client không có lỗi hay mất phiếu.
- [ ] **Step 7: Chạy** `pnpm e2e && pnpm tsx e2e/load.ts`. Kỳ vọng: mọi test PASS, in `p95(20)=<300ms`.
- [ ] **Step 8: Commit** `feat: item import, summary/csv, e2e and load tests`

---

## Ngoài phạm vi Plan 1 (đã có plan khác nhận)

- Hiệu ứng 3-2-1, lật bài theo nhịp, confetti canvas, plot twist, con dấu chốt, nhân vật có trạng thái, reaction, ném giấy, vòng quay, 3 mức hiệu ứng, auto-hạ theo fps, lazy-load âm thanh/sprite → **Plan 2**
- Jira OAuth, import JQL/board, cấu hình trường, preview push, phát hiện xung đột, nhật ký đẩy điểm, mã hóa token → **Plan 3**
- Excel, retention 12 tháng, huy hiệu, trang phục, chủ đề mùa, các template ngoài Estimate → **Plan 4**
