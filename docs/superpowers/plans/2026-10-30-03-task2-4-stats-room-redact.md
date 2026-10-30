# ✅ ĐÃ XONG (2026-10-30) — Task 2–4 — Thống kê vòng, logic phòng, che phiếu + CSV (kèm nâng cấp stack) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện toàn bộ domain thuần của Planning Poker: thống kê vòng (Task 2), luật chơi trong phòng gồm vai trò/vòng/lật/bỏ phiếu lại/chốt điểm/chuyển host/kick/duyệt/khóa phòng (Task 3), che phiếu trước khi lật + tổng kết + CSV (Task 4). Trước đó chốt stack: commit backend NestJS + TypeORM + Postgres (Task 0a) và nâng frontend lên React 19 + Tailwind v4 + shadcn (Task 0b).

**Architecture:** Domain thuần, không I/O, nằm ở `apps/backend/src/domain`; frontend import qua `apps/frontend/src/domain.ts`. `applyCommand(state, cmd, now)` clone state bằng `structuredClone`, rồi gọi handler mutate bản clone. Nếu handler throw `DomainError` thì bản clone bị bỏ, nên mọi command là atomic và state cũ không bao giờ bị đổi. Thời gian luôn truyền vào qua `now`, domain không gọi `Date.now()`.

**Tech Stack:** Backend: NestJS 10, TypeORM 0.3, PostgreSQL 16 (docker compose, port 5433), Vitest 2 + unplugin-swc. Frontend: React 19, Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui, i18next, Vitest 3.

**Nguồn:** Plan 1 (`docs/superpowers/plans/2026-10-29-01-core-realtime-voting.md`) Task 2–4, roadmap §2, spec §2/§3/§6/§7.
**Nơi lưu khi thực hiện:** file này (`2026-10-30-03-…`; số `02` đã dùng cho Plan 2).

## Global Constraints

- Discussion trigger: `spreadSteps >= 2`, tính theo hiệu chỉ số trên thang; lá đặc biệt không tính (roadmap §2.4).
- Trung bình nằm đúng giữa 2 lá → chọn lá **lớn hơn** (§2.6). Mode bị hòa → trả về tất cả (§2.7).
- Đổi voter → observer giữa vòng → xóa phiếu của vòng hiện tại (§2.8).
- Host phải có tài khoản. Host offline **> 60 000 ms** thì chuyển cho người kế nhiệm đã chỉ định (có tài khoản + online); nếu không có thì cho người có tài khoản, đang online, vào sớm nhất; nếu vẫn không có ai thì `hostId = null`, và người có tài khoản vào đầu tiên sẽ nhận host (§2.5).
- Giá trị phiếu và lý do **không bao giờ** gửi cho người khác trước khi lật (§6). Event domain không chứa `cardId`.
- Lý do tối đa **200** ký tự. Tên tối đa **40** ký tự.
- Tổng kết/CSV không kèm tên người (§7). CSV: BOM UTF-8, CRLF, RFC 4180, chống formula injection.
- `enabledSpecials` chỉ đặt lúc tạo phòng, không đổi giữa buổi (quyết định 2026-10-30).

## Quyết định thiết kế (mới, khác Plan 1)

1. **Host tách khỏi role.** `Role = 'voter'|'observer'`, host là `RoomState.hostId`. Host vẫn bỏ phiếu được nếu role là voter (mặc định của host là voter).
2. **`createRoom` nhận object options** `{ id, owner, scale, now, enabledSpecials?, revealRule?, access? }` thay cho 4 tham số vị trí như Plan 1.
3. **Kick / duyệt / khóa phòng nằm trong domain** (đã chốt 2026-10-30): command `kick`, `approve`, `reject`, `setAccess`.
   - Người bị kick bị đưa vào `banned`: `join` lại → `KICKED` (trong vòng đời phòng).
   - Khi `locked`, người mới vào → `ROOM_LOCKED`; người đã có ghế vẫn vào lại được. Chủ phòng (`ownerId`) luôn vào được.
   - Khi `requireApproval`, người mới vào nằm ở `pending` cho tới khi host `approve`/`reject`. Tắt `requireApproval` → tự duyệt hết người đang chờ.
4. **`startRound` khi vòng hiện tại đang `voting`** → vòng đó bị **bỏ hẳn**, không vào `history`, để `history` chỉ chứa vòng đã lật và không bao giờ giữ phiếu chưa lật.
5. **Auto-reveal `onAllVoted` chỉ kiểm tra khi có phiếu mới**, không kiểm tra khi có người disconnect, để tránh lật bài ngoài ý muốn khi ai đó reload tab. `revealRule` mặc định `{ onAllVoted: false, timerSec: null }`.
6. **Mã lỗi:** `CARD_NOT_IN_DECK` (lá không có trong bộ đang bật) thay `UNKNOWN_CARD` ở `vote`; `computeRoundStats` vẫn throw `UNKNOWN_CARD`.
7. **Reasons cũng bị che** như phiếu khi đang voting; người xem chỉ thấy lý do của chính mình.
8. `pending` và `banned` chỉ host nhìn thấy trong `toPublicState`.

---

## File Structure

```
apps/backend/src/domain/
  stats.ts, stats.test.ts                  — Task 2
  room/types.ts                            — RoomState, Participant, Command, DomainEvent, hằng số
  room/guards.ts                           — requireParticipant/requireHost/requireTarget
  room/participants.ts                     — join/disconnect/rename/setRole/host/kick/approve/setAccess/host timeout
  room/rounds.ts                           — addItems/startRound/vote/reveal/revote/reason/finalize/timer
  room/apply.ts                            — createRoom, applyCommand
  room/testing.ts                          — fixture cho test (room(), user(), guest(), run())
  room/participants.test.ts, room/access.test.ts, room/rounds.test.ts
  redact.ts, redact.test.ts                — Task 4
  summary.ts, summary.test.ts              — Task 4
  index.ts                                 — re-export public API
apps/frontend/  (Task 0b) vite.config.ts, tsconfig.json, components.json, src/index.css, src/lib/utils.ts, src/components/ui/*, src/App.tsx
```

## Thứ tự & phụ thuộc

`0a backend commit` → `0b frontend` (độc lập với 2–4) · `0a` → `Task 2` → `Task 3` → `Task 4` → `Docs`.

---

### Task 0a: Commit backend NestJS + TypeORM + Postgres (đã code xong, chưa commit)

Hiện trạng đã kiểm tra: `pnpm test` (17 pass, có 2 test health), `test:e2e` pass với Postgres thật, `nest build` OK, server trả `/api/health` 200 (DB up) / 503 (DB down), `migration:run` → "No migrations are pending".

- [x] **Step 1:** Thêm root scripts vào `package.json`:
```json
"db:up": "docker compose up -d --wait db",
"dev:backend": "pnpm --filter @opendeck/backend dev",
"dev:frontend": "pnpm --filter @opendeck/frontend dev"
```
- [x] **Step 2:** Verify lại: `pnpm db:up && pnpm test && pnpm typecheck && pnpm --filter @opendeck/backend test:e2e`. Expected: PASS hết.
- [x] **Step 3:** Cập nhật docs về stack: Plan 1 dòng **Tech Stack** → `NestJS 10 + TypeORM 0.3 + PostgreSQL 16`, `React 19 + Vite 7 + Tailwind v4 + shadcn/ui + Zustand + react-router`. Ghi chú ở đầu Task 5/6: "Viết lại chi tiết theo NestJS (module/controller/guard, TypeORM entity + migration, `@nestjs/websockets` + Socket.IO adapter) khi bắt đầu Task 5". Roadmap §4 cập nhật stack tương tự.
- [x] **Step 4: Commit**
```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml docker-compose.yml apps/backend docs/superpowers/plans
git status --short   # đảm bảo KHÔNG có apps/backend/.env và dist/
git commit -m "feat(backend): NestJS + TypeORM + Postgres skeleton with health check

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 0b: Frontend React 19 + Tailwind CSS v4 + shadcn/ui

**Files:** Modify `apps/frontend/{package.json,tsconfig.json,vite.config.ts,src/main.tsx,src/App.tsx}` · Create `apps/frontend/src/index.css`, `components.json`, `src/lib/utils.ts`, `src/components/ui/{button,select}.tsx` (shadcn sinh ra).

- [x] **Step 1: Nâng cấp dependency**
```bash
cd apps/frontend
pnpm add react@^19 react-dom@^19
pnpm add -D @types/react@^19 @types/react-dom@^19 vite@^7 @vitejs/plugin-react@^5 vitest@^3 tailwindcss@^4 @tailwindcss/vite@^4 @types/node@^22
```
Nếu pnpm báo `Ignored build scripts` (vd `@tailwindcss/oxide`): `pnpm approve-builds <tên> -y` ở root.

- [x] **Step 2: `vite.config.ts`**
```ts
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { proxy: { '/api': 'http://localhost:3001' } },
})
```

- [x] **Step 3: `tsconfig.json`** thêm alias + types node:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "vitest/globals", "node"],
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

- [x] **Step 4: Tailwind entry** — `src/index.css`:
```css
@import "tailwindcss";
```
`src/main.tsx` thêm `import './index.css'` (trước `import './i18n'`).

- [x] **Step 5: shadcn init + component**
```bash
pnpm dlx shadcn@latest init -y -b neutral
pnpm dlx shadcn@latest add button select
```
Nếu CLI vẫn hỏi: style `new-york`, base color `neutral`, CSS variables `yes`. Kết quả mong đợi: `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, `src/components/ui/select.tsx`, `src/index.css` có theme variables.

- [x] **Step 6: `src/App.tsx`** dùng shadcn:
```tsx
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRESET_SCALES, deckOf, type Card } from '@/domain'
import { LANGUAGES, isLanguage, setLanguage } from '@/i18n'

export function App() {
  const { t, i18n } = useTranslation()
  const scale = PRESET_SCALES.fibonacci
  const cardLabel = (c: Card) => (c.special ? t(`cards.special.${c.id}`) : c.label)

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('app.title')}</h1>
        <Select value={i18n.language} onValueChange={v => { if (isLanguage(v)) setLanguage(v) }}>
          <SelectTrigger className="w-28" aria-label={t('app.language')}><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t(`scales.${scale.id}`)}</h2>
        <ul className="flex flex-wrap gap-2">
          {deckOf(scale).map(c => <li key={c.id}><Button variant="outline">{cardLabel(c)}</Button></li>)}
        </ul>
      </section>
    </main>
  )
}
```

- [x] **Step 7: Verify**
```bash
pnpm --filter @opendeck/frontend test && pnpm typecheck && pnpm --filter @opendeck/frontend build
grep -l "max-w-3xl" apps/frontend/dist/assets/*.css   # Tailwind đã sinh class
node -e "console.log(require('./apps/frontend/node_modules/react/package.json').version)"   # 19.x
```
Chạy `pnpm dev:frontend`, `curl -s localhost:5173 | grep root` → có `<div id="root">`. Dừng dev server.

- [x] **Step 8: Commit** `feat(frontend): React 19, Tailwind CSS v4, shadcn/ui` (+ trailer Co-authored-by), xóa `apps/frontend/dist` trước khi add.

---
### Task 2: Tính thống kê vòng — `computeRoundStats`

**Files:** Create `apps/backend/src/domain/stats.ts` · Test `apps/backend/src/domain/stats.test.ts` · Modify `apps/backend/src/domain/index.ts`

**Interfaces:**
- Consumes: `Card`, `Scale`, `SPECIAL_CARDS`, `PRESET_SCALES`, `createCustomScale` (deck.ts), `DomainError` (errors.ts)
- Produces:
```ts
interface RoundStats {
  total: number                                   // gồm cả lá đặc biệt
  distribution: { card: Card; count: number }[]   // chỉ count>0; thứ tự theo thang, lá đặc biệt ở cuối theo SPECIAL_IDS
  min: Card|null; max: Card|null                  // theo thứ tự thang, bỏ lá đặc biệt
  spreadSteps: number                             // index(max)-index(min); 0 nếu không có/1 phiếu thường
  needsDiscussion: boolean                        // spreadSteps >= 2
  consensus: number                               // count(mode)/số phiếu thường, 0..1; 0 nếu không có phiếu thường
  average: number|null                            // chỉ numeric scale và có phiếu thường
  nearestCard: Card|null                          // lá gần average nhất; hòa → numeric lớn hơn
  modes: Card[]                                   // lá nhiều phiếu nhất (hòa → tất cả, theo thứ tự thang)
}
function computeRoundStats(scale: Scale, cardIds: readonly string[]): RoundStats   // throws DomainError('UNKNOWN_CARD')
```

- [x] **Step 1: Viết test fail** — `stats.test.ts`
```ts
import { PRESET_SCALES, createCustomScale } from './deck'
import { computeRoundStats } from './stats'

const fib = PRESET_SCALES.fibonacci
const ts = PRESET_SCALES.tshirt

test('3,5,8 → spread 2, needs discussion, avg 5.33 → nearest 5', () => {
  const s = computeRoundStats(fib, ['3', '5', '8'])
  expect(s.spreadSteps).toBe(2)
  expect(s.needsDiscussion).toBe(true)
  expect(s.average).toBeCloseTo(5.333, 2)
  expect(s.nearestCard!.id).toBe('5')
})
test('3,5 → spread 1, no discussion; avg 4 ties 3/5 → picks 5', () => {
  const s = computeRoundStats(fib, ['3', '5'])
  expect(s.needsDiscussion).toBe(false)
  expect(s.nearestCard!.id).toBe('5')
})
test('min/max/distribution follow scale order, specials last', () => {
  const s = computeRoundStats(fib, ['8', 'coffee', '2', '2', 'bug'])
  expect(s.min!.id).toBe('2')
  expect(s.max!.id).toBe('8')
  expect(s.spreadSteps).toBe(3)
  expect(s.distribution.map(d => [d.card.id, d.count])).toEqual([['2', 2], ['8', 1], ['coffee', 1], ['bug', 1]])
  expect(s.modes.map(c => c.id)).toEqual(['2'])
  expect(s.consensus).toBeCloseTo(2 / 3)
})
test('special cards excluded from min/max/avg but counted in total', () => {
  const s = computeRoundStats(fib, ['2', '2', 'coffee'])
  expect(s.total).toBe(3)
  expect(s.consensus).toBe(1)
  expect(s.average).toBe(2)
  expect(s.distribution.at(-1)).toMatchObject({ card: { id: 'coffee' }, count: 1 })
})
test('tshirt: no average, modes instead, ties return both', () => {
  const s = computeRoundStats(ts, ['S', 'S', 'L', 'L'])
  expect(s.average).toBeNull()
  expect(s.nearestCard).toBeNull()
  expect(s.modes.map(c => c.id)).toEqual(['S', 'L'])
  expect(s.spreadSteps).toBe(2)
  expect(s.consensus).toBe(0.5)
})
test('unsorted custom numeric scale: nearest tie picks larger numeric, spread uses scale index', () => {
  const sc = createCustomScale('x', ['4', '2', '1'])
  const s = computeRoundStats(sc, ['4', '2'])   // avg 3 ties 2/4
  expect(s.nearestCard!.id).toBe('4')
  expect(s.spreadSteps).toBe(1)
})
test.each([[[]], [['shrug', 'infinity']], [['8']]])('degenerate %j does not crash', ids => {
  const s = computeRoundStats(fib, ids)
  expect(s.needsDiscussion).toBe(false)
  expect(s.spreadSteps).toBe(0)
})
test('only specials → average null, consensus 0, modes empty', () => {
  const s = computeRoundStats(fib, ['shrug', 'infinity'])
  expect(s).toMatchObject({ total: 2, average: null, nearestCard: null, min: null, max: null, consensus: 0, modes: [] })
})
test('unknown card id throws UNKNOWN_CARD', () => {
  expect(() => computeRoundStats(fib, ['99'])).toThrow('UNKNOWN_CARD')
})
```

- [x] **Step 2: Chạy** `pnpm --filter @opendeck/backend test -- stats` → Expected FAIL `Failed to load url ./stats`.

- [x] **Step 3: Implement** — `stats.ts`
```ts
import { type Card, type Scale, SPECIAL_CARDS } from './deck'
import { DomainError } from './errors'

export interface RoundStats {
  total: number
  distribution: { card: Card; count: number }[]
  min: Card | null
  max: Card | null
  spreadSteps: number
  needsDiscussion: boolean
  consensus: number
  average: number | null
  nearestCard: Card | null
  modes: Card[]
}

export function computeRoundStats(scale: Scale, cardIds: readonly string[]): RoundStats {
  const regularIndex = new Map(scale.cards.map((c, i) => [c.id, i]))
  const specialIndex = new Map(SPECIAL_CARDS.map((c, i) => [c.id, i]))
  const regularCounts = scale.cards.map(() => 0)
  const specialCounts = SPECIAL_CARDS.map(() => 0)

  for (const id of cardIds) {
    const r = regularIndex.get(id)
    if (r !== undefined) { regularCounts[r] = (regularCounts[r] ?? 0) + 1; continue }
    const sp = specialIndex.get(id)
    if (sp === undefined) throw new DomainError('UNKNOWN_CARD')
    specialCounts[sp] = (specialCounts[sp] ?? 0) + 1
  }

  const distribution = [
    ...scale.cards.map((card, i) => ({ card, count: regularCounts[i] ?? 0 })),
    ...SPECIAL_CARDS.map((card, i) => ({ card, count: specialCounts[i] ?? 0 })),
  ].filter(d => d.count > 0)

  const regularTotal = regularCounts.reduce((a, b) => a + b, 0)
  const usedIdx = regularCounts.flatMap((n, i) => (n > 0 ? [i] : []))
  const minIdx = usedIdx[0]
  const maxIdx = usedIdx.at(-1)
  const spreadSteps = minIdx !== undefined && maxIdx !== undefined ? maxIdx - minIdx : 0

  const top = Math.max(0, ...regularCounts)
  const modes = top === 0 ? [] : scale.cards.filter((_, i) => regularCounts[i] === top)

  let average: number | null = null
  let nearestCard: Card | null = null
  if (scale.kind === 'numeric' && regularTotal > 0) {
    const avg = scale.cards.reduce((sum, c, i) => sum + (c.numeric ?? 0) * (regularCounts[i] ?? 0), 0) / regularTotal
    average = avg
    for (const c of scale.cards) {
      if (nearestCard === null) { nearestCard = c; continue }
      const d = Math.abs((c.numeric ?? 0) - avg)
      const best = Math.abs((nearestCard.numeric ?? 0) - avg)
      if (d < best || (d === best && (c.numeric ?? 0) > (nearestCard.numeric ?? 0))) nearestCard = c
    }
  }

  return {
    total: cardIds.length,
    distribution,
    min: minIdx === undefined ? null : scale.cards[minIdx] ?? null,
    max: maxIdx === undefined ? null : scale.cards[maxIdx] ?? null,
    spreadSteps,
    needsDiscussion: spreadSteps >= 2,
    consensus: regularTotal === 0 ? 0 : top / regularTotal,
    average,
    nearestCard,
    modes,
  }
}
```
`index.ts` thêm `export * from './stats'`.

- [x] **Step 4: Chạy** `pnpm --filter @opendeck/backend test && pnpm typecheck` → Expected PASS.
- [x] **Step 5: Commit** `feat(domain): round statistics` (+ trailer).

---
### Task 3: Logic phòng (`room/*`)

**Files:** Create `apps/backend/src/domain/room/{types,guards,participants,rounds,apply,testing}.ts` · Test `apps/backend/src/domain/room/{participants,access,rounds}.test.ts` · Modify `apps/backend/src/domain/index.ts`

**Interfaces:**
- Consumes: `Scale`, `SpecialId`, `SPECIAL_IDS`, `deckOf`, `PRESET_SCALES` (deck), `computeRoundStats`, `RoundStats` (stats), `DomainError`
- Produces (Task 4, 6, 8 dùng) — `room/types.ts`:
```ts
import type { Scale, SpecialId } from '../deck'
import type { RoundStats } from '../stats'

export const HOST_OFFLINE_MS = 60_000
export const REASON_MAX = 200
export const NAME_MAX = 40
export const TIMER_MAX_SEC = 3600

export type Role = 'voter' | 'observer'
export interface JoinInfo { id: string; userId: string | null; name: string; avatar: string; role: Role }
export interface Participant extends JoinInfo { joinedAt: number; online: boolean; offlineSince: number | null }
export interface PendingJoin extends JoinInfo { requestedAt: number }
export interface Item {
  id: string; source: 'manual' | 'jira'; externalRef: string | null
  title: string; description: string; status: 'pending' | 'done'
}
export interface Round {
  itemId: string; number: number; status: 'voting' | 'revealed'
  votes: Record<string, string>; reasons: Record<string, string>
  deadline: number | null; stats: RoundStats | null
}
export interface Outcome { itemId: string; value: string; note: string; decidedBy: string; decidedAt: number; rounds: number }
export interface RevealRule { onAllVoted: boolean; timerSec: number | null }
export interface RoomAccess { locked: boolean; requireApproval: boolean }
export interface RoomState {
  id: string
  ownerId: string                 // userId của người tạo phòng
  hostId: string | null           // participant id; null = hostless
  successorId: string | null
  participants: Record<string, Participant>
  pending: Record<string, PendingJoin>
  banned: string[]
  access: RoomAccess
  scale: Scale
  enabledSpecials: SpecialId[]    // luôn theo thứ tự SPECIAL_IDS
  revealRule: RevealRule
  items: Item[]
  itemSeq: number
  current: Round | null
  history: Round[]                // chỉ chứa vòng đã lật
  outcomes: Outcome[]
}
export interface NewItem { title: string; description?: string; externalRef?: string | null }
export interface CreateRoomOptions {
  id: string
  owner: JoinInfo & { userId: string }
  scale: Scale
  now: number
  enabledSpecials?: readonly SpecialId[]
  revealRule?: RevealRule
  access?: Partial<RoomAccess>
}

export type Command =
  | { type: 'join'; participant: JoinInfo }
  | { type: 'disconnect'; pid: string }
  | { type: 'rename'; pid: string; name: string; avatar?: string }
  | { type: 'setRole'; pid: string; target: string; role: Role }
  | { type: 'transferHost'; pid: string; target: string }
  | { type: 'setSuccessor'; pid: string; target: string | null }
  | { type: 'kick'; pid: string; target: string }
  | { type: 'approve'; pid: string; target: string }
  | { type: 'reject'; pid: string; target: string }
  | { type: 'setAccess'; pid: string; locked?: boolean; requireApproval?: boolean }
  | { type: 'addItems'; pid: string; items: NewItem[] }
  | { type: 'startRound'; pid: string; itemId: string; timerSec?: number }
  | { type: 'vote'; pid: string; cardId: string | null }
  | { type: 'reveal'; pid: string }
  | { type: 'revote'; pid: string }
  | { type: 'reason'; pid: string; text: string }
  | { type: 'finalize'; pid: string; value: string; note?: string }
  | { type: 'tick' }

export type DomainEvent =
  | { type: 'joined' | 'rejoined' | 'offline' | 'renamed' | 'kicked' | 'rejected' | 'voted' | 'unvoted'; pid: string }
  | { type: 'approvalRequested'; pid: string; name: string }
  | { type: 'roleChanged'; pid: string; role: Role }
  | { type: 'hostChanged'; from: string | null; to: string | null; reason: 'manual' | 'timeout' | 'claimed' }
  | { type: 'accessChanged'; locked: boolean; requireApproval: boolean }
  | { type: 'itemsAdded'; ids: string[] }
  | { type: 'roundStarted'; itemId: string; number: number }
  | { type: 'revealed'; itemId: string; number: number; auto: boolean }
  | { type: 'discussionNeeded'; lowPids: string[]; highPids: string[] }
  | { type: 'finalized'; itemId: string; value: string }

export interface CommandResult { state: RoomState; events: DomainEvent[] }
```
- `room/apply.ts`: `createRoom(o: CreateRoomOptions): RoomState`, `applyCommand(s: RoomState, c: Command, now: number): CommandResult` (throws `DomainError`).
- Mã lỗi: `NOT_IN_ROOM`, `NOT_HOST`, `NOT_VOTER`, `UNKNOWN_PARTICIPANT`, `INVALID_TARGET`, `HOST_NEEDS_ACCOUNT`, `KICKED`, `ROOM_LOCKED`, `NAME_INVALID`, `ITEM_TITLE_EMPTY`, `UNKNOWN_ITEM`, `TIMER_INVALID`, `ROUND_NOT_VOTING`, `ROUND_NOT_REVEALED`, `NO_ROUND`, `CARD_NOT_IN_DECK`, `REASON_TOO_LONG`, `FINAL_EMPTY`, `UNKNOWN_SPECIAL` (từ `deckOf`).

**Luật tóm tắt:**
- `join` id đã có ghế → `online=true`, cập nhật name/avatar, giữ role + phiếu, event `rejoined`. Id mới: `banned` → `KICKED`; `locked` (trừ chủ phòng) → `ROOM_LOCKED`; `requireApproval` (trừ chủ phòng) → vào `pending` + `approvalRequested`; còn lại → vào phòng ngay + `joined`. Nếu đang hostless và người vừa vào/vào lại có tài khoản → nhận host (`reason:'claimed'`).
- `disconnect`: người đang chờ duyệt → xóa khỏi `pending`; người có ghế → `online=false`, `offlineSince=now`, giữ phiếu.
- `setRole`: tự đổi cho mình, hoặc host đổi cho người khác. voter→observer khi đang voting → xóa phiếu.
- `kick`: chỉ host, không tự kick; xóa ghế/pending, xóa phiếu + lý do của vòng hiện tại, thêm vào `banned`.
- `setAccess`: chỉ host. Tắt `requireApproval` → duyệt toàn bộ `pending` theo `requestedAt`.
- `tick`: chuyển host khi quá hạn + auto-reveal theo `deadline`.
- `vote`: phải có vòng `voting` → role voter → `cardId` thuộc `deckOf(scale, enabledSpecials)`; `null` = rút phiếu. Event chỉ có `pid`.
- `reveal`/`revote`/`finalize`/`startRound`/`addItems`: chỉ host.

- [x] **Step 1: Fixture test** — `room/testing.ts`
```ts
import { PRESET_SCALES } from '../deck'
import { applyCommand, createRoom } from './apply'
import type { Command, CommandResult, CreateRoomOptions, DomainEvent, JoinInfo, Role, RoomState } from './types'

export const T0 = 1_000_000

export const user = (id: string, role: Role = 'voter'): JoinInfo => ({ id, userId: `user-${id}`, name: id, avatar: 'cat', role })
export const guest = (id: string, role: Role = 'voter'): JoinInfo => ({ id, userId: null, name: id, avatar: 'dog', role })

/** Room owned and hosted by registered user 'H' (a voter), Fibonacci scale, created at T0. */
export function room(opts: Partial<Pick<CreateRoomOptions, 'revealRule' | 'access' | 'enabledSpecials' | 'scale'>> = {}): RoomState {
  return createRoom({
    id: 'r1',
    owner: { id: 'H', userId: 'user-H', name: 'H', avatar: 'cat', role: 'voter' },
    scale: PRESET_SCALES.fibonacci,
    now: T0,
    ...opts,
  })
}

/** Applies commands in order at the same `now`, accumulating events. */
export function run(s: RoomState, cmds: Command[], now = T0): CommandResult {
  let state = s
  const events: DomainEvent[] = []
  for (const c of cmds) {
    const r = applyCommand(state, c, now)
    state = r.state
    events.push(...r.events)
  }
  return { state, events }
}
```

- [x] **Step 2: Viết test fail** — `room/participants.test.ts`
```ts
import { applyCommand } from './apply'
import { T0, guest, room, run, user } from './testing'
import { HOST_OFFLINE_MS } from './types'

test('createRoom: owner is host, online voter; defaults', () => {
  const s = room()
  expect(s.hostId).toBe('H')
  expect(s.participants.H).toMatchObject({ online: true, role: 'voter', joinedAt: T0 })
  expect(s.access).toEqual({ locked: false, requireApproval: false })
  expect(s.revealRule).toEqual({ onAllVoted: false, timerSec: null })
  expect(s.enabledSpecials).toHaveLength(7)
})
test('applyCommand never mutates the previous state', () => {
  const s0 = run(room(), [{ type: 'join', participant: user('A') }]).state
  const snapshot = structuredClone(s0)
  applyCommand(s0, { type: 'rename', pid: 'A', name: 'Alice' }, T0)
  expect(() => applyCommand(s0, { type: 'rename', pid: 'A', name: '' }, T0)).toThrow('NAME_INVALID')
  expect(s0).toEqual(snapshot)
})
test('rejoin with same id keeps seat and vote', () => {
  const { state, events } = run(room(), [
    { type: 'join', participant: user('A') },
    { type: 'addItems', pid: 'H', items: [{ title: 'Login' }] },
    { type: 'startRound', pid: 'H', itemId: 'i1' },
    { type: 'vote', pid: 'A', cardId: '5' },
    { type: 'disconnect', pid: 'A' },
    { type: 'join', participant: user('A') },
  ])
  expect(Object.keys(state.participants)).toEqual(['H', 'A'])
  expect(state.participants.A).toMatchObject({ online: true, offlineSince: null })
  expect(state.current!.votes.A).toBe('5')
  expect(events).toContainEqual({ type: 'rejoined', pid: 'A' })
})
test('disconnect marks offline with timestamp', () => {
  const s = run(room(), [{ type: 'join', participant: user('A') }, { type: 'disconnect', pid: 'A' }], T0 + 5).state
  expect(s.participants.A).toMatchObject({ online: false, offlineSince: T0 + 5 })
})
test('voter→observer mid-round removes their vote', () => {
  const s = run(room(), [
    { type: 'join', participant: user('A') },
    { type: 'addItems', pid: 'H', items: [{ title: 'Login' }] },
    { type: 'startRound', pid: 'H', itemId: 'i1' },
    { type: 'vote', pid: 'A', cardId: '5' },
    { type: 'setRole', pid: 'A', target: 'A', role: 'observer' },
  ]).state
  expect(s.participants.A!.role).toBe('observer')
  expect(s.current!.votes.A).toBeUndefined()
})
test('only host can change someone else\'s role', () => {
  const s = run(room(), [{ type: 'join', participant: user('A') }, { type: 'join', participant: user('B') }]).state
  expect(() => applyCommand(s, { type: 'setRole', pid: 'A', target: 'B', role: 'observer' }, T0)).toThrow('NOT_HOST')
  expect(applyCommand(s, { type: 'setRole', pid: 'H', target: 'B', role: 'observer' }, T0).state.participants.B!.role).toBe('observer')
})
test('host offline 60_001ms → host goes to designated successor (registered, online)', () => {
  const s = run(room(), [
    { type: 'join', participant: user('A') },
    { type: 'join', participant: user('B') },
    { type: 'setSuccessor', pid: 'H', target: 'B' },
    { type: 'disconnect', pid: 'H' },
  ]).state
  const r = run(s, [{ type: 'tick' }], T0 + HOST_OFFLINE_MS + 1)
  expect(r.state.hostId).toBe('B')
  expect(r.state.successorId).toBeNull()
  expect(r.events).toContainEqual({ type: 'hostChanged', from: 'H', to: 'B', reason: 'timeout' })
})
test('no (online) successor → earliest-joined online registered user', () => {
  let s = run(room(), [{ type: 'join', participant: guest('G') }], T0).state
  s = run(s, [{ type: 'join', participant: user('B') }], T0 + 1).state
  s = run(s, [{ type: 'join', participant: user('A') }], T0 + 2).state
  s = run(s, [{ type: 'setSuccessor', pid: 'H', target: 'A' }, { type: 'disconnect', pid: 'A' }, { type: 'disconnect', pid: 'H' }], T0 + 10).state
  expect(run(s, [{ type: 'tick' }], T0 + 10 + HOST_OFFLINE_MS + 1).state.hostId).toBe('B')
})
test.each([HOST_OFFLINE_MS - 1, HOST_OFFLINE_MS])('host offline %ims → unchanged', ms => {
  const s = run(room(), [{ type: 'join', participant: user('A') }, { type: 'disconnect', pid: 'H' }]).state
  const r = run(s, [{ type: 'tick' }], T0 + ms)
  expect(r.state.hostId).toBe('H')
  expect(r.events).toEqual([])
})
test('only guests online → hostId null; next registered join becomes host', () => {
  let s = run(room(), [{ type: 'join', participant: guest('G') }, { type: 'disconnect', pid: 'H' }]).state
  s = run(s, [{ type: 'tick' }], T0 + HOST_OFFLINE_MS + 1).state
  expect(s.hostId).toBeNull()
  const r = run(s, [{ type: 'join', participant: user('A') }], T0 + HOST_OFFLINE_MS + 2)
  expect(r.state.hostId).toBe('A')
  expect(r.events).toContainEqual({ type: 'hostChanged', from: null, to: 'A', reason: 'claimed' })
})
test('returning old host does not reclaim host from the new one', () => {
  let s = run(room(), [{ type: 'join', participant: user('A') }, { type: 'disconnect', pid: 'H' }]).state
  s = run(s, [{ type: 'tick' }], T0 + HOST_OFFLINE_MS + 1).state
  s = run(s, [{ type: 'join', participant: user('H') }], T0 + HOST_OFFLINE_MS + 2).state
  expect(s.hostId).toBe('A')
})
test('transferHost: manual, guest target throws HOST_NEEDS_ACCOUNT', () => {
  const s = run(room(), [{ type: 'join', participant: guest('G') }, { type: 'join', participant: user('A') }]).state
  expect(() => applyCommand(s, { type: 'transferHost', pid: 'H', target: 'G' }, T0)).toThrow('HOST_NEEDS_ACCOUNT')
  expect(() => applyCommand(s, { type: 'setSuccessor', pid: 'H', target: 'G' }, T0)).toThrow('HOST_NEEDS_ACCOUNT')
  const r = applyCommand(s, { type: 'transferHost', pid: 'H', target: 'A' }, T0)
  expect(r.state.hostId).toBe('A')
  expect(r.events).toEqual([{ type: 'hostChanged', from: 'H', to: 'A', reason: 'manual' }])
})
test('non-host startRound throws NOT_HOST; stranger throws NOT_IN_ROOM', () => {
  const s = run(room(), [{ type: 'join', participant: user('A') }, { type: 'addItems', pid: 'H', items: [{ title: 'x' }] }]).state
  expect(() => applyCommand(s, { type: 'startRound', pid: 'A', itemId: 'i1' }, T0)).toThrow('NOT_HOST')
  expect(() => applyCommand(s, { type: 'vote', pid: 'Z', cardId: '1' }, T0)).toThrow('NOT_IN_ROOM')
})
test('rename trims and validates 1..40 chars', () => {
  const s = run(room(), [{ type: 'join', participant: guest('G') }]).state
  expect(applyCommand(s, { type: 'rename', pid: 'G', name: '  Mèo  ', avatar: 'fox' }, T0).state.participants.G).toMatchObject({ name: 'Mèo', avatar: 'fox' })
  expect(() => applyCommand(s, { type: 'rename', pid: 'G', name: '   ' }, T0)).toThrow('NAME_INVALID')
  expect(() => applyCommand(s, { type: 'rename', pid: 'G', name: 'x'.repeat(41) }, T0)).toThrow('NAME_INVALID')
})
```

`room/access.test.ts`
```ts
import { applyCommand } from './apply'
import { T0, guest, room, run, user } from './testing'

test('kick removes seat, vote and reason; kicked id cannot rejoin', () => {
  const r = run(room(), [
    { type: 'join', participant: guest('G') },
    { type: 'addItems', pid: 'H', items: [{ title: 'x' }] },
    { type: 'startRound', pid: 'H', itemId: 'i1' },
    { type: 'vote', pid: 'G', cardId: '3' },
    { type: 'reason', pid: 'G', text: 'easy' },
    { type: 'kick', pid: 'H', target: 'G' },
  ])
  expect(r.state.participants.G).toBeUndefined()
  expect(r.state.current!.votes).toEqual({})
  expect(r.state.current!.reasons).toEqual({})
  expect(r.state.banned).toEqual(['G'])
  expect(r.events).toContainEqual({ type: 'kicked', pid: 'G' })
  expect(() => applyCommand(r.state, { type: 'join', participant: guest('G') }, T0)).toThrow('KICKED')
})
test('kick guards: non-host NOT_HOST, self INVALID_TARGET, unknown UNKNOWN_PARTICIPANT', () => {
  const s = run(room(), [{ type: 'join', participant: user('A') }]).state
  expect(() => applyCommand(s, { type: 'kick', pid: 'A', target: 'H' }, T0)).toThrow('NOT_HOST')
  expect(() => applyCommand(s, { type: 'kick', pid: 'H', target: 'H' }, T0)).toThrow('INVALID_TARGET')
  expect(() => applyCommand(s, { type: 'kick', pid: 'H', target: 'Z' }, T0)).toThrow('UNKNOWN_PARTICIPANT')
})
test('requireApproval: newcomer waits in pending, host approves', () => {
  const r1 = run(room({ access: { requireApproval: true } }), [{ type: 'join', participant: guest('G') }], T0 + 1)
  expect(r1.state.participants.G).toBeUndefined()
  expect(r1.state.pending.G).toMatchObject({ name: 'G', requestedAt: T0 + 1 })
  expect(r1.events).toEqual([{ type: 'approvalRequested', pid: 'G', name: 'G' }])
  const r2 = run(r1.state, [{ type: 'approve', pid: 'H', target: 'G' }], T0 + 2)
  expect(r2.state.pending).toEqual({})
  expect(r2.state.participants.G).toMatchObject({ joinedAt: T0 + 2, online: true })
  expect(r2.events).toContainEqual({ type: 'joined', pid: 'G' })
})
test('requireApproval: reject removes request; pending disconnect drops request', () => {
  const s = run(room({ access: { requireApproval: true } }), [{ type: 'join', participant: guest('G') }, { type: 'join', participant: guest('K') }]).state
  const r = run(s, [{ type: 'reject', pid: 'H', target: 'G' }, { type: 'disconnect', pid: 'K' }])
  expect(r.state.pending).toEqual({})
  expect(r.events).toContainEqual({ type: 'rejected', pid: 'G' })
  expect(() => applyCommand(s, { type: 'approve', pid: 'G', target: 'K' }, T0)).toThrow('NOT_IN_ROOM')
})
test('turning requireApproval off admits everyone pending in request order', () => {
  let s = run(room({ access: { requireApproval: true } }), [{ type: 'join', participant: guest('G') }], T0 + 1).state
  s = run(s, [{ type: 'join', participant: guest('K') }], T0 + 2).state
  const r = run(s, [{ type: 'setAccess', pid: 'H', requireApproval: false }], T0 + 3)
  expect(Object.keys(r.state.participants)).toEqual(['H', 'G', 'K'])
  expect(r.events).toEqual([
    { type: 'joined', pid: 'G' }, { type: 'joined', pid: 'K' },
    { type: 'accessChanged', locked: false, requireApproval: false },
  ])
})
test('locked room: newcomers rejected, existing seats can come back', () => {
  const s = run(room(), [
    { type: 'join', participant: user('A') },
    { type: 'setAccess', pid: 'H', locked: true },
    { type: 'disconnect', pid: 'A' },
  ]).state
  expect(() => applyCommand(s, { type: 'join', participant: guest('G') }, T0)).toThrow('ROOM_LOCKED')
  expect(applyCommand(s, { type: 'join', participant: user('A') }, T0).state.participants.A!.online).toBe(true)
})
test('owner bypasses lock and approval even on a fresh participant id', () => {
  const s = run(room({ access: { locked: true, requireApproval: true } }), [])
    .state
  const ownerNewTab = { id: 'H2', userId: 'user-H', name: 'H', avatar: 'cat', role: 'voter' as const }
  expect(applyCommand(s, { type: 'join', participant: ownerNewTab }, T0).state.participants.H2).toBeDefined()
})
```

`room/rounds.test.ts`
```ts
import { applyCommand } from './apply'
import { T0, room, run, user } from './testing'
import type { CreateRoomOptions } from './types'

type Opts = Partial<Pick<CreateRoomOptions, 'revealRule' | 'enabledSpecials'>>
/** H (host, voter), A, B voters; item i1 'Login' in round 1 voting. */
const voting = (opts: Opts = {}, now = T0) => run(room(opts), [
  { type: 'join', participant: user('A') },
  { type: 'join', participant: user('B') },
  { type: 'addItems', pid: 'H', items: [{ title: 'Login', externalRef: 'PROJ-1' }, { title: 'Logout', description: ' d ' }] },
  { type: 'startRound', pid: 'H', itemId: 'i1' },
], now).state

test('addItems assigns sequential ids, trims, rejects empty title', () => {
  const s = voting()
  expect(s.items.map(i => [i.id, i.externalRef, i.description, i.status])).toEqual([['i1', 'PROJ-1', '', 'pending'], ['i2', null, 'd', 'pending']])
  expect(() => applyCommand(s, { type: 'addItems', pid: 'H', items: [{ title: '  ' }] }, T0)).toThrow('ITEM_TITLE_EMPTY')
})
test('startRound: unknown item, invalid timer', () => {
  const s = voting()
  expect(() => applyCommand(s, { type: 'startRound', pid: 'H', itemId: 'nope' }, T0)).toThrow('UNKNOWN_ITEM')
  expect(() => applyCommand(s, { type: 'startRound', pid: 'H', itemId: 'i1', timerSec: 0 }, T0)).toThrow('TIMER_INVALID')
})
test('vote events never carry the card value; null withdraws', () => {
  const r = run(voting(), [{ type: 'vote', pid: 'A', cardId: '13' }, { type: 'vote', pid: 'A', cardId: null }])
  expect(JSON.stringify(r.events)).not.toContain('13')
  expect(r.events).toEqual([{ type: 'voted', pid: 'A' }, { type: 'unvoted', pid: 'A' }])
  expect(r.state.current!.votes).toEqual({})
})
test('vote after reveal throws ROUND_NOT_VOTING and stats unchanged', () => {
  const s = run(voting(), [{ type: 'vote', pid: 'A', cardId: '5' }, { type: 'reveal', pid: 'H' }]).state
  expect(() => applyCommand(s, { type: 'vote', pid: 'B', cardId: '8' }, T0)).toThrow('ROUND_NOT_VOTING')
  expect(s.current!.stats!.total).toBe(1)
})
test('observer vote throws NOT_VOTER', () => {
  const s = run(voting(), [{ type: 'join', participant: user('O', 'observer') }]).state
  expect(() => applyCommand(s, { type: 'vote', pid: 'O', cardId: '5' }, T0)).toThrow('NOT_VOTER')
})
test('disabled special card or unknown card throws CARD_NOT_IN_DECK', () => {
  const s = voting({ enabledSpecials: ['coffee'] })
  expect(s.enabledSpecials).toEqual(['coffee'])
  expect(() => applyCommand(s, { type: 'vote', pid: 'A', cardId: 'bomb' }, T0)).toThrow('CARD_NOT_IN_DECK')
  expect(() => applyCommand(s, { type: 'vote', pid: 'A', cardId: '99' }, T0)).toThrow('CARD_NOT_IN_DECK')
  expect(applyCommand(s, { type: 'vote', pid: 'A', cardId: 'coffee' }, T0).state.current!.votes.A).toBe('coffee')
})
test('onAllVoted: last online voter votes → auto reveal (offline voter not counted)', () => {
  const s = run(voting({ revealRule: { onAllVoted: true, timerSec: null } }), [
    { type: 'disconnect', pid: 'B' },
    { type: 'vote', pid: 'H', cardId: '3' },
  ]).state
  expect(s.current!.status).toBe('voting')
  const r = run(s, [{ type: 'vote', pid: 'A', cardId: '5' }])
  expect(r.state.current!.status).toBe('revealed')
  expect(r.events).toContainEqual({ type: 'revealed', itemId: 'i1', number: 1, auto: true })
})
test('timer: tick before deadline does nothing, at deadline reveals', () => {
  const s = voting({ revealRule: { onAllVoted: false, timerSec: 30 } })
  expect(s.current!.deadline).toBe(T0 + 30_000)
  expect(run(s, [{ type: 'tick' }], T0 + 29_999).state.current!.status).toBe('voting')
  const r = run(s, [{ type: 'tick' }], T0 + 30_000)
  expect(r.state.current).toMatchObject({ status: 'revealed', deadline: null })
  expect(r.events).toContainEqual({ type: 'revealed', itemId: 'i1', number: 1, auto: true })
})
test('startRound timerSec overrides room default', () => {
  const s = run(voting(), [{ type: 'startRound', pid: 'H', itemId: 'i2', timerSec: 10 }]).state
  expect(s.current).toMatchObject({ itemId: 'i2', number: 1, deadline: T0 + 10_000 })
})
test('startRound while voting discards the unrevealed round', () => {
  const s = run(voting(), [{ type: 'vote', pid: 'A', cardId: '5' }, { type: 'startRound', pid: 'H', itemId: 'i1' }]).state
  expect(s.history).toEqual([])
  expect(s.current).toMatchObject({ number: 1, votes: {} })
})
test('reveal with 3/13 emits discussionNeeded with lowPids/highPids', () => {
  const r = run(voting(), [
    { type: 'vote', pid: 'H', cardId: '3' },
    { type: 'vote', pid: 'A', cardId: '13' },
    { type: 'vote', pid: 'B', cardId: '5' },
    { type: 'reveal', pid: 'H' },
  ])
  expect(r.state.current!.stats!.needsDiscussion).toBe(true)
  expect(r.events).toContainEqual({ type: 'revealed', itemId: 'i1', number: 1, auto: false })
  expect(r.events).toContainEqual({ type: 'discussionNeeded', lowPids: ['H'], highPids: ['A'] })
})
test('revote keeps history: history.length===1, current.number===2, votes empty', () => {
  const s = run(voting(), [{ type: 'vote', pid: 'A', cardId: '5' }, { type: 'reveal', pid: 'H' }, { type: 'revote', pid: 'H' }]).state
  expect(s.history).toHaveLength(1)
  expect(s.current).toMatchObject({ itemId: 'i1', number: 2, status: 'voting', votes: {}, stats: null })
  expect(() => applyCommand(s, { type: 'revote', pid: 'H' }, T0)).toThrow('ROUND_NOT_REVEALED')
})
test('finalize with value differing from stats is allowed; item done; outcome.rounds===2', () => {
  const r = run(voting(), [
    { type: 'vote', pid: 'A', cardId: '3' }, { type: 'reveal', pid: 'H' }, { type: 'revote', pid: 'H' },
    { type: 'vote', pid: 'A', cardId: '5' }, { type: 'reveal', pid: 'H' },
    { type: 'finalize', pid: 'H', value: ' 4 ', note: ' agreed ' },
  ], T0 + 9)
  expect(r.state.items[0]!.status).toBe('done')
  expect(r.state.outcomes).toEqual([{ itemId: 'i1', value: '4', note: 'agreed', decidedBy: 'H', decidedAt: T0 + 9, rounds: 2 }])
  expect(r.state.current).toBeNull()
  expect(r.state.history).toHaveLength(2)
  expect(r.events).toContainEqual({ type: 'finalized', itemId: 'i1', value: '4' })
})
test('finalize guards: before reveal ROUND_NOT_REVEALED, blank FINAL_EMPTY', () => {
  const s = voting()
  expect(() => applyCommand(s, { type: 'finalize', pid: 'H', value: '5' }, T0)).toThrow('ROUND_NOT_REVEALED')
  const revealed = run(s, [{ type: 'reveal', pid: 'H' }]).state
  expect(() => applyCommand(revealed, { type: 'finalize', pid: 'H', value: '  ' }, T0)).toThrow('FINAL_EMPTY')
})
test('re-finalizing an item replaces its outcome', () => {
  let s = run(voting(), [{ type: 'reveal', pid: 'H' }, { type: 'finalize', pid: 'H', value: '3' }]).state
  s = run(s, [{ type: 'startRound', pid: 'H', itemId: 'i1' }, { type: 'reveal', pid: 'H' }, { type: 'finalize', pid: 'H', value: '8' }]).state
  expect(s.outcomes).toEqual([expect.objectContaining({ itemId: 'i1', value: '8', rounds: 2 })])
})
test('reason: trimmed, empty clears, >200 chars REASON_TOO_LONG, observer NOT_VOTER, no round NO_ROUND', () => {
  const s = run(voting(), [{ type: 'join', participant: user('O', 'observer') }, { type: 'reason', pid: 'A', text: '  big  ' }]).state
  expect(s.current!.reasons).toEqual({ A: 'big' })
  expect(applyCommand(s, { type: 'reason', pid: 'A', text: ' ' }, T0).state.current!.reasons).toEqual({})
  expect(() => applyCommand(s, { type: 'reason', pid: 'A', text: 'x'.repeat(201) }, T0)).toThrow('REASON_TOO_LONG')
  expect(() => applyCommand(s, { type: 'reason', pid: 'O', text: 'hi' }, T0)).toThrow('NOT_VOTER')
  expect(() => applyCommand(room(), { type: 'reason', pid: 'H', text: 'hi' }, T0)).toThrow('NO_ROUND')
})
```

- [x] **Step 3: Chạy** `pnpm --filter @opendeck/backend test -- room` → Expected FAIL (`Failed to load url ./apply`).

- [x] **Step 4: Implement `room/guards.ts`**
```ts
import { DomainError } from '../errors'
import { NAME_MAX, type Participant, type RoomState } from './types'

export function requireParticipant(s: RoomState, pid: string): Participant {
  const p = s.participants[pid]
  if (!p) throw new DomainError('NOT_IN_ROOM')
  return p
}

export function requireHost(s: RoomState, pid: string): Participant {
  const p = requireParticipant(s, pid)
  if (s.hostId !== pid) throw new DomainError('NOT_HOST')
  return p
}

export function requireTarget(s: RoomState, target: string): Participant {
  const p = s.participants[target]
  if (!p) throw new DomainError('UNKNOWN_PARTICIPANT')
  return p
}

export function validName(name: string): string {
  const n = name.trim()
  if (n.length === 0 || n.length > NAME_MAX) throw new DomainError('NAME_INVALID')
  return n
}
```

- [x] **Step 5: Implement `room/participants.ts`** — các handler mutate bản nháp `s` (đã clone ở `applyCommand`) và đẩy event vào `ev`.
```ts
import { DomainError } from '../errors'
import { requireHost, requireParticipant, requireTarget, validName } from './guards'
import { HOST_OFFLINE_MS, type DomainEvent, type JoinInfo, type Participant, type Role, type RoomState } from './types'

type Ev = DomainEvent[]

export function join(s: RoomState, info: JoinInfo, now: number, ev: Ev): void {
  const name = validName(info.name)
  const existing = s.participants[info.id]
  if (existing) {
    existing.online = true
    existing.offlineSince = null
    existing.name = name
    existing.avatar = info.avatar
    ev.push({ type: 'rejoined', pid: info.id })
    claimHostIfHostless(s, existing, ev)
    return
  }
  if (s.banned.includes(info.id)) throw new DomainError('KICKED')
  const isOwner = info.userId !== null && info.userId === s.ownerId
  if (s.access.locked && !isOwner) throw new DomainError('ROOM_LOCKED')
  if (s.access.requireApproval && !isOwner) {
    if (!s.pending[info.id]) {
      s.pending[info.id] = { ...info, name, requestedAt: now }
      ev.push({ type: 'approvalRequested', pid: info.id, name })
    }
    return
  }
  admit(s, { ...info, name }, now, ev)
}

function admit(s: RoomState, info: JoinInfo, now: number, ev: Ev): void {
  const p: Participant = { id: info.id, userId: info.userId, name: info.name, avatar: info.avatar, role: info.role, joinedAt: now, online: true, offlineSince: null }
  s.participants[p.id] = p
  delete s.pending[p.id]
  ev.push({ type: 'joined', pid: p.id })
  claimHostIfHostless(s, p, ev)
}

function claimHostIfHostless(s: RoomState, p: Participant, ev: Ev): void {
  if (s.hostId !== null || p.userId === null) return
  s.hostId = p.id
  ev.push({ type: 'hostChanged', from: null, to: p.id, reason: 'claimed' })
}

export function disconnect(s: RoomState, pid: string, now: number, ev: Ev): void {
  if (s.pending[pid]) { delete s.pending[pid]; return }
  const p = s.participants[pid]
  if (!p || !p.online) return
  p.online = false
  p.offlineSince = now
  ev.push({ type: 'offline', pid })
}

export function rename(s: RoomState, pid: string, name: string, avatar: string | undefined, ev: Ev): void {
  const p = requireParticipant(s, pid)
  p.name = validName(name)
  if (avatar !== undefined) p.avatar = avatar
  ev.push({ type: 'renamed', pid })
}

export function setRole(s: RoomState, pid: string, target: string, role: Role, ev: Ev): void {
  if (pid === target) requireParticipant(s, pid)
  else requireHost(s, pid)
  const t = requireTarget(s, target)
  if (t.role === role) return
  t.role = role
  if (role === 'observer' && s.current?.status === 'voting') delete s.current.votes[target]
  ev.push({ type: 'roleChanged', pid: target, role })
}

function requireRegisteredTarget(s: RoomState, pid: string, target: string): Participant {
  const t = requireTarget(s, target)
  if (t.userId === null) throw new DomainError('HOST_NEEDS_ACCOUNT')
  if (target === pid) throw new DomainError('INVALID_TARGET')
  return t
}

export function transferHost(s: RoomState, pid: string, target: string, ev: Ev): void {
  requireHost(s, pid)
  requireRegisteredTarget(s, pid, target)
  s.hostId = target
  if (s.successorId === target) s.successorId = null
  ev.push({ type: 'hostChanged', from: pid, to: target, reason: 'manual' })
}

export function setSuccessor(s: RoomState, pid: string, target: string | null): void {
  requireHost(s, pid)
  if (target !== null) requireRegisteredTarget(s, pid, target)
  s.successorId = target
}

export function kick(s: RoomState, pid: string, target: string, ev: Ev): void {
  requireHost(s, pid)
  if (target === pid) throw new DomainError('INVALID_TARGET')
  if (!s.participants[target] && !s.pending[target]) throw new DomainError('UNKNOWN_PARTICIPANT')
  delete s.participants[target]
  delete s.pending[target]
  if (s.current) {
    delete s.current.votes[target]
    delete s.current.reasons[target]
  }
  if (s.successorId === target) s.successorId = null
  if (!s.banned.includes(target)) s.banned.push(target)
  ev.push({ type: 'kicked', pid: target })
}

export function approve(s: RoomState, pid: string, target: string, now: number, ev: Ev): void {
  requireHost(s, pid)
  const req = s.pending[target]
  if (!req) throw new DomainError('UNKNOWN_PARTICIPANT')
  admit(s, { id: req.id, userId: req.userId, name: req.name, avatar: req.avatar, role: req.role }, now, ev)
}

export function reject(s: RoomState, pid: string, target: string, ev: Ev): void {
  requireHost(s, pid)
  if (!s.pending[target]) throw new DomainError('UNKNOWN_PARTICIPANT')
  delete s.pending[target]
  ev.push({ type: 'rejected', pid: target })
}

export function setAccess(s: RoomState, pid: string, patch: { locked?: boolean; requireApproval?: boolean }, now: number, ev: Ev): void {
  requireHost(s, pid)
  if (patch.locked !== undefined) s.access.locked = patch.locked
  if (patch.requireApproval !== undefined) s.access.requireApproval = patch.requireApproval
  if (!s.access.requireApproval) {
    const waiting = Object.values(s.pending).sort((a, b) => a.requestedAt - b.requestedAt)
    for (const req of waiting) admit(s, { id: req.id, userId: req.userId, name: req.name, avatar: req.avatar, role: req.role }, now, ev)
  }
  ev.push({ type: 'accessChanged', locked: s.access.locked, requireApproval: s.access.requireApproval })
}

/** Hands host over when the current host has been offline longer than HOST_OFFLINE_MS (roadmap §2.5). */
export function checkHostTimeout(s: RoomState, now: number, ev: Ev): void {
  const from = s.hostId
  if (from === null) return
  const host = s.participants[from]
  if (host && (host.online || host.offlineSince === null || now - host.offlineSince <= HOST_OFFLINE_MS)) return
  const eligible = (p: Participant | undefined): p is Participant => !!p && p.online && p.userId !== null && p.id !== from
  const successor = s.successorId === null ? undefined : s.participants[s.successorId]
  const next = eligible(successor)
    ? successor
    : Object.values(s.participants).filter(eligible).sort((a, b) => a.joinedAt - b.joinedAt)[0]
  s.hostId = next?.id ?? null
  if (s.successorId === s.hostId) s.successorId = null
  ev.push({ type: 'hostChanged', from, to: s.hostId, reason: 'timeout' })
}
```

- [x] **Step 6: Implement `room/rounds.ts`**
```ts
import { deckOf } from '../deck'
import { DomainError } from '../errors'
import { computeRoundStats } from '../stats'
import { requireHost, requireParticipant } from './guards'
import { REASON_MAX, TIMER_MAX_SEC, type DomainEvent, type NewItem, type Round, type RoomState } from './types'

type Ev = DomainEvent[]

export function addItems(s: RoomState, pid: string, items: NewItem[], ev: Ev): void {
  requireHost(s, pid)
  const ids: string[] = []
  for (const it of items) {
    const title = it.title.trim()
    if (!title) throw new DomainError('ITEM_TITLE_EMPTY')
    s.itemSeq += 1
    const id = `i${s.itemSeq}`
    s.items.push({ id, source: 'manual', externalRef: it.externalRef ?? null, title, description: (it.description ?? '').trim(), status: 'pending' })
    ids.push(id)
  }
  ev.push({ type: 'itemsAdded', ids })
}

const roundsOf = (s: RoomState, itemId: string) => s.history.filter(r => r.itemId === itemId).length

function openRound(s: RoomState, itemId: string, timerSec: number | null, now: number, ev: Ev): void {
  const number = roundsOf(s, itemId) + 1
  s.current = { itemId, number, status: 'voting', votes: {}, reasons: {}, deadline: timerSec === null ? null : now + timerSec * 1000, stats: null }
  ev.push({ type: 'roundStarted', itemId, number })
}

export function startRound(s: RoomState, pid: string, itemId: string, timerSec: number | undefined, now: number, ev: Ev): void {
  requireHost(s, pid)
  if (!s.items.some(i => i.id === itemId)) throw new DomainError('UNKNOWN_ITEM')
  const timer = timerSec ?? s.revealRule.timerSec
  if (timer !== null && !(Number.isInteger(timer) && timer > 0 && timer <= TIMER_MAX_SEC)) throw new DomainError('TIMER_INVALID')
  // An unrevealed round is discarded rather than archived, so history never stores secret votes.
  if (s.current?.status === 'revealed') s.history.push(s.current)
  openRound(s, itemId, timer, now, ev)
}

function votingRound(s: RoomState): Round {
  const r = s.current
  if (!r || r.status !== 'voting') throw new DomainError('ROUND_NOT_VOTING')
  return r
}

function revealedRound(s: RoomState): Round {
  const r = s.current
  if (!r || r.status !== 'revealed') throw new DomainError('ROUND_NOT_REVEALED')
  return r
}

function reveal(s: RoomState, r: Round, auto: boolean, ev: Ev): void {
  r.status = 'revealed'
  r.deadline = null
  const stats = computeRoundStats(s.scale, Object.values(r.votes))
  r.stats = stats
  ev.push({ type: 'revealed', itemId: r.itemId, number: r.number, auto })
  if (stats.needsDiscussion) {
    const pidsWith = (cardId: string | undefined) => Object.entries(r.votes).filter(([, c]) => c === cardId).map(([p]) => p)
    ev.push({ type: 'discussionNeeded', lowPids: pidsWith(stats.min?.id), highPids: pidsWith(stats.max?.id) })
  }
}

export function vote(s: RoomState, pid: string, cardId: string | null, ev: Ev): void {
  const p = requireParticipant(s, pid)
  const r = votingRound(s)
  if (p.role !== 'voter') throw new DomainError('NOT_VOTER')
  if (cardId === null) {
    if (r.votes[pid] !== undefined) {
      delete r.votes[pid]
      ev.push({ type: 'unvoted', pid })
    }
    return
  }
  if (!deckOf(s.scale, s.enabledSpecials).some(c => c.id === cardId)) throw new DomainError('CARD_NOT_IN_DECK')
  r.votes[pid] = cardId
  ev.push({ type: 'voted', pid })
  if (s.revealRule.onAllVoted) {
    const voters = Object.values(s.participants).filter(x => x.role === 'voter' && x.online)
    if (voters.length > 0 && voters.every(x => r.votes[x.id] !== undefined)) reveal(s, r, true, ev)
  }
}

export function revealCmd(s: RoomState, pid: string, ev: Ev): void {
  requireHost(s, pid)
  reveal(s, votingRound(s), false, ev)
}

export function revote(s: RoomState, pid: string, now: number, ev: Ev): void {
  requireHost(s, pid)
  const r = revealedRound(s)
  s.history.push(r)
  openRound(s, r.itemId, s.revealRule.timerSec, now, ev)
}

export function reason(s: RoomState, pid: string, text: string): void {
  const p = requireParticipant(s, pid)
  const r = s.current
  if (!r) throw new DomainError('NO_ROUND')
  if (p.role !== 'voter') throw new DomainError('NOT_VOTER')
  const t = text.trim()
  if (t.length > REASON_MAX) throw new DomainError('REASON_TOO_LONG')
  if (t) r.reasons[pid] = t
  else delete r.reasons[pid]
}

export function finalize(s: RoomState, pid: string, value: string, note: string | undefined, now: number, ev: Ev): void {
  requireHost(s, pid)
  const r = revealedRound(s)
  const v = value.trim()
  if (!v) throw new DomainError('FINAL_EMPTY')
  s.history.push(r)
  s.current = null
  const item = s.items.find(i => i.id === r.itemId)
  if (item) item.status = 'done'
  const outcome = { itemId: r.itemId, value: v, note: (note ?? '').trim(), decidedBy: pid, decidedAt: now, rounds: roundsOf(s, r.itemId) }
  s.outcomes = [...s.outcomes.filter(o => o.itemId !== r.itemId), outcome]
  ev.push({ type: 'finalized', itemId: r.itemId, value: v })
}

export function tickRound(s: RoomState, now: number, ev: Ev): void {
  const r = s.current
  if (r?.status === 'voting' && r.deadline !== null && now >= r.deadline) reveal(s, r, true, ev)
}
```

- [x] **Step 7: Implement `room/apply.ts`**
```ts
import { SPECIAL_IDS, deckOf } from '../deck'
import * as P from './participants'
import * as R from './rounds'
import type { Command, CommandResult, CreateRoomOptions, DomainEvent, RoomState } from './types'

export function createRoom(o: CreateRoomOptions): RoomState {
  const requested = o.enabledSpecials ?? SPECIAL_IDS
  deckOf(o.scale, requested) // throws UNKNOWN_SPECIAL for bad ids
  return {
    id: o.id,
    ownerId: o.owner.userId,
    hostId: o.owner.id,
    successorId: null,
    participants: { [o.owner.id]: { ...o.owner, joinedAt: o.now, online: true, offlineSince: null } },
    pending: {},
    banned: [],
    access: { locked: false, requireApproval: false, ...o.access },
    scale: o.scale,
    enabledSpecials: SPECIAL_IDS.filter(id => requested.includes(id)),
    revealRule: o.revealRule ?? { onAllVoted: false, timerSec: null },
    items: [],
    itemSeq: 0,
    current: null,
    history: [],
    outcomes: [],
  }
}

/** Pure: works on a clone, so a thrown DomainError leaves `prev` untouched and commands are atomic. */
export function applyCommand(prev: RoomState, c: Command, now: number): CommandResult {
  const s = structuredClone(prev)
  const ev: DomainEvent[] = []
  switch (c.type) {
    case 'join': P.join(s, c.participant, now, ev); break
    case 'disconnect': P.disconnect(s, c.pid, now, ev); break
    case 'rename': P.rename(s, c.pid, c.name, c.avatar, ev); break
    case 'setRole': P.setRole(s, c.pid, c.target, c.role, ev); break
    case 'transferHost': P.transferHost(s, c.pid, c.target, ev); break
    case 'setSuccessor': P.setSuccessor(s, c.pid, c.target); break
    case 'kick': P.kick(s, c.pid, c.target, ev); break
    case 'approve': P.approve(s, c.pid, c.target, now, ev); break
    case 'reject': P.reject(s, c.pid, c.target, ev); break
    case 'setAccess': P.setAccess(s, c.pid, c, now, ev); break
    case 'addItems': R.addItems(s, c.pid, c.items, ev); break
    case 'startRound': R.startRound(s, c.pid, c.itemId, c.timerSec, now, ev); break
    case 'vote': R.vote(s, c.pid, c.cardId, ev); break
    case 'reveal': R.revealCmd(s, c.pid, ev); break
    case 'revote': R.revote(s, c.pid, now, ev); break
    case 'reason': R.reason(s, c.pid, c.text); break
    case 'finalize': R.finalize(s, c.pid, c.value, c.note, now, ev); break
    case 'tick': P.checkHostTimeout(s, now, ev); R.tickRound(s, now, ev); break
    default: { const never: never = c; throw new Error(`Unhandled command ${JSON.stringify(never)}`) }
  }
  return { state: s, events: ev }
}
```
`index.ts` thêm: `export * from './room/types'` và `export { applyCommand, createRoom } from './room/apply'`.

**Lưu ý typecheck:** `exactOptionalPropertyTypes` đang bật. Nếu `P.setAccess(s, c.pid, c, ...)` báo lỗi type, truyền object rõ ràng: `{ ...(c.locked !== undefined && { locked: c.locked }), ...(c.requireApproval !== undefined && { requireApproval: c.requireApproval }) }`.

- [x] **Step 8: Chạy** `pnpm --filter @opendeck/backend test && pnpm typecheck` → Expected PASS (gồm cả frontend typecheck, vì frontend import domain).
- [x] **Step 9: Commit** `feat(domain): room state machine — roles, rounds, host transfer, kick/approval/lock` (+ trailer).

---
### Task 4: Che phiếu + tổng kết/CSV

**Files:** Create `apps/backend/src/domain/{redact,summary}.ts` · Test `apps/backend/src/domain/{redact,summary}.test.ts` · Modify `index.ts`

**Interfaces:**
- Consumes: `RoomState`, `Round` (room/types), `SPECIAL_IDS`, `SpecialId`, `isSpecialId` (deck); fixture `room/testing.ts`
- Produces (Task 6 gateway, Task 8–9 web):
```ts
interface PublicRound extends Omit<Round, 'votes' | 'reasons'> {
  voted: string[]                        // pid đã bỏ phiếu (không có giá trị)
  myVote: string | null
  votes: Record<string, string> | null   // chỉ != null khi revealed
  reasons: Record<string, string>        // revealed: tất cả; voting: chỉ của viewer
}
type PublicRoomState = Omit<RoomState, 'current'> & { current: PublicRound | null }   // pending/banned rỗng nếu viewer không phải host
function toPublicState(s: RoomState, viewerPid: string): PublicRoomState
interface SummaryRow { key: string | null; title: string; final: string; rounds: number; notes: string; specialCards: SpecialId[] }
interface Summary { rows: SummaryRow[]; totals: { items: number; finalized: number; rounds: number; mostUsedSpecial: SpecialId | null } }
function buildSummary(s: RoomState): Summary
function toCsv(rows: SummaryRow[]): string   // BOM + header key,title,final,rounds,notes,special_cards; CRLF; RFC 4180; chống formula injection
```

- [x] **Step 1: Viết test fail** — `redact.test.ts`
```ts
import { toPublicState } from './redact'
import { guest, room, run, user } from './room/testing'

const voting = run(room({ access: { requireApproval: true } }), [
  { type: 'setAccess', pid: 'H', requireApproval: false },
  { type: 'join', participant: user('A') },
  { type: 'join', participant: user('B') },
  { type: 'setAccess', pid: 'H', requireApproval: true },
  { type: 'join', participant: guest('G') },        // waits in pending
  { type: 'addItems', pid: 'H', items: [{ title: 'Login' }] },
  { type: 'startRound', pid: 'H', itemId: 'i1' },
  { type: 'vote', pid: 'A', cardId: '13' },
  { type: 'reason', pid: 'A', text: 'too big' },
  { type: 'vote', pid: 'B', cardId: '3' },
]).state

test('voting: public state for B never contains A\'s card or reason', () => {
  const pub = toPublicState(voting, 'B')
  expect(JSON.stringify(pub.current)).not.toContain('13')
  expect(JSON.stringify(pub)).not.toMatch(/"A":"13"/)
  expect(JSON.stringify(pub)).not.toContain('too big')
  expect(pub.current!.voted).toEqual(['A', 'B'])
  expect(pub.current!.votes).toBeNull()
  expect(pub.current!.myVote).toBe('3')
})
test('viewer sees own vote and own reason only', () => {
  const pub = toPublicState(voting, 'A')
  expect(pub.current!.myVote).toBe('13')
  expect(pub.current!.reasons).toEqual({ A: 'too big' })
})
test('revealed: all votes and reasons visible', () => {
  const s = run(voting, [{ type: 'reveal', pid: 'H' }]).state
  const pub = toPublicState(s, 'B')
  expect(pub.current!.votes).toEqual({ A: '13', B: '3' })
  expect(pub.current!.reasons).toEqual({ A: 'too big' })
})
test('pending and banned are visible to host only', () => {
  const s = run(voting, [{ type: 'join', participant: guest('K') }, { type: 'kick', pid: 'H', target: 'K' }]).state
  expect(Object.keys(toPublicState(s, 'H').pending)).toEqual(['G'])
  expect(toPublicState(s, 'H').banned).toEqual(['K'])
  expect(toPublicState(s, 'A').pending).toEqual({})
  expect(toPublicState(s, 'A').banned).toEqual([])
})
test('does not mutate or alias the source state', () => {
  const snapshot = structuredClone(voting)
  const pub = toPublicState(voting, 'H')
  pub.participants.A!.name = 'changed'
  expect(voting).toEqual(snapshot)
})
```

`summary.test.ts`
```ts
import { room, run, user } from './room/testing'
import { buildSummary, toCsv } from './summary'

const played = run(room(), [
  { type: 'join', participant: user('A') },
  { type: 'join', participant: user('B') },
  { type: 'addItems', pid: 'H', items: [{ title: 'Login', externalRef: 'PROJ-1' }, { title: 'Logout' }] },
  { type: 'startRound', pid: 'H', itemId: 'i1' },
  { type: 'vote', pid: 'H', cardId: 'coffee' }, { type: 'vote', pid: 'A', cardId: '13' }, { type: 'vote', pid: 'B', cardId: '3' },
  { type: 'reason', pid: 'A', text: 'too big' },
  { type: 'reveal', pid: 'H' }, { type: 'revote', pid: 'H' },
  { type: 'vote', pid: 'H', cardId: 'coffee' }, { type: 'vote', pid: 'A', cardId: '5' }, { type: 'vote', pid: 'B', cardId: 'bug' },
  { type: 'reveal', pid: 'H' },
  { type: 'finalize', pid: 'H', value: '5', note: 'split later' },
]).state

test('summary rows: outcome, rounds, notes without names, specials in canonical order', () => {
  const { rows, totals } = buildSummary(played)
  expect(rows).toEqual([
    { key: 'PROJ-1', title: 'Login', final: '5', rounds: 2, notes: 'split later\ntoo big', specialCards: ['coffee', 'bug'] },
    { key: null, title: 'Logout', final: '', rounds: 0, notes: '', specialCards: [] },
  ])
  expect(totals).toEqual({ items: 2, finalized: 1, rounds: 2, mostUsedSpecial: 'coffee' })
})
test('unrevealed current round is ignored by summary', () => {
  const s = run(played, [{ type: 'startRound', pid: 'H', itemId: 'i2' }, { type: 'vote', pid: 'A', cardId: 'bomb' }]).state
  expect(buildSummary(s).rows[1]).toMatchObject({ rounds: 0, specialCards: [] })
})
test('csv escapes quotes, commas, newlines and starts with BOM', () => {
  expect(toCsv([{ key: null, title: 'a,"b"\nc', final: '5', rounds: 1, notes: '', specialCards: [] }]))
    .toBe('\uFEFFkey,title,final,rounds,notes,special_cards\r\n,"a,""b""\nc",5,1,,\r\n')
})
test('csv joins special cards with ";"', () => {
  expect(toCsv([{ key: 'K-1', title: 't', final: '', rounds: 2, notes: '', specialCards: ['coffee', 'bug'] }]))
    .toContain('\r\nK-1,t,,2,,coffee;bug\r\n')
})
test.each(['=cmd|calc', '+SUM(A1)', '-2+3', '@x', '\tx'])('csv neutralises formula injection: %j', title => {
  const line = toCsv([{ key: null, title, final: '', rounds: 0, notes: '', specialCards: [] }]).split('\r\n')[1]!
  expect(line.startsWith(`,'${title}`) || line.startsWith(`,"'${title}`)).toBe(true)
})
```

- [x] **Step 2: Chạy** `pnpm --filter @opendeck/backend test -- redact summary` → Expected FAIL (module not found).

- [x] **Step 3: Implement** — `redact.ts`
```ts
import type { Round, RoomState } from './room/types'

export interface PublicRound extends Omit<Round, 'votes' | 'reasons'> {
  voted: string[]
  myVote: string | null
  votes: Record<string, string> | null
  reasons: Record<string, string>
}
export type PublicRoomState = Omit<RoomState, 'current'> & { current: PublicRound | null }

/** The only shape that may leave the server: hides other people's votes/reasons until reveal (§6). */
export function toPublicState(s: RoomState, viewerPid: string): PublicRoomState {
  const { current, ...rest } = structuredClone(s)
  const isHost = s.hostId === viewerPid
  return {
    ...rest,
    pending: isHost ? rest.pending : {},
    banned: isHost ? rest.banned : [],
    current: current && publicRound(current, viewerPid),
  }
}

function publicRound(r: Round, viewer: string): PublicRound {
  const { votes, reasons, ...rest } = r
  const revealed = r.status === 'revealed'
  const own = reasons[viewer]
  return {
    ...rest,
    voted: Object.keys(votes),
    myVote: votes[viewer] ?? null,
    votes: revealed ? votes : null,
    reasons: revealed ? reasons : own === undefined ? {} : { [viewer]: own },
  }
}
```

`summary.ts`
```ts
import { SPECIAL_IDS, isSpecialId, type SpecialId } from './deck'
import type { RoomState } from './room/types'

export interface SummaryRow { key: string | null; title: string; final: string; rounds: number; notes: string; specialCards: SpecialId[] }
export interface Summary { rows: SummaryRow[]; totals: { items: number; finalized: number; rounds: number; mostUsedSpecial: SpecialId | null } }

export function buildSummary(s: RoomState): Summary {
  const revealed = s.current?.status === 'revealed' ? [...s.history, s.current] : s.history
  const rows = s.items.map((item): SummaryRow => {
    const rounds = revealed.filter(r => r.itemId === item.id)
    const outcome = s.outcomes.find(o => o.itemId === item.id)
    const used = new Set(rounds.flatMap(r => Object.values(r.votes)))
    // §7: notes are reason texts only, never who wrote them.
    const notes = [outcome?.note ?? '', ...rounds.flatMap(r => Object.values(r.reasons))].filter(Boolean)
    return {
      key: item.externalRef,
      title: item.title,
      final: outcome?.value ?? '',
      rounds: rounds.length,
      notes: notes.join('\n'),
      specialCards: SPECIAL_IDS.filter(id => used.has(id)),
    }
  })

  const counts = new Map<SpecialId, number>()
  for (const r of revealed) for (const c of Object.values(r.votes)) if (isSpecialId(c)) counts.set(c, (counts.get(c) ?? 0) + 1)
  let mostUsedSpecial: SpecialId | null = null
  let best = 0
  for (const id of SPECIAL_IDS) {
    const n = counts.get(id) ?? 0
    if (n > best) { best = n; mostUsedSpecial = id }
  }

  return { rows, totals: { items: s.items.length, finalized: s.outcomes.length, rounds: revealed.length, mostUsedSpecial } }
}

const HEADER = ['key', 'title', 'final', 'rounds', 'notes', 'special_cards']
const FORMULA_START = /^[=+\-@\t\r]/

function cell(v: string | number): string {
  if (typeof v === 'number') return String(v)
  const safe = FORMULA_START.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function toCsv(rows: SummaryRow[]): string {
  const lines = [
    HEADER.join(','),
    ...rows.map(r => [r.key ?? '', r.title, r.final, r.rounds, r.notes, r.specialCards.join(';')].map(cell).join(',')),
  ]
  return '\uFEFF' + lines.map(l => `${l}\r\n`).join('')
}
```
`index.ts` thêm `export * from './redact'` và `export * from './summary'`.

- [x] **Step 4: Chạy** `pnpm test && pnpm typecheck` → Expected PASS toàn repo.
- [x] **Step 5: Commit** `feat(domain): vote redaction, session summary, CSV export` (+ trailer).

---

### Task D: Cập nhật tài liệu

- [x] **Step 1:** Copy plan này sang `docs/superpowers/plans/2026-10-30-03-task2-4-stats-room-redact.md`, tick các step đã xong.
- [x] **Step 2:** Plan 1: đánh dấu Task 2, 3, 4 là "✅ ĐÃ XONG", trỏ sang file plan mới, và thay khối Interfaces cũ bằng interface thật (`Role` không còn `'host'`, `createRoom(options)`, Command/DomainEvent mới, mã lỗi mới, `PublicRound.reasons`). Global Constraints thêm: kick → banned, lock/approval chủ phòng được bypass, reasons bị che như phiếu.
- [x] **Step 3:** Roadmap §2: thêm mục 9–11 cho các quyết định mới (host tách khỏi role; vòng chưa lật bị bỏ khi `startRound`; auto-reveal chỉ khi có phiếu mới, `revealRule` mặc định tắt).
- [x] **Step 4: Commit** `docs: task 2–4 as-built, new domain decisions` (+ trailer).

---

## Self-review

- **Độ phủ:** Task 2 (phân bố phiếu, min/max, trung bình, đồng thuận, mode, discussion) ✔ · Task 3 (vai trò, vòng, lật tay/tự động/hẹn giờ, bỏ phiếu lại, chốt điểm, chuyển host tay/timeout/hostless/claim, kick, duyệt, khóa, đổi tên) ✔ · Task 4 (che phiếu + lý do, pending/banned chỉ host thấy, tổng kết, CSV BOM/RFC 4180/chống formula injection) ✔ · Review Focus 1–5 của Plan 1 đều có test (rejoin giữ ghế + phiếu; lộ phiếu qua snapshot; phiếu đến sau khi lật; tập phiếu suy biến). Mục 2 (cùng một người mở 2 tab) thuộc gateway, để Task 6.
- **Placeholder:** không có. Lệnh `shadcn init` có hướng dẫn dự phòng khi CLI vẫn hỏi.
- **Tên nhất quán:** `RoundStats`, `computeRoundStats`, `deckOf(scale, enabledSpecials)`, `SPECIAL_IDS`, `createRoom(o)`, `applyCommand(s,c,now)`, `toPublicState(s,pid)`, `buildSummary`, `toCsv`, fixture `room/run/user/guest/T0` dùng giống nhau ở mọi task.

---

## Log thực hiện (2026-10-30)

| Commit | Nội dung |
|---|---|
| `7e41610` | Task 0a — NestJS + TypeORM + Postgres skeleton, root scripts `db:up`/`dev:backend`/`dev:frontend`, docs stack |
| `084c9fa` | Task 2 — `computeRoundStats` |
| `b31b2f1` | Task 3 — room state machine |
| `b163614` | Task 4 — redaction, summary, CSV |
| `75cc25b` | Task 0b — React 19.3, Vite 7, Tailwind 4.3, shadcn/ui |

**Lệch so với plan:**
- Task 2 thêm `consensusLevel: 'absolute'|'high'|'medium'|'low'|'unknown'` vào `RoundStats` (theo spreadSteps 0/1/2/≥3; không có phiếu thường → `unknown`), theo cập nhật Plan 1 cho Plan 2 (confetti, chip "Đồng thuận"). Thêm test `consensusLevel mapping`.
- Task 0b: shadcn CLI v4 đã đổi `-b` thành thư viện nền. Lệnh thật: `pnpm dlx shadcn@latest init -y -b radix -p nova --no-monorepo --no-rtl` (style `radix-nova`, base color neutral, font Geist, icon lucide), rồi `shadcn add button select -y`.
- `setAccess(s, c.pid, c, …)` typecheck qua bình thường, không cần workaround.

**Kết quả verify:** backend 81 test pass (deck 15, stats 12, room 38, redact 5, summary 9, health 2), frontend 3 test pass, `pnpm typecheck` sạch, `nest build` OK, e2e health với Postgres thật pass, frontend build OK (CSS chứa class Tailwind), dev server trả `<div id="root">`.
