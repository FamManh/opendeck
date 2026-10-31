# Plan 2 — Hiệu ứng, nhân vật, reaction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm các khoảnh khắc vui vào phòng chơi của Plan 1: đếm ngược và lật bài theo nhịp, confetti khi đồng thuận, plot twist kèm vòng quay, con dấu chốt điểm, nhân vật có trạng thái, reaction, ném máy bay giấy, âm thanh, 3 mức hiệu ứng, tự hạ mức khi tụt fps. Mục tiêu là không làm chậm buổi họp.

**Architecture:** Hiệu ứng chạy hoàn toàn trên máy từng người (§6). Server không biết hiệu ứng tồn tại: client nhận DomainEvent của Plan 1 (`revealed`, `finalized`…) rồi tự dựng **timeline** bằng một hàm thuần (`planReveal`, `planFinalize`), sau đó một `FxDirector` phát timeline theo `FxLevel`. Server chỉ thêm một kênh `fx` tạm thời, không lưu, không đi qua `RoomState`, dùng cho reaction (gộp theo lô), máy bay giấy và kết quả vòng quay (server bốc ngẫu nhiên để mọi người thấy cùng kết quả). Một `FpsGovernor` đo fps thực tế và hạ mức hiệu ứng khi cần.

**Tech Stack:** Như Plan 1: React 19 + Tailwind 4 + shadcn/ui ở frontend, NestJS 10 + Socket.IO ở backend, Vitest cho cả hai. Không thêm thư viện animation: keyframes khai báo trong `@theme` của Tailwind 4 (`--animate-*`) hoặc `fx.css`, chỉ animate `transform`/`opacity`. Confetti dùng Canvas 2D. Âm thanh dùng Web Audio API, file `.mp3` tải trễ. UI cài đặt và toast dùng shadcn (`Sheet`, `RadioGroup`, `Switch`, `Sonner`).

## Điều kiện tiên quyết và thứ tự thực hiện

**Hiện trạng repo:** backend đã có domain (`stats.ts` với `consensusLevel`/`needsDiscussion`/`modes`, `DomainEvent` gồm `discussionNeeded`), auth, DB, `createTestApp`. **Chưa có** Plan 1 Task 6–8: `RoomGateway`, `RoomStoreService`, `useRoom`, `roomStore`, `Mascot`, `PokerCard`, `Table`, `Seat`, socket client. Frontend mới có `App`, i18n, shadcn `button`/`select`.

- **Làm được ngay (không phụ thuộc Plan 1 Task 6–8):** Task 1 (prefs, trừ Sheet cần shadcn), Task 2 phần hàm thuần (`timeline.ts`, `director.ts`), Task 3 (`mascotState.ts`, `confetti.ts`), Task 6 (sound), Task 7 (governor).
- **Chờ Plan 1 Task 6–8:** Task 2 (nối store, Table/Seat/CardFan), Task 3 (Spotlight, Seat), Task 4, Task 5, Task 8 (e2e).
- **Cần cài trước:** `sonner`; shadcn `sheet`, `radio-group`, `switch`; Playwright (workspace `e2e/` + script `perf` ở root, kiểm `pnpm-workspace.yaml`).
- **i18n:** mọi chuỗi mới (toast governor, "Mời {low} và {high} nói trước", "{tên} nói trước", nhãn cài đặt, "Chỉ áp dụng trên máy của bạn.") thêm vào cả `i18n/vi.json` và `en.json` để `resources.test.ts` (kiểm tra đồng bộ khóa) vẫn pass. Các chuỗi tiếng Việt viết trong plan này chỉ là nội dung `vi.json`.

## Bổ sung sau review (áp dụng cho các task bên dưới)

1. **Thứ tự state/event (Task 2):** store áp `state` và `events` từ cùng một message một cách nguyên tử, rồi dựng timeline từ state sau cùng, vì `planReveal` cần `RoundStats` nằm trong snapshot còn trigger là event `revealed`.
2. **Hủy timeline luôn về trạng thái cuối (Task 2):** `cancel()` hoặc timeline bị thay thế phải để UI ở trạng thái đúng của state hiện tại (lá đã ngửa, kết quả đã hiện), không để nửa chừng. Thêm test.
3. **Tab ẩn (Task 2, 7):** timer bị bóp nên step có thể trễ hoặc dồn. Khi `visibilitychange` về hiển thị, director nhảy thẳng tới trạng thái cuối thay vì phát lại. Thêm test.
4. **"Ngủ" (Task 4, 5):** `SLEEP_AFTER_MS` đưa vào domain dùng chung. Server cần `roundStartedAt` (kiểm `RoomState`); nếu chưa có thì bỏ kiểm tra ở server, chỉ giới hạn tần suất và ghi rõ trong plan. Đổi mã lỗi `TARGET_NOT_SLEEPING_CANDIDATE` thành `TARGET_NOT_IDLE`.
5. **Giới hạn tần suất (Task 4):** khóa theo `pid`, không theo socket (2 tab không được nhân đôi hạn mức). Nói rõ observer và khách có được react hay không (mặc định: được react, không được ném).
6. **Governor (Task 7):** ngưỡng 45/25 fps giả định màn 60Hz. Đo theo tỉ lệ so với tần số quét ước lượng (khung trung bình > 1.4× khung chuẩn thì hạ), và cần tối thiểu 30 mẫu trong cửa sổ.
7. **Perf (Task 8):** `css-guard` là kiểm tra bắt buộc. `pnpm perf` chạy cục bộ, in số liệu, không chặn CI vì CPU throttle và fps trên CI không ổn định.
8. **Âm thanh (Task 6):** ghi nguồn 3 file mp3 hoặc tạo bằng Web Audio oscillator làm fallback; `AudioContext.resume()` gọi trong cử chỉ người dùng (iOS). Âm `tick` ở 10 giây cuối chỉ làm nếu Plan 1 có đồng hồ vòng, nếu không thì bỏ.
9. **Confetti/celebrating (Task 3):** "≥2 phiếu số" dùng cùng cách đếm với `regularTotal` trong `stats.ts`. `celebrating` so `cardId` của người đó với `stats.modes` (kiểu `Card[]`) theo `card.id`.
10. **Vòng quay (Task 4, 5):** `discussionNeeded` có mảng `lowPids`/`highPids`. Server chọn `chosen` ngẫu nhiên, rồi chọn ngẫu nhiên một `pid` trong phía đó. Mỗi lượt lật chỉ quay được một lần; host bấm lần hai nhận lỗi `ALREADY_SPUN`.
11. **Ẩn danh (Task 4):** `fx:reactions` không có pid (ẩn danh). `fx:thrown` có `from`, và đó là chủ ý.

**Spec:** `docs/Đặc tả sản phẩm — Planning Poker.md` §5, §6 · **Design:** `docs/design/RoomV3.dc.html` (logic `flip()`, `lock()`, `spin()`, `react()`, CONF), `docs/design/Planning Poker Screens.dc.html` màn 07, 08, 09, 11, 14, `docs/design/Planning Poker.dc.html` mục "Chuyển động" · **Phụ thuộc:** Plan 1 Task 6–8 (hiện chưa xong, xem "Điều kiện tiên quyết") cung cấp (`PublicRoomState`, `DomainEvent`, `useRoom`, `roomStore.lastEvents`, `Mascot`, `PokerCard`, `Table`, `Seat`, `RoomGateway`, `RoomStoreService`).

## Global Constraints

- Chỉ animate `transform` và `opacity`. Không animate width/height/top/left/box-shadow/filter (§6).
- Thời lượng tối đa (§5): chọn bài 0,3 giây · đếm ngược 1,5 giây · lật bài 1 giây · đồng thuận 2 giây · plot twist 1,5 giây · chốt điểm 0,8 giây.
- Nhịp đếm theo đặc tả (tối đa 1,5 giây, chốt 2026-10-31): đếm 3→2→1 cách nhau **500ms**, lá đầu tiên lật ở **1500ms**. Design dùng 650ms/1950ms. Ở mức Đầy đủ các lá lật cách nhau **150ms**, tối đa 1 giây cho cả lượt lật (nếu đông người thì bước nhịp = `min(150, 1000 / n)`). Lá chọn nhô lên **34px**, easing `cubic-bezier(.3,.7,.3,1.3)`. Lá lật xoay Y 180° trong **560ms**, easing `cubic-bezier(.3,.7,.35,1.15)`. Reaction bay trong **1600ms**. Vòng quay **1000ms** (Tối giản: 50ms).
- 3 mức (§5, màn 14): `full` = Đầy đủ (mọi hiệu ứng + âm thanh) · `medium` = Vừa phải (đếm ngược, các lá lật cùng lúc, không âm thanh) · `minimal` = Tối giản (không xoay, không di chuyển, chỉ mờ dần, kết quả hiện ngay).
- Cài đặt hiệu ứng chỉ áp dụng trên máy của từng người: lưu `localStorage['pp.fx']`. Mặc định `full`. Nếu hệ điều hành bật `prefers-reduced-motion: reduce` và toggle "Theo giảm chuyển động" đang bật (mặc định bật) thì dùng `minimal`.
- Confetti vẽ trên canvas, tối đa **38 hạt** (con số của design), kéo dài 2 giây. Khi governor đã hạ mức thì giảm còn 19 hạt.
- Server không gửi khung hình hay trạng thái hiệu ứng. Kênh `fx` không ghi DB (§6).
- Reaction: 4 emoji `👏 😂 🤔 😮` (§5). Mỗi người tối đa **5 reaction / 2 giây**. Server gộp và phát theo lô mỗi **250ms** cho mỗi phòng.
- Gamification §5 cột "Không làm" không được xuất hiện ở bất kỳ đâu (không có "team harmony", không có danh hiệu cho người đồng thuận nhanh).

## Quyết định ở chỗ design và spec lệch nhau

1. **Khi nào bật plot twist:** design tự mở popup plot twist khi mức đồng thuận là "Thấp" (chênh từ 3 bậc). Spec §3 nói chênh **từ 2 bậc** là cần thảo luận. → Theo spec: plot twist chạy khi `stats.needsDiscussion` (≥2 bậc).
2. **Âm thanh:** spec gắn âm thanh vào mức Đầy đủ, còn design có thêm toggle Âm thanh riêng. → Chỉ phát âm thanh khi `level === 'full' && sound === true`.
3. **Confetti:** design chỉ bắn confetti khi đồng thuận tuyệt đối (mọi phiếu số cùng một giá trị). → Theo design: `consensusLevel === 'absolute'`. Ngoài ra cần **ít nhất 2 phiếu số**, để phòng 1 người không tự bắn confetti.

## Review Focus

1. **Vào phòng hoặc reconnect khi vòng đã lật:** không phát lại đếm ngược hay confetti, chỉ hiển thị trạng thái cuối. Hiệu ứng chỉ chạy khi nhận **event**, không chạy khi nhận **snapshot** → test trong Task 2.
2. **Event mới đến khi timeline cũ đang chạy** (host bấm "Bỏ phiếu lại" giữa lúc confetti, hoặc lật rồi chốt rất nhanh): timeline cũ bị hủy sạch, không còn timer chạy sót cập nhật UI → test trong Task 2.
3. **Tab chạy nền** (rAF bị trình duyệt bóp): governor không được hiểu đó là máy yếu mà tự hạ mức → test trong Task 7.
4. **20 người cùng spam reaction:** server vẫn phản hồi, client không vẽ quá 30 emoji cùng lúc → test trong Task 4 và Task 5.
5. **Phòng 50 người lật bài:** tổng thời gian lật vẫn ≤ 1 giây, bố cục không vỡ → test trong Task 2 và Task 8.

---

## Phần Plan 2 dựa vào Plan 1

✅ `consensusLevel` đã có trong `RoundStats` (Plan 1 Task 2, đã xong):
`consensusLevel: 'absolute'|'high'|'medium'|'low'|'unknown'`, tính từ `spreadSteps`: 0 → absolute, 1 → high, 2 → medium, ≥3 → low; không có phiếu số → unknown. Nhãn tiếng Việt: Tuyệt đối / Cao / Vừa phải / Thấp / Chưa rõ.

## File Structure

```
apps/frontend/src/fx/
  prefs.ts          — FxPrefs, useFxPrefs, resolveLevel
  timeline.ts       — planReveal, planFinalize, planVoteFly (hàm thuần → Step[])
  director.ts       — FxDirector: phát Step[], hủy được, fake-timer friendly
  confetti.ts       — ConfettiCanvas (canvas 2D, pool hạt)
  mascotState.ts    — deriveMascotState
  sound.ts          — SoundBank (lazy, Web Audio)
  governor.ts       — FpsGovernor
  fx.css            — keyframes (chỉ transform/opacity), import trong index.css
apps/frontend/src/room/fx/
  CountdownOverlay.tsx, Spotlight.tsx, Wheel.tsx, Stamp.tsx, ReactionLayer.tsx, PaperPlane.tsx, FxSettingsSheet.tsx
apps/backend/src/realtime/fx.service.ts — kênh fx: react / throw / spin (handler @SubscribeMessage nằm trong RoomGateway)
e2e/perf.spec.ts
```

---

### Task 1: Cài đặt hiệu ứng (màn 14)

**Files:** Create `apps/frontend/src/fx/prefs.ts`, `apps/frontend/src/room/fx/FxSettingsSheet.tsx` · Test `apps/frontend/src/fx/prefs.test.ts`, `apps/frontend/src/room/fx/FxSettingsSheet.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  type FxLevel = 'full'|'medium'|'minimal'
  interface FxPrefs { level: FxLevel; sound: boolean; followReducedMotion: boolean }
  const DEFAULT_FX_PREFS: FxPrefs  // { level:'full', sound:true, followReducedMotion:true }
  function resolveLevel(p: FxPrefs, reducedMotion: boolean, governorCap: FxLevel|null): FxLevel  // lấy mức thấp hơn giữa các nguồn
  function soundEnabled(p: FxPrefs, effective: FxLevel): boolean  // effective==='full' && p.sound
  function useFxPrefs(): { prefs: FxPrefs; effective: FxLevel; set(p: Partial<FxPrefs>): void }
  ```

- [ ] **Step 1: Viết test fail**

```ts
test('reduced motion forces minimal when followReducedMotion', () => {
  expect(resolveLevel({ ...DEFAULT_FX_PREFS }, true, null)).toBe('minimal')
  expect(resolveLevel({ ...DEFAULT_FX_PREFS, followReducedMotion:false }, true, null)).toBe('full')
})
test('governor cap only lowers', () => {
  expect(resolveLevel({ ...DEFAULT_FX_PREFS, level:'minimal' }, false, 'medium')).toBe('minimal')
  expect(resolveLevel(DEFAULT_FX_PREFS, false, 'medium')).toBe('medium')
})
test('sound only on full', () => { expect(soundEnabled(DEFAULT_FX_PREFS, 'medium')).toBe(false) })
test('corrupt localStorage falls back to defaults', ...)   // 'pp.fx' = '{bad' → DEFAULT_FX_PREFS
test('localStorage throwing (private mode) does not crash', ...)
```
  Test cho Sheet (shadcn `Sheet`: bottom trên mobile, right trên desktop; `RadioGroup` cho 3 mức; `Switch` cho 2 toggle): hiện 3 lựa chọn với label và mô tả lấy từ `effOpts` của design. Chọn "Tối giản" thì gọi `set({level:'minimal'})`. Có toggle "Âm thanh" và "Theo giảm chuyển động". Có dòng "Chỉ áp dụng trên máy của bạn."

- [ ] **Step 2: Chạy** `pnpm --filter @opendeck/frontend test fx/prefs`. Kỳ vọng: FAIL.
- [ ] **Step 3: Implement.** `useFxPrefs` lắng nghe `matchMedia('(prefers-reduced-motion: reduce)')` change. Sheet mở từ nút ✦ trên thanh trên cùng.
- [ ] **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat(fx): per-device effect preferences`

---

### Task 2: Timeline + director: chọn bài, đếm ngược, lật bài, chốt (màn 07, 11)

**Files:** Create `apps/frontend/src/fx/{timeline,director}.ts`, `apps/frontend/src/fx/fx.css`, `apps/frontend/src/room/fx/{CountdownOverlay,Stamp}.tsx` · Modify `apps/frontend/src/index.css` (import `fx.css`), `apps/frontend/src/room/{Table,Seat,CardFan,TaskPanel}.tsx`, `apps/frontend/src/store/roomStore.ts` · Test `apps/frontend/src/fx/{timeline,director}.test.ts`

**Interfaces:**
- Consumes: `DomainEvent`, `PublicRoomState`, `RoundStats` (Plan 1), `FxLevel` (Task 1)
- Produces:
  ```ts
  type Step =
    | { at: number; kind: 'countdown'; n: 3|2|1 } | { at: number; kind: 'flip'; pid: string }
    | { at: number; kind: 'flipAll' } | { at: number; kind: 'results' }
    | { at: number; kind: 'stamp' } | { at: number; kind: 'slideDone'; itemId: string }
    | { at: number; kind: 'moment'; name: 'consensus'|'twist' }
  function planReveal(level: FxLevel, seatOrder: string[], stats: RoundStats): Step[]
  function planFinalize(level: FxLevel, itemId: string): Step[]
  class FxDirector { play(steps: Step[], onStep: (s: Step) => void): void; cancel(): void }  // play() tự cancel timeline đang chạy
  // roomStore: fxQueue chỉ được nạp từ socket 'events', KHÔNG nạp từ 'state' snapshot
  ```

- [ ] **Step 1: Viết test fail — timeline.test.ts**

```ts
const st = (o: Partial<RoundStats>) => ({ ...baseStats, ...o })
test('full: countdown 0/650/1300, flips from 1950 every 150ms, results after last flip + 650', () => {
  const s = planReveal('full', ['a','b','c'], st({}))
  expect(s.filter(x => x.kind==='countdown').map(x => x.at)).toEqual([0,650,1300])
  expect(s.filter(x => x.kind==='flip').map(x => x.at)).toEqual([1950,2100,2250])
  expect(s.find(x => x.kind==='results')!.at).toBe(2250 + 650)
})
test('full with 50 seats: last flip <= 1950 + 1000', () => {
  const flips = planReveal('full', seats(50), st({})).filter(x => x.kind==='flip')
  expect(flips.at(-1)!.at).toBeLessThanOrEqual(2950)
})
test('medium: countdown then single flipAll at 1950, results at 2600', ...)
test('minimal: no countdown, flipAll at 0, results at 50', ...)
test('consensus moment only when absolute and >=2 numeric votes', ...)  // absolute+1 phiếu → không có
test('twist moment when needsDiscussion', ...)
test('planFinalize full: stamp at 0, slideDone at 800; minimal: both at 0', ...)
```

- [ ] **Step 2: Viết test fail — director.test.ts** (dùng `vi.useFakeTimers`): các step chạy đúng thứ tự và đúng mốc `at` · gọi `play()` lần 2 khi lần 1 chưa xong thì không còn step nào của lần 1 chạy · `cancel()` dọn hết timer (`vi.getTimerCount()===0`).
- [ ] **Step 3: Viết test fail — roomStore:** nhận `events:[revealed]` thì enqueue timeline · nhận `state` có `current.status==='revealed'` mà không có event thì không enqueue (Review Focus 1) · nhận `roundStarted` khi đang phát timeline thì gọi `cancel()` (Review Focus 2).
- [ ] **Step 4: Chạy test.** Kỳ vọng: FAIL.
- [ ] **Step 5: Implement.** `Seat` nhận prop `flipped` từ step, dùng `PokerCard faceUp` (transition 560ms) có sẵn. `CardFan`: lá chọn nhô `translateY(-34px)` trong 0,3 giây. Lá của người khác xuất hiện trên bàn bằng `opacity` + `scale(.6→1)` trong 0,3 giây. Mức `minimal`: mọi transition đổi thành `opacity 200ms`. Con dấu: `scale(1.6→1) rotate(-12deg)` + opacity trong 0,8 giây. Task trượt sang cột xong bằng `translateX` trong danh sách.
- [ ] **Step 6: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 7: Commit** `feat(fx): reveal and finalize choreography`

---

### Task 3: Khoảnh khắc: nhân vật, confetti, plot twist (màn 08, 09)

**Files:** Create `apps/frontend/src/fx/{mascotState,confetti}.ts`, `apps/frontend/src/room/fx/Spotlight.tsx` · Modify `apps/frontend/src/room/Seat.tsx`, `apps/frontend/src/room/Table.tsx` · Test `apps/frontend/src/fx/{mascotState,confetti}.test.ts`, `apps/frontend/src/room/fx/Spotlight.test.tsx`

**Interfaces:**
- Consumes: `Participant`, `PublicRound`, `RoundStats`, `Step` (Task 2), `Mascot` (Plan 1 Task 7)
- Produces:
  ```ts
  type MascotState = 'thinking'|'voted'|'sleeping'|'celebrating'|'away'
  const SLEEP_AFTER_MS = 45_000
  function deriveMascotState(p: Participant, round: PublicRound|null, stats: RoundStats|null, now: number, roundStartedAt: number, moment: 'consensus'|null): MascotState
  class ConfettiCanvas { constructor(canvas: HTMLCanvasElement, opts: { count: number; durationMs: 2000; colors: string[] }); burst(): void; destroy(): void; readonly active: number }
  ```
  Bảng màu confetti lấy từ design: `#FFB627 #F26A2E #5CC8C2 #A68BFF #7BC86C #FF9DBB`.

- [ ] **Step 1: Viết test fail:**
  - `deriveMascotState`: offline → `away` · đang voting và đã vote → `voted` · đang voting, chưa vote, `now - roundStartedAt > 45_000` → `sleeping` · chưa đến 45 giây → `thinking` · moment consensus và phiếu của người này thuộc `stats.modes` → `celebrating` · observer → không bao giờ `sleeping`.
  - Confetti (canvas mock): `burst()` sinh đúng `count` hạt · sau 2000ms (fake rAF) `active===0` và không còn rAF nào đang chờ · `burst()` 2 lần liên tiếp không vượt quá `count` hạt.
  - Spotlight: render 2 vòng sáng ở ghế `lowPids[0]` và `highPids[0]` (lấy từ event `discussionNeeded` của Plan 1) · dòng chữ "Mời {low} và {high} nói trước" · lá thấp nhất và cao nhất phóng to `scale(1.25)` · tông tích cực, không dùng màu đỏ báo động (assert không có class `danger`).
- [ ] **Step 2: Chạy test.** Kỳ vọng: FAIL.
- [ ] **Step 3: Implement.** Khi `Table` nhận `sleeping`, nó chỉ lấy giá trị `now` mỗi 5 giây (`setInterval` 5000) để tránh render lại liên tục. Canvas phủ trên bàn với `pointer-events:none`, hạt rơi bằng `translate` + `rotate` trên canvas, và canvas bị gỡ khỏi DOM khi `active===0`. Spotlight là 2 lớp `radial-gradient` cố định, chỉ animate `opacity` và `transform: scale`, trong 1,5 giây.
- [ ] **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat(fx): mascot states, confetti, plot twist spotlight`

---

### Task 4: Backend — kênh `fx` (reaction, máy bay giấy, vòng quay)

**Files:** Create `apps/backend/src/realtime/fx.service.ts` (+ `fx.service.test.ts` unit: giới hạn tần suất, gộp lô) · Modify `apps/backend/src/realtime/{room.gateway,realtime.module}.ts` (thêm `@SubscribeMessage('fx:react'|'fx:throw'|'fx:spin')` dùng `@Ack()`, gọi `FxService`) · Test `apps/backend/test/fx.e2e.test.ts` (dùng `createTestApp` + `socket.io-client`)

**Interfaces:**
- Consumes: `RoomGateway`, `RoomStoreService.load(slug)` (Plan 1 Task 6) để biết participant, host, trạng thái vòng; `Clock` (Plan 1 Task 5).
- `FxService { react(slug, pid, emoji, now); throwAt(slug, from, target, kind, now); spin(slug, pid): {chosen, pid, turns} }`, provider `Random { next(): number }` để test inject.
- Produces (Socket.IO, namespace `/room`):
  - client→server `fx:react {emoji}` (emoji ∈ `👏 😂 🤔 😮`) · `fx:throw {target: pid, kind:'paper'|'plane'}` · `fx:spin {}` (chỉ host, chỉ khi `current.status==='revealed' && stats.needsDiscussion`)
  - server→client `fx:reactions {items: {emoji, count}[]}` (gộp mỗi 250ms, không gửi pid → reaction ẩn danh) · `fx:thrown {from, target, kind}` · `fx:spun {chosen:'low'|'high', pid, turns}` (`turns` = số vòng ngẫu nhiên 3–4, để mọi client quay giống nhau)
  - ack lỗi: `RATE_LIMITED`, `NOT_HOST`, `BAD_EMOJI`, `TARGET_NOT_SLEEPING_CANDIDATE`

- [ ] **Step 1: Viết test fail:**
  - 1 người gửi 7 reaction trong 2 giây → 5 cái được nhận, 2 cái bị ack `RATE_LIMITED`.
  - 20 client mỗi người gửi 5 reaction cùng lúc → mỗi client nhận ≤ 2 frame `fx:reactions` trong 500ms và tổng `count` là 100.
  - Emoji ngoài danh sách → `BAD_EMOJI`.
  - `fx:throw` vào người đã vote → bị từ chối. Giới hạn 1 lần ném / 10 giây cho mỗi cặp (người ném, người bị ném).
  - `fx:spin` từ non-host → `NOT_HOST`. Từ host → tất cả client nhận cùng một `{chosen, pid, turns}`. Override provider `Random` trong test để kết quả cố định.
  - Không có gì từ kênh `fx` được ghi xuống DB: số dòng các bảng không đổi, và `RoomPersistenceService` không bị gọi (spy).
- [ ] **Step 2: Chạy** `pnpm --filter @opendeck/backend test:e2e -- fx`. Kỳ vọng: FAIL. **Step 3: Implement.** Lô reaction flush bằng `setInterval(250)` cho mỗi phòng có reaction đang chờ và tự dừng khi trống. **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat(backend): ephemeral fx channel`

---

### Task 5: Client — reaction, máy bay giấy, vòng quay

**Files:** Create `apps/frontend/src/room/fx/{ReactionLayer,PaperPlane,Wheel}.tsx` · Modify `apps/frontend/src/realtime/socket.ts`, `apps/frontend/src/room/{Seat,Table}.tsx` · Test các file `.test.tsx` tương ứng

**Interfaces:**
- Consumes: kênh `fx` (Task 4), `FxLevel` (Task 1), `deriveMascotState` (Task 3)
- Produces: `MAX_FLOATING_REACTIONS = 30`

- [ ] **Step 1: Viết test fail:**
  - ReactionLayer: nhận `{emoji:'👏',count:40}` → vẽ tối đa 30 emoji (Review Focus 4), mỗi emoji tự gỡ sau 1600ms · `minimal` → không bay, chỉ hiện bộ đếm `👏 ×40` mờ dần · nút reaction bị disable trong lúc client đang bị giới hạn tần suất.
  - PaperPlane: nút "Ném máy bay" chỉ hiện trên ghế có trạng thái `sleeping` · nhận `fx:thrown` → máy bay bay tới ghế đích bằng `translate`/`rotate` (keyframe `ppPlane` của design) · `minimal` → chỉ rung nhẹ bằng opacity.
  - Wheel: nhận `fx:spun {chosen:'high', turns:3}` → góc quay cuối = `turns*360 + (chosen==='high'?0:180)` · quay 1000ms (`minimal`: 50ms) · khi xong hiện "{tên} nói trước" · nút "Quay" chỉ host thấy (màn 09).
- [ ] **Step 2: Chạy test.** Kỳ vọng: FAIL. **Step 3: Implement.** **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat(fx): reactions, paper plane, speaker wheel`

---

### Task 6: Âm thanh (tải trễ)

**Files:** Create `apps/frontend/src/fx/sound.ts`, `apps/frontend/public/sfx/{drum,flip,tick}.mp3` (mỗi file ≤ 30 KB, nguồn CC0, ghi nguồn vào `apps/frontend/public/sfx/CREDITS.md`) · Test `apps/frontend/src/fx/sound.test.ts`

**Interfaces:**
- Produces: `class SoundBank { constructor(fetcher?: typeof fetch, ctxFactory?: () => AudioContext); unlock(): Promise<void>; play(name:'drum'|'flip'|'tick'): void }`. Director gọi `play` ở step `countdown n=3` (drum), mỗi step `flip`/`flipAll` (flip), và ở 10 giây cuối của đồng hồ đếm ngược vòng (tick, mỗi giây).

- [ ] **Step 1: Viết test fail:** chưa `unlock()` (chưa có thao tác người dùng) → `play` không làm gì và không ném lỗi · không gọi `fetch` nào lúc khởi tạo, chỉ fetch sau `unlock()` (lazy, §6) · fetch lỗi → `play` không làm gì, không ném lỗi · `soundEnabled===false` → director không gọi `play`.
- [ ] **Step 2: Chạy test.** Kỳ vọng: FAIL. **Step 3: Implement.** `unlock()` được gọi ở lần click đầu tiên trong phòng. **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat(fx): lazy sound bank`

---

### Task 7: FPS governor + tự hạ mức

**Files:** Create `apps/frontend/src/fx/governor.ts` · Modify `apps/frontend/src/fx/prefs.ts` (nối `governorCap`) · Test `apps/frontend/src/fx/governor.test.ts`

**Interfaces:**
- Produces:
  ```ts
  class FpsGovernor {
    constructor(opts: { raf: (cb: FrameRequestCallback) => number; now: () => number; isVisible: () => boolean; onCap: (cap: FxLevel) => void })
    startSampling(): void   // director gọi khi bắt đầu timeline
    stopSampling(): void    // director gọi khi timeline xong
  }
  ```
  Quy tắc: chỉ đo khi timeline đang chạy và tab đang hiển thị. Tính fps trung bình theo cửa sổ trượt 3 giây. Đang `full` mà < **45 fps** → cap `medium`. Đang `medium` mà < **25 fps** → cap `minimal`. Không bao giờ tự nâng mức trong cùng một phiên. Mỗi lần hạ hiện toast nhẹ (shadcn Sonner) đúng 1 lần: "Máy đang hơi chậm, đã chuyển hiệu ứng sang {mức}. Đổi lại trong ✦."

- [ ] **Step 1: Viết test fail** (raf và now giả lập): khung 30ms đều trong 3 giây khi đang full → `onCap('medium')` · khung 16ms → không gọi · `isVisible()===false` cùng khung 200ms → không gọi (Review Focus 3) · 1 khung giật 500ms giữa các khung 16ms → không hạ (cửa sổ trung bình vẫn > 45) · sau khi đã cap `medium`, fps 20 → `onCap('minimal')` · `stopSampling()` thì không còn rAF nào đang chờ.
- [ ] **Step 2: Chạy test.** Kỳ vọng: FAIL. **Step 3: Implement.** **Step 4: Chạy test.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat(fx): fps governor with auto downgrade`

---

### Task 8: Rào chắn hiệu năng

**Files:** Create `apps/frontend/test/css-guard.test.ts`, `e2e/perf.spec.ts` · Modify `package.json` (script `perf`)

- [ ] **Step 1: Viết test css-guard:**
  - Quét `@keyframes` trong `apps/frontend/src/**/*.css` (kể cả `--animate-*` trong `@theme`): bên trong chỉ được có `transform`, `translate`, `rotate`, `scale`, `opacity`.
  - Quét `className` trong `apps/frontend/src/{room,fx,components/game}/**/*.tsx`: cấm `transition-all`, `transition-[width|height|top|left|box-shadow|filter…]`, `transition-shadow`, và style inline `transition:` có thuộc tính khác `transform`/`opacity`.
  - Được phép `transition-colors` (hover nút, không phải hiệu ứng khoảnh khắc). `components/ui/*` (shadcn) không quét, nhưng không được dùng component shadcn có `transition-all` trong các vùng `room/fx`.
  - Vi phạm thì FAIL kèm tên file và dòng.
- [ ] **Step 2: Chạy** `pnpm --filter @opendeck/frontend test css-guard`. Kỳ vọng: PASS. Nếu FAIL thì sửa CSS vi phạm trong Task 2–5, không nới quy tắc.
- [ ] **Step 3: Viết `e2e/perf.spec.ts`:** dùng Chromium, CDP `Emulation.setCPUThrottlingRate(4)` để giả lập điện thoại tầm trung. Tạo phòng 20 người (1 trình duyệt thật, 19 client socket giả). Lật bài ở mức `full`, đo fps bằng rAF trong page suốt timeline. Ngưỡng: median ≥ 30 fps khi có throttle và ≥ 55 fps khi không throttle. Thêm kịch bản 50 người: lượt lật xong trong ≤ 1 giây sau mốc 1950ms và không có ghế nào tràn khỏi bàn (kiểm `getBoundingClientRect` của ghế nằm trong bàn hoặc viewport).
- [ ] **Step 4: Đo thời gian mở phòng:** từ `navigate` đến khi `Table` hiện ra phải < 3 giây (§6) khi throttle mạng "Fast 3G", và file `.mp3` **không** được tải trước lần click đầu tiên (kiểm tra qua network log).
- [ ] **Step 5: Chạy** `pnpm perf`. Kỳ vọng: mọi ngưỡng PASS, in bảng fps, thời gian lật và thời gian mở phòng.
- [ ] **Step 6: Commit** `test(perf): css guard and fps budget`

---

## Ngoài phạm vi Plan 2

- Mở khóa trang phục/phụ kiện, danh hiệu "Người đặt câu hỏi hay", chủ đề theo mùa, icebreaker → **Plan 4**
- Sprite nhân vật dạng ảnh: không cần, vì nhân vật là SVG inline nhỏ (đã có từ Plan 1)


> **Ghi chú thực thi:** âm thanh (`drum`/`flip`/`tick`) được tổng hợp bằng code trong `fx/sound.ts` (WebAudio), không có file `.mp3` hay `CREDITS.md`. Perf chạy bằng `pnpm perf` (`e2e/reveal.perf.ts`, không chặn CI).
