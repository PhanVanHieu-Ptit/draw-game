# PROGRESS

> Bảng bên dưới giữa hai marker được **sinh tự động** từ [`tasks.json`](./tasks.json) (`node docs/ai-planning/tools/plan.mjs render`). Phần "Nhật ký tiến độ" phía dưới là của con người/agent viết tay.
>
> **Không tự đánh dấu task hoàn thành khi chưa kiểm chứng.** Trạng thái chỉ đổi qua `plan.mjs set` và `done` bắt buộc có evidence (lệnh + kết quả + commit).

<!-- BEGIN GENERATED -->
### Tổng hợp

| Trạng thái | Số task |
|---|---:|
<<<<<<< Updated upstream
| not_started | 55 |
| in_progress | 0 |
=======
| not_started | 50 |
| in_progress | 1 |
>>>>>>> Stashed changes
| blocked | 1 |
| needs_clarification | 2 |
| needs_review | 0 |
| failed | 0 |
| done | 7 |
| cancelled | 0 |
| **Tổng** | **65** |

SP hoàn thành (đã xác minh): **12 / 189** (đã xếp sprint: 12 / 168). Sprint hiện tại: **S0**.

### Theo sprint

| Sprint | Task done / tổng | SP done / tổng |
|---:|---:|---:|
| S0 | 7 / 10 | 12 / 19 |
| S1 | 0 / 10 | 0 / 21 |
| S2 | 0 / 8 | 0 / 22 |
| S3 | 0 / 7 | 0 / 21 |
| S4 | 0 / 6 | 0 / 22 |
| S5 | 0 / 7 | 0 / 24 |
| S6 | 0 / 8 | 0 / 24 |
| S7 | 0 / 5 | 0 / 15 |

### Quyết định của chủ dự án

| ID | Cần trước S | Trạng thái | Lựa chọn | Ngày | Ghi chú |
|---|---:|---|---|---|---|
| DEC-01 | 2 | open | — | — |  |
| DEC-02 | 2 | open | — | — |  |
| DEC-03 | 3 | open | — | — |  |
| DEC-04 | 3 | open | — | — |  |
| DEC-05 | 5 | open | — | — |  |
| DEC-06 | 6 | open | — | — |  |
| DEC-07 | 6 | open | — | — |  |
| DEC-08 | 1 | open | — | — |  |
| DEC-09 | 5 | open | — | — |  |
| DEC-10 | 1 | open | — | — |  |

### Từng task

| Task | Sprint | Trạng thái | Hoàn thành | Evidence |
|---|---|---|---|---|
| ADM-01 | S0 | done | 2026-11-10 | Sửa admin/server/app.mjs hàm body(): gom các chunk Buffer, cộng size += chunk.length, ném 413 khi vư |
| FND-01 | S0 | blocked | — | Đã xong FND-01.1–.2 (agent): baseline git ls-files node_modules = 327 (3 file .node native); tạo .gi |
| FND-02 | S0 | done | 2026-11-10 | Thêm engines.node '>=22.12.0' vào package.json (sau packageManager) và admin/package.json (đọc lại c |
| FND-03 | S0 | not_started | — | — |
| SEC-01 | S0 | done | 2026-11-10 | Sửa 2 đường CMS→innerHTML (không phải 1 như kế hoạch): (1) src/ui/UIManager.js — thêm helper setButt |
| TST-01 | S0 | done | 2026-11-10 | Baseline (TST-01.1): mô phỏng in-process nguyên logic cũ 1247/4000 = 31.2% đỏ (khớp ~32% lý thuyết:  |
| TST-02 | S0 | done | 2026-11-10 | TST-02.1: quét lại 28 file test (test-*.js, scripts/test-*.js, tests/*.test.js) — trước: chỉ test-pe |
| TST-03 | S0 | done | 2026-11-10 | Tạo scripts/run-tests.mjs (runner tuần tự, không dừng ở lỗi đầu; fail khi exit≠0/timeout/signal, hoặ |
| FND-05 | S0 | not_started | — | — |
| IPA-02 | S0 | done | 2026-11-10 | Xoá 2 URL dự phòng https://www.google.com/logos/2016/halloween16/r4/… khỏi danh sách candidates ở sr |
| ADM-02 | S1 | not_started | — | — |
| ADM-03 | S1 | not_started | — | — |
| ADM-04 | S1 | not_started | — | — |
| FND-04 | S1 | not_started | — | — |
| IPA-01 | S1 | in_progress | — | — |
| SEC-02 | S1 | not_started | — | — |
| SEC-03 | S1 | not_started | — | — |
| TST-04 | S1 | not_started | — | — |
| TST-05 | S1 | not_started | — | — |
| TST-06 | S1 | not_started | — | — |
| ARC-01 | S2 | not_started | — | — |
| ARC-04 | S2 | not_started | — | — |
| ARC-06 | S2 | not_started | — | — |
| BAL-01 | S2 | not_started | — | — |
| RUN-01 | S2 | not_started | — | — |
| TST-07 | S2 | not_started | — | — |
| UXL-05 | S2 | not_started | — | — |
| RUN-02 | S2 | not_started | — | — |
| BAL-02 | S3 | not_started | — | — |
| BAL-03 | S3 | not_started | — | — |
| IPA-03 | S3 | not_started | — | — |
| IPA-05 | S3 | not_started | — | — |
| RUN-03 | S3 | not_started | — | — |
| RUN-04 | S3 | not_started | — | — |
| RUN-06 | S3 | not_started | — | — |
| IPA-04 | S4 | not_started | — | — |
| IPA-06 | S4 | not_started | — | — |
| RUN-05 | S4 | not_started | — | — |
| RUN-07 | S4 | not_started | — | — |
| RUN-08 | S4 | not_started | — | — |
| RUN-09 | S4 | not_started | — | — |
| ADM-07 | S5 | not_started | — | — |
| ARC-02 | S5 | not_started | — | — |
| IPA-07 | S5 | not_started | — | — |
| OPS-01 | S5 | not_started | — | — |
| OPS-02 | S5 | not_started | — | — |
| OPS-03 | S5 | not_started | — | — |
| OPS-04 | S5 | not_started | — | — |
| ADM-05 | S6 | not_started | — | — |
| ADM-06 | S6 | not_started | — | — |
| MOD-01 | S6 | not_started | — | — |
| OPS-05 | S6 | not_started | — | — |
| UXL-01 | S6 | not_started | — | — |
| UXL-02 | S6 | not_started | — | — |
| UXL-03 | S6 | not_started | — | — |
| UXL-04 | S6 | not_started | — | — |
| REL-01 | S7 | not_started | — | — |
| REL-02 | S7 | not_started | — | — |
| REL-03 | S7 | not_started | — | — |
| REL-05 | S7 | not_started | — | — |
| REL-04 | S7 | not_started | — | — |
| ARC-03 | parking | not_started | — | — |
| ARC-05 | parking | not_started | — | — |
| MOD-02 | parking | needs_clarification | — | Mô tả task tự nêu "phạm vi sẽ được tinh chỉnh theo đặc tả MOD-01": chưa có lược đồ sự kiện, chính sá |
| OPS-06 | parking | needs_clarification | — | Task 8 SP chỉ có 4 bước và còn lựa chọn mở "MFA (TOTP) hoặc tích hợp OIDC" chưa chốt. Cần tách thành |
<!-- END GENERATED -->

## Nhật ký tiến độ

Ghi theo thứ tự thời gian (mới nhất ở trên). Mỗi dòng: `YYYY-MM-DD — <Task ID> — <việc đã làm / bằng chứng / vấn đề>`.

- 2026-11-10 — (Sprint 0, phiên thực thi đầu tiên) — **7/10 task, 12/19 SP `done`; dừng vì blocker cần chủ dự án.** Làm theo thứ tự TST-01 → TST-02 → TST-03 → (FND-01 làm dở rồi `blocked`) → ADM-01 → SEC-01 → FND-02 → IPA-02; chi tiết và lệnh kiểm chứng trong evidence của từng task (`plan.mjs show <ID>`). **Chờ chủ dự án:** FND-01.3 `git rm -r --cached node_modules` (chỉ đổi index, giữ file trên đĩa); xong bước đó thì FND-03 (README) và FND-05 (CI) mới mở khoá — đây là Exit Criteria "chủ dự án đã duyệt thao tác gỡ index". **Chưa commit gì:** toàn bộ thay đổi nằm trong working tree nhánh `content-management` (commit/đổi nhánh cần duyệt theo EXECUTION_RULES §4), kể cả `.gitignore` mới. **Artifact chưa rebuild:** SEC-01 và IPA-02 sửa mã game (`src/`), nên `dist/` và `arcane-paws-standalone.html` (được track) vẫn chứa sink XSS và URL Google cũ cho tới khi `npm run build` + commit cùng lúc. **Baseline mới:** `npm test` = `scripts/run-tests.mjs`, 27 suite xanh + 3 quarantine (TST-04/05/06), ~9–11 s, exit 0 (~1387 assertion đọc từ output); `npm run test:admin` = 21 backend + 10 UI, exit 0. **Tiêu chí Sprint "npm test xanh 20 lần liên tiếp" đạt:** 20/20 lần exit 0 (192 s, mỗi lần 27 suite). **Phát hiện ngoài kế hoạch:** (1) SEC-01 có ĐƯỜNG XSS THỨ HAI mà kế hoạch bỏ sót — `Game.js:3024` đưa tiêu đề mảnh ký ức (CMS) chưa escape vào toast; đã vá và thêm `src/core/Game.js` vào `affectedFiles` của SEC-01; (2) runner quét TOÀN BỘ output nên một suite không được in chuỗi `<n> Failed` (n>0) hoặc `❌ FAIL` kể cả trong tên test; (3) tỉ lệ flaky blood-moon đo lại: mô phỏng in-process 31,2% (1247/4000, khớp lý thuyết) nhưng chạy tiến trình thật chỉ 9/54 ≈ 17%; (4) AC của TST-03 ghi 25 suite, thực tế 26 vì `tests/run-tests.test.js` cũng khớp mẫu orphan (nay 27 với `no-hotlinks`); (5) `plan.mjs next` cố ý gồm cả task `blocked` (để task hết chờ có thể chọn lại) nhưng không in trạng thái, nên FND-01 vẫn hiện ở mục SẴN SÀNG — đừng bắt đầu lại nó khi chưa có duyệt (`plan.mjs show FND-01` cho thấy `blocked` và lý do). Chưa làm: SPRINT_REPORT.md và cập nhật ROADMAP.md (Sprint chưa đủ Exit Criteria).

- 2026-11-10 — (kế hoạch v1.2.0) — Rà soát theo prompt "Agile Sprint Planner": chạy kiểm tra độc lập (không dùng `plan.mjs`) cho 7 điểm validation — ID trùng, dependency tồn tại, chu trình (DFS), AC, Goal/Exit Criteria của sprint, tổng SP, thứ tự thực thi — đều đạt; không có thay đổi cấu trúc sprint/task. **Sửa:** IPA-05 có tiêu chí grep `src/ui` nhưng thiếu `CharacterPortraits.js` và `StoryCanvasRenderer.js` ở bước và `affectedFiles` (agent làm đúng bước vẫn trượt tiêu chí của chính nó); bốn tiêu chí chấp nhận mơ hồ (ADM-03, ADM-06, IPA-05, MOD-02) được viết lại cụ thể và ADM-03/ADM-06 thêm lệnh kiểm chứng. **Thêm:** trạng thái `needs_clarification` và `failed` (bắt buộc evidence, được `set`/`validate`/`next` thực thi); MOD-02 và OPS-06 đặt `needs_clarification` vì tự mô tả phạm vi chưa chốt (OPS-06: 8 SP chỉ 4 bước, còn lựa chọn mở MFA hay OIDC); bảng "Tổng quan sprint" có trạng thái suy ra, tỷ lệ SP/sức chứa và dòng tổng 189 = 168 + 21. Quy mô không đổi: 65 task, 189 SP.
- 2026-11-10 — (kế hoạch v1.1.0) — Kiểm chứng lần 2 độc lập (cùng commit d101898, không file nguồn nào đổi; chi tiết PROJECT_ANALYSIS.md §9b). **Sửa số liệu:** độ flaky test blood-moon ~67% → ~1/3 (36/105 lần đo gộp; TST-01); TST-05 bổ sung assertion chập chờn. **Thêm:** GAP-312 + ARC-06 (vòng lặp game chịu lỗi, S2, 3 SP), GAP-204 + ADM-07 (ErrorBoundary Admin, S5, 2 SP), REQ-N11, RSK-25, `evidence/repro-game-loop.mjs`. **Sửa công cụ/tài liệu:** `plan.mjs validate` trước đây không hề đối chiếu bảng mốc ROADMAP (regex `/^M\d$/` đọc 0 hàng); ROADMAP §3 (đường găng) có mũi tên không phải phụ thuộc thật nên được viết lại theo `tasks.json` và `validate` nay kiểm từng mũi tên. Quy mô 63 → 65 task, 184 → 189 SP. Chưa task nào bắt đầu.
- 2026-11-10 — (kế hoạch) — Lập kế hoạch ban đầu từ phân tích repo tại commit d101898; chưa có task nào bắt đầu. Số liệu baseline: xem PROJECT_ANALYSIS.md §"Nhật ký xác minh".
