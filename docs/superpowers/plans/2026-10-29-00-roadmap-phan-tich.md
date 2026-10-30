# Planning Poker — Phân tích đặc tả & lộ trình kế hoạch

**Spec:** `docs/Đặc tả sản phẩm — Planning Poker.md`
**Design:** `docs/design.md` → Claude Design project `6c078921-f2e4-491f-9e11-91ebb7118e07`, file `Planning Poker Screens.dc.html` (+ `support.js`)

## 1. Phân tích nhanh

Spec gồm **5 hệ thống con độc lập**. Gộp vào một plan thì không chạy được, không test được. Vì vậy tôi tách thành 4 plan, plan nào làm xong cũng ra phần mềm chạy được:

| # | Plan | Phủ mục spec | Phụ thuộc | Kết quả demo được |
|---|---|---|---|---|
| 1 | **Core: phòng + bỏ phiếu realtime** | §2, §3, §6 (realtime), §7 (auth/phòng), §8 (mô hình dữ liệu) | — | 2 team chơi được Planning Poker tạo task tay, xuất CSV |
| 2 | **Hiệu ứng, nhân vật, reaction** | §5, §6 (hiệu năng hiệu ứng) | Plan 1 | Lật bài/confetti/plot twist, 3 mức hiệu ứng, auto-hạ khi tụt fps |
| 3 | **Tích hợp Jira** — ⏸ **HOÃN** (quyết định 2026-10-30) | §4, §7 (token, quyền Jira, nhật ký) | Plan 1; câu hỏi Cloud/DC | Kéo issue, đẩy điểm có preview + phát hiện xung đột |
| 4 | **Hậu MVP (giai đoạn 2+)** | §5 gamification, §7 lưu trữ 12 tháng, Excel, template khác | 1–2 (phần Jira của template khác chờ Plan 3) | Huy hiệu, trang phục, retention job, export Excel |

File chi tiết: `2026-10-29-01-core-realtime-voting.md` (Plan 1). Plan 2 sẽ viết sau khi Plan 1 chốt interface (`RoomState`, event socket), để không phải đoán.

**Quyết định 2026-10-30: Jira làm sau.** Giai đoạn này chỉ có Chế độ B của §4: tạo task bằng tay (gõ, dán nhiều dòng, import CSV), còn kết quả lấy ra bằng file CSV xuất ở trang tổng kết. Lộ trình làm: Plan 1 → Plan 2 → Plan 4, còn Plan 3 (Jira) làm khi có nhu cầu. Plan 1 vẫn giữ sẵn chỗ cho Jira mà không viết thêm code nào: `Item.source` / `Item.externalRef` và CSV có cột `key`, để sau này nối Jira không phải đổi schema.

## 2. Mâu thuẫn / chỗ hở trong spec (cần chốt)

1. **Lá bài đặc biệt:** §3 liệt kê 6 lá, §5 thêm "con bọ — mùi bug". → **Design đã giải quyết:** dùng 7 lá `coffee, question, bug, bomb, puzzle, infinity, shrug`. Còn một điểm mới cần chốt: màn 03 (Tạo phòng) cho host bật/tắt từng lá đặc biệt, trong khi §3 nói lá đặc biệt "luôn có trong mọi bộ". Plan 1 tạm theo spec (luôn có đủ 7 lá) cho đến khi chốt.
2. **Bộ bài giờ/ngày** chưa có giá trị. → Đề xuất: giờ `0.5,1,2,4,8,16,24`, ngày `0.5,1,2,3,5,8`.
3. **T-shirt** "XS–XL" → `XS,S,M,L,XL`.
4. **"Chênh lệch 2 bậc"** → tính bằng hiệu chỉ số trên thang (index), không tính theo giá trị; lá đặc biệt không tính.
5. **Tự chuyển host** khi host rớt mạng quá 60 giây: spec yêu cầu host phải có tài khoản, nhưng người "vào sớm nhất" có thể là khách. → Chỉ chuyển cho thành viên **có tài khoản và đang online**. Nếu không có ai như vậy, phòng ở trạng thái `hostless`, và người có tài khoản vào đầu tiên sẽ làm host.
6. **Trung bình hòa giữa 2 lá** (ví dụ avg = 4 giữa 3 và 5) → chọn lá **lớn hơn** (thiên về an toàn).
7. **Mode T-shirt bị hòa** → trả về tất cả giá trị hòa.
8. **Đổi vai voter → observer giữa vòng** → phiếu của vòng hiện tại bị xóa.

## 3. Câu hỏi mở ảnh hưởng tới plan (§10)

- Jira Cloud hay Data Center → chỉ cần trả lời khi bắt đầu Plan 3 (đang hoãn).
- Ngôn ngữ UI → Plan 1 dùng i18n key ngay từ đầu (vi mặc định), nên thêm en sau rẻ.
- Hạ tầng / dữ liệu ở VN → chỉ ảnh hưởng deploy, không ảnh hưởng code Plan 1.
- Có cần xác minh email không → Plan 1 **không** làm (YAGNI), schema có sẵn cột `emailVerifiedAt`.

## 4. Stack chọn (spec không quy định)

TypeScript monorepo pnpm · `apps/web`: React 18 + Vite + Zustand · `apps/server`: Fastify + Socket.IO · PostgreSQL + Prisma · `packages/core`: domain thuần (không I/O) dùng chung client/server · Vitest + Playwright.
Lý do: logic phòng/bỏ phiếu nằm ở `core` thuần nên test nhanh. Server là nguồn sự thật duy nhất (§6) và chỉ gửi sự kiện nhỏ.
