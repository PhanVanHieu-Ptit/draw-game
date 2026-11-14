# HỒ SƠ DỰ ÁN — Arcane Paws: Spellscribe

Cập nhật: 2026-11-11 · Chủ dự án: hieu · Scrum Master: Claude

> **Trạng thái khởi tạo: CHƯA HOÀN TẤT.** Đã xong bước 1–3 (đọc tài liệu, lập hồ sơ). Đang chờ bước 4: 5 câu hỏi ở mục 11.
> `BACKLOG.md`, `SPRINT.md`, `LICH_SU.md` **chưa được tạo**. Phiên sau thấy thiếu `BACKLOG.md` thì quay lại bước 4–5 của quy trình khởi tạo, đừng coi đây là dự án đang chạy.

Cách đọc: mỗi mục ghi *(nguồn)*. Chỗ tài liệu không nói thì ghi **giả định** (gom ở mục 9).

---

## 1. Tóm tắt và mục tiêu

- **Sản phẩm:** game 2D chạy trên trình duyệt, phong cách Magic Cat Academy. Người chơi là mèo phù thủy Momo, vẽ ký hiệu (rune) bằng chuột/cảm ứng để diệt u linh theo wave. UI và cốt truyện mặc định tiếng Việt. *(README.md; docs/GDD.md §1)*
- **Ba phần của repo:** Game (JS thuần, Canvas 2D, Web Audio, build bằng Vite ra một file HTML) · Admin Control Center (React + TS + Ant Design + API Node; CMS cho cấu hình, gameplay, story) · `shared/` (hợp đồng dùng chung). *(README.md)*
- **Tình trạng:** lõi game đã trưởng thành và được test dày. Khoảng trống nằm ở độ tin cậy của cổng chất lượng, việc nối Gameplay Content vào runtime, bảo mật nội dung và tuân thủ IP, không phải tính năng lõi. *(docs/ai-planning/PROJECT_ANALYSIS.md §1)*
- **Mục tiêu hiện tại:** đưa dự án tới **Release Candidate (M7)** qua 8 sprint S0–S7: 65 task, 168 SP đã xếp sprint + 21 SP parking lot. *(docs/ai-planning/ROADMAP.md, SPRINT_PLAN.md)*

| Mốc | Sprint | Kết quả kiểm chứng được *(ROADMAP.md §2)* |
|---|---|---|
| M0 | S0 | Baseline đáng tin: `npm test` xanh 20 lần liên tiếp, CI xanh trên PR, `node_modules` rời khỏi git, 3 lỗi chặn đã vá |
| M1 | S1 | Admin đúng và an toàn: lưu được gameplay ≥ 100 KB, ma trận quyền xanh, hết suite quarantine, kiểm kê asset/IP |
| M2 | S2 | Đặc tả chốt: ADR content↔runtime, loader có fallback, golden-master, smoke test trình duyệt, BALANCE.md |
| M3 | S3 | Content chạy trong game (alpha): timeline phát đúng thời điểm, hết 404 asset, tên sản phẩm thống nhất |
| M4 | S4 | Content hoàn chỉnh, asset tuân thủ: boss theo dữ liệu, chế độ "Chiến dịch tùy chỉnh", LICENSE/NOTICES |
| M5 | S5 | Production-ready, lõi dễ bảo trì: `updatePlaying` ≤ 60 dòng, SQLite + session bền, tài liệu triển khai |
| M6 | S6 | Trải nghiệm hoàn thiện: i18n, a11y, favicon/manifest, xuất bản tĩnh, spec module vận hành |
| M7 | S7 | Release candidate: E2E xanh trên CI, ngân sách bundle, checklist + CHANGELOG, go/no-go |

## 2. Phạm vi (trong phạm vi)

12 epic, 30 feature, 48 user story, 65 task. *(docs/ai-planning/BACKLOG.md "Tổng quan"; tasks.json)*

| Epic | Nội dung | Task | SP |
|---|---|---:|---:|
| EP-FND | Nền tảng repo và tooling | 5 | 10 |
| EP-TST | Độ tin cậy của test, cổng chất lượng | 7 | 14 |
| EP-ADM | Độ đúng đắn, củng cố Admin API | 7 | 16 |
| EP-SEC | Bảo mật nội dung, chuỗi cung ứng | 3 | 6 |
| EP-RUN | Tích hợp Gameplay Content vào runtime game | 9 | 30 |
| EP-BAL | Đồng bộ đặc tả, cân bằng | 3 | 8 |
| EP-IPA | IP, asset, thương hiệu | 7 | 21 |
| EP-MOD | Module vận hành (LiveOps / Players / Analytics) | 2 | 7 |
| EP-OPS | Sẵn sàng production cho Admin | 6 | 24 |
| EP-ARC | Khả năng bảo trì của game | 6 | 21 |
| EP-UXL | UX, accessibility, bản địa hóa | 5 | 17 |
| EP-REL | Sẵn sàng phát hành | 5 | 15 |
| **Tổng** | | **65** | **189** (168 đã xếp sprint + 21 parking) |

## 3. Ngoài phạm vi

- Viết lại lịch sử git; PWA offline đầy đủ / service worker; màn chọn spell loadout (cờ đã có, hoãn có chủ đích); đa tài khoản / IdP (parking OPS-06); chuyển cả game sang TypeScript; đổi engine; kiếm tiền / quảng cáo; backend cho bảng xếp hạng toàn cầu. *(ROADMAP.md §8; docs/combat.md)*
- Cấu hình từ xa không phải cơ chế chống gian lận và không phải bảng xếp hạng có thẩm quyền; không bắt buộc hai người duyệt. *(docs/configuration-management.md)*
- Parking lot, chưa xếp sprint (21 SP): MOD-02, OPS-06, ARC-03, ARC-05. *(SPRINT_PLAN.md)*

## 4. Người dùng

- **Người chơi:** Casual và Mid-core, thích phản xạ nhanh và vẽ cử chỉ; web, chuột và cảm ứng. *(docs/GDD.md, phần đầu)*
- **Vận hành viên Admin, 5 vai trò:** Super Admin, Game Designer, Content Editor, Analyst, Support. *(admin/README.md)*
- **Maintainer / người đóng góp:** theo README và EXECUTION_RULES. *(README.md "Contributing")*

## 5. Nhóm

- Chủ dự án kiêm lập trình: **hieu**. Git có hai danh tính ("hieu" 36 commit, "Phan Văn Hiểu …" 28 commit), cùng GitHub `PhanVanHieu-Ptit`. *(git shortlog, kiểm 2026-11-11)*
- Thực thi bằng **AI coding agent**: 52 task `agent`, 13 task `agent+human` (cần người cho asset, giấy phép, ADR, thao tác git ra ngoài). *(tasks.json)*
- **Giả định:** nhóm = 1 người + AI agent. Chỉ chủ dự án được quyết các `DEC-xx` và duyệt việc ra ngoài (push, PR). *(EXECUTION_RULES.md §1)*

## 6. Công nghệ *(PROJECT_ANALYSIS.md §3; package.json; README.md)*

| Thành phần | Công nghệ |
|---|---|
| Game | JavaScript ES modules, Canvas 2D, Web Audio; Vite 8 + vite-plugin-singlefile; pnpm 10 |
| Admin SPA | React 19.1, Ant Design 5.27, react-router 7.9, TypeScript 5.9 (strict), Vite 7.1; npm |
| Admin API | Node `http` thuần, scrypt, lưu `admin/.data/store.json`; một tiến trình, bind loopback |
| Test | Game: script Node tự viết, chạy qua `scripts/run-tests.mjs` + `tests/manifest.json`. Admin: `node --test`, Vitest + Testing Library + jsdom |
| CI | GitHub Actions `.github/workflows/ci.yml` (3 job: game, admin, plan); **chưa từng chạy trên GitHub** |
| Runtime | Node ≥ 22.12 (`.nvmrc` = 22). Repo: github.com/PhanVanHieu-Ptit/draw-game; quy trình nhánh tính năng → PR → main |

## 7. Ràng buộc

- **An toàn lệnh** *(.agent/rules/terminal-safety.md)*: không đọc `.env` hay khóa riêng. Cần duyệt trước khi cài/gỡ gói, tạo/sửa/xóa/di chuyển file, chạy build hoặc test có ghi file, đổi nhánh hoặc trạng thái git, gọi mạng, đổi biến môi trường. Cấm nếu không có ủy quyền rõ: `rm -rf`, `sudo`, `git push --force`, `git reset --hard`, `git clean -fd`, `curl | bash`.
- **Quy tắc thực thi** *(EXECUTION_RULES.md §1, §4, §5)*: không tự đánh dấu `done` khi chưa có evidence; không tự quyết `DEC-xx`; mỗi lần một task trong `affectedFiles`; không làm yếu test; không hoàn tác thay đổi không phải của mình; không viết lại lịch sử git; build thử ra thư mục tạm (không `npm run build` chỉ để kiểm tra vì nó ghi đè artifact đang được track).
- **Bất biến kiến trúc** *(ARCHITECTURE.md §3)*: lỗi nạp từ xa không làm hỏng game (fallback cục bộ); cấu hình/nội dung ghim bất biến theo ván; endpoint công khai chỉ trả bản đã publish; mutation Admin cần phiên + `X-Admin-Request` + Origin + quyền phía server + `revision`; văn bản CMS luôn hiển thị bằng `textContent`; `shared/` đẳng cấu; schema strict; test không được xanh giả; một ngoại lệ ở một khung hình không được làm dừng vòng lặp game.
- **Gotcha đã bị test khóa** *(EXECUTION_RULES.md §6)*: văn bản story; không `shadowBlur` ở đường vẽ minion; mock DOM tối giản trong test Node.
- **Đầu vào con người, không tự động hóa được** *(ROADMAP.md §6)*: quyết định DEC-01..10; duyệt ADR (RUN-01); asset art/audio và giấy phép (IPA-04); thiết bị thật để đo FPS (REL-02, UXL-03); duyệt dependency SQLite (OPS-02); mạng (SEC-03, CI).
- **Cổng phát hành** *(RISKS.md §3)*: mọi rủi ro mức Cao phải được xử lý (task giảm thiểu `done` có evidence) hoặc được chủ dự án chấp nhận bằng văn bản trước khi phát hành.

## 8. Definition of Done *(BACKLOG.md "Definition of Done chung"; EXECUTION_RULES.md §1; README.md "Contributing")*

Áp dụng cho mọi task:

- [ ] Mọi `verificationCommands` chạy xanh; lệnh + kết quả tóm tắt + commit được ghi vào `evidence`.
- [ ] Không hồi quy: `npm test` và `npm run test:admin` vẫn xanh; không xóa, skip hay nới assertion. Test hồi quy của bug phải ĐỎ trên mã cũ, XANH trên mã đã sửa.
- [ ] Chỉ chạm các file trong `affectedFiles` (chạm thêm thì ghi lý do vào evidence).
- [ ] Cập nhật tài liệu liên quan khi hành vi, API hoặc biến môi trường đổi.
- [ ] Đổi mã game thì xử lý artifact build theo chính sách hiện hành (trước FND-04: `npm run build`, commit `arcane-paws-standalone.html` và `dist/` cùng thay đổi nguồn).
- [ ] Commit nhỏ theo Conventional Commits, nêu Task ID, ví dụ `fix(admin): decode request body once (ADM-01)`; không trộn nhiều task.
- [ ] Chạm tài liệu kế hoạch thì `node docs/ai-planning/tools/plan.mjs validate` phải sạch.

Mỗi sprint còn có Exit Criteria riêng trong SPRINT_PLAN.md.

## 9. Giả định (tài liệu không nói, hoặc nói nhưng chưa xác minh)

| # | Giả định | Căn cứ |
|---|---|---|
| A1 | **Sprint dài 7 ngày** (không có ngày nghỉ cố định). | Tài liệu không nêu độ dài sprint; mặc định của quy trình là 1 tuần; lịch commit thực tế có cả T7/CN |
| A2 | **Năng lực 20 SP/sprint (±4)**; cam kết 80–90% = **16–18 SP**. | Docs cũng giả định ~20 SP nhưng ghi "CHƯA XÁC MINH" (`meta.capacityNote`) |
| A3 | **Velocity thực của S0 = 16 SP** (9/10 task, 16/19 SP) trong 2 ngày làm việc (2026-11-10 và 11-11). Nút cổ chai là duyệt của chủ dự án và đầu vào con người, không phải tốc độ viết mã (suy luận). | PROGRESS.md |
| A4 | Thang điểm 1-2-3-5-8-13; trên 8 phải chia nhỏ. Docs dùng 1/2/3/5/8 nên tương thích; hiện lớn nhất = 8 (IPA-04, OPS-06). | tasks.json |
| A5 | **MoSCoW suy từ P0–P3:** P0 và P1 = Must (22 task, 64 SP) · P2 = Should (25 task, 64 SP) · P3 = Could (14 task, 40 SP) · parking = Won't lần này (4 task, 21 SP). | BACKLOG.md "Mức ưu tiên" |
| A6 | Mỗi story có 2–4 tiêu chí nghiệm thu kiểm tra được. Hiện: 9 task có 2, 48 có 3, 7 có 4, **1 có 6 (ARC-06)** → xử lý ở `/lammin`. | tasks.json |
| A7 | Giữ nhãn sprint **S0–S7** của docs, không đánh số lại. | — |
| A8 | Nhóm = 1 người + AI agent (mục 5). | git shortlog |
| A9 | **Chưa có hạn chót cứng.** Ước tính (không cam kết): còn 152 SP đã xếp. Ở 20 SP/sprint cần 8 sprint → RC ≈ **2027-01-06**; ở 18 SP → 9 sprint ≈ 2027-01-13; ở 16 SP → 10 sprint ≈ 2027-01-20 (S1 bắt đầu 2026-11-12). ROADMAP chỉ có 7 sprint sau S0, tức 2026-12-30 nếu sprint nào cũng xong đủ 21–24 SP kế hoạch, cao hơn mức cam kết. | Tính từ tasks.json |
| A10 | Mọi `DEC-01..10` giữ ở phương án khuyến nghị làm giả định lập kế hoạch, như docs. Không agent nào được tự quyết. | SPRINT_PLAN.md |

## 10. Rủi ro mức Cao — trạng thái giảm thiểu đến 2026-11-11 *(RISKS.md; tasks.json)*

| Rủi ro | Giảm thiểu | Trạng thái |
|---|---|---|
| RSK-01 IP / bản quyền asset | IPA-01..07; DEC-03, DEC-04 | Mở. Mới xong IPA-02 (gỡ hotlink google.com) |
| RSK-02 XSS từ nội dung CMS | SEC-01, SEC-02, OPS-04 | Mở một phần. SEC-01 xong; SEC-02 và OPS-04 chưa |
| RSK-03 Hỏng UTF-8 khi lưu | ADM-01 | Giảm thiểu xong (ADM-01 `done`, test hồi quy có bằng chứng đỏ→xanh); chưa ghi đóng chính thức |
| RSK-04 Cổng test không tin cậy | TST-01..06, FND-05 | Mở một phần. TST-01/02/03 xong; TST-04/05/06 và FND-05 chưa |
| RSK-05 Mô hình content↔runtime lệch | RUN-01; DEC-02 | Mở. DEC-02 chưa quyết |
| RSK-06 Hồi quy lõi khi chèn spawn / tách `updatePlaying` | ARC-01, ARC-02, RUN-04 | Mở (S2, S3, S5) |
| RSK-07 Hiệu năng thiết bị thật chưa xác minh | REL-01, REL-02 | Mở (S7), cần điện thoại thật |
| RSK-22 Agent tự quyết điểm của chủ dự án | `plan.mjs` từ chối `done` thiếu evidence; agent không gọi `decide` | Có kiểm soát bằng công cụ |

Bảng "chấp nhận rủi ro bằng văn bản" trong RISKS.md hiện trống.

## 11. Mâu thuẫn, thiếu sót và câu hỏi đang chờ (bước 4)

**Phát hiện khi đối chiếu tài liệu:**

1. `tasks.json` là "nguồn sự thật duy nhất" và 3 file .md được sinh tự động, nhưng `plan.mjs set/decide` ghi lại các file đó. Va chạm với quy tắc "không sửa .md gốc".
2. Sprint 0 chưa đóng được: FND-05 `blocked` (cần PR thật trên GitHub).
3. DEC-08 và DEC-10 cần trước S1 nhưng còn `open`. DEC-10 bắt nguồn từ mâu thuẫn: admin/README và `policy.mjs` cho Analyst đọc Gameplay, trong khi API trả 403 và docs/gameplay-content-editors.md nói dùng quyền `configuration:*`.
4. Độ dài sprint, ngày bắt đầu, hạn chót và đích phát hành không có trong tài liệu nào.
5. Kế hoạch xếp S1–S6 ở 117–150% mức cam kết 16–18 SP (S1 21, S2 22, S3 21, S4 22, S5 24, S6 24; S7 15). Sẽ xử lý ở `/sprint` và `/lammin`.
6. Các mâu thuẫn đã có DEC riêng, chưa cần hỏi ngay: tên sản phẩm (GDD/README "Arcane Paws: Spellscribe" ≠ menu "Magic Cat Academy: Arcane Paws" ≠ Admin "Arcane Paws") → DEC-04, cần trước S3; GDD v1.0.0 lệch code (8 rune thay vì 6, công thức, DDA) → DEC-01, cần trước S2; standalone "100% self-contained" nhưng không nhúng asset → DEC-09, cần trước S5.

**Câu hỏi đang chờ** (trả lời "ok" hoặc sửa):

| # | Câu hỏi | Gợi ý |
|---|---|---|
| Q1 | Quan hệ giữa `scrum/` và `docs/ai-planning/` (nguồn chuẩn, quyền ghi) | `scrum/` chỉ là lớp điều phối (sprint, năng lực, daily, review), dùng đúng mã task có sẵn, không chép bước triển khai; `tasks.json` vẫn là nguồn chuẩn. Khi xong task, xin phép bạn từng lần rồi mới chạy `plan.mjs set`; `decide` chỉ chạy khi chính bạn quyết |
| Q2 | Đóng Sprint 0 thế nào khi FND-05 bị chặn | Đóng S0 với velocity thực 16 SP; FND-05 sang S1 làm đầu tiên; bạn tự `git push origin fix-bugs` rồi mở 2 PR (một xanh, một cố ý hỏng rồi đóng); Claude không push |
| Q3 | DEC-08 và DEC-10 (cần trước S1) | DEC-08 = A (chỉ track `arcane-paws-standalone.html`, ignore `dist/`, giữ pnpm root + npm admin); DEC-10 = A (namespace `gameplay:*`). Mở khóa FND-04 và ADM-03 |
| Q4 | Nhịp sprint, ngày bắt đầu, hạn chót | Sprint 7 ngày; S1 = Thứ Năm 2026-11-12 → Thứ Tư 2026-11-18, review + retro ngày cuối; cam kết 16–18 SP; không có hạn chót cứng |
| Q5 | Đích phát hành và các DEC muộn | Đích = phát hành công khai (RC ở S7). DEC-01..07 và DEC-09 giữ ở khuyến nghị làm giả định, chỉ hỏi lại đúng trước sprint cần: S2 (DEC-01, 02) · S3 (DEC-03, 04) · S5 (DEC-05, 09) · S6 (DEC-06, 07). Nếu chỉ là dự án cá nhân thì phạm vi giảm khoảng 38 SP (IPA-04/06, OPS-01..05 + ADM-05, UXL-01/02) |

## 12. Bối cảnh xuất phát (kiểm chứng 2026-11-11)

- **Kế hoạch:** `plan.mjs validate` → 0 lỗi, 0 cảnh báo (chạy trong phiên này). `meta.currentSprint` = 0.
- **S0:** 9/10 task, 16/19 SP `done`; FND-05 (3 SP) `blocked`: đã làm xong và mô phỏng CI cục bộ trên bản clone sạch, nhưng AC1/AC2 cần PR thật trên GitHub. *(tasks.json evidence, PROGRESS.md)*
- **`plan.mjs next --all`:** 14 task sẵn sàng (FND-05 hiện ở danh sách này dù đang `blocked`, do công cụ cố ý gồm task blocked); 5 task chờ quyết định (BAL-01, RUN-01, IPA-05, MOD-01, UXL-01); 33 chờ dependency; 2 cần tinh chỉnh (MOD-02, OPS-06).
- **Git:** nhánh `fix-bugs` tại `07facbc`, cây làm việc sạch. `origin/fix-bugs` đang ở `d74bec1`; 5 commit mới chỉ có ở máy (`8bfcfe1`, `0c243cb`, `0cefe6a`, `9d2edfd`, `07facbc`), gồm cả `ci.yml`. Máy chưa cài `gh`.
- **CI:** `ci.yml` chạy khi `push` vào `main` và mọi `pull_request`. Đẩy riêng nhánh `fix-bugs` **không** kích hoạt CI; phải mở PR.
- **Test baseline** theo evidence QA 2026-11-11, *chưa chạy lại trong phiên này*: `npm test` 27/27 suite + 3 quarantine; admin 21 backend + 10 UI; `tsc --noEmit` sạch.

## 13. Nhật ký quyết định quan trọng

| Ngày | Quyết định | Nguồn |
|---|---|---|
| 2026-11-10 | Kế hoạch `docs/ai-planning` v1.2.0 lập với mọi DEC ở phương án khuyến nghị (giả định, chưa phải quyết định của chủ dự án) | ROADMAP.md, SPRINT_PLAN.md |
| 2026-11-11 | Chủ dự án duyệt `git rm -r --cached node_modules` và commit riêng (FND-01) | PROGRESS.md |
| 2026-11-11 | Khởi tạo `scrum/`: Claude làm Scrum Master; chỉ đọc các .md gốc, không sửa/xóa/di chuyển; muốn sửa thì hỏi trước | Prompt của chủ dự án |
| — | DEC-01..DEC-10: tất cả còn `open` (đối chiếu `tasks.json` 2026-11-11) | tasks.json |

## 14. Tài liệu nguồn

Đã tìm 19 file .md (bỏ `node_modules`, `.git`, `dist`).

- **Đọc đầy đủ:** README.md · admin/README.md · .agent/rules/terminal-safety.md · docs/combat.md · configuration-management.md · gameplay-content-editors.md · story-cms.md · gesture-recognition-report.md · docs/ai-planning/ROADMAP.md · REQUIREMENTS.md · RISKS.md · EXECUTION_RULES.md · PROGRESS.md · ARCHITECTURE.md · PROJECT_ANALYSIS.md · SPRINT_PLAN.md
- **Đọc một phần:** docs/GDD.md (bỏ §5, các schema JSON dài) · docs/ai-planning/GAP_ANALYSIS.md (chỉ mục, 70/692 dòng) · docs/ai-planning/BACKLOG.md (4.015 dòng, chỉ đọc phần đầu; chi tiết task lấy từ `tasks.json` bằng lệnh chỉ-đọc)
- **Ngoài .md:** `docs/ai-planning/tasks.json` (nguồn chuẩn của kế hoạch) được tổng hợp bằng script chỉ-đọc; không đọc từng dòng.
- Không có file nào tên `todo`, `ke-hoach`, `spec`; các từ `plan`, `roadmap`, `backlog`, `sprint` chỉ có trong `docs/ai-planning/`.

## 15. Quy ước làm việc

- Trả lời tiếng Việt, ngắn gọn; mỗi lần cập nhật file trong `scrum/` thì báo ngắn gọn đã đổi gì; cuối mỗi câu trả lời gợi ý đúng 1 lệnh nên dùng tiếp.
- Chỉ đọc các .md gốc, không sửa/xóa/di chuyển; muốn đề xuất sửa thì hỏi trước.
- `/task`: chỉ làm trong phạm vi task; việc phát sinh ghi thành story mới.
- Nếu `/review` bị Claude Code coi là lệnh có sẵn (xem PR), hãy nói "tổng kết sprint".
- Phiên mới: đọc `scrum/`, báo sprint hiện tại đang ở đâu và gợi ý việc tiếp theo.
