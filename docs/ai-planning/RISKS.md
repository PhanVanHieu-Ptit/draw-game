# RISKS

Sổ đăng ký rủi ro của dự án và của chính kế hoạch. **Khả năng / Tác động:** C = Cao, T = Trung bình, Th = Thấp. **Mức** = đánh giá tổng hợp (Cao nếu một trong hai là C và cái kia ≥ T). Mọi rủi ro mức Cao phải được xử lý hoặc chấp nhận bằng văn bản trước khi phát hành (Sprint 7 exit criteria).

Quy ước: các rủi ro dưới đây là phán đoán dựa trên bằng chứng đã nêu ở [GAP_ANALYSIS](./GAP_ANALYSIS.md); chỗ nào chưa đo được thì ghi rõ.

## 1. Rủi ro sản phẩm và kỹ thuật

| ID | Rủi ro | Kh. năng | Tác động | Mức | Giảm thiểu | Task / Quyết định |
|---|---|:---:|:---:|:---:|---|---|
| RSK-01 | **IP/bản quyền**: audio/sprite được ghi chú là trích từ Google Doodle, URL dự phòng tải từ google.com, tên "Magic Cat Academy" trùng tên Doodle. *Không phải kết luận pháp lý.* | C | C | **Cao** | Gỡ hotlink ngay (S0); kiểm kê; thay thế/gỡ trước phát hành công khai; thống nhất tên; LICENSE/NOTICES | IPA-01..07; DEC-03, DEC-04 |
| RSK-02 | **XSS từ nội dung CMS** vào game (`UIManager.js:843`); nếu game và admin chung origin, mã có thể gọi `/api` với phiên quản trị viên đang chơi | T | C | **Cao** | Vá sink; test hồi quy; server từ chối markup; CSP trong tài liệu triển khai | SEC-01, SEC-02, OPS-04 |
| RSK-03 | **Hỏng dữ liệu UTF-8** khi lưu story/nội dung lớn (U+FFFD chen vào tiếng Việt) — im lặng, không báo lỗi | T | C | **Cao** | Gom Buffer rồi decode một lần; test hồi quy tất định | ADM-01 |
| RSK-04 | **Cổng test không đáng tin**: đỏ khoảng 1/3 số lần do flaky (36/105 lần đo gộp), 1 test xanh giả, 6 suite ngoài cổng, không CI → hồi quy lọt qua hoặc bị bỏ qua vì "đỏ như mọi khi" | C | T | **Cao** | Runner trung thực + orphan guard + CI | TST-01..06, FND-05 |
| RSK-05 | **Mô hình content ↔ runtime không khớp** (thời gian tuyệt đối vs số lượng) → tích hợp sai hoặc phải làm lại | C | C | **Cao** | ADR + chủ dự án duyệt trước khi code; chế độ riêng không đụng Story/Endless; golden-master | DEC-02; RUN-01 |
| RSK-06 | **Hồi quy lõi** khi chèn nguồn spawn (RUN-04) hoặc tách `updatePlaying` (ARC-02) — hàm 517 dòng, test dùng fake-context | T | C | **Cao** | Harness + golden-master trước (ARC-01); refactor sau tích hợp, từng bước, commit riêng; dừng nếu golden-master lệch | ARC-01, ARC-02, RUN-04 |
| RSK-07 | **Hiệu năng trên thiết bị thật chưa được xác minh** (mock + Chrome headless trên máy dev) | T | C | **Cao** | Harness rAF-interval + hướng dẫn đo thủ công trên điện thoại trước phát hành | REL-02, REL-01 |
| RSK-08 | **Admin một tiến trình**: JSON store, session in-memory, một tài khoản; mất phiên khi restart; không chịu được đa instance | T | T | Trung bình | Repository + SQLite + session bền (nếu DEC-05 ≠ A); hướng dẫn triển khai tham chiếu | OPS-01..05; DEC-05 |
| RSK-09 | **Endpoint công khai cho game dùng chung tiến trình admin** với `no-store` → mỗi lượt mở game chạm admin; admin ngừng thì game vẫn chạy nhờ fallback nhưng không cập nhật | Th | T | Thấp | Xuất bản tĩnh + cache ngắn qua proxy/CDN | OPS-04, OPS-05 |
| RSK-10 | **GDD lệch code** khiến quyết định thiết kế dựa trên số liệu sai | T | T | Trung bình | BALANCE.md sinh từ code; GDD trỏ về; snapshot test cân bằng | BAL-01..03; DEC-01 |
| RSK-11 | **Phụ thuộc chưa được audit**; hai major Vite; cây phụ thuộc admin lớn | T | T | Trung bình | Audit baseline + Dependabot + bước CI | SEC-03 |
| RSK-12 | **Rò bí mật** do thiếu `.gitignore` gốc (chỉ `admin/.gitignore` ignore `.env`) | Th | C | Trung bình | `.gitignore` gốc ignore `.env*`; tuyệt đối không đọc/commit `.env` | FND-01 |
| RSK-13 | **Repo phình**: `node_modules` (31 MB) + 3 bản bundle trùng + asset trùng; `.git` 25 MB và tăng mỗi lần commit artifact | C | Th | Trung bình | Gỡ khỏi index (không viết lại lịch sử), chính sách artifact, dedupe asset | FND-01, FND-04, IPA-03 |
| RSK-14 | **Kích thước/phức tạp của `Game.js`, `Enemy.js`, `SoundSystem.js`** làm chậm mọi thay đổi và tăng xác suất lỗi | C | T | Trung bình | Harness + tách `updatePlaying`; controller tách dần (parking lot) | ARC-01, ARC-02, ARC-03 |
| RSK-15 | **Gimmick boss theo dữ liệu** đòi refactor `Enemy` lớn hơn dự kiến | T | T | Trung bình | Chỉ cho phép `config.gimmick` ghi đè mặc định; nếu quá lớn tách task | RUN-05 |
| RSK-16 | **Accessibility/zoom**: viewport chặn phóng to; hộp thoại thiếu ngữ nghĩa — có thể loại trừ người dùng và vi phạm WCAG 1.4.4 | T | T | Trung bình | Sprint 6 | UXL-03 |
| RSK-17 | **Boot chậm khi máy chủ cấu hình không phản hồi** (tối đa ~5 s trước khi game bắt đầu; chưa đo) | Th | T | Thấp | Nạp song song + màn chờ | UXL-05 |
| RSK-18 | **Chất lượng âm thanh/nhân vật nhánh dự phòng** kém hơn bản "authentic" khi gỡ asset | C | T | Trung bình | Chủ dự án chấp nhận đánh đổi hoặc cung cấp asset mới; chạy smoke ở cả hai chế độ | IPA-04; DEC-03, DEC-09 |
| RSK-25 | **Thiếu lớp chịu lỗi runtime**: một ngoại lệ ở `update()`/`render()` làm vòng lặp game dừng vĩnh viễn (đã tái hiện tất định, không thông báo); không có handler lỗi toàn cục; Admin SPA không có ErrorBoundary. Phơi nhiễm tăng khi dữ liệu CMS chảy vào đường update/render | T | T | Trung bình | Bọc khung bằng `try/catch` + đặt lại rAF trong `finally`, khôi phục canvas, màn hình khôi phục sau ≥ 3 khung lỗi liên tiếp, handler toàn cục chỉ ghi log; ErrorBoundary cho Admin; xếp trước RUN-03/04 | ARC-06, ADM-07 |

## 2. Rủi ro của quy trình lập kế hoạch/thực thi

| ID | Rủi ro | Kh. năng | Tác động | Mức | Giảm thiểu |
|---|---|:---:|:---:|:---:|---|
| RSK-19 | **Kế hoạch lỗi thời** so với code (đường dẫn, ID, dependency) khi dự án đi tiếp | T | T | Trung bình | `plan.mjs validate` trong CI (FND-05); mọi thay đổi kế hoạch qua `tasks.json` rồi `render` |
| RSK-20 | **Sức chứa sprint giả định sai** (20 SP; chưa có velocity thật) | T | Th | Thấp | Hiệu chỉnh sau Sprint 0 (đã nêu trong `meta.capacityNote`) |
| RSK-21 | **Xung đột chỉnh sửa song song** giữa các phiên/agent (đã từng xảy ra với `package.json` test script và các file đang được track) | T | Th | Thấp | Đọc lại file ngay trước khi sửa; commit nhỏ; không hoàn tác thay đổi không phải của mình ([EXECUTION_RULES](./EXECUTION_RULES.md)) |
| RSK-22 | **Agent tự quyết các điểm thuộc quyền chủ dự án** (DEC-xx) hoặc tự đánh dấu `done` khi chưa kiểm chứng | T | C | **Cao** | `plan.mjs set` từ chối `done` thiếu evidence/dependency/quyết định; agent không được gọi `decide` |
| RSK-23 | **Phụ thuộc đầu vào con người** (asset art/audio, giấy phép, duyệt ADR, bản dịch) làm trễ sprint | C | T | Trung bình | Nêu rõ `executor: agent+human` và bước [NGƯỜI]; xếp sớm các quyết định (`neededBy`) |
| RSK-24 | **Chọn phương án khác khuyến nghị** làm vô hiệu một phần kế hoạch (ví dụ DEC-02 = C, DEC-05 = A, DEC-07 = A) | T | T | Trung bình | Kế hoạch đã nêu rõ task nào bị hủy theo từng lựa chọn (SPRINT_PLAN); lập lại sau quyết định |

## 3. Chấp nhận rủi ro

Một rủi ro mức Cao chỉ được đóng bằng một trong hai cách: (a) task giảm thiểu đã `done` có evidence; (b) chủ dự án ghi **chấp nhận bằng văn bản** (ngày, lý do, người chấp nhận) vào bảng dưới đây.

| Rủi ro | Quyết định chấp nhận | Ngày | Người chấp nhận | Lý do |
|---|---|---|---|---|
| _(chưa có)_ | | | | |
