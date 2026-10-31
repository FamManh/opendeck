# Design — Planning Poker (style 3a)

Đồng bộ ngày 2026-10-30 từ Claude Design, project `Planning Poker UI Design` (`6c078921-f2e4-491f-9e11-91ebb7118e07`). Đây là file tham chiếu, không sửa trực tiếp; khi design thay đổi thì đồng bộ lại.

Mở file `.dc.html` bằng trình duyệt; `support.js` phải nằm cùng thư mục.

| File | Vai trò |
|---|---|
| `Planning Poker Screens.dc.html` | 13 màn hình (01–05, 07–14), mỗi màn có desktop 1440 và mobile 390 |
| `Planning Poker.dc.html` | Màn 06 (đang bỏ phiếu) ở mục `#3a` + design system lượt 3. Lượt 1–2 là các hướng cũ, chỉ để tham khảo |
| `RoomV3.dc.html` | Component phòng chơi: `layout=round`, `theme=light/dark`, `device=desktop/mobile`, `scene` |
| `CardV3.dc.html` | Lá bài: số + 7 lá đặc biệt (`coffee, question, bug, bomb, puzzle, infinity, shrug`), các thuộc tính `faceUp/selected/dim/compact` |
| `Mascot.dc.html` | 8 loài (cat, capybara, robot, dino, owl, bunny, koala, fox) × 5 trạng thái (thinking, voted, sleeping, celebrating, away) |
| `support.js` | Runtime để xem file `.dc.html`, không đưa vào app |

## Màn hình → task

| Màn | Nội dung | Plan / Task |
|---|---|---|
| 01 | Trang chủ: tạo phòng / nhập mã | Plan 1 · Task 7 |
| 02 | Đăng nhập · Quên mật khẩu | Plan 1 · Task 7 |
| 03 | Tạo phòng (bộ bài, lá đặc biệt, mật khẩu, duyệt) | Plan 1 · Task 7 |
| 04 | Vào phòng với tư cách khách (công khai / có mật khẩu, nhập sai) | Plan 1 · Task 7 |
| 05 | Kéo task từ Jira | Plan 3 (hoãn) |
| 06 | Đang bỏ phiếu (`Planning Poker.dc.html#3a`) | Plan 1 · Task 8 |
| 07 | Lật bài: đếm ngược 3-2-1, các lá lật cách nhau 150ms | Plan 1 · Task 8 (trạng thái) + Plan 2 · Task 2 |
| 08 | Đồng thuận: confetti 2 giây, nhân vật ăn mừng | Plan 2 · Task 3 |
| 09 | Plot twist: đèn sân khấu, vòng quay chọn người nói trước | Plan 1 · Task 8 (lời mời nói trước) + Plan 2 · Task 3 (đèn sân khấu) + Task 5 (vòng quay) |
| 10 | Bảng kết quả + tab Lý do + host chọn điểm cuối | Plan 1 · Task 8 |
| 11 | Chốt điểm: con dấu, task chuyển sang trạng thái xong | Plan 1 · Task 8 (trạng thái) + Plan 2 · Task 2 (con dấu) |
| 12 | Đẩy điểm về Jira | Plan 3 (hoãn) |
| 13 | Tổng kết buổi, xuất file | Plan 1 · Task 9 (danh hiệu → Plan 4) |
| 14 | Cài đặt hiệu ứng (3 mức + âm thanh) | Plan 2 · Task 1 (+ Task 6 âm thanh) |
