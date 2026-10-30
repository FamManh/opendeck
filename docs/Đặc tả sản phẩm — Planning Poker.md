# Đặc tả sản phẩm — Planning Poker nội bộ

Oct 29, 2026 · @Andrew

## 1. Bối cảnh và mục tiêu

Công ty tự xây một app Planning Poker, dùng nội bộ và mở cho người ngoài, vừa đẹp vừa mượt, gắn với Jira, để buổi ước lượng (estimation) bớt nhàm chán mà vẫn ra kết quả tin được.

Các app có sẵn thường rơi vào một trong hai cực: có hiệu ứng nhưng giật, lag khi đông người; hoặc chạy ổn nhưng sơ sài, không ai muốn mở. Bản tự xây phải tránh được cả hai, và được tùy biến theo quy trình của công ty.

**Mục tiêu**

- Thành viên **thích** tham gia: giao diện bắt mắt, có icon, nhân vật và hiệu ứng vui.
- Hiệu ứng **không bao giờ làm chậm** buổi họp: mượt trên laptop cấu hình thường và điện thoại.
- Kết quả ước lượng **đáng tin**: giữ đúng cơ chế bỏ phiếu bí mật, lật cùng lúc, thảo luận khi chênh lệch.
- **Giảm việc tay với Jira**: kéo task từ Jira vào, đẩy điểm (story point) về Jira sau khi chốt.

**Nguyên tắc thiết kế**

1. Vui để giữ chân, nhưng không thưởng cho việc đồng thuận nhanh. Bất đồng là tín hiệu quý, nên app thưởng cho thảo luận và đặt câu hỏi.
2. Hiệu ứng phục vụ khoảnh khắc (lật bài, chốt điểm), không chạy liên tục làm rối mắt.
3. Mọi thứ vui đều có nút tắt: người dùng có thể chọn chế độ tối giản.
4. Dữ liệu ước lượng không dùng để đánh giá hiệu suất cá nhân.

## 2. Người dùng và vai trò

Mỗi phòng có ba vai trò. Một người có thể đổi vai trò giữa buổi, ví dụ host nhường quyền khi phải rời đi.

| Vai trò | Ai thường đảm nhận | Được làm gì |
| --- | --- | --- |
| Host (facilitator) | Scrum Master, PO, Tech Lead | Tạo phòng, nhập/kéo task, bắt đầu và lật vòng bỏ phiếu, chốt điểm, đẩy kết quả về Jira, chuyển quyền host |
| Người bỏ phiếu (voter) | Dev, QA, Designer | Chọn bài bí mật, bỏ phiếu lại, đặt câu hỏi, ghi lý do, thả reaction |
| Người quan sát (observer) | PO, quản lý, người mới | Xem phòng, xem kết quả, đặt câu hỏi; không bỏ phiếu |

**Tài khoản và vào phòng**

- Đăng nhập bằng email và mật khẩu. Giai đoạn này chưa làm SSO; có thể thêm sau (ví dụ đăng nhập Google).
- **Host bắt buộc có tài khoản**, để lưu phòng, lịch sử và kết nối Jira.
- Người bỏ phiếu và người quan sát có thể đăng ký, hoặc vào với tư cách khách (guest). Khi khách vào phòng, app tìm tên đã dùng lần trước trong cookie/localStorage: có thì vào thẳng, không có thì hiện popup nhập tên và chọn nhân vật. Khách đổi tên được ngay trong phòng.
- **Phòng công khai** (mặc định): có link là vào, không cần host duyệt.
- **Phòng có mật khẩu**: nhập đúng mật khẩu là vào, không cần duyệt.
- Cài đặt "Cần host duyệt" có sẵn nhưng **mặc định tắt**; host bật khi muốn tự duyệt từng người.

## 3. Luồng chính và tính năng cốt lõi (MVP)

Một vòng ước lượng đi theo luồng: chọn task → bỏ phiếu bí mật → lật bài → nếu chênh lệch lớn thì thảo luận và bỏ phiếu lại → chốt điểm → sang task tiếp theo.

**Phòng chơi**

- Tạo phòng bằng link hoặc mã phòng; phòng lưu lại để dùng cho các sprint sau.
- Tham gia nhanh bằng tài khoản hoặc với tư cách khách (mục 2); đặt tên hiển thị và chọn nhân vật (avatar).
- Trạng thái thành viên hiển thị trực tiếp: đã chọn bài, đang suy nghĩ, vắng mặt.

**Bộ bài (deck)**

- Có sẵn: Fibonacci (1, 2, 3, 5, 8, 13, 21), T-shirt (XS–XL), số giờ hoặc số ngày; host có thể tạo bộ bài riêng của team.
- Lá bài đặc biệt, luôn có trong mọi bộ: Chưa đủ thông tin, Task quá lớn – cần chia nhỏ, Có dependency, Rủi ro cao, Cần nghỉ giải lao, Tôi không biết.

**Bỏ phiếu và lật bài**

- Phiếu bí mật đến lúc lật; mọi người chỉ thấy ai đã chọn, không thấy chọn gì.
- Host lật bài, hoặc app tự lật khi đủ phiếu hay hết giờ đếm ngược (tùy chọn).
- Sau khi lật, hiển thị **phân bố phiếu** (bao nhiêu người chọn mỗi giá trị), giá trị thấp nhất/cao nhất và mức độ đồng thuận. Hiển thị cả giá trị trung bình (với bộ bài dạng số), kèm lá bài gần nhất với giá trị đó, làm gợi ý tham khảo; điểm chốt vẫn do host quyết định sau thảo luận. Với bộ T-shirt, hiển thị giá trị được chọn nhiều nhất thay cho trung bình.

**Thảo luận và chốt**

- Khi chênh lệch từ 2 bậc trở lên trên thang bài, app mời người chọn cao nhất và thấp nhất nói trước.
- Mỗi người có thể ghi một dòng lý do; app gom lại thành ghi chú của task.
- Bỏ phiếu lại không giới hạn số vòng; lịch sử các vòng được giữ.
- Host chốt điểm cuối cùng (có thể khác kết quả bỏ phiếu) rồi chuyển sang task tiếp theo.

**Sau buổi**

- Bảng tổng kết: task, điểm chốt, số vòng, ghi chú, các lá bài đặc biệt đã được dùng.
- Xuất CSV hoặc Excel; đẩy điểm về Jira (mục 4).

## 4. Tích hợp Jira

App hỗ trợ hai chế độ, chọn theo từng phòng: kéo task từ Jira (khuyến nghị), hoặc tạo task tay trong app rồi đồng bộ sau. Cả hai đều kết thúc bằng việc điểm chốt nằm đúng trong Jira.

|  | Chế độ A – Kéo từ Jira | Chế độ B – Tạo tay, đồng bộ sau |
| --- | --- | --- |
| Khi nào dùng | Backlog đã có trên Jira | Ý tưởng mới, workshop, Jira chưa có ticket |
| Đưa task vào phòng | Chọn board/sprint, hoặc lọc bằng JQL; tick các issue cần ước lượng | Gõ tay, dán danh sách nhiều dòng, hoặc import CSV |
| Thông tin hiển thị | Key, tiêu đề, mô tả, acceptance criteria, người được giao, link mở Jira | Tiêu đề, mô tả ngắn do người tạo nhập |
| Đẩy kết quả | Ghi điểm vào trường Story Points của issue; ghi chú thảo luận thành comment (tùy chọn) | Ghép với issue có sẵn bằng key, hoặc tạo issue mới trên Jira; hoặc xuất CSV để import |
| Thời điểm đẩy | Ngay khi host chốt, hoặc đẩy hàng loạt cuối buổi | Cuối buổi, sau khi host kiểm tra lại danh sách |

**Yêu cầu kỹ thuật**

- Chỉ tài khoản đã đăng ký mới kết nối được Jira; khách thì không. Kết nối bằng OAuth 2.0 của Atlassian theo từng người dùng, để mọi thay đổi trên Jira ghi đúng tên người thao tác và tôn trọng quyền của họ.
- Trường Story Points ở mỗi Jira khác nhau (thường là custom field). Admin cấu hình một lần: project nào, trường nào, bộ bài nào.
- Bộ bài T-shirt không ghi được vào trường số: cấu hình bảng quy đổi (ví dụ S = 2, M = 3) hoặc ghi vào một trường/nhãn riêng.
- Trước khi đẩy, app kiểm tra issue đã có điểm chưa. Nếu điểm trên Jira khác với điểm cũ lúc kéo về, app hỏi lại thay vì ghi đè.
- Đẩy hàng loạt có màn hình xem trước: danh sách issue, điểm cũ → điểm mới; host bỏ tick những dòng không muốn đẩy.
- Lỗi kết nối hoặc hết hạn token không làm mất kết quả: điểm được lưu trong app và đẩy lại được sau.

MVP chỉ cần đồng bộ một chiều (Jira → app khi kéo task, app → Jira khi đẩy điểm). Đồng bộ hai chiều liên tục để sau, khi thấy thật sự cần.

## 5. Thiết kế UI, icon và hiệu ứng vui nhộn

Giao diện lấy cảm hứng từ một bàn chơi bài: mọi người ngồi quanh bàn, lá bài úp trước mặt, task nằm giữa bàn. Phong cách minh họa phẳng, màu tươi, bo tròn, có nhân vật riêng cho công ty.

**Bố cục màn hình phòng chơi**

- Giữa: "bàn chơi" với task hiện tại (tiêu đề, mô tả, acceptance criteria thu gọn được).
- Quanh bàn: nhân vật của từng thành viên, lá bài úp trước mặt khi đã chọn.
- Dưới cùng: bộ bài của mình, dạng quạt bài; kéo thả hoặc bấm để chọn.
- Bên phải: danh sách task của buổi, tiến độ (ví dụ 4/12 task), khung câu hỏi và ghi chú.
- Có chế độ sáng/tối và giao diện điện thoại (bàn chơi thu thành danh sách dọc).

**Nhân vật và icon**

- Bộ nhân vật riêng (mèo, capybara, robot, khủng long…), có thể thêm linh vật của công ty.
- Nhân vật có trạng thái: đang nghĩ (bong bóng suy nghĩ), đã chọn (giơ bài úp), ngủ gật khi chưa chọn quá lâu, ăn mừng khi chốt điểm.
- Mỗi lá bài đặc biệt có icon riêng, dễ nhận ra từ xa: tách cà phê (nghỉ giải lao), dấu hỏi (chưa đủ thông tin), con bọ (có mùi bug), quả bom (rủi ro cao), mảnh ghép (dependency), vô cực (task quá lớn).
- Mở khóa trang phục, phụ kiện theo số buổi tham gia. Chỉ thưởng cho việc tham gia, không thưởng cho "chọn đúng".

**Hiệu ứng theo khoảnh khắc**

| Khoảnh khắc | Hiệu ứng | Thời lượng tối đa |
| --- | --- | --- |
| Có người chọn bài | Lá bài bay từ tay vào bàn, úp xuống | 0,3 giây |
| Trước khi lật | Đếm ngược 3-2-1, tiếng trống ngắn (tắt được) | 1,5 giây |
| Lật bài | Các lá bài lật lần lượt rất nhanh, theo nhịp | 1 giây |
| Đồng thuận | Confetti, nhân vật ăn mừng | 2 giây |
| Chênh lệch lớn | "Plot twist": hai lá cao nhất và thấp nhất phóng to, đèn sân khấu chiếu vào hai người đó, mời họ nói trước | 1,5 giây |
| Chốt điểm | Con dấu "đóng" lên task, task trượt sang cột đã xong | 0,8 giây |
| Hết buổi | Màn hình tổng kết vui: số task, số vòng, lá bài đặc biệt được dùng nhiều nhất | — |

Chênh lệch lớn được thể hiện như một khoảnh khắc **hấp dẫn** (plot twist, đèn sân khấu), không phải tiêu cực (sấm chớp, báo động). Thông điệp là: chỗ này đáng bàn.

**Reaction và tương tác nhỏ**

- Thả emoji bay lên trên màn hình (vỗ tay, cười, suy nghĩ, ngạc nhiên); giới hạn tần suất để không spam.
- Ném vật nhẹ nhàng vào nhân vật đang ngủ gật (giấy vo, máy bay giấy) để nhắc chọn bài.
- Vòng quay chọn người giải thích trước khi không ai muốn nói.

**Gamification lành mạnh**

| Nên có | Không làm | Lý do |
| --- | --- | --- |
| Danh hiệu "Người đặt câu hỏi hay", "Người phát hiện rủi ro" | "Kẻ phá vỡ đồng thuận" | Không gán nhãn xấu cho người dám chọn khác |
| Huy hiệu tham gia, chuỗi buổi liên tiếp | "Nhà tiên tri" (đoán trúng điểm chốt) | Tránh thưởng cho việc đoán ý số đông |
| Thống kê vui ở cấp nhóm (số câu hỏi được làm rõ) | Thanh "team harmony" tăng khi đồng thuận nhanh | Đồng thuận nhanh không đồng nghĩa ước lượng đúng |
| Icebreaker ngắn giữa các task (tùy chọn) | Đoán trước ai sẽ chọn cao nhất | Gây thiên kiến neo (anchoring) trước khi bỏ phiếu |
| Chủ đề giao diện theo mùa (Tết, Halloween, Noel) | Bảng xếp hạng cá nhân | Không biến buổi ước lượng thành cuộc thi |

Người dùng tự chọn mức độ: **Đầy đủ** (mọi hiệu ứng và âm thanh), **Vừa phải** (hiệu ứng, không âm thanh), **Tối giản** (chỉ chuyển động cần thiết). App tự chọn Tối giản khi hệ điều hành bật giảm chuyển động (reduced motion).

## 6. Hiệu năng: chống lag

Hiệu ứng đẹp chỉ có giá trị khi chạy mượt. Đây là yêu cầu bắt buộc, được kiểm thử trước mỗi lần phát hành, không phải phần làm thêm.

**Chỉ tiêu (đề xuất, cần chốt)**

| Chỉ tiêu | Mục tiêu |
| --- | --- |
| Tốc độ khung hình khi chạy hiệu ứng | 60 fps trên laptop văn phòng phổ thông; không dưới 30 fps trên điện thoại tầm trung |
| Độ trễ từ lúc một người chọn bài đến lúc người khác thấy | Dưới 300 ms trong cùng khu vực mạng |
| Thời gian mở phòng lần đầu | Dưới 3 giây |
| Số người trong một phòng | Mượt với 20 người; chịu được 50 người |
| Vào lại phòng sau khi rớt mạng | Tự kết nối lại, khôi phục đúng trạng thái, không mất phiếu |

**Nguyên tắc kỹ thuật cho hiệu ứng**

- Chỉ animate `transform` và `opacity` (chạy trên GPU); tránh animate kích thước, vị trí theo layout hay bóng đổ lớn.
- Confetti, hạt (particle) vẽ trên canvas, giới hạn số hạt; tự giảm khi máy yếu.
- Hiệu ứng chạy cục bộ trên máy từng người. Server chỉ gửi sự kiện nhỏ ("đã lật", "đã chọn"), không gửi khung hình hay trạng thái hiệu ứng.
- Tài nguyên nặng (âm thanh, sprite nhân vật, chủ đề theo mùa) tải trễ (lazy-load) và lưu cache; phòng mở được trước khi tải xong.
- App đo fps thực tế; nếu tụt kéo dài thì tự hạ xuống mức Vừa phải hoặc Tối giản và báo nhẹ cho người dùng.
- Reaction được gộp và giới hạn tần suất để 20 người cùng bấm không làm nghẽn.

**Realtime**

- Dùng WebSocket (hoặc dịch vụ realtime tương đương). Server là nguồn sự thật duy nhất cho phiếu và trạng thái vòng.
- Phiếu được giữ kín trên server đến lúc lật. Trình duyệt của người khác không nhận giá trị phiếu trước đó, để không ai mở công cụ dev ra xem trộm được.
- Host rời phòng hoặc rớt mạng quá 60 giây: quyền host tự chuyển cho người kế tiếp được chỉ định, hoặc người vào sớm nhất.

## 7. Bảo mật, quyền và dữ liệu

App mở ra bên ngoài công ty, nên tài khoản, mật khẩu phòng và dữ liệu Jira phải được bảo vệ ngay từ bản đầu tiên.

- **Đăng nhập**: email và mật khẩu; mật khẩu băm bằng thuật toán chuyên dụng (bcrypt hoặc Argon2); có quên mật khẩu qua email; giới hạn số lần đăng nhập sai.
- **Khách**: định danh bằng mã ngẫu nhiên lưu trong cookie/localStorage, chỉ kèm tên hiển thị và nhân vật; không truy cập được Jira và không lưu lịch sử lâu dài.
- **Phòng**: công khai hoặc có mật khẩu; mật khẩu phòng được băm khi lưu; giới hạn số lần nhập sai để chống dò mật khẩu. Host có thể đổi mật khẩu, mời ra khỏi phòng (kick), khóa phòng hoặc bật duyệt.
- **Link phòng**: dùng mã ngẫu nhiên khó đoán, không dùng số tăng dần.
- **Quyền Jira**: app không bao giờ cho người dùng xem hoặc sửa issue mà họ không có quyền trên Jira.
- **Token**: token Jira mã hóa khi lưu, không gửi về trình duyệt, thu hồi được bất cứ lúc nào.
- **Lưu trữ**: phiếu từng người, ghi chú và lịch sử phòng lưu tối đa một thời hạn do công ty chọn (đề xuất 12 tháng), sau đó tự xóa.
- **Không đánh giá cá nhân**: không có báo cáo "ai ước lượng sai nhiều nhất". Thống kê chỉ ở cấp nhóm hoặc cấp task.
- **Nhật ký**: ghi lại ai đẩy điểm nào lên Jira, lúc nào, để tra soát khi cần.

## 8. Thiết kế mở rộng: phiên đánh giá tổng quát

Hệ thống không đóng cứng vào story point. Mỗi phòng là một **phiên đánh giá (session)** gồm 7 thành phần; Planning Poker chỉ là template mặc định. Nhờ vậy, sau này thêm chấm ưu tiên, đánh giá rủi ro, ra quyết định hay retro mà không phải viết lại lõi hệ thống.

**Bảy thành phần của một phiên**

| Thành phần | Ý nghĩa | Planning Poker (mặc định) | Risk Poker | Retrospective |
| --- | --- | --- | --- | --- |
| Đối tượng cần đánh giá (items) | Thứ được bỏ phiếu | Task/issue Jira | Tính năng, bản phát hành | Ý kiến do thành viên gửi |
| Tiêu chí hoặc bộ bài (criteria/scale) | Thang chấm; một hoặc nhiều tiêu chí | 1 tiêu chí: công sức, bộ Fibonacci | 3 tiêu chí: kỹ thuật, bảo mật, vận hành, thang 1–5 | 1 tiêu chí: số phiếu bình chọn |
| Cơ chế bỏ phiếu (voting) | Cách mỗi người bỏ phiếu | Chọn 1 lá bài, bí mật | Chấm từng tiêu chí, bí mật | Ẩn danh, mỗi người N phiếu (dot voting) |
| Quy tắc mở kết quả (reveal rule) | Khi nào lộ phiếu | Host lật, hoặc đủ phiếu, hoặc hết giờ | Như Planning Poker | Khi hết thời gian gửi ý kiến |
| Điều kiện cần thảo luận (discussion trigger) | Khi nào app yêu cầu bàn thêm | Chênh lệch từ 2 bậc | Bất kỳ tiêu chí nào chấm từ 4 trở lên | Chủ đề nhiều phiếu nhất |
| Kết quả cuối cùng (outcome) | Thứ được chốt | Điểm story point | Mức rủi ro + biện pháp giảm thiểu | Chủ đề cần xử lý + người phụ trách |
| Bộ tích hợp (integration) | Nhận và gửi dữ liệu | Kéo issue, ghi Story Points vào Jira | Ghi nhãn/trường rủi ro vào Jira | Tạo task hành động trên Jira |

Hai cột Risk Poker và Retrospective là ví dụ minh họa cách cùng một khung chạy các template khác nhau; chi tiết sẽ chốt khi làm template đó.

**Các template dự kiến**

| Template | Hướng mở rộng gom vào | Đối tượng và tiêu chí | Kết quả |
| --- | --- | --- | --- |
| Estimate (mặc định) | Planning Poker, Async estimation | Task; công sức theo Fibonacci, T-shirt, giờ/ngày | Điểm ước lượng |
| Prioritize | Prioritization Poker, Product Discovery | Ý tưởng, tính năng; giá trị, tác động, chi phí, hoặc ICE/RICE | Thứ tự ưu tiên |
| Assess Risk | Risk Poker, Confidence Vote, Release readiness | Tính năng, bản phát hành, deadline; rủi ro theo loại, mức tự tin, mức sẵn sàng theo bộ phận | Mức rủi ro hoặc quyết định go/no-go |
| Make a Decision | Decision Poker, Workshop/brainstorm | Các phương án kiến trúc, thiết kế, sản phẩm; tiêu chí do nhóm đặt | Phương án được chọn + lý do |
| Run a Retro | Retrospective | Ý kiến ẩn danh, gom nhóm thành chủ đề; dot voting | Chủ đề cần thảo luận + việc cần làm |

**Mô hình dữ liệu cần có từ đầu**

- Session: thuộc một template, giữ cấu hình của 7 thành phần; template chỉ là bộ cấu hình mặc định, host chỉnh được.
- Item: đối tượng chung, có nguồn (tạo tay, Jira…) và mã tham chiếu ngoài (ví dụ issue key).
- Criterion và Scale: một phiên có thể có nhiều tiêu chí; mỗi tiêu chí có một thang (bộ bài số, T-shirt, 1–5, có/không). MVP chỉ dùng 1 tiêu chí, nhưng dữ liệu hỗ trợ nhiều tiêu chí ngay từ đầu.
- Vote: gắn với item, tiêu chí, người bỏ phiếu và số vòng; có cờ ẩn danh.
- Reveal rule: thủ công, khi đủ phiếu, khi hết giờ, hoặc vào một thời điểm hẹn trước (phục vụ Async estimation).
- Outcome: giá trị chốt + ghi chú + người chốt; kiểu dữ liệu tùy template (số, thứ hạng, phương án, danh sách việc).
- Integration adapter: giao diện chung gồm "lấy danh sách item" và "ghi kết quả", kèm bảng ánh xạ trường. Jira là adapter đầu tiên; Linear, GitHub, Azure DevOps, Trello, Notion thêm sau theo cùng giao diện.

Chi phí làm khung tổng quát ngay từ đầu nhỏ hơn nhiều so với viết lại sau này. Tuy vậy, giao diện MVP chỉ hiện template Estimate để giữ sản phẩm gọn; các template khác mở dần theo lộ trình.

## 9. Lộ trình phát hành

Ra mắt một bản MVP gọn nhưng đã đẹp và mượt, cho 2 team dùng thử trước, rồi mới mở rộng. Tiêu chí qua cổng là đề xuất, cần chốt cùng các team.

&#91;embedded content: lộ trình · 3 giai đoạn, 2 cổng kiểm tra\]

Giai đoạn 1 đã có đủ hiệu ứng cho các khoảnh khắc chính, vì đó là lý do mọi người muốn dùng app. Phần mở rộng như trang phục, chủ đề mùa để sang giai đoạn 2.

Sau giai đoạn 3, mở lần lượt các template Prioritize, Make a Decision, Run a Retro (mục 8), rồi đến các tích hợp ngoài Jira.

**Cố ý không làm**

- Bảng xếp hạng cá nhân, hay báo cáo "ai ước lượng sai".
- Quy đổi story point sang giờ làm để đánh giá năng suất.
- Đồng bộ hai chiều liên tục với Jira trong giai đoạn đầu.
- Tích hợp công cụ khác ngoài Jira trong các giai đoạn đầu. Kiến trúc adapter (mục 8) để sẵn cho Linear, GitHub, Azure DevOps, Trello, Notion khi có nhu cầu.

## 10. Câu hỏi mở cần chốt

- [ ] Công ty dùng Jira Cloud hay Jira Data Center (bản tự host)? Câu trả lời quyết định cách kết nối và xác thực.
- [ ] Trường Story Points đang dùng là trường nào ở từng project? Có team nào dùng T-shirt size không?
- [ ] Có cần xác minh email khi đăng ký không, và khi nào thêm đăng nhập Google/SSO?
- [ ] App chạy trên hạ tầng nội bộ hay cloud? Có yêu cầu dữ liệu phải lưu tại Việt Nam không?
- [ ] Hai team nào dùng thử giai đoạn 1, và ai là người chốt phản hồi?
- [ ] Có làm nhân vật/linh vật riêng của công ty không? Nếu có, ai thiết kế?
- [ ] Ngôn ngữ giao diện: chỉ tiếng Việt, hay cả tiếng Anh?
- [ ] Thời hạn lưu dữ liệu phòng và lịch sử phiếu: 12 tháng có phù hợp không?
