# Task 1 — Khởi tạo project + bộ bài — Implementation Plan (✅ đã thực hiện 2026-10-30)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Có project chạy được (`pnpm test`, `pnpm typecheck`, `pnpm --filter @opendeck/frontend dev`) gồm 2 app `frontend` + `backend`, với bộ bài và 7 lá đặc biệt, UI song ngữ vi/en.

**Architecture:** pnpm workspace chỉ có `apps/*`, không có `packages/`. Domain thuần (không I/O, không dependency runtime) nằm ở `apps/backend/src/domain`; frontend import trực tiếp qua `apps/frontend/src/domain.ts`. Domain không chứa chuỗi hiển thị, frontend dịch theo id bằng i18next.

**Tech Stack:** Node ≥20, pnpm 12 (cài bằng `npm i -g pnpm`), TypeScript 5, Vitest 2, Vite 5, React 18, i18next 23 + react-i18next 15.

**Nguồn:** Plan 1 Task 1 (`2026-10-29-01-core-realtime-voting.md`), roadmap §2.1–2.3, design `CardV3`.

## Global Constraints

- Bộ bài: Fibonacci `1,2,3,5,8,13,21`; T-shirt `XS,S,M,L,XL`; giờ `0.5,1,2,4,8,16,24`; ngày `0.5,1,2,3,5,8`.
- 7 lá đặc biệt, thứ tự cố định: `coffee, question, bug, bomb, puzzle, infinity, shrug`.
- Host bật/tắt từng lá đặc biệt, mặc định bật đủ 7 (quyết định 2026-10-30).
- Chỉ 2 app: `apps/frontend`, `apps/backend` (quyết định 2026-10-30).
- UI hỗ trợ `vi` + `en`, mặc định `vi`, lựa chọn lưu ở localStorage `opendeck.lang` (quyết định 2026-10-30).

## Quyết định trong task

- `DomainError` ở `domain/errors.ts` để `deck.ts` không phụ thuộc `room/`.
- Lá đặc biệt không nằm trong `Scale`; `deckOf(scale, enabledSpecials)` ghép chúng vào. Room settings (Task 3) giữ `enabledSpecials`.
- `SPECIAL_CARDS[i].label = id`; label tiếng Việt/Anh nằm ở `cards.special.<id>` trong `vi.json`/`en.json`. Tên preset dịch qua `scales.<id>`.
- Bộ bài tuỳ chỉnh: trim label; lỗi `SCALE_TOO_SMALL`, `SCALE_EMPTY_LABEL`, `SCALE_RESERVED_LABEL` (trùng id lá đặc biệt), `SCALE_DUPLICATE`.
- pnpm 12 chặn build script mặc định → `pnpm-workspace.yaml` có `allowBuilds: { esbuild: true }`.

## File Structure

```
.gitignore, package.json (scripts test/typecheck), pnpm-workspace.yaml, tsconfig.base.json, pnpm-lock.yaml
apps/backend/
  package.json (@opendeck/backend), tsconfig.json, vitest.config.ts
  src/domain/errors.ts, deck.ts, deck.test.ts, index.ts
apps/frontend/
  package.json (@opendeck/frontend), tsconfig.json, vite.config.ts, vitest.config.ts, index.html
  src/main.tsx, App.tsx (demo bộ Fibonacci + chọn ngôn ngữ), domain.ts (re-export backend domain)
  src/i18n/index.ts (init, LANGUAGES, setLanguage), vi.json, en.json, resources.test.ts
```

## Interfaces (Produces)

```ts
class DomainError extends Error { readonly code: string }
type SpecialId = 'coffee'|'question'|'bug'|'bomb'|'puzzle'|'infinity'|'shrug'
const SPECIAL_IDS: readonly SpecialId[]
interface Card { id: string; label: string; numeric: number|null; special: boolean }
interface Scale { id: string; name: string; kind: 'numeric'|'ordinal'; cards: Card[] }
const PRESET_SCALES: Record<'fibonacci'|'tshirt'|'hours'|'days', Scale>
const SPECIAL_CARDS: Card[]
function isSpecialId(id: string): id is SpecialId
function deckOf(scale: Scale, enabledSpecials?: readonly SpecialId[]): Card[]   // throws UNKNOWN_SPECIAL
function createCustomScale(name: string, labels: string[]): Scale
// frontend/src/i18n
const LANGUAGES: readonly ['vi','en']; type Language; const DEFAULT_LANGUAGE = 'vi'
function isLanguage(v: unknown): v is Language
function setLanguage(lang: Language): void
```

## Steps

- [x] **1.** `npm i -g pnpm` (12.16.1), tạo root files.
- [x] **2.** Tạo `apps/backend` + devDeps `typescript@^5 vitest@^2`; `pnpm approve-builds esbuild`.
- [x] **3.** Viết `deck.test.ts` (15 case: 4 preset, 7 lá đặc biệt, `deckOf` mặc định/tập con/dedupe/id lạ, `isSpecialId`, custom scale kind/trim/5 lỗi) → chạy FAIL (`Failed to load url ./deck`).
- [x] **4.** Implement `errors.ts`, `deck.ts`, `index.ts` → PASS.
- [x] **5.** Tạo `apps/frontend` (Vite + React 18), `domain.ts` re-export.
- [x] **6.** i18n: `vi.json`/`en.json`, `i18n/index.ts`, `resources.test.ts` (key vi = en; mọi `SPECIAL_IDS` và preset đều có bản dịch); App có dropdown VI/EN.
- [x] **7.** Verify: `pnpm test` (backend 15 + frontend 3 PASS), `pnpm typecheck` sạch, `pnpm --filter @opendeck/frontend build` thành công.
- [x] **8.** Cập nhật Plan 1 (Task 1 as-built, đường dẫn `apps/backend/src/domain`, `apps/frontend`, constraint lá đặc biệt + i18n) và roadmap §2.1, §3, §4.
- [ ] **9.** Commit `feat: scaffold frontend/backend apps, deck with toggleable special cards, vi/en i18n`.
