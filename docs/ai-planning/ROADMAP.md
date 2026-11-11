# ROADMAP

Lộ trình ở mức mốc (milestone). **Nguồn chuẩn cho từng task/sprint là [SPRINT_PLAN.md](./SPRINT_PLAN.md)** (sinh từ `tasks.json`); bảng mốc dưới đây được `plan.mjs validate` đối chiếu — task nêu trong mỗi hàng phải đúng sprint của hàng đó.

Kế hoạch được lập với **mọi quyết định ở phương án khuyến nghị** và giả định ~20 SP/sprint (chưa có velocity thật — hiệu chỉnh sau Sprint 0). Quy mô: 65 task, 8 sprint, 168 SP đã xếp lịch + 21 SP ở parking lot (v1.1.0).

## 1. Nguyên tắc ưu tiên

1. **Niềm tin vào baseline trước tính năng mới** — cổng test trung thực, repo sạch, CI (không thể tích hợp an toàn khi `npm test` đỏ khoảng một lần trong ba).
2. **Vá sớm các lỗi gây mất dữ liệu hoặc bảo mật** khi chúng nhỏ và độc lập (hỏng UTF-8, XSS, hotlink).
3. **Đưa quyết định của chủ dự án lên sớm** — mỗi quyết định có sprint `neededBy`; task bị chặn không được bắt đầu khi quyết định còn mở.
4. **Tích hợp lớn (content runtime) chỉ sau khi có harness bảo vệ hành vi hiện tại** (golden-master) và đặc tả được duyệt (ADR).
5. **Refactor lõi vòng lặp sau tích hợp**, từng bước nhỏ, để tránh xung đột và hồi quy.
6. **Phát hành chỉ khi các rủi ro mức Cao trong [RISKS](./RISKS.md) đã được xử lý hoặc chấp nhận bằng văn bản.**

## 2. Mốc

| Mốc | Sprint | Kết quả kiểm chứng được | Task chính | Quyết định cần trước |
|---|---|---|---|---|
| M0 · Baseline đáng tin | S0 | `npm test` xanh 20 lần liên tiếp; CI xanh trên PR; `node_modules` rời khỏi git; 3 lỗi chặn nghiêm trọng đã vá có test hồi quy | FND-01, FND-03, FND-05, TST-01, TST-02, TST-03, ADM-01, SEC-01, IPA-02 | — |
| M1 · Admin đúng và an toàn | S1 | Lưu được tài liệu Gameplay ≥ 100 KB; ma trận quyền xanh; không còn suite quarantine; kiểm kê asset/IP; chính sách artifact áp dụng | ADM-02, ADM-03, ADM-04, SEC-02, SEC-03, TST-04, TST-05, TST-06, FND-04, IPA-01 | DEC-08, DEC-10 |
| M2 · Đặc tả chốt, nền tảng tích hợp | S2 | ADR content↔runtime được duyệt; loader có fallback; golden-master 5 kịch bản; smoke test trình duyệt; BALANCE.md; vòng lặp game không chết khi có ngoại lệ | RUN-01, RUN-02, BAL-01, ARC-01, ARC-04, ARC-06, UXL-05, TST-07 | DEC-01, DEC-02 |
| M3 · Content chạy trong game (alpha) | S3 | Timeline mẫu được phát lại đúng thời điểm trong mô phỏng tất định; không còn 404 asset; tên sản phẩm thống nhất | RUN-03, RUN-04, RUN-06, BAL-02, BAL-03, IPA-03, IPA-05 | DEC-03, DEC-04 |
| M4 · Content hoàn chỉnh, asset tuân thủ | S4 | Boss theo dữ liệu; chế độ "Chiến dịch tùy chỉnh" với pin/fallback; test tích hợp publish→spawn; asset thay thế; LICENSE/NOTICES | RUN-05, RUN-07, RUN-08, RUN-09, IPA-04, IPA-06 | — |
| M5 · Production-ready và lõi dễ bảo trì | S5 | `updatePlaying` ≤ 60 dòng, golden-master không đổi; repository + SQLite + session bền; tài liệu triển khai tham chiếu; standalone đúng hợp đồng; ErrorBoundary cho Admin | ARC-02, ADM-07, OPS-01, OPS-02, OPS-03, OPS-04, IPA-07 | DEC-05, DEC-09 |
| M6 · Trải nghiệm hoàn thiện | S6 | i18n runtime; a11y kiểm chứng bằng smoke; favicon/manifest; xuất bản tĩnh; retention; spec module vận hành | UXL-01, UXL-02, UXL-03, UXL-04, OPS-05, ADM-05, ADM-06, MOD-01 | DEC-06, DEC-07 |
| M7 · Release candidate | S7 | E2E (game + admin + audio + content) xanh trên CI; ngân sách bundle; harness FPS có baseline; checklist + CHANGELOG; go/no-go | REL-01, REL-02, REL-03, REL-04, REL-05 | — |

## 3. Đường găng

Mỗi mũi tên `A → B` dưới đây là một phụ thuộc **trực tiếp** (B cần A) và được `plan.mjs validate` đối chiếu với `tasks.json`; `X + Y → Z` nghĩa là Z cần cả X và Y. Mỗi dòng đúng một chuỗi.

**1. Tích hợp content (chuỗi dài nhất của kế hoạch: 10 task, 30 SP — tính từ `tasks.json`):**

- `TST-01 → TST-03 → UXL-05 → RUN-02 → RUN-03 → RUN-05 → RUN-07 → RUN-08 → REL-01 → REL-04`

Các nhánh nhập vào chuỗi trên:

- `DEC-02 → RUN-01 → RUN-02` (đặc tả chờ quyết định của chủ dự án và duyệt ADR)
- `TST-03 → ARC-01 → RUN-03` (harness bảo vệ hành vi hiện tại trước khi chèn nguồn spawn)
- `RUN-02 → RUN-04 → RUN-07`
- `RUN-03 → RUN-06 → RUN-07`
- `ADM-02 → RUN-08`
- `TST-07 → REL-01`

**2. Tin cậy kiểm thử:**

- `TST-01 + TST-02 → TST-03 → FND-05 → SEC-03`
- `TST-03 → ARC-01 → ARC-02 → REL-02`

**3. IP/asset** — dễ trễ nhất vì cần đầu vào con người (art/audio, giấy phép):

- `IPA-01 + IPA-02 → IPA-03 → IPA-04 → IPA-06`
- `IPA-04 → IPA-07`

DEC-03 phải được quyết định trước IPA-04. REL-04 không phụ thuộc cứng vào nhóm IPA, nhưng RSK-01 phải được xử lý hoặc chấp nhận bằng văn bản trước khi phát hành.

**4. Admin production:**

- `ADM-01 → ADM-02 → ADM-03 → OPS-01 → OPS-02 → OPS-03`
- `OPS-01 → ADM-05`
- `ADM-04 → OPS-04 → OPS-05`

## 4. Lịch quyết định của chủ dự án

| Cần trước | Quyết định | Nếu chọn khác khuyến nghị |
|---|---|---|
| S1 | DEC-08 artifact & package manager; DEC-10 mô hình quyền Gameplay | DEC-08 = B/C: điều chỉnh FND-04; DEC-10 = B: sửa README/UI thay vì policy (ADM-03) |
| S2 | DEC-01 nguồn sự thật cân bằng; DEC-02 mô hình runtime content | DEC-02 = C: **hủy nhóm RUN** (30 SP) và coi Studio là công cụ nháp; DEC-02 = B: đơn giản hóa RUN-04 |
| S3 | DEC-03 chính sách asset Doodle; DEC-04 tên sản phẩm | DEC-03 = C: IPA-04 thu hẹp; DEC-04 = C chỉ hợp lệ khi DEC-03 = B |
| S5 | DEC-05 phạm vi triển khai Admin; DEC-09 hợp đồng standalone | DEC-05 = A: **hủy OPS-01..05 và ADM-05**; DEC-05 = C: kích hoạt OPS-06 (parking) |
| S6 | DEC-06 lộ trình module vận hành; DEC-07 ngôn ngữ UI | DEC-07 = A: **hủy UXL-01/02** (10 SP); DEC-06 = B/C: MOD-02 vào kế hoạch |

## 5. Now / Next / Later

- **Now (S0–S1):** baseline và vá lỗi — không cần quyết định nào để bắt đầu Sprint 0.
- **Next (S2–S4):** chốt đặc tả → tích hợp content → tuân thủ asset.
- **Later (S5–S7 + parking):** refactor lõi, production-readiness, UX/i18n, phát hành. Parking lot: OPS-06 (đa tài khoản), ARC-03 (tách controller), ARC-05 (kiểm tra kiểu), MOD-02 (telemetry).

## 6. Đầu vào từ con người (không thể tự động hóa)

| Đầu vào | Cần cho | Ghi chú |
|---|---|---|
| Quyết định DEC-01..DEC-10 | xem §4 | ghi bằng `plan.mjs decide` |
| Duyệt ADR content↔runtime | RUN-01 | trước khi viết code RUN-02..09 |
| Phê duyệt thao tác thay đổi trạng thái git | FND-01, FND-04 | theo `.agent/rules/terminal-safety.md` |
| Asset art/audio mới hoặc giấy phép | IPA-04 | XL, dễ trễ nhất |
| Bản dịch `en` được duyệt | UXL-02 | chỉ khi DEC-07 = B |
| Thiết bị thật (điện thoại) để đo FPS/cảm ứng | REL-02, UXL-03 | CI không thay thế được |
| Duyệt thêm dependency SQLite | OPS-02 | cần `npm install` |
| Mạng | SEC-03 (audit), CI | không có trong giai đoạn phân tích |

## 7. Tín hiệu cần lập lại kế hoạch

- Velocity thực tế sau Sprint 0 lệch > 30% so với 20 SP.
- Chủ dự án chọn phương án khác khuyến nghị ở bất kỳ DEC-xx nào (xem §4).
- Task `L`/`XL` phát hiện phạm vi lớn hơn dự kiến → tách task.
- Một suite quarantine hóa ra là lỗi production thật (TST-04/05/06) → thêm task BUG và xếp lịch.
- Audit phụ thuộc (SEC-03) phát hiện lỗ hổng mức cao.
- Golden-master lệch trong ARC-02 mà không giải thích được → dừng refactor.

## 8. Ngoài phạm vi kế hoạch này

Viết lại lịch sử git (không khuyến nghị); PWA offline đầy đủ/service worker; màn chọn spell loadout (cờ đã có nhưng hoãn có chủ đích theo docs/combat.md); đa tài khoản/IdP (parking OPS-06); chuyển toàn bộ game sang TypeScript; đổi engine; kiếm tiền/quảng cáo; backend cho kỷ lục toàn cầu.
