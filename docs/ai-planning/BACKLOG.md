# BACKLOG — Epic → Feature → User Story → Task → Subtask

> **File sinh tự động từ [`tasks.json`](./tasks.json) bởi `tools/plan.mjs render`. KHÔNG sửa tay** — sửa `tasks.json` rồi chạy `node docs/ai-planning/tools/plan.mjs render`.

Baseline: nhánh `content-management`, commit `d101898`, kế hoạch v1.2.0 (2026-11-10).

## Quy ước

- Subtask = bước trong `implementationSteps`, đánh số suy ra `<TaskID>.<n>` (ví dụ FND-01.2).
- File mới trong `affectedFiles` có hậu tố ` (mới)`; validator kiểm tra mọi đường dẫn còn lại phải tồn tại.
- Task có `sprint: null` nằm trong "Parking lot" (có điều kiện/tùy chọn); task đã xếp sprint không được phụ thuộc task parking.
- Task `executor: human` hoặc `agent+human` cần người duyệt/đầu vào ở các bước đánh dấu [NGƯỜI].

### Thang độ phức tạp → Story Points

| Complexity | SP | Ý nghĩa |
|---|---:|---|
| XS | 1 | Sửa 1 file nhỏ, rủi ro thấp, < 1 giờ. |
| S | 2 | Tối đa 2–3 file, một mối quan tâm duy nhất, có test đi kèm. |
| M | 3 | 3–6 file hoặc 2 module; cần thiết kế nhỏ; có thể làm trong 1 phiên. |
| L | 5 | Xuyên nhiều module hoặc thay đổi lõi; PHẢI làm theo từng subtask, commit mỗi subtask. |
| XL | 8 | Cần đầu vào con người (asset, quyết định ngoài code); chỉ agent+human. |

### Mức ưu tiên

| Mức | Ý nghĩa |
|---|---|
| P0 | Chặn baseline đáng tin cậy hoặc gây mất dữ liệu/bảo mật nghiêm trọng — làm trước mọi thứ. |
| P1 | Cần cho giá trị cốt lõi hoặc tính đúng đắn; làm sớm. |
| P2 | Cải thiện quan trọng; lên lịch theo phụ thuộc. |
| P3 | Tùy chọn / có điều kiện / nợ kỹ thuật dài hạn. |

### Quy tắc trạng thái

- `done` chỉ được đặt khi: mọi dependency đã `done`, mọi verificationCommands đã chạy xanh, và `evidence` có ít nhất 1 mục (lệnh + kết quả + commit).
- Task bị chặn bởi quyết định `open` KHÔNG được chuyển sang `in_progress`.
- Agent không được tự đóng quyết định (DEC-xx); chỉ chủ dự án ghi nhận bằng `plan.mjs decide`.
- `blocked`, `needs_clarification` và `failed` BẮT BUỘC có evidence nêu lý do cụ thể (chờ ai/cái gì, câu hỏi nào, lệnh nào thất bại và đã thử gì). Không có evidence thì không đổi được sang các trạng thái này.
- `needs_clarification` = thiếu thông tin để thực hiện (phạm vi chưa chốt, lựa chọn chưa rõ) — cần tinh chỉnh task rồi mới chuyển lại `not_started`. `blocked` = đã đủ thông tin nhưng chờ thứ ngoài tầm tay (người, mạng, tài nguyên). `failed` = đã thử, lệnh kiểm chứng không xanh và không sửa được trong phạm vi task.
- Task bị chặn bởi quyết định `open` được coi là BLOCKED theo suy diễn (`plan.mjs next` liệt kê riêng ở mục "CHỜ QUYẾT ĐỊNH CHỦ DỰ ÁN"); KHÔNG đặt `blocked` thủ công cho trường hợp này vì trạng thái sẽ lỗi thời ngay khi `plan.mjs decide` chạy.
- Ánh xạ với từ vựng của prompt Sprint Planner: pending = `not_started`, review = `needs_review`, completed = `done` (xem `meta.statusAliases`).

## Definition of Done chung (áp dụng cho MỌI task)

- [ ] Mọi `verificationCommands` chạy xanh; lệnh + kết quả tóm tắt + commit được ghi vào `evidence` bằng `plan.mjs set <ID> done --evidence ...`.
- [ ] Không hồi quy: toàn bộ test gốc và test admin vẫn xanh; không xóa/skip/làm yếu assertion để làm xanh.
- [ ] Chỉ chạm các file trong `affectedFiles` (lý do chạm thêm phải ghi vào evidence).
- [ ] Tài liệu liên quan (docs/*.md, README) được cập nhật khi hành vi/API/biến môi trường đổi.
- [ ] Nếu đổi mã nguồn game: xử lý artifact build theo chính sách hiện hành (trước FND-04: `npm run build` rồi commit `arcane-paws-standalone.html` + `dist/`; sau FND-04: theo chính sách mới).
- [ ] Commit nhỏ theo Conventional Commits, mô tả nêu Task ID; không trộn nhiều task trong một commit.

## Tổng quan

- **65** task (61 đã xếp vào 8 sprint = 168 SP; 4 ở parking lot = 21 SP), **12** epic, **30** feature, **48** user story, **10** quyết định cần chủ dự án.

| Epic | Tiêu đề | Ưu tiên | Task | SP |
|---|---|---|---:|---:|
| [EP-FND](#ep-fnd) | Nền tảng repository & tooling | P0 | 5 | 10 |
| [EP-TST](#ep-tst) | Độ tin cậy của test & cổng chất lượng | P0 | 7 | 14 |
| [EP-ADM](#ep-adm) | Độ đúng đắn & củng cố Admin API | P1 | 7 | 16 |
| [EP-SEC](#ep-sec) | Bảo mật nội dung & chuỗi cung ứng | P1 | 3 | 6 |
| [EP-RUN](#ep-run) | Tích hợp Gameplay Content vào runtime game | P1 | 9 | 30 |
| [EP-BAL](#ep-bal) | Đồng bộ đặc tả & cân bằng | P2 | 3 | 8 |
| [EP-IPA](#ep-ipa) | IP, tài sản (asset) & thương hiệu | P1 | 7 | 21 |
| [EP-MOD](#ep-mod) | Module vận hành Admin (LiveOps / Players / Analytics) | P3 | 2 | 7 |
| [EP-OPS](#ep-ops) | Sẵn sàng vận hành production cho Admin | P2 | 6 | 24 |
| [EP-ARC](#ep-arc) | Khả năng bảo trì của game | P2 | 6 | 21 |
| [EP-UXL](#ep-uxl) | UX, accessibility & bản địa hóa | P2 | 5 | 17 |
| [EP-REL](#ep-rel) | Sẵn sàng phát hành | P1 | 5 | 15 |

## EP-FND

### Nền tảng repository & tooling

**Mục tiêu:** Repo tái lập được, sạch, có CI và tài liệu khởi động.  
**Ưu tiên epic:** P0

#### Feature FT-FND-1 — Repository tái lập được

Index git sạch, runtime/công cụ được ghim, README đủ để người mới chạy được.

##### Story US-FND-1

> Là maintainer, tôi muốn index git không chứa node_modules để clone/CI sạch và diff không bị nhiễu.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| FND-01 | Gỡ node_modules khỏi git và thêm .gitignore gốc | P0 | S (2) | S0 | blocked |

###### FND-01 — Gỡ node_modules khỏi git và thêm .gitignore gốc

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | chore / P0 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 0 |
| Người thực hiện | agent+human |
| Dependencies | — |
| Quyết định chặn | — |
| Gap liên quan | GAP-306 |
| Trạng thái | blocked |

**Mô tả.** Repo đang track 327 file trong `node_modules/` (31 MB, có cả binary native `rolldown-binding.darwin-arm64.node`) và KHÔNG có `.gitignore` ở gốc. `vite` dev ghi đè `node_modules/.vite/deps/_metadata.json` (file này cũng bị track) gây diff nhiễu; CI Linux không dùng được binary darwin. Chỉ gỡ khỏi index — KHÔNG viết lại lịch sử (.git hiện 25 MB).

**Affected files**

- `.gitignore (mới)`
- `node_modules/** (gỡ khỏi index, giữ nguyên trên đĩa)`

**Implementation steps (subtask)**

1. `FND-01.1` — Ghi baseline: `git ls-files node_modules | wc -l` (kỳ vọng 327) và `git status --short` (phải sạch).
2. `FND-01.2` — Tạo `.gitignore` gốc: `node_modules/`, `.DS_Store`, `*.log`, `.env`, `.env.*` (giữ `!.env.example`), `coverage/`, `test-results/`, `*.tsbuildinfo`. KHÔNG ignore `dist/` hay `arcane-paws-standalone.html` ở bước này (chờ FND-04 / DEC-08).
3. `FND-01.3` — [NGƯỜI] Xin duyệt rồi chạy `git rm -r --cached node_modules` — chỉ đổi index, giữ file trên đĩa. Theo `.agent/rules/terminal-safety.md`, thay đổi trạng thái git cần phê duyệt.
4. `FND-01.4` — Xác nhận `pnpm install --frozen-lockfile` vẫn chạy và `npm test` cho kết quả như baseline (test engagement có thể đỏ nếu TST-01 chưa xong).
5. `FND-01.5` — Commit riêng `chore: stop tracking node_modules`; không trộn thay đổi khác.

**Acceptance criteria**

- [ ] `git ls-files node_modules | wc -l` = 0.
- [ ] `git check-ignore node_modules` in ra đường dẫn (đang bị ignore).
- [ ] `git status --short` chỉ gồm các dòng xóa `node_modules/...` khỏi index và `.gitignore` mới.
- [ ] Thư mục `node_modules/` trên đĩa còn nguyên và `npm test` vẫn chạy được.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
git ls-files node_modules | wc -l
git check-ignore -v node_modules
git status --short | grep -v "node_modules/"
pnpm install --frozen-lockfile
```

**Rủi ro**

- Dev khác phải chạy lại `pnpm install` sau khi pull.
- Lịch sử git vẫn nặng (blob cũ còn nguyên) — ngoài phạm vi; không khuyến nghị viết lại lịch sử.

##### Story US-FND-2

> Là dev mới, tôi muốn README và runtime được ghim để chạy dự án trong vài phút.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| FND-02 | Ghim runtime: .nvmrc, engines và ghi chú package manager | P1 | XS (1) | S0 | done |
| FND-03 | Viết README gốc (cài đặt, chạy, test, build, biến môi trường) | P1 | S (2) | S0 | not_started |

###### FND-02 — Ghim runtime: .nvmrc, engines và ghi chú package manager

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | chore / P1 |
| Độ phức tạp / SP | XS / 1 |
| Sprint | 0 |
| Người thực hiện | agent |
| Dependencies | — |
| Quyết định chặn | — |
| Gap liên quan | GAP-115 |
| Trạng thái | done (2026-11-10) |

**Mô tả.** Không có `engines` hay `.nvmrc`. Các gói rolldown/Vite 8 khai báo `engines: ^20.19.0 || >=22.12.0` (pnpm-lock.yaml) và admin README nói "Node 22.12+". Root dùng pnpm@10.33.0 (đã có `packageManager`), admin dùng npm (package-lock.json); hai major Vite khác nhau (8 ở root, 7 ở admin).

**Affected files**

- `package.json`
- `admin/package.json`
- `.nvmrc (mới)`

**Implementation steps (subtask)**

1. `FND-02.1` — Thêm `"engines": { "node": ">=22.12.0" }` vào cả hai `package.json` (đọc lại file ngay trước khi sửa).
2. `FND-02.2` — Tạo `.nvmrc` với nội dung `22`.
3. `FND-02.3` — Không đổi phiên bản dependency ở task này; việc thống nhất package manager/Vite phụ thuộc DEC-08.

**Acceptance criteria**

- [ ] Cả hai package.json có `engines.node`.
- [ ] `.nvmrc` tồn tại.
- [ ] `pnpm install --frozen-lockfile` chạy được trên Node 22.x hiện tại.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node -e "for (const f of ['package.json','admin/package.json']) { const e = JSON.parse(require('fs').readFileSync(f,'utf8')).engines; if (!e || !e.node) { console.error('thiếu engines trong ' + f); process.exit(1) } console.log(f, e.node) }"
cat .nvmrc
pnpm install --frozen-lockfile
```

###### FND-03 — Viết README gốc (cài đặt, chạy, test, build, biến môi trường)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | docs / P1 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 0 |
| Người thực hiện | agent |
| Dependencies | FND-01, FND-02 |
| Quyết định chặn | — |
| Gap liên quan | GAP-109 |
| Trạng thái | not_started |

**Mô tả.** `README.md` hiện chỉ có đúng một dòng `# draw-game`. Người mới không biết cách chạy game, admin, test, build hay các biến môi trường `VITE_*`.

**Affected files**

- `README.md`

**Implementation steps (subtask)**

1. `FND-03.1` — Mục giới thiệu: game + admin + shared; một sơ đồ kiến trúc ngắn và liên kết `docs/ai-planning/ARCHITECTURE.md`.
2. `FND-03.2` — Yêu cầu hệ thống (Node ≥ 22.12, pnpm 10, npm) và cách chạy game dev (`pnpm dev`; chọn cổng trống), build (`npm run build`), bản standalone.
3. `FND-03.3` — Admin: tóm tắt 3 lệnh và liên kết `admin/README.md`.
4. `FND-03.4` — Bảng biến môi trường: game `VITE_GAME_CONFIG_URL`, `VITE_GAME_CONFIG_ENV`, `VITE_STORY_CONTENT_URL`, `VITE_STORY_LOCALE`; admin `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PORT`, `ADMIN_ROLE`. Nhắc không bao giờ commit `.env`.
5. `FND-03.5` — Bảng script npm, cách chạy test (`npm test`, `npm run test:admin` sau TST-03), cấu trúc thư mục, danh mục `docs/*.md`.
6. `FND-03.6` — Mục "Lưu ý khi đóng góp" liên kết `docs/ai-planning/EXECUTION_RULES.md`.
7. `FND-03.7` — Kiểm tra mọi liên kết tương đối trong README đều tồn tại.

**Acceptance criteria**

- [ ] README có đủ các mục trên.
- [ ] Mọi liên kết tương đối trong README trỏ tới file có thật.
- [ ] Một người mới làm theo được `npm test` và build ra thư mục tạm.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Tài liệu được rà soát chính tả/liên kết; mọi con số trích dẫn có thể tái tạo bằng lệnh nêu trong tài liệu.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node -e "const fs=require('fs');const t=fs.readFileSync('README.md','utf8');const bad=[...t.matchAll(/\]\((?!https?:|#|mailto:)([^)#]+)/g)].map(m=>m[1]).filter(p=>!fs.existsSync(p));if(bad.length){console.error('liên kết gãy:',bad);process.exit(1)}console.log('links ok')"
npx vite build --outDir "$(mktemp -d)" --emptyOutDir
```

#### Feature FT-FND-2 — Tích hợp liên tục & artifact

CI tự động trên mọi PR; chính sách artifact build rõ ràng và được kiểm tra.

##### Story US-FND-3

> Là maintainer, tôi muốn mọi PR tự chạy test/build để lỗi bị chặn trước khi gộp.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| FND-05 | Thêm GitHub Actions CI cho game và admin | P0 | M (3) | S0 | not_started |

###### FND-05 — Thêm GitHub Actions CI cho game và admin

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | chore / P0 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 0 |
| Người thực hiện | agent |
| Dependencies | FND-01, TST-03 |
| Quyết định chặn | — |
| Gap liên quan | GAP-201 |
| Trạng thái | not_started |

**Mô tả.** Không có thư mục `.github/`; 26 PR đã gộp mà không có kiểm tra tự động. Remote là github.com/PhanVanHieu-Ptit/draw-game. Không có lint/format nên CI hiện chỉ chạy test + build + typecheck.

**Affected files**

- `.github/workflows/ci.yml (mới)`

**Implementation steps (subtask)**

1. `FND-05.1` — Trigger: `push` lên `main` và `pull_request`; `permissions: contents: read`; `concurrency` hủy run cũ cùng nhánh.
2. `FND-05.2` — Job `game` (ubuntu-latest, Node 22): `pnpm/action-setup` (lấy phiên bản từ `packageManager`), `pnpm install --frozen-lockfile`, `npm test`, `npx vite build --outDir "$RUNNER_TEMP/game-build" --emptyOutDir`.
3. `FND-05.3` — Job `admin` (`working-directory: admin`): `npm ci`, `npm test`, `npm run test:ui`, `npx tsc --noEmit`, `npx vite build --outDir "$RUNNER_TEMP/admin-build" --emptyOutDir`.
4. `FND-05.4` — Thêm job nhẹ `plan` chạy `node docs/ai-planning/tools/plan.mjs validate` để kế hoạch không trôi lệch khỏi code (đường dẫn, ID, dependency).
5. `FND-05.5` — Cache pnpm store và npm cache (KHÔNG cache `node_modules`); không dùng secrets.
6. `FND-05.6` — Bảo đảm không bước nào ghi vào working tree được track.
7. `FND-05.7` — Mở một PR thử để xác nhận cả hai job xanh trên Linux; ghi thời lượng vào evidence.

**Acceptance criteria**

- [ ] Workflow hợp lệ; PR thử có cả 2 job xanh.
- [ ] Job đỏ nếu `npm test` thoát ≠ 0 (kiểm chứng bằng PR thử cố ý hỏng rồi đóng).
- [ ] Không dùng secrets; quyền chỉ `contents: read`.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
gh workflow list
gh run list --branch <nhánh-pr-thử> --limit 1 --json status,conclusion
pnpm install --frozen-lockfile && npm test
(cd admin && npm ci && npm test && npm run test:ui && npx tsc --noEmit)
node docs/ai-planning/tools/plan.mjs validate
```

**Rủi ro**

- Lần chạy đầu có thể đỏ do giả định chỉ đúng trên macOS (đường dẫn, binary native).

##### Story US-FND-4

> Là maintainer, tôi muốn chính sách artifact rõ ràng và bị kiểm tra tự động để không còn bản build cũ hay trùng lặp.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| FND-04 | Áp dụng chính sách artifact build và script kiểm tra độ mới | P2 | S (2) | S1 | not_started |

###### FND-04 — Áp dụng chính sách artifact build và script kiểm tra độ mới

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | chore / P2 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 1 |
| Người thực hiện | agent+human |
| Dependencies | FND-01, FND-05 |
| Quyết định chặn | DEC-08 |
| Gap liên quan | GAP-115, GAP-311 |
| Trạng thái | not_started |

**Mô tả.** Repo commit 3 bản trùng 667.200 byte (md5 giống hệt: `dist/index.html`, `dist/arcane-paws-standalone.html`, `arcane-paws-standalone.html`) cùng cả thư mục `dist/` (15 file). Build hiện TẤT ĐỊNH (đã xác minh md5 bản build mới = bản đã commit), nên có thể kiểm tra độ mới tự động thay vì tin vào kỷ luật commit.

**Affected files**

- `.gitignore`
- `scripts/export-bundle.js`
- `scripts/verify-artifacts.mjs (mới)`
- `tests/artifacts.test.js (mới)`
- `tests/manifest.json`
- `package.json`
- `.github/workflows/ci.yml`
- `arcane-paws-standalone.html`
- `dist/** (gỡ khỏi index nếu DEC-08 = A)`

**Implementation steps (subtask)**

1. `FND-04.1` — [NGƯỜI] Chờ DEC-08. Mặc định khuyến nghị A: chỉ track `arcane-paws-standalone.html` ở gốc; ignore `dist/`.
2. `FND-04.2` — Sửa `scripts/export-bundle.js` để chỉ ghi bản gốc (theo chính sách); giữ nguyên phần kiểm tra "không có script/CSS ngoài".
3. `FND-04.3` — Thêm `dist/` vào `.gitignore`; [NGƯỜI] duyệt rồi `git rm -r --cached dist`.
4. `FND-04.4` — Viết `scripts/verify-artifacts.mjs`: build vào thư mục tạm (`vite build --outDir <tmp>`), so nội dung với `arcane-paws-standalone.html`; lệch → thoát 1 kèm hướng dẫn `npm run build`. Thêm script `verify:artifacts`.
5. `FND-04.5` — Viết `tests/artifacts.test.js` kiểm thử hàm so sánh (giống/khác) và đăng ký vào `tests/manifest.json`.
6. `FND-04.6` — Thêm bước `npm run verify:artifacts` vào job `game` của CI.

**Acceptance criteria**

- [ ] Chỉ còn đúng 1 bản 667 kB được track; `git ls-files dist | wc -l` = 0 (nếu DEC-08 = A).
- [ ] `npm run verify:artifacts` thoát 0 ngay sau `npm run build`.
- [ ] Sửa 1 dòng trong `src/` mà không build lại → script thoát ≠ 0 (kiểm chứng trong worktree/thư mục tạm, không để lại thay đổi).
- [ ] CI chạy bước verify.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-08 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm run build
npm run verify:artifacts
git ls-files | grep -E "^(dist/|arcane-paws-standalone.html)"
npm test
```

**Rủi ro**

- Nếu DEC-08 chọn B/C, thay đổi này phải điều chỉnh tương ứng.

## EP-TST

### Độ tin cậy của test & cổng chất lượng

**Mục tiêu:** Test xanh phải thật sự xanh: không flaky, không suite mồ côi, không "xanh giả"; có smoke test trên trình duyệt.  
**Ưu tiên epic:** P0

#### Feature FT-TST-1 — Cổng test trung thực

Một runner duy nhất, không flaky, không suite mồ côi, không xanh giả.

##### Story US-TST-1

> Là dev, tôi muốn kết quả test xanh nghĩa là thật sự không lỗi (không flaky, không xanh giả).

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| TST-01 | Làm test "blood moon" tất định (hết flaky) | P0 | XS (1) | S0 | done |
| TST-02 | Sửa test "xanh giả": test-performance-system.js không bao giờ thoát ≠ 0 | P1 | XS (1) | S0 | done |

###### TST-01 — Làm test "blood moon" tất định (hết flaky)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P0 |
| Độ phức tạp / SP | XS / 1 |
| Sprint | 0 |
| Người thực hiện | agent |
| Dependencies | — |
| Quyết định chặn | — |
| Gap liên quan | GAP-307 |
| Trạng thái | done (2026-11-10) |

**Mô tả.** Assertion "ghosts generated during a blood moon are faster" (`test-engagement-features.js` ~dòng 203–211) đỏ khoảng một lần trong ba lần chạy — ba nguồn đo độc lập: 8/12 (lúc lập kế hoạch), 26/84 (kiểm chứng lần 2, 2026-11-10: 7/24 rồi 19/60 ≈ 31%) và 2/9 (ghi chú cũ của dự án); gộp 36/105 lần ≈ 34% (khoảng tin cậy 95% ≈ 26–44%), khớp với xác suất ~32% của nguyên nhân gốc bên dưới — nên `npm test` thoát 1 ở khoảng một phần ba số lần (mẫu 8/12 lúc đầu là số ngoại lai). Nguyên nhân gốc: `WaveSystem._generateEnemyConfig` trả `speedMultiplier` cố định 0 / 0.40 / 0.45 cho ghost tim/băng/xoáy (bỏ qua `eventSpeedScale` — chủ ý), mà mẫu ngẫu nhiên đầu tiên có ~32% (8% + 12% + 12%) rơi vào nhóm này; RNG không được gieo hạt. Đây là lỗi của TEST, không phải của production.

**Affected files**

- `test-engagement-features.js`

**Implementation steps (subtask)**

1. `TST-01.1` — Tái hiện: chạy `node test-engagement-features.js` 12 lần và ghi tỉ lệ đỏ (baseline gộp: 36/105 ≈ 34%).
2. `TST-01.2` — Sửa test: gieo RNG (`ws.setSeed(...)`) và chỉ lấy ghost THƯỜNG (`!isHeartGhost && !isFreezeGhost && !isBlastGhost`, flatten mảng squad) cho cả hai mẫu; assert tỉ lệ `fast / base` xấp xỉ 1.25 với dung sai nhỏ.
3. `TST-01.3` — KHÔNG sửa `src/systems/WaveSystem.js` (hành vi ghost tactical bỏ qua `eventSpeedScale` là chủ ý).
4. `TST-01.4` — Kiểm tra đột biến thủ công: tạm làm `_generateEnemyConfig` bỏ qua `eventSpeedScale` → test phải ĐỎ; hoàn tác ngay.

**Acceptance criteria**

- [ ] 100 lần chạy liên tiếp đều thoát 0.
- [ ] Test vẫn đỏ khi `eventSpeedScale` bị bỏ qua (kiểm tra đột biến).
- [ ] Không có thay đổi nào trong `src/`.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
for i in $(seq 1 100); do node test-engagement-features.js >/dev/null 2>&1 || echo "FAIL run $i"; done
git diff --stat -- src/
```

###### TST-02 — Sửa test "xanh giả": test-performance-system.js không bao giờ thoát ≠ 0

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P1 |
| Độ phức tạp / SP | XS / 1 |
| Sprint | 0 |
| Người thực hiện | agent |
| Dependencies | — |
| Quyết định chặn | — |
| Gap liên quan | GAP-308 |
| Trạng thái | done (2026-11-10) |

**Mô tả.** `test-performance-system.js` dùng soft-assert (chỉ tăng `failed`, in kết quả) và không có `process.exit` → assertion hỏng vẫn thoát 0 và `npm test` đi tiếp. Đã quét 28 file test: 27 file còn lại hoặc gọi `process.exit` theo số lỗi hoặc dùng `node:assert` (ném lỗi).

**Affected files**

- `test-performance-system.js`

**Implementation steps (subtask)**

1. `TST-02.1` — Chạy lại bản quét: liệt kê file test không có `process.exit` và không `import assert` (kỳ vọng chỉ còn `test-performance-system.js`).
2. `TST-02.2` — Thêm cuối file `process.exit(failed > 0 ? 1 : 0)` theo mẫu của `test-meta-features.js`.
3. `TST-02.3` — Kiểm chứng âm tính trên BẢN SAO tạm: đổi một assertion thành sai → thoát 1; xóa bản sao.

**Acceptance criteria**

- [ ] Chạy bình thường thoát 0.
- [ ] Bản sao có assertion sai thoát 1.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node test-performance-system.js; echo "exit=$?"
grep -n "process.exit" test-performance-system.js
```

##### Story US-TST-2

> Là dev, tôi muốn mọi file test đều nằm trong cổng để không suite nào bị bỏ quên.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| TST-03 | Runner test thống nhất, manifest và "orphan guard" | P0 | M (3) | S0 | done |
| TST-04 | Sửa suite lỗi thời: scripts/test-center-cat-boss-tutorial.js | P2 | S (2) | S1 | not_started |
| TST-05 | Sửa suite lỗi thời: scripts/test-boss-minions-and-scary-face.js | P2 | S (2) | S1 | not_started |
| TST-06 | Sửa suite lỗi thời: scripts/test-monster-sounds.js (dùng cast identity thật) | P2 | S (2) | S1 | not_started |

###### TST-03 — Runner test thống nhất, manifest và "orphan guard"

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P0 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 0 |
| Người thực hiện | agent |
| Dependencies | TST-01, TST-02 |
| Quyết định chặn | — |
| Gap liên quan | GAP-309, GAP-108 |
| Trạng thái | done (2026-11-10) |

**Mô tả.** `package.json` nối 22 suite bằng chuỗi `&&` dài ~800 ký tự: (a) một suite đỏ làm bỏ qua mọi suite sau nó; (b) 6 file test không nằm trong chuỗi — 3 xanh (`test-story-lore.js` 168, `test-powerups-freeze-blast.js` 34, `scripts/test-gesture-momo-sound.js` 72) và 3 hỏng (xem TST-04..06); (c) test admin nằm ngoài cổng. Cần một runner trung thực, không để suite bị bỏ quên.

**Affected files**

- `scripts/run-tests.mjs (mới)`
- `tests/manifest.json (mới)`
- `tests/run-tests.test.js (mới)`
- `tests/fixtures/soft-fail.js (mới)`
- `package.json`

**Implementation steps (subtask)**

1. `TST-03.1` — Tạo `tests/manifest.json`: `suites[]` (id, file, area) cho 22 suite hiện có + 3 suite mồ côi đang xanh; `quarantine[]` (id, file, reason, task) cho 3 suite hỏng (TST-04/05/06).
2. `TST-03.2` — Viết `scripts/run-tests.mjs`: chạy từng suite bằng `node <file>` tuần tự, thu stdout/stderr, KHÔNG dừng ở lỗi đầu tiên. Suite thất bại nếu exit ≠ 0, HOẶC output khớp `/(\d+)\s+Failed/` với số > 0, HOẶC chứa `❌ FAIL` (phòng thủ cho test "mềm"). In bảng tổng kết (suite, pass/fail, thời lượng); thoát 1 nếu có suite NGOÀI quarantine thất bại. Hỗ trợ `--only <id>`, `--include-quarantine`, `--report <path>`.
3. `TST-03.3` — "Orphan guard": runner thất bại nếu tồn tại file khớp `test-*.js`, `tests/*.test.js`, `scripts/test-*.js` mà không có trong `suites` hay `quarantine`.
4. `TST-03.4` — Cập nhật `package.json` (ĐỌC LẠI file ngay trước khi sửa): `test` = `node scripts/run-tests.mjs`; thêm `test:admin` = `npm --prefix admin test && npm --prefix admin run test:ui`; `test:all` = `npm test && npm run test:admin`; giữ `test:combat`, `test:gestures`, `test:story`.
5. `TST-03.5` — Viết `tests/run-tests.test.js` và fixture `tests/fixtures/soft-fail.js` (in "1 Failed" nhưng thoát 0) để chứng minh runner bắt được lỗi mềm và orphan guard hoạt động.
6. `TST-03.6` — Ghi vào evidence: số suite, tổng assertion, thời lượng.

**Acceptance criteria**

- [ ] `npm test` chạy đủ 25 suite và liệt kê 3 suite quarantine; thoát 0 khi không có suite ngoài quarantine nào đỏ.
- [ ] Thêm một file `test-dummy.js` bất kỳ → `npm test` thoát ≠ 0 với thông báo orphan (rồi xóa file).
- [ ] Fixture "mềm" bị runner phát hiện là thất bại.
- [ ] `npm run test:admin` chạy 19 test backend + 10 test UI.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm test
node tests/run-tests.test.js
npm run test:admin
npm test -- --include-quarantine; echo "exit=$? (kỳ vọng ≠ 0 vì 3 suite hỏng)"
```

**Rủi ro**

- Khi exit code trở nên trung thực có thể lộ lỗi từng bị che.
- Phiên làm việc khác có thể đang sửa `package.json` — đọc lại trước khi ghi.

###### TST-04 — Sửa suite lỗi thời: scripts/test-center-cat-boss-tutorial.js

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P2 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 1 |
| Người thực hiện | agent |
| Dependencies | TST-03 |
| Quyết định chặn | — |
| Gap liên quan | GAP-309 |
| Trạng thái | not_started |

**Mô tả.** Suite FAIL: `❌ Spawned first tutorial minion` rồi `TypeError: Cannot read properties of null (reading 'symbolQueue')`. File sửa lần cuối 2026-11-01 trong khi `WaveSystem` (màn 1 có kịch bản hướng dẫn; `INTRO_TIMING.FIRST_SPAWN_S = 2.3`) đổi ngày 04–06/11 → nhiều khả năng test lỗi thời chứ chưa phải lỗi production (CHƯA xác minh).

**Affected files**

- `scripts/test-center-cat-boss-tutorial.js`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `TST-04.1` — Chạy suite và ghi lại hai triệu chứng (assertion đỏ + TypeError).
2. `TST-04.2` — Đọc đoạn test xin spawn đầu tiên; đối chiếu `WaveSystem.initLevel` đặt `spawnTimer = INTRO_TIMING.FIRST_SPAWN_S` và `update()` trả `null` cho tới khi hết thời gian chờ.
3. `TST-04.3` — Cập nhật test: import `INTRO_TIMING`, tiến thời gian ≥ `FIRST_SPAWN_S` trước khi kỳ vọng spawn; giữ nguyên ý định (mèo ở giữa; minion hướng dẫn thứ nhất `horizontal`, thứ hai `vertical`).
4. `TST-04.4` — Nếu phát hiện lỗi production thật: DỪNG, thêm task BUG mới vào tasks.json, giữ suite trong quarantine với `reason` cập nhật — KHÔNG xóa assertion.
5. `TST-04.5` — Chuyển suite từ `quarantine` sang `suites` trong `tests/manifest.json`.

**Acceptance criteria**

- [ ] `node scripts/test-center-cat-boss-tutorial.js` thoát 0; không assertion nào bị xóa/skip.
- [ ] Suite nằm trong `suites`, không còn trong `quarantine`.
- [ ] `npm test` xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/test-center-cat-boss-tutorial.js
git diff --stat -- src/
npm test
```

###### TST-05 — Sửa suite lỗi thời: scripts/test-boss-minions-and-scary-face.js

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P2 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 1 |
| Người thực hiện | agent |
| Dependencies | TST-03 |
| Quyết định chặn | — |
| Gap liên quan | GAP-309 |
| Trạng thái | not_started |

**Mô tả.** Suite 53 pass / 2 fail: `Spawned all 10 initial minions` (màn 1 nay có `totalMinions: 12`) và `Did not exceed max concurrent minions during boss battle` (trần minion hiện tại: 4 cho màn 1–2, 6 cho màn 3–4, 8 cho màn 5; +2 HARDCORE, +4 INFERNO — `WaveSystem.update` ~dòng 311–313). Ngoài hai assertion đỏ cố định còn có MỘT assertion chập chờn: `Spawned minion has valid combat speed` đỏ 1/12 lần chạy (kiểm chứng lần 2, 2026-11-10; kết quả khi đó 52 pass / 3 fail) — phụ thuộc RNG, cần được gieo hạt/loại bỏ phụ thuộc ngẫu nhiên. File sửa lần cuối 2026-11-01.

**Affected files**

- `scripts/test-boss-minions-and-scary-face.js`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `TST-05.1` — Chạy suite và ghi 2 assertion đỏ.
2. `TST-05.2` — Chạy suite 12 lần và liệt kê MỌI assertion đỏ (kể cả assertion chập chờn `Spawned minion has valid combat speed`); xác định nguồn ngẫu nhiên (RNG không gieo hạt trong `WaveSystem`/mô phỏng) và gieo hạt hoặc stub RNG trong test — không sửa production.
3. `TST-05.3` — Thay hằng 10 bằng `LEVEL_CONFIGS[0].totalMinions`.
4. `TST-05.4` — Đo số minion sống đồng thời tối đa trong mô phỏng và so với công thức trần của `WaveSystem.update`. Nếu ≤ trần hiện hành → cập nhật hằng của test theo trần hiện hành (import cấu hình, đừng hard-code). Nếu VƯỢT trần → lỗi production: thêm task BUG, giữ quarantine với reason mới.
5. `TST-05.5` — Chuyển suite từ `quarantine` sang `suites`.

**Acceptance criteria**

- [ ] `node scripts/test-boss-minions-and-scary-face.js` thoát 0, không assertion bị xóa/skip.
- [ ] Suite nằm trong `suites`.
- [ ] `npm test` xanh.
- [ ] 30 lần chạy liên tiếp đều thoát 0 (không còn assertion chập chờn).

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/test-boss-minions-and-scary-face.js
for i in $(seq 1 30); do node scripts/test-boss-minions-and-scary-face.js >/dev/null 2>&1 || echo "FAIL run $i"; done
git diff --stat -- src/
npm test
```

###### TST-06 — Sửa suite lỗi thời: scripts/test-monster-sounds.js (dùng cast identity thật)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P2 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 1 |
| Người thực hiện | agent |
| Dependencies | TST-03 |
| Quyết định chặn | — |
| Gap liên quan | GAP-309 |
| Trạng thái | not_started |

**Mô tả.** Suite 35 pass / 5 fail (`Partial rune hit triggers playHit()`, `Final hit … playEnemyDeath()`, `Eliminating boss triggers playBossDeath()`, `playBossDeath passed correct level index 1`, …). Test đẩy `fakeProj = { targetEnemy, gesture, ... }` thiếu cast identity/target generation mà combat-refactor (docs/combat.md, mục "Incremental changes" 2) đòi hỏi. Hook âm thanh vẫn được gọi trong code thật (`Game.js:1535`, `:3286`, `:1592`, `:3174`) → nhiều khả năng test lỗi thời, KHÔNG phải mất tiếng thật (chưa kiểm chứng bằng nghe thật — xem REL-01).

**Affected files**

- `scripts/test-monster-sounds.js`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `TST-06.1` — Chạy suite và ghi 5 assertion đỏ.
2. `TST-06.2` — Thay `fakeProj` bằng đường chạy thật: gọi `game.executeSpell({ gesture, score, synthetic: false }, [])` rồi tiến `game.updatePlaying`/`game.advanceEffects`, hoặc tạo projectile qua `game.projectilePool` với cast/target generation như `tests/combat.test.js`.
3. `TST-06.3` — Giữ nguyên các assertion về `playHit`, `playEnemyDeath`, `playBossDeath(level)`.
4. `TST-06.4` — Chuyển suite từ `quarantine` sang `suites`.

**Acceptance criteria**

- [ ] `node scripts/test-monster-sounds.js` thoát 0; các assertion về hook âm thanh vẫn còn đủ.
- [ ] Suite nằm trong `suites`.
- [ ] `npm test` xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/test-monster-sounds.js
git diff --stat -- src/
npm test
```

#### Feature FT-TST-2 — Xác minh ở mức trình duyệt

Smoke test tự động trên Chrome headless.

##### Story US-TST-3

> Là dev, tôi muốn smoke test trên trình duyệt thật để biết game khởi động và nhận nét vẽ.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| TST-07 | Smoke test trên trình duyệt thật (Chrome headless qua CDP) | P2 | M (3) | S2 | not_started |

###### TST-07 — Smoke test trên trình duyệt thật (Chrome headless qua CDP)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 2 |
| Người thực hiện | agent |
| Dependencies | TST-03 |
| Quyết định chặn | — |
| Gap liên quan | GAP-108 |
| Trạng thái | not_started |

**Mô tả.** Mọi test hiện chạy trong Node với DOM/canvas giả; chưa có kiểm thử nào chạy trong trình duyệt. Phân tích đã làm smoke test thủ công (Chrome headless: menu hiển thị, 0 lỗi console, 2 sprite 404 + favicon 404) — cần tự động hóa và đưa vào CI. Không thêm dependency: dùng `WebSocket` toàn cục của Node 22.

**Affected files**

- `scripts/e2e-smoke.mjs (mới)`
- `tests/manifest.json`
- `package.json`
- `.github/workflows/ci.yml`
- `.gitignore`

**Implementation steps (subtask)**

1. `TST-07.1` — Helper tìm Chrome: biến `CHROME_PATH`, rồi các đường dẫn macOS/Linux phổ biến; nếu không có thì thoát mã 77 ("skipped") kèm thông báo để máy không có Chrome không bị đỏ.
2. `TST-07.2` — Build vào thư mục tạm (`vite build --outDir`) và phục vụ bằng static server Node (127.0.0.1, cổng NGẪU NHIÊN — không dùng cổng cố định; cổng 5199 đã bị dự án khác chiếm trên máy maintainer).
3. `TST-07.3` — Chạy Chrome `--headless=new --remote-debugging-port=<ngẫu nhiên> --user-data-dir=<tmp> --autoplay-policy=no-user-gesture-required`; kết nối CDP bằng `WebSocket`.
4. `TST-07.4` — Kịch bản: đợi `window.__ARCANE_GAME__`; xác nhận state MENU và nút chính hiển thị; `game.stateMachine.changeState("PLAYING")`; phát pointer events vẽ một nét ngang trên canvas; xác nhận `game.metrics` ghi nhận một lần niệm (đọc `Game._newMetrics()` để biết tên trường); chụp ảnh vào `test-results/` (đã ignore).
5. `TST-07.5` — Thu `Runtime.consoleAPICalled` (mức error) và `Runtime.exceptionThrown`; thất bại nếu có. In danh sách request 404.
6. `TST-07.6` — Dọn dẹp chắc chắn (kể cả khi lỗi): đóng Chrome, tắt server, xóa thư mục tạm. Thêm cờ `--inject-error` (chỉ để test) tiêm `throw` vào trang.
7. `TST-07.7` — Đăng ký suite vào manifest (`area: e2e`, cho phép mã 77) và thêm job CI `e2e-smoke`.

**Acceptance criteria**

- [ ] `node scripts/e2e-smoke.mjs` thoát 0 trên máy có Chrome.
- [ ] `node scripts/e2e-smoke.mjs --inject-error` thoát ≠ 0.
- [ ] Không để lại tiến trình Chrome/server/thư mục tạm.
- [ ] In danh sách 404 (kỳ vọng trước IPA-03/UXL-04: 2 sprite + favicon).

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/e2e-smoke.mjs
node scripts/e2e-smoke.mjs --inject-error; echo "exit=$? (kỳ vọng ≠ 0)"
pgrep -fl "remote-debugging-port" || echo "clean"
```

**Rủi ro**

- Render phần mềm trên CI chậm — smoke test không đo hiệu năng.

## EP-ADM

### Độ đúng đắn & củng cố Admin API

**Mục tiêu:** Admin lưu đúng dữ liệu, phân quyền nhất quán, throttle đúng, lưu trữ không phình vô hạn.  
**Ưu tiên epic:** P1

#### Feature FT-ADM-1 — Lưu trữ nội dung đáng tin cậy

Không hỏng UTF-8; giới hạn kích thước hợp lý theo từng route.

##### Story US-ADM-1

> Là Content Editor/Game Designer, tôi muốn nội dung tiếng Việt và tài liệu lớn lưu đúng nguyên vẹn.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| ADM-01 | Sửa giải mã UTF-8 khi đọc body request (gom Buffer, decode một lần) | P1 | S (2) | S0 | done |
| ADM-02 | Giới hạn body theo route và test HTTP end-to-end cho vòng đời Gameplay | P1 | S (2) | S1 | not_started |

###### ADM-01 — Sửa giải mã UTF-8 khi đọc body request (gom Buffer, decode một lần)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | bug / P1 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 0 |
| Người thực hiện | agent |
| Dependencies | — |
| Quyết định chặn | — |
| Gap liên quan | GAP-302 |
| Trạng thái | done (2026-11-10) |

**Mô tả.** `admin/server/app.mjs` đọc body bằng `raw += chunk`: mỗi chunk Buffer bị `toString()` riêng nên ký tự đa byte (tiếng Việt 2–3 byte) nằm vắt qua ranh giới chunk bị thay bằng U+FFFD. Đã tái hiện bằng server thật: body 1,25 MB → gửi 720.000 ký tự, lưu 720.015 ký tự với 25 ký tự U+FFFD (round-trip khác). Story seed mặc định (54 KB) round-trip sạch trên loopback (0/12 lần) — lỗi chỉ xuất hiện khi body bị chia nhiều chunk (body lớn hoặc đi qua proxy); mức độ phơi nhiễm thực tế phụ thuộc mạng và độ lớn story.

**Affected files**

- `admin/server/app.mjs`
- `admin/tests/server.test.mjs`
- `docs/ai-planning/evidence/repro-admin-bugs.mjs`

**Implementation steps (subtask)**

1. `ADM-01.1` — Chạy `node docs/ai-planning/evidence/repro-admin-bugs.mjs` và xác nhận kiểm tra EXP3 báo FAIL (có U+FFFD).
2. `ADM-01.2` — Sửa hàm `body()` trong `app.mjs`: thu các `chunk` (Buffer), cộng `size += chunk.length`, ném 413 khi vượt giới hạn, rồi `Buffer.concat(chunks).toString("utf8")` đúng MỘT lần; giữ nguyên status/thông báo hiện có (413, 400).
3. `ADM-01.3` — Thêm test hồi quy TẤT ĐỊNH trong `admin/tests/server.test.mjs`: dựng body JSON chứa chuỗi tiếng Việt lớn; tìm chỉ số cắt nằm GIỮA một ký tự đa byte; ghi nửa đầu bằng `http.request`, đợi ≥ 30 ms, ghi nửa sau; POST `/api/content/story/draft` rồi GET lại và `assert.equal` với chuỗi gốc.
4. `ADM-01.4` — Xác nhận test ĐỎ khi hoàn tác bản vá và XANH khi có bản vá.
5. `ADM-01.5` — Chạy lại toàn bộ test admin và script repro.

**Acceptance criteria**

- [ ] Round-trip chuỗi tiếng Việt ≥ 1 MB giống hệt từng ký tự (0 U+FFFD).
- [ ] Body vượt giới hạn vẫn nhận 413; JSON hỏng vẫn nhận 400.
- [ ] Test hồi quy đỏ khi hoàn tác bản vá.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Có test hồi quy ĐỎ trên mã cũ và XANH trên mã đã sửa (ghi lại cách chứng minh).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
node docs/ai-planning/evidence/repro-admin-bugs.mjs
git diff --stat
```

###### ADM-02 — Giới hạn body theo route và test HTTP end-to-end cho vòng đời Gameplay

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | bug / P1 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 1 |
| Người thực hiện | agent |
| Dependencies | ADM-01 |
| Quyết định chặn | — |
| Gap liên quan | GAP-301 |
| Trạng thái | not_started |

**Mô tả.** Giới hạn body hiện là 2 MiB cho `/api/content/story*` và 16 KiB cho mọi route còn lại. Tài liệu gameplay hợp lệ ≥ ~16,4 KB bị từ chối 413 dù schema cho phép tới 500 phần tử/mảng và 10.000 spawn event (đã tái hiện: 15.278 B → 200; 16.808 B → 413, tương đương ~30 enemy + 25 wave; `validateContent` báo 0 lỗi). Test hiện có (`admin/tests/gameplay.test.mjs`) gọi thẳng `configurationRoute` với `permits: () => true` nên KHÔNG chạm đường HTTP thật.

**Affected files**

- `admin/server/app.mjs`
- `admin/tests/gameplay.test.mjs`
- `admin/README.md`
- `docs/gameplay-content-editors.md`

**Implementation steps (subtask)**

1. `ADM-02.1` — Thay biểu thức hằng trong `body()` bằng bảng `BODY_LIMITS` (tiền tố → byte): `/api/content/story` 2 MiB; `/api/gameplay/` 1 MiB; mặc định 16 KiB (auth, configuration).
2. `ADM-02.2` — Ghi lý do chọn 1 MiB (schema cho tối đa 500 phần tử/mảng) vào README.
3. `ADM-02.3` — Viết test HTTP với server thật (mẫu `server.test.mjs`): Super Admin save → validate → review → publish → GET công khai `/api/game-content/development` → rollback, dùng tài liệu ≥ 100 KB hợp lệ (xây như `buildContent` trong script repro) → 200; body > 1 MiB → 413; body > 16 KiB tới `/api/configuration` → 413.
4. `ADM-02.4` — Thêm test 401 (chưa đăng nhập) cho các endpoint gameplay.

**Acceptance criteria**

- [ ] Tài liệu 100 KB lưu được (HTTP 200) và đọc lại giống hệt.
- [ ] Vượt giới hạn mới → 413; auth/configuration vẫn giới hạn 16 KiB.
- [ ] Vòng đời đầy đủ qua HTTP xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Có test hồi quy ĐỎ trên mã cũ và XANH trên mã đã sửa (ghi lại cách chứng minh).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
node docs/ai-planning/evidence/repro-admin-bugs.mjs
```

#### Feature FT-ADM-2 — Kiểm soát truy cập nhất quán

Quyền UI = quyền API = tài liệu; throttle đúng sau proxy.

##### Story US-ADM-2

> Là Analyst, tôi muốn xem được Gameplay như README nêu mà không được sửa.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| ADM-03 | Đồng bộ mô hình quyền Gameplay (gameplay:* thay configuration:*) | P2 | M (3) | S1 | not_started |

###### ADM-03 — Đồng bộ mô hình quyền Gameplay (gameplay:* thay configuration:*)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | bug / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 1 |
| Người thực hiện | agent |
| Dependencies | ADM-02 |
| Quyết định chặn | DEC-10 |
| Gap liên quan | GAP-303 |
| Trạng thái | not_started |

**Mô tả.** API nội dung gameplay kiểm tra `configuration:read/write/review/publish` (`admin/server/configuration.mjs`, dòng 59–72) trong khi policy cho Analyst `gameplay:read`, route guard UI dùng `gameplay:read` và README ghi Analyst đọc được Gameplay → Analyst vào được trang rồi nhận 403 (đã tái hiện: GET `/api/gameplay/environments/development` = 403 dù `permits(Analyst, "gameplay:read")` = true). `GameplayPage.tsx` cũng dùng `can("configuration:*")` ở dòng 407, 446, 536, 552, 560, 586.

**Affected files**

- `admin/server/policy.mjs`
- `admin/server/configuration.mjs`
- `admin/src/GameplayPage.tsx`
- `admin/src/GameplayPage.test.tsx`
- `admin/tests/server.test.mjs`
- `admin/tests/gameplay.test.mjs`
- `admin/README.md`

**Implementation steps (subtask)**

1. `ADM-03.1` — [NGƯỜI] Chờ DEC-10. Mặc định khuyến nghị A (namespace `gameplay:*`).
2. `ADM-03.2` — `policy.mjs`: thêm `gameplay:review` và `gameplay:publish` cho Super Admin; Game Designer giữ `gameplay:read/write`; Analyst giữ `gameplay:read`.
3. `ADM-03.3` — `configuration.mjs`: chọn tiền tố quyền theo cờ `content` (`gameplay` hay `configuration`) cho read/write/review/publish/rollback.
4. `ADM-03.4` — `GameplayPage.tsx`: đổi 6 điểm `can("configuration:*")` sang `gameplay:*`; cập nhật `GameplayPage.test.tsx`.
5. `ADM-03.5` — Viết test MA TRẬN qua HTTP thật: với mỗi role × endpoint (GET và POST save/validate/review/publish/rollback cho cả `/api/configuration/...` và `/api/gameplay/...`), kỳ vọng được SINH từ `roles` trong policy.mjs.
6. `ADM-03.6` — Cập nhật bảng quyền trong README.

**Acceptance criteria**

- [ ] Analyst: GET gameplay = 200; POST save = 403.
- [ ] Game Designer: save/validate = 200, review/publish = 403; Super Admin: tất cả = 200.
- [ ] Test ma trận đỏ nếu ai đó đổi tiền tố quyền ở một chỗ.
- [ ] `npm --prefix admin run test:ui` xanh, trong đó `GameplayPage.test.tsx` khẳng định nút ghi/duyệt/xuất bản hiển thị hoặc bị ẩn theo quyền `gameplay:*` của từng role; `GameplayPage.tsx` không còn `can("configuration:` nào (hiện có 6).

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-10 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Có test hồi quy ĐỎ trên mã cũ và XANH trên mã đã sửa (ghi lại cách chứng minh).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
npm --prefix admin run test:ui
node docs/ai-planning/evidence/repro-admin-bugs.mjs
grep -n 'can("configuration:' admin/src/GameplayPage.tsx || echo "sạch"
```

**Rủi ro**

- Người dùng hiện tại có thể mất/được thêm quyền nếu cấu hình khác giả định — kiểm tra role đang dùng trước khi triển khai.

##### Story US-ADM-3

> Là vận hành viên, tôi muốn throttle đăng nhập hoạt động đúng cả sau reverse proxy.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| ADM-04 | Throttle đăng nhập đúng sau reverse proxy và giới hạn bộ nhớ | P2 | S (2) | S1 | not_started |

###### ADM-04 — Throttle đăng nhập đúng sau reverse proxy và giới hạn bộ nhớ

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | security / P2 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 1 |
| Người thực hiện | agent |
| Dependencies | — |
| Quyết định chặn | — |
| Gap liên quan | GAP-305 |
| Trạng thái | not_started |

**Mô tả.** Throttle khoá theo `req.socket.remoteAddress` (`admin/server/app.mjs` dòng 98–103). README yêu cầu chạy sau reverse proxy tin cậy → mọi người dùng chung một bucket: 5 lần sai của BẤT KỲ AI cũng khoá cả đội 15 phút. Map `attempts` không bị giới hạn kích thước. (Xác nhận bằng đọc code; chưa chạy sau proxy thật.)

**Affected files**

- `admin/server/app.mjs`
- `admin/server/index.mjs`
- `admin/.env.example`
- `admin/README.md`
- `admin/tests/server.test.mjs`

**Implementation steps (subtask)**

1. `ADM-04.1` — Thêm biến môi trường `ADMIN_TRUST_PROXY` (mặc định tắt) → tham số `trustProxy` của `createAdminServer`.
2. `ADM-04.2` — Khi bật: lấy IP khách từ PHẦN TỬ CUỐI của `X-Forwarded-For` do proxy tin cậy thêm vào; khi tắt: bỏ qua header (chống giả mạo).
3. `ADM-04.3` — Khoá throttle thêm theo email (đếm theo tài khoản) để chặn tấn công phân tán; giữ ngưỡng 5 lần / 15 phút.
4. `ADM-04.4` — Giới hạn kích thước `attempts` (ví dụ 10.000 khoá) và dọn mục hết hạn.
5. `ADM-04.5` — Test với `now` giả: (a) tắt proxy + header giả → vẫn gộp theo socket; (b) bật proxy → hai IP khác nhau không ảnh hưởng nhau; (c) throttle theo email; (d) map bị chặn kích thước.
6. `ADM-04.6` — Cập nhật `.env.example` và README (mục Deployment boundary).

**Acceptance criteria**

- [ ] Khi bật proxy, client A bị khoá không ảnh hưởng client B.
- [ ] Khi tắt proxy, đổi `X-Forwarded-For` không thoát được throttle.
- [ ] Map `attempts` không tăng vô hạn.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Có test hồi quy ĐỎ trên mã cũ và XANH trên mã đã sửa (ghi lại cách chứng minh).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
```

#### Feature FT-ADM-3 — Dữ liệu gọn và mã sạch

Retention/compaction; loại bỏ mã chết và chữ lỗi thời.

##### Story US-ADM-4

> Là vận hành viên, tôi muốn kho dữ liệu không phình vô hạn và API danh sách nhẹ.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| ADM-05 | Retention/compaction cho audit, versions và API danh sách release gọn | P3 | M (3) | S6 | not_started |

###### ADM-05 — Retention/compaction cho audit, versions và API danh sách release gọn

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | refactor / P3 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 6 |
| Người thực hiện | agent |
| Dependencies | OPS-01 |
| Quyết định chặn | DEC-05 |
| Gap liên quan | GAP-114 |
| Trạng thái | not_started |

**Mô tả.** Mỗi `mutate` clone và ghi lại TOÀN BỘ `store.json`; sự kiện audit `save` nhúng nguyên `values`; `versions` và `story.releases` (mỗi release là cả một story ~54 KB) tăng vô hạn; `GET /api/content/story` trả TẤT CẢ release. (Xác nhận bằng đọc code; chưa đo tăng trưởng thực tế.) Có thể bị thay thế một phần bởi OPS-02 nếu chuyển sang SQL.

**Affected files**

- `admin/server/app.mjs`
- `admin/server/configuration.mjs`
- `admin/server/story.mjs`
- `admin/src/StoryPage.tsx`
- `admin/tests/story.test.mjs`
- `admin/tests/configuration.test.mjs`
- `admin/README.md`
- `docs/configuration-management.md`
- `docs/story-cms.md`

**Implementation steps (subtask)**

1. `ADM-05.1` — Chốt chính sách retention (đề xuất: giữ 50 version/môi trường, 5.000 audit; thay `values` của audit cũ hơn 100 sự kiện bằng hash + kích thước).
2. `ADM-05.2` — Không bao giờ xoá bản đang published hay bản mà rollback còn tham chiếu.
3. `ADM-05.3` — `GET /api/content/story` trả `releases` dạng tóm tắt (id, createdAt, status, size); thêm `GET /api/content/story/releases/:id` trả bản đầy đủ.
4. `ADM-05.4` — Cập nhật `StoryPage.tsx` tải bản đầy đủ khi xem trước/sao chép release.
5. `ADM-05.5` — Test: compaction giữ bất biến (published còn nguyên, rollback hoạt động); danh sách tóm tắt nhỏ; UI test xem trước release.
6. `ADM-05.6` — Cập nhật docs — lưu ý `docs/configuration-management.md` hiện nói audit chứa saved values.

**Acceptance criteria**

- [ ] Sau 200 lần save, `store.json` không tăng tuyến tính theo kích thước `values`.
- [ ] Rollback vẫn hoạt động tới mọi version còn giữ.
- [ ] GET danh sách release < 5 KB với 50 release.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-05 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
npm --prefix admin run test:ui
(cd admin && npx tsc --noEmit)
```

##### Story US-ADM-5

> Là dev, tôi muốn mã chết và chữ lỗi thời trong Admin được dọn.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| ADM-06 | Dọn mã chết và chữ lỗi thời trong Admin | P3 | S (2) | S6 | not_started |

###### ADM-06 — Dọn mã chết và chữ lỗi thời trong Admin

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | refactor / P3 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 6 |
| Người thực hiện | agent |
| Dependencies | ADM-03 |
| Quyết định chặn | — |
| Gap liên quan | GAP-116 |
| Trạng thái | not_started |

**Mô tả.** `main.tsx` định tuyến `configuration` sang `ConfigurationPage`, nên nhánh `configuration` (modal "New configuration", `api.createConfig`, kiểu `Config`) trong `ModulePage` của `pages.tsx` là mã chết; endpoint legacy `POST /api/configuration` vẫn tồn tại; chữ ở trang System ("Audit history shows configuration creation actions") đã lỗi thời vì audit nay gồm configuration/gameplay/story.

**Affected files**

- `admin/src/pages.tsx`
- `admin/src/services/api.ts`
- `admin/server/app.mjs`
- `admin/README.md`
- `admin/tests/server.test.mjs`

**Implementation steps (subtask)**

1. `ADM-06.1` — Xoá nhánh `configuration` cùng modal/`confirm` liên quan khỏi `ModulePage`; xoá `createConfig` và kiểu `Config` nếu không còn dùng.
2. `ADM-06.2` — Giữ endpoint legacy nhưng đánh dấu deprecated: thêm header `Deprecation: true` và ghi chú README (không xoá để không phá client cũ); test giữ nguyên hành vi 201/400.
3. `ADM-06.3` — Sửa chữ cảnh báo trang System cho đúng (nêu đủ các loại audit).
4. `ADM-06.4` — Chạy tsc, UI test và test server.

**Acceptance criteria**

- [ ] `tsc --noEmit` sạch; không còn tham chiếu `createConfig`.
- [ ] Endpoint legacy trả header `Deprecation`.
- [ ] `npm --prefix admin run test:ui` và `npm --prefix admin test` xanh; chữ cảnh báo trang System (`pages.tsx`) không còn cụm "configuration creation actions" và nêu đủ các loại audit hiện có (configuration, gameplay, story).

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
(cd admin && npx tsc --noEmit)
npm --prefix admin test
npm --prefix admin run test:ui
grep -rn "createConfig" admin/src || echo "không còn tham chiếu"
grep -rn "configuration creation actions" admin/src || echo "sạch"
```

#### Feature FT-ADM-4 — Giao diện chịu lỗi

Lỗi render ở một trang không làm trắng cả ứng dụng Admin.

##### Story US-ADM-6

> Là vận hành viên, tôi muốn một lỗi hiển thị ở một trang không làm mất menu và phiên làm việc của tôi.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| ADM-07 | ErrorBoundary cho Admin SPA: lỗi render không làm trắng cả trang | P3 | S (2) | S5 | not_started |

###### ADM-07 — ErrorBoundary cho Admin SPA: lỗi render không làm trắng cả trang

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | bug / P3 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 5 |
| Người thực hiện | agent |
| Dependencies | — |
| Quyết định chặn | — |
| Gap liên quan | GAP-204 |
| Trạng thái | not_started |

**Mô tả.** Admin SPA không có `ErrorBoundary` (`grep -rn "ErrorBoundary|componentDidCatch|getDerivedStateFromError|errorElement" admin/src` → rỗng; GAP-204). Một ngoại lệ trong lúc render bất kỳ trang nào (ví dụ `RuntimePreview` của Gameplay Studio gọi `new Enemy(...).render(ctx)` với dữ liệu bất thường, hoặc payload API ngoài dự kiến) làm React gỡ toàn bộ cây: trang trắng, mất cả menu. Cần một boundary quanh `<Outlet />` trong `Shell` (`admin/src/main.tsx:140–142`) để lỗi chỉ ảnh hưởng vùng nội dung, kèm nút thử lại và tự đặt lại khi người dùng chuyển route.

**Affected files**

- `admin/src/components/ErrorBoundary.tsx (mới)`
- `admin/src/ErrorBoundary.test.tsx (mới)`
- `admin/src/main.tsx`

**Implementation steps (subtask)**

1. `ADM-07.1` — Viết test ĐỎ trước — `admin/src/ErrorBoundary.test.tsx` (Vitest + Testing Library, theo mẫu `GameplayPage.test.tsx`): một component con ném lỗi khi render bên trong boundary → hiện thông báo lỗi và nút "Thử lại" (không hiển thị stack trace); phần tử ngoài boundary (menu giả) vẫn còn; đổi `resetKey` hoặc bấm "Thử lại" thì render lại con khi đã hết lỗi. Dùng `vi.spyOn(console, "error").mockImplementation(() => {})` để không in nhiễu.
2. `ADM-07.2` — Tạo `admin/src/components/ErrorBoundary.tsx`: class component (`getDerivedStateFromError` + `componentDidCatch` ghi `console.error`), prop `resetKey`; giao diện lỗi dùng `Result`/`Alert` của antd (đã có trong dự án) — KHÔNG hiển thị `error.stack`, không `dangerouslySetInnerHTML`.
3. `ADM-07.3` — Bọc `<Outlet />` trong `Shell` (`main.tsx:141`) bằng `<ErrorBoundary resetKey={location.pathname}>` để đổi route thì boundary tự đặt lại; chạy `npm --prefix admin run test:ui` và `npx tsc --noEmit` (trong `admin/`).

**Acceptance criteria**

- [ ] Test mới ĐỎ khi chưa có boundary và XANH sau khi thêm.
- [ ] Lỗi render trong một trang không làm mất menu/topbar của Shell; chuyển route thì lỗi tự xoá.
- [ ] Giao diện lỗi không lộ stack trace; `tsc --noEmit` sạch; 10 test UI cũ vẫn xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin run test:ui
(cd admin && npx tsc --noEmit)
npm --prefix admin test
```

**Rủi ro**

- ErrorBoundary chỉ bắt lỗi trong lúc render/vòng đời, KHÔNG bắt lỗi trong event handler hay promise (các lỗi đó đã đi qua `useNotifications`/`ErrorState`).

## EP-SEC

### Bảo mật nội dung & chuỗi cung ứng

**Mục tiêu:** Nội dung CMS không thể chèn mã vào game; phụ thuộc được kiểm định định kỳ.  
**Ưu tiên epic:** P1

#### Feature FT-SEC-1 — Hiển thị nội dung CMS an toàn

Phòng thủ nhiều lớp: client render an toàn + server từ chối markup.

##### Story US-SEC-1

> Là người chơi, tôi muốn văn bản do CMS cung cấp không bao giờ thực thi như mã.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| SEC-01 | Vá sink XSS: không đưa văn bản CMS vào innerHTML | P1 | S (2) | S0 | done |

###### SEC-01 — Vá sink XSS: không đưa văn bản CMS vào innerHTML

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | security / P1 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 0 |
| Người thực hiện | agent |
| Dependencies | — |
| Quyết định chặn | — |
| Gap liên quan | GAP-304 |
| Trạng thái | done (2026-11-10) |

**Mô tả.** `src/ui/UIManager.js:843` gán `btnStoryNext.innerHTML = <span>${slide.actionPrompt || ...}</span>`. `actionPrompt` là chuỗi CMS (key `slides.INTRO.N.actionPrompt` trong Story CMS) mà `validateStory` chỉ kiểm "là string". Content Editor (hoặc tài khoản bị chiếm) có thể publish `<img src=x onerror=...>` và mã chạy trên trình duyệt người chơi khi game nạp `VITE_STORY_CONTENT_URL`. Nếu game và admin chung origin (hướng dẫn triển khai khuyến nghị), mã còn có thể gọi `/api` với cookie phiên của quản trị viên đang chơi. (Xác nhận bằng đọc source; chưa chạy khai thác.) `MetaUI` đã có `escapeStoryText` cho nhật ký/mảnh ký ức; các `innerHTML` còn lại của UIManager dùng hằng số.

**Affected files**

- `src/ui/UIManager.js`
- `src/ui/MetaUI.js`
- `src/core/Game.js`
- `test-story-lore.js`

**Implementation steps (subtask)**

1. `SEC-01.1` — Thêm helper `setButtonLabel(btn, text)` trong UIManager: xoá con, tạo `<span>` bằng `document.createElement`, gán `textContent`; thay 5 vị trí `btnStoryNext.innerHTML` (dòng 841, 843, 893, 922, 954).
2. `SEC-01.2` — Rà soát mọi `innerHTML` còn lại trong `UIManager.js` (11 vị trí) và `MetaUI.js` (12 vị trí); ghi bảng nguồn dữ liệu (hằng số / CMS) vào evidence. Chuỗi CMS nào còn vào innerHTML phải qua `escapeStoryText` hoặc chuyển sang `textContent`.
3. `SEC-01.3` — Thêm test hồi quy vào `test-story-lore.js`: cài story có `slides.INTRO.0.actionPrompt = "<img src=x onerror=alert(1)>"`, gọi `showStorySlide(0)`, kiểm chứng phần tử nhãn KHÔNG nhận markup (dùng phần tử giả ghi lại setter `innerHTML` và `textContent`) và `textContent` đúng bằng chuỗi payload.
4. `SEC-01.4` — Xác nhận test ĐỎ trên mã cũ.
5. `SEC-01.5` — Chạy `node test-story-lore.js` và `npm test`.

**Acceptance criteria**

- [ ] Payload hiển thị dạng chữ; không có phần tử/handler nào được tạo.
- [ ] Test hồi quy đỏ trên mã cũ, xanh trên mã mới.
- [ ] Có bảng rà soát chứng minh không còn `innerHTML` nào nội suy dữ liệu CMS chưa escape.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Có test hồi quy ĐỎ trên mã cũ và XANH trên mã đã sửa (ghi lại cách chứng minh).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node test-story-lore.js
npm test
grep -nE "btnStoryNext\.innerHTML" src/ui/UIManager.js || echo "không còn"
```

##### Story US-SEC-2

> Là chủ dự án, tôi muốn server từ chối markup trong nội dung ngay từ lúc lưu (phòng thủ nhiều lớp).

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| SEC-02 | Validator story từ chối markup và chuỗi quá dài | P2 | S (2) | S1 | not_started |

###### SEC-02 — Validator story từ chối markup và chuỗi quá dài

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | security / P2 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 1 |
| Người thực hiện | agent |
| Dependencies | SEC-01 |
| Quyết định chặn | — |
| Gap liên quan | GAP-304 |
| Trạng thái | not_started |

**Mô tả.** Phòng thủ nhiều lớp cho SEC-01: `validateStory` (shared/story/engine.js) hiện chỉ kiểm giá trị locale là string. Đã kiểm seed: 243 chuỗi locale, 0 chuỗi chứa `<` hoặc `>`, chuỗi dài nhất 302 ký tự → quy tắc mới không phá nội dung hiện có.

**Affected files**

- `shared/story/engine.js`
- `admin/tests/story.test.mjs`
- `docs/story-cms.md`
- `admin/src/StoryPage.tsx`

**Implementation steps (subtask)**

1. `SEC-02.1` — Thêm vào `validateStory` mã vấn đề `markup` (severity error) cho chuỗi locale chứa `<`, `>` hoặc ký tự điều khiển U+0000–U+0008, U+000B, U+000C, U+000E–U+001F; và `length` (error) khi > 2.000 ký tự.
2. `SEC-02.2` — Hành vi: `markup`/`length` chặn publish (422); POST draft vẫn lưu được (như các lỗi đồ thị) nhưng trả issues. Xác nhận `installStory` (runtime game) cũng từ chối story mang lỗi này.
3. `SEC-02.3` — Test: seed → không phát sinh issue mới; chuỗi `<b>x</b>` → `markup`; chuỗi 2.001 ký tự → `length`; publish bị 422.
4. `SEC-02.4` — Xác nhận StoryPage hiển thị các mã issue mới.
5. `SEC-02.5` — Cập nhật `docs/story-cms.md`.

**Acceptance criteria**

- [ ] Seed không phát sinh issue mới.
- [ ] Publish story có markup bị 422.
- [ ] `installStory` từ chối story có markup.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Có test hồi quy ĐỎ trên mã cũ và XANH trên mã đã sửa (ghi lại cách chứng minh).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
node test-story-lore.js
```

#### Feature FT-SEC-2 — Vệ sinh chuỗi cung ứng

Audit phụ thuộc + cập nhật tự động.

##### Story US-SEC-3

> Là chủ dự án, tôi muốn phụ thuộc được audit và cập nhật định kỳ.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| SEC-03 | Audit phụ thuộc và cấu hình Dependabot | P2 | S (2) | S1 | not_started |

###### SEC-03 — Audit phụ thuộc và cấu hình Dependabot

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | security / P2 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 1 |
| Người thực hiện | agent |
| Dependencies | FND-05 |
| Quyết định chặn | — |
| Gap liên quan | GAP-201, GAP-405 |
| Trạng thái | not_started |

**Mô tả.** Chưa từng chạy audit (không có CI, không có `.github`). Hai cây phụ thuộc: root (pnpm: vite 8, vite-plugin-singlefile) và admin (npm: react 19, antd 5, vite 7, vitest 5, …). Hai major Vite khác nhau. Việc quét lỗ hổng KHÔNG được thực hiện trong giai đoạn lập kế hoạch vì cần truy cập mạng.

**Affected files**

- `.github/dependabot.yml (mới)`
- `.github/workflows/ci.yml`
- `docs/ai-planning/evidence/audit-baseline.md (mới)`

**Implementation steps (subtask)**

1. `SEC-03.1` — Chạy `pnpm audit --prod` (root) và `npm --prefix admin audit` (cần mạng); lưu bản tóm tắt vào `docs/ai-planning/evidence/audit-baseline.md` (có ngày chạy; không dán dữ liệu nhạy cảm).
2. `SEC-03.2` — Với mỗi lỗ hổng mức cao/nghiêm trọng: nâng phiên bản trong PR riêng hoặc thêm task BUG vào tasks.json.
3. `SEC-03.3` — Tạo `.github/dependabot.yml` cho `npm` (thư mục `/` và `/admin`) và `github-actions`; lịch hàng tuần; gom nhóm bản vá.
4. `SEC-03.4` — Thêm bước audit vào CI ở chế độ `continue-on-error: true` cho tới khi baseline sạch rồi chuyển thành bắt buộc.

**Acceptance criteria**

- [ ] Có báo cáo baseline audit kèm ngày chạy.
- [ ] Dependabot cấu hình hợp lệ.
- [ ] CI hiển thị kết quả audit.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Có test hồi quy ĐỎ trên mã cũ và XANH trên mã đã sửa (ghi lại cách chứng minh).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
pnpm audit --prod
npm --prefix admin audit
gh workflow list
```

## EP-RUN

### Tích hợp Gameplay Content vào runtime game

**Mục tiêu:** Nội dung enemy/boss/wave publish từ Admin thật sự điều khiển game, có fallback an toàn.  
**Ưu tiên epic:** P1

#### Feature FT-RUN-1 — Đưa content đến game

Đặc tả ánh xạ và bộ nạp content có fallback.

##### Story US-RUN-1

> Là Game Designer, tôi muốn có đặc tả rõ trường nào của content tác động gì đến game.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| RUN-01 | Đặc tả ánh xạ Gameplay Content → runtime và ADR chọn mô hình tích hợp | P1 | M (3) | S2 | not_started |

###### RUN-01 — Đặc tả ánh xạ Gameplay Content → runtime và ADR chọn mô hình tích hợp

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | docs / P1 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 2 |
| Người thực hiện | agent+human |
| Dependencies | — |
| Quyết định chặn | DEC-02 |
| Gap liên quan | GAP-101 |
| Trạng thái | not_started |

**Mô tả.** Admin xuất bản `contentSchema` (enemies/bosses/waves) nhưng game KHÔNG có consumer nào (grep `gameplay-content|game-content|validateContent` trong `src/`, `main.js`, `scripts/` → 0 kết quả). Schema và game lệch về mô hình: content là lịch spawn theo THỜI GIAN TUYỆT ĐỐI (`start`, `offset`, `interval`, `direction`, `bossId`) còn `WaveSystem` điều khiển theo SỐ LƯỢNG và điều kiện hết quái; content có `health/damage/abilities/statusEffects/spawnProbability/category` trong khi game dùng hàng đợi rune, `ENEMY_TYPES`, `BOSS_GIMMICKS` cố định theo loại boss (`Enemy.js:21–26`), `bossPhases`/`bossLives`. GDD §5 (WaveConfig/EnemyTemplate) lại là schema thứ ba, khác cả hai.

**Affected files**

- `docs/gameplay-content-runtime.md (mới)`
- `shared/gameplay-content.js`
- `shared/gameplay-content.types.ts`
- `docs/gameplay-content-editors.md`

**Implementation steps (subtask)**

1. `RUN-01.1` — [NGƯỜI] Chờ DEC-02 và chốt các điểm mơ hồ: ngữ nghĩa `statusEffects` (áp lên ai), `spawnProbability` (dùng ở đâu khi group đã chỉ định `enemyId`), `category: elite` ↔ `eliteModifier` (`armored`|`swift`), `health` ↔ độ dài hàng đợi rune, `damage` ↔ sát thương chạm người chơi, `waves[].difficulty` ↔ hệ số.
2. `RUN-01.2` — Viết `docs/gameplay-content-runtime.md`: ADR (bối cảnh, lựa chọn, hệ quả) và BẢNG ánh xạ MỌI trường lá của schema (dùng ký hiệu `enemies[].health`) → consumer runtime (`ENEMY_TYPES`, `Enemy.init`, `WaveSystem.queueSpawn`, `BOSS_GIMMICKS`, `StatusEffects`, `CombatSystem.rules`) với trạng thái `supported | ignored(cảnh báo) | unsupported(từ chối)`.
3. `RUN-01.3` — Định nghĩa ngữ nghĩa thời gian: đồng hồ kịch bản chỉ chạy khi đang chơi (không tính pause/intermission/countdown), điều kiện hoàn thành wave (đã spawn hết và `hostile = 0`), điều kiện thắng/thua của chế độ, xử lý wave lệch khoảng.
4. `RUN-01.4` — Quy định hợp đồng lỗi/fallback: content không hợp lệ hoặc mất mạng → game chạy như không có content, không ném lỗi.
5. `RUN-01.5` — Nếu cần trường mới (ví dụ `eliteModifier`): nêu rõ phải nâng `CONTENT_SCHEMA_VERSION` lên 2 và kế hoạch migrate bản nháp/bản publish cũ (validator strict từ chối trường thiếu). KHÔNG tự đổi schema trong task này.
6. `RUN-01.6` — [NGƯỜI] Chủ dự án duyệt ADR.

**Acceptance criteria**

- [ ] Mọi trường lá của `contentSchema` có đúng một dòng trong bảng ánh xạ với trạng thái rõ ràng.
- [ ] ADR nêu lý do chọn mô hình và hệ quả với Story/Endless (không đổi).
- [ ] Các điểm mơ hồ ở bước 1 đều có quyết định bằng văn bản.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-02 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Tài liệu được rà soát chính tả/liên kết; mọi con số trích dẫn có thể tái tạo bằng lệnh nêu trong tài liệu.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node -e "import('./shared/gameplay-content.js').then(m=>{const leaves=[];(function w(s,p){if(s.type==='object')for(const [k,v] of Object.entries(s.fields))w(v,p?p+'.'+k:k);else if(s.type==='array')w(s.item,p+'[]');else leaves.push(p)})(m.contentSchema,'');const doc=require('fs').readFileSync('docs/gameplay-content-runtime.md','utf8');const miss=leaves.filter(f=>!doc.includes(f));console.log('trường lá:',leaves.length,'thiếu trong tài liệu:',miss.length);if(miss.length){console.log(miss.join('\n'));process.exit(1)}})"
```

##### Story US-RUN-2

> Là người chơi, tôi muốn game nạp nội dung đã publish nhưng vẫn chạy bình thường khi mạng/nội dung hỏng.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| RUN-02 | Bộ nạp RemoteGameplayContent: nạp, kiểm tra, đóng băng, fallback | P1 | M (3) | S2 | not_started |

###### RUN-02 — Bộ nạp RemoteGameplayContent: nạp, kiểm tra, đóng băng, fallback

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P1 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 2 |
| Người thực hiện | agent |
| Dependencies | RUN-01, UXL-05 |
| Quyết định chặn | DEC-02 |
| Gap liên quan | GAP-101 |
| Trạng thái | not_started |

**Mô tả.** Game chỉ có `RemoteConfiguration` (cấu hình) và `loadPublishedStory` (story). Cần bộ nạp tương tự cho `GET /api/game-content/:environment` (công khai, chỉ trả bản đã publish).

**Affected files**

- `src/core/RemoteGameplayContent.js (mới)`
- `main.js`
- `test-remote-content.js (mới)`
- `tests/manifest.json`
- `README.md`
- `docs/gameplay-content-editors.md`

**Implementation steps (subtask)**

1. `RUN-02.1` — Tạo `RemoteGameplayContent` mô phỏng `RemoteConfiguration`: `load(url, environment, fetcher)` dùng `credentials: "omit"`, timeout 2,5 s (`AbortSignal.timeout`), chỉ chấp nhận khi `schemaVersion === CONTENT_SCHEMA_VERSION`, `environment` khớp (`ENVIRONMENTS`), `id` là string và `validateContent(values)` trả `[]`; thành công → `freezeConfig(structuredClone(...))`; mọi lỗi → `published = null`, trả `false`, KHÔNG ném.
2. `RUN-02.2` — `pin()` trả bản sao đóng băng (hoặc `null` khi không có content).
3. `RUN-02.3` — Nối vào `main.js` với `VITE_GAME_CONTENT_URL` và `VITE_GAME_CONTENT_ENV` (mặc định theo `VITE_GAME_CONFIG_ENV`), gắn `game.remoteContent`; nạp SONG SONG với cấu hình/story (theo cấu trúc UXL-05).
4. `RUN-02.4` — Viết `test-remote-content.js` với `fetcher` giả: thành công; 404; `ok:false`; JSON hỏng; timeout/abort; `schemaVersion` sai; `environment` sai; `values` không hợp lệ; đối tượng trả về bị đóng băng sâu.
5. `RUN-02.5` — Đăng ký test vào manifest; ghi biến môi trường mới vào README và docs.

**Acceptance criteria**

- [ ] Mọi trường hợp lỗi → `published = null` và game khởi động bình thường.
- [ ] Đối tượng content đã nạp bất biến (deep-frozen).
- [ ] Không có lệnh gọi mạng nào khi không đặt `VITE_GAME_CONTENT_URL`.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-02 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node test-remote-content.js
npm test
npx vite build --outDir "$(mktemp -d)" --emptyOutDir
```

#### Feature FT-RUN-2 — Gameplay điều khiển bằng content

Enemy, wave, boss, trạng thái, chế độ chơi.

##### Story US-RUN-3

> Là Game Designer, tôi muốn enemy và lịch wave tôi thiết kế xuất hiện đúng trong game.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| RUN-03 | Adapter enemy: content enemy → cấu hình spawn của game | P1 | M (3) | S3 | not_started |
| RUN-04 | ScriptedWaveSource: phát lại timeline content qua WaveSystem | P1 | L (5) | S3 | not_started |
| RUN-06 | Ánh xạ trạng thái (slow/stun) và elite modifier cho enemy từ content | P2 | M (3) | S3 | not_started |

###### RUN-03 — Adapter enemy: content enemy → cấu hình spawn của game

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P1 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 3 |
| Người thực hiện | agent |
| Dependencies | RUN-02, ARC-01 |
| Quyết định chặn | DEC-02 |
| Gap liên quan | GAP-101 |
| Trạng thái | not_started |

**Mô tả.** Game tạo enemy từ "spawn config" `{ archetype, symbolQueue, speedMultiplier, isBoss, bossPhases, bossLives, eliteModifier, … }` tại `Game.js` ~dòng 1252–1377 (`newEnemy.init({...})`). Cần hàm thuần chuyển một `EnemyDefinition` (shared/gameplay-content.js) thành đúng cấu hình đó theo bảng ánh xạ RUN-01.

**Affected files**

- `src/core/ContentAdapter.js (mới)`
- `src/entities/Enemy.js`
- `src/core/Game.js`
- `test-content-adapter.js (mới)`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `RUN-03.1` — Viết `enemyToSpawnConfig(def, ctx)` thuần/tất định: `archetype` ← `def.archetype` (kiểm tra thuộc `ENEMY_TYPES`); `symbolQueue` ← lấy mẫu `def.health` rune từ `def.gestures` bằng RNG truyền vào (không gọi `Math.random` trực tiếp); `speedMultiplier` ← `def.speed / ENEMY_TYPES[archetype].baseSpeed`; `scoreValue` ← `def.score`; `contactDamage` ← `def.damage`; `eliteModifier` theo ADR.
2. `RUN-03.2` — Mở rộng `Enemy.init(config)` nhận `scoreValue` và `contactDamage` tùy chọn (mặc định giữ hành vi cũ) và đường gây sát thương chạm người chơi dùng `contactDamage` nếu có (đọc đường hiện tại trong `Game.updatePlaying` và `CombatSystem.rules.damage.player`).
3. `RUN-03.3` — Trong khối spawn (`Game.js` ~dòng 1348) chuyển tiếp các trường mới vào `newEnemy.init`.
4. `RUN-03.4` — Test đơn vị adapter (giá trị biên: `health` nhỏ nhất/lớn nhất theo ADR; `speed` rất nhỏ; `gestures` rỗng → lỗi rõ ràng) và test `Enemy.init` giữ nguyên hành vi cũ khi không có trường mới.
5. `RUN-03.5` — Chạy toàn bộ test; golden-master của ARC-01 phải không đổi.

**Acceptance criteria**

- [ ] Adapter thuần: cùng input + cùng seed → cùng output.
- [ ] Không đổi hành vi Story/Endless (golden-master xanh).
- [ ] Trường không hỗ trợ bị bỏ qua kèm cảnh báo theo ADR (không ném).

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-02 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node test-content-adapter.js
npm test
```

**Rủi ro**

- Khối spawn nằm trong `Game.updatePlaying`; mọi `this.xxx` mới dùng ở đó phải có trong harness (ARC-01 đã thay các fake-context).

###### RUN-04 — ScriptedWaveSource: phát lại timeline content qua WaveSystem

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P1 |
| Độ phức tạp / SP | L / 5 |
| Sprint | 3 |
| Người thực hiện | agent |
| Dependencies | RUN-02, ARC-01 |
| Quyết định chặn | DEC-02 |
| Gap liên quan | GAP-101 |
| Trạng thái | not_started |

**Mô tả.** `contentTimeline(content)` (shared/gameplay-content.js) đã sinh danh sách `{ time, waveId, enemyId, direction }` (kể cả boss tại `w.start`) nhưng hiện chỉ dùng để xem trước trong admin. `WaveSystem` đã có đường chèn spawn ngoài kế hoạch `queueSpawn()` (surprises và boss gimmick đi qua đây). Khối chọn vị trí ở `Game.js` ~dòng 1299–1346 chỉ dùng cạnh ngẫu nhiên/đội hình — cần hỗ trợ `direction` (left/right/top/bottom/random).

**Affected files**

- `src/systems/ScriptedWaveSource.js (mới)`
- `src/systems/WaveSystem.js`
- `src/entities/Enemy.js`
- `src/core/Game.js`
- `test-scripted-waves.js (mới)`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `RUN-04.1` — Tạo `ScriptedWaveSource(content, adapterCtx)`: nhận timeline đã sắp xếp; `advance(dt)` chỉ cộng đồng hồ khi được gọi (WaveSystem gọi khi đang chơi, không pause/intermission/hold) và trả các spawn đã đến hạn (mỗi spawn = `enemyToSpawnConfig(...)` + `spawnSide`).
2. `RUN-04.2` — Tích hợp `WaveSystem.setScript(source|null)`: khi có script, `update()` lấy spawn từ script thay cho bộ sinh ngẫu nhiên nhưng GIỮ cơ chế hoàn thành wave (đã spawn hết và `hostileEnemiesCount === 0` → `onWaveComplete`) và điều kiện thắng theo ADR. `script = null` (Story/Endless) không đổi.
3. `RUN-04.3` — Hỗ trợ `direction`: thêm `Enemy.getEdgePosition(side, w, h)` (left/right/top/bottom; `random` dùng RNG của wave) và trong khối chọn vị trí của `Game.js` dùng `enemyConfig.spawnSide` nếu có, GIỮ khoảng cách an toàn tới người chơi (`minSafeDist`).
4. `RUN-04.4` — Tất định: dùng `waveRng(seed, wave)` có sẵn (Challenge.js) cho mọi lựa chọn ngẫu nhiên trong script.
5. `RUN-04.5` — Test: timeline mẫu spawn đúng thời điểm (sai số ≤ 1 frame), thứ tự, hướng; pause/intermission không làm đồng hồ chạy; boss tại `w.start`.
6. `RUN-04.6` — Chạy toàn bộ test + golden-master (Story/Endless không đổi).

**Acceptance criteria**

- [ ] Mô phỏng 60 s với timeline mẫu cho đúng chuỗi spawn kỳ vọng (thời điểm, enemy, hướng).
- [ ] Tạm dừng game làm đồng hồ kịch bản đứng yên.
- [ ] Khi `script = null`, mọi test hiện có và golden-master xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-02 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node test-scripted-waves.js
npm test
```

**Rủi ro**

- Chạm khối spawn trong `Game.updatePlaying` — rủi ro hồi quy lõi; chỉ làm sau khi ARC-01 có harness.

###### RUN-06 — Ánh xạ trạng thái (slow/stun) và elite modifier cho enemy từ content

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 3 |
| Người thực hiện | agent |
| Dependencies | RUN-03 |
| Quyết định chặn | DEC-02 |
| Gap liên quan | GAP-101, GAP-103 |
| Trạng thái | not_started |

**Mô tả.** `CombatSystem` có `eliteModifiers` (armored chặn 1 đòn, swift +20% tốc) nhưng KHÔNG có producer: `WaveSystem` không bao giờ phát `eliteModifier` (docs/combat.md: "does not randomly turn existing waves into elites"); chỉ `Game.js:1351, 1371, 1451` tiêu thụ. `StatusEffects` (slow/stun) có sẵn. Content có `category: elite` và `statusEffects[]` nhưng chưa có ánh xạ. Admin cũng chỉ lộ 3/5 cờ combat (thiếu `spellLoadout`, `eliteModifiers`).

**Affected files**

- `src/core/ContentAdapter.js`
- `src/combat/StatusEffects.js`
- `src/combat/CombatSystem.js`
- `src/core/Game.js`
- `shared/game-configuration.js`
- `test-content-status.js (mới)`
- `tests/manifest.json`
- `docs/combat.md`

**Implementation steps (subtask)**

1. `RUN-06.1` — Theo ADR RUN-01: `category: elite` → `eliteModifier` (và/hoặc trường mới nếu schema được nâng); bật cờ `eliteModifiers` cho chế độ nội dung qua `combat.rules.flags` mà không đổi mặc định toàn cục.
2. `RUN-06.2` — `statusEffects[]` → `StatusEffects.apply` lên đúng đối tượng theo ngữ nghĩa ADR (slow = `speedMultiplier`; stun = dừng di chuyển), dùng cơ chế refresh-by-longest-duration sẵn có.
3. `RUN-06.3` — Có lộ `spellLoadout`/`eliteModifiers` cho admin hay không (sửa `shared/game-configuration.js`)? Đây là thay đổi phá vỡ schema (nâng `SCHEMA_VERSION`) → tách thành task riêng; trong task này CHỈ ghi nhận quyết định.
4. `RUN-06.4` — Test: enemy elite armored chặn đúng 1 đòn; swift nhanh +20%; slow/stun áp đúng thời lượng; enemy thường không bị ảnh hưởng.
5. `RUN-06.5` — Cập nhật `docs/combat.md` (producer nay tồn tại cho chế độ nội dung).

**Acceptance criteria**

- [ ] Enemy `elite` từ content hiển thị modifier và hành xử đúng.
- [ ] Cờ `eliteModifiers` không bị bật cho Story/Endless.
- [ ] Test đơn vị xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-02 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node test-content-status.js
node tests/combat.test.js
npm test
```

##### Story US-RUN-4

> Là Game Designer, tôi muốn boss với các pha và khả năng tôi thiết kế hoạt động đúng trong game.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| RUN-05 | Adapter boss: pha, ngưỡng HP và khả năng (gimmick) theo dữ liệu | P1 | L (5) | S4 | not_started |

###### RUN-05 — Adapter boss: pha, ngưỡng HP và khả năng (gimmick) theo dữ liệu

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P1 |
| Độ phức tạp / SP | L / 5 |
| Sprint | 4 |
| Người thực hiện | agent |
| Dependencies | RUN-03 |
| Quyết định chặn | DEC-02 |
| Gap liên quan | GAP-101 |
| Trạng thái | not_started |

**Mô tả.** Boss hiện cứng theo loại: `BOSS_GIMMICKS` (`Enemy.js:21–26`: hide/Thủ Thư, swirl/Đầu Bếp, meteors/Planetarium, sprint/HLV, flicker/Master) và `bossPhases`/`bossLives` trong `LEVEL_CONFIGS`; `Enemy.init` đặt `this.gimmick = BOSS_GIMMICKS[this.type]` (~dòng 402). Content cho phép boss với `phases[]` (`hpThreshold`, `transition`, `abilities`, `gestures`, `gestureRule`, `summons`) và `abilities[].kind ∈ {hide, swirl, meteors, sprint, flicker}` — trùng bộ gimmick hiện có nhưng cấu hình tuỳ ý.

**Affected files**

- `src/core/ContentAdapter.js`
- `src/entities/Enemy.js`
- `src/systems/WaveSystem.js`
- `src/core/Game.js`
- `test-content-boss.js (mới)`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `RUN-05.1` — Viết `bossToSpawnConfig(def, ctx)`: `archetype` thuộc `BOSS_*`; `bossPhases` ← `phases[].gestures` (mỗi pha một hàng đợi rune theo `gestureRule` ordered/random/repeat); `bossLives` ← số pha (hoặc theo ADR); ánh xạ `hpThreshold` (giảm dần, pha đầu = 1) sang ranh giới mất mạng.
2. `RUN-05.2` — Cho phép `Enemy.init` nhận `config.gimmick` (`kind`, `firstDelay` ← `cooldown`, `interval`, `duration`, `name` ← `warning`) ghi đè `BOSS_GIMMICKS[type]`; mặc định giữ nguyên.
3. `RUN-05.3` — `summons` (tham chiếu `enemies[]`) cấp danh sách enemy dùng cho minion của boss thay cho `_generateBossMinionConfig` khi có; giữ trần minion hiện tại.
4. `RUN-05.4` — Đồng bộ `transition` (`immediate | after-ability | after-summons`) với máy trạng thái flinch/retreat có sẵn; ghi những gì chưa hỗ trợ vào bảng ánh xạ.
5. `RUN-05.5` — Test: boss đổi pha đúng thứ tự; gimmick tuỳ chỉnh phát `gimmickEvent` đúng chu kỳ; boss không cấu hình giữ nguyên hành vi cũ (golden-master).

**Acceptance criteria**

- [ ] Boss từ content đổi pha và kích hoạt gimmick đúng theo dữ liệu.
- [ ] Boss của Story (không dùng content) không đổi hành vi.
- [ ] Trường chưa hỗ trợ nằm trong bảng ánh xạ với trạng thái rõ.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-02 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node test-content-boss.js
npm test
```

**Rủi ro**

- Có thể đòi hỏi refactor Enemy lớn hơn dự kiến (file 2.991 dòng).

##### Story US-RUN-5

> Là người chơi, tôi muốn một chế độ chơi dùng nội dung tùy chỉnh mà không ảnh hưởng Story/Endless.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| RUN-07 | Chế độ "Chiến dịch tùy chỉnh": pin snapshot, fallback, phạm vi lưu | P1 | M (3) | S4 | not_started |

###### RUN-07 — Chế độ "Chiến dịch tùy chỉnh": pin snapshot, fallback, phạm vi lưu

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P1 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 4 |
| Người thực hiện | agent |
| Dependencies | RUN-04, RUN-05, RUN-06 |
| Quyết định chặn | DEC-02 |
| Gap liên quan | GAP-101 |
| Trạng thái | not_started |

**Mô tả.** Đưa các adapter vào một chế độ chơi hoàn chỉnh theo ADR (khuyến nghị: chế độ riêng, tách khỏi Story/Endless). Cần pin content bất biến theo từng ván như cách `runConfiguration` được pin (`Game.resetGameData`, `Game.js:932`), fallback khi không có content, và không làm ô nhiễm kỷ lục/lưu của Story/Endless.

**Affected files**

- `src/core/Game.js`
- `src/core/StateMachine.js`
- `src/core/ProgressStore.js`
- `src/core/RunSave.js`
- `src/ui/UIManager.js`
- `src/ui/MetaUI.js`
- `index.html`
- `test-content-mode.js (mới)`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `RUN-07.1` — Thêm `Game.startContentCampaign()` (chỉ khả dụng khi `remoteContent.published` có và hợp lệ): đặt `game.contentRun = remoteContent.pin()` trong `resetGameData` (bản sao đóng băng), tạo `ScriptedWaveSource` từ nó và gọi `waveSystem.setScript(...)`.
2. `RUN-07.2` — MỌI đường bắt đầu ván KHÔNG phải chế độ này (MenuState.enter, startDaily, resumeEndless, Boss Rush, nút Victory) phải xoá `contentRun` và script — như `bossRush` (Game.js:107, 2651, 2692; StateMachine.js:29; UIManager.js:351, 364).
3. `RUN-07.3` — Phạm vi v1 (giảm rủi ro): ván chế độ này KHÔNG ghi kỷ lục, không autosave/tiếp tục, không trao Mảnh Ký Ức/Lời Hứa, không mở khoá đồng hành (đúng tinh thần Boss Rush). Ghi rõ trong docs; mở rộng ở task sau nếu chủ dự án muốn.
4. `RUN-07.4` — UI: nút "Chiến dịch tùy chỉnh" trên menu chỉ hiện khi có content; guard mọi truy cập DOM (test Node mock DOM tối giản: `getElementById` trả một stub, không có `style`/`toggle`).
5. `RUN-07.5` — Fallback: content bị gỡ/hỏng → nút ẩn, các chế độ khác y nguyên. Viết test cho từng đường reset ở bước 2.

**Acceptance criteria**

- [ ] Ván chế độ mới chạy đúng timeline; thoát về menu rồi vào Story không còn dấu vết content.
- [ ] Không có content → menu và hành vi không đổi.
- [ ] Không ghi kỷ lục/save/lore trong chế độ mới.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-02 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node test-content-mode.js
npm test
```

#### Feature FT-RUN-3 — Xác minh & phản hồi cho người vận hành

Test tích hợp; chỉ báo trường nào được runtime hỗ trợ.

##### Story US-RUN-6

> Là dev, tôi muốn test tích hợp từ publish đến spawn để tránh hồi quy.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| RUN-08 | Test tích hợp publish → nạp → mô phỏng (và các kịch bản fallback) | P1 | M (3) | S4 | not_started |

###### RUN-08 — Test tích hợp publish → nạp → mô phỏng (và các kịch bản fallback)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P1 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 4 |
| Người thực hiện | agent |
| Dependencies | RUN-07, ADM-02 |
| Quyết định chặn | — |
| Gap liên quan | GAP-101 |
| Trạng thái | not_started |

**Mô tả.** Hiện không có test nào đi từ Admin API tới game. Cần test chạy server admin thật (thư mục dữ liệu tạm), publish content qua HTTP, để `RemoteGameplayContent` nạp bằng `fetch` loopback, rồi dùng `Game` (qua harness) mô phỏng N giây và kiểm chứng spawn khớp `contentTimeline`.

**Affected files**

- `tests/content-runtime.integration.test.js (mới)`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `RUN-08.1` — Khởi động `createAdminServer` (`admin/server/app.mjs`, chỉ dùng module có sẵn của Node) với `dataDir` tạm và cổng 0; đăng nhập Super Admin; thực hiện save → validate → review → publish nội dung mẫu (≥ 100 KB, tận dụng ADM-02).
2. `RUN-08.2` — Cấu hình `RemoteGameplayContent` trỏ tới `http://127.0.0.1:<port>/api/game-content/development`; nạp; tạo Game bằng `createTestGame()` (ARC-01); `startContentCampaign()`; mô phỏng bằng `game.update(dt)` cố định.
3. `RUN-08.3` — So sánh chuỗi spawn thực tế với `contentTimeline(content)` (thời điểm ±1 frame, enemyId → archetype, hướng).
4. `RUN-08.4` — Kịch bản fallback: server trả 404 (chưa publish), server tắt, JSON sai, schema sai, timeout → game chạy bình thường và không có chế độ nội dung.
5. `RUN-08.5` — Dọn chắc chắn: đóng server, xoá thư mục tạm kể cả khi test lỗi.

**Acceptance criteria**

- [ ] Chuỗi spawn khớp timeline đã publish.
- [ ] Mọi kịch bản fallback giữ game hoạt động như không có content.
- [ ] Không để lại server hay thư mục tạm.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node tests/content-runtime.integration.test.js
npm test
```

##### Story US-RUN-7

> Là Game Designer, tôi muốn thấy trường nào được runtime hỗ trợ ngay trong editor.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| RUN-09 | Chỉ báo "runtime hỗ trợ" trong editor và cập nhật tài liệu | P3 | S (2) | S4 | not_started |

###### RUN-09 — Chỉ báo "runtime hỗ trợ" trong editor và cập nhật tài liệu

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P3 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 4 |
| Người thực hiện | agent |
| Dependencies | RUN-07 |
| Quyết định chặn | — |
| Gap liên quan | GAP-101 |
| Trạng thái | not_started |

**Mô tả.** `docs/gameplay-content-editors.md` (mục "Runtime integration boundary") nói game "chưa" dùng content; sau RUN-07 cần cập nhật. Trường bị runtime bỏ qua phải hiện ngay trong editor để Game Designer không đoán mò.

**Affected files**

- `shared/gameplay-content.runtime-support.js (mới)`
- `admin/src/GameplayPage.tsx`
- `admin/src/GameplayPage.test.tsx`
- `docs/gameplay-content-editors.md`
- `docs/gameplay-content-runtime.md`

**Implementation steps (subtask)**

1. `RUN-09.1` — Tạo `shared/gameplay-content.runtime-support.js` (map đường dẫn trường → `supported | ignored | unsupported`) làm NGUỒN DUY NHẤT; bảng ánh xạ trong docs đối chiếu với file này (test kiểm tra mọi trường lá của schema đều có mặt).
2. `RUN-09.2` — GameplayPage: gắn nhãn nhỏ cạnh trường `ignored/unsupported` (tooltip giải thích); không chặn lưu.
3. `RUN-09.3` — Cập nhật `docs/gameplay-content-editors.md`: bỏ câu "does not yet consume", mô tả chế độ chơi và cách bật (`VITE_GAME_CONTENT_URL`).
4. `RUN-09.4` — Test UI: nhãn hiển thị cho trường `ignored`; test: mọi trường lá của `contentSchema` đều có trong map.

**Acceptance criteria**

- [ ] Mọi trường schema có trạng thái hỗ trợ.
- [ ] Editor hiển thị nhãn cho trường không được hỗ trợ.
- [ ] Docs không còn nói game không dùng content.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin run test:ui
(cd admin && npx tsc --noEmit)
npm test
```

## EP-BAL

### Đồng bộ đặc tả & cân bằng

**Mục tiêu:** Một nguồn sự thật về số liệu cân bằng; độ khó đo được, tái lập được.  
**Ưu tiên epic:** P2

#### Feature FT-BAL-1 — Nguồn sự thật cân bằng

BALANCE.md sinh từ code; GDD trỏ về đó.

##### Story US-BAL-1

> Là Game Designer, tôi muốn một tài liệu duy nhất ghi đúng số liệu cân bằng đang chạy.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| BAL-01 | docs/BALANCE.md sinh từ code và đối chiếu GDD | P2 | M (3) | S2 | not_started |
| BAL-02 | Áp dụng quyết định DDA (triển khai hoặc loại bỏ luật combo ≥ 15) | P3 | S (2) | S3 | not_started |

###### BAL-01 — docs/BALANCE.md sinh từ code và đối chiếu GDD

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | docs / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 2 |
| Người thực hiện | agent |
| Dependencies | — |
| Quyết định chặn | DEC-01 |
| Gap liên quan | GAP-102 |
| Trạng thái | not_started |

**Mô tả.** GDD (v1.0.0) lệch code ở nhiều điểm đã xác minh: 6 vs 8 rune (thêm `circle` ❄️ Frost Nova, `spiral` 🌀 Gale Shockwave); combo decay 2.2 s vs 2.4 s (`COMBO_CONFIG.DECAY_TIME`); i-frame 1.0 s vs 1.2 s (`PLAYER_CONFIG.INVULNERABLE_DURATION`); vòng nguy hiểm 120 vs 140 px; Endless N = ⌊8+4·W^1.18⌋ vs ⌊(10+5·W^1.22)·(HARDCORE 1.25)⌋ (`WaveSystem.js:142`); khoảng spawn max(0.55, 2.6·e^(-0.09(W-1))) vs max(0.45, 2.2·e^(-0.11(W-1))·mult) (`:143`); tốc độ min(1.75, 1+0.05(W-1)) vs min(2.2, (1.1+0.08(W-1))·mult) (`:144`); ghost tim 5–15% vs 8/15/24% theo HP; 3 mức độ khó NORMAL/HARDCORE/INFERNO không có trong GDD; DDA "combo ≥ 15 → +10% tốc độ" chưa triển khai; mô tả DDA HP ≤ 2 tự mâu thuẫn ("giảm I_spawn 15%" nhưng "quái ra thưa hơn", trong khi code nhân khoảng spawn ×1.10).

**Affected files**

- `docs/BALANCE.md (mới)`
- `scripts/print-balance.mjs (mới)`
- `docs/GDD.md`
- `src/core/Constants.js`
- `src/systems/WaveSystem.js`

**Implementation steps (subtask)**

1. `BAL-01.1` — [NGƯỜI] Chờ DEC-01 (khuyến nghị A: code là chuẩn).
2. `BAL-01.2` — Viết `scripts/print-balance.mjs` import trực tiếp `Constants.js` và `WaveSystem` để in số liệu thật (độ khó, LEVEL_CONFIGS, công thức Endless cho W = 1..15, trọng số archetype, xác suất ghost tactical, combo/HP/i-frame/danger) — tránh chép tay.
3. `BAL-01.3` — Tạo `docs/BALANCE.md` từ đầu ra của script (kèm lệnh tái tạo) cùng bảng "GDD vs code" cho từng điểm lệch.
4. `BAL-01.4` — Cập nhật `docs/GDD.md` (chỉ tài liệu): banner đầu §2–§4 trỏ về BALANCE.md; sửa danh mục rune (8), thêm 3 mức độ khó, sửa các số đã lệch; KHÔNG sửa §8–§9 (đã đồng bộ với code).
5. `BAL-01.5` — Luật DDA được xử lý ở BAL-02.

**Acceptance criteria**

- [ ] Mọi số trong BALANCE.md tái tạo được bằng `node scripts/print-balance.mjs`.
- [ ] Mọi điểm lệch GDD↔code nêu ở trên đều có dòng đối chiếu.
- [ ] GDD không còn mâu thuẫn với code ở các mục đã liệt kê.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-01 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Tài liệu được rà soát chính tả/liên kết; mọi con số trích dẫn có thể tái tạo bằng lệnh nêu trong tài liệu.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/print-balance.mjs
git diff --stat -- src/
```

###### BAL-02 — Áp dụng quyết định DDA (triển khai hoặc loại bỏ luật combo ≥ 15)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P3 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 3 |
| Người thực hiện | agent |
| Dependencies | BAL-01 |
| Quyết định chặn | DEC-01 |
| Gap liên quan | GAP-102 |
| Trạng thái | not_started |

**Mô tả.** GDD §3.2.E có hai luật DDA: HP ≤ 2 (nới độ khó) và combo ≥ 15 (+10% tốc độ đợt sau). Code chỉ có HP ≤ 2 (khoảng spawn ×1.10, ghost tim 24%); luật combo ≥ 15 không tồn tại (grep trong `Game.js`, `WaveSystem.js` không có kết quả).

**Affected files**

- `docs/GDD.md`
- `docs/BALANCE.md`
- `src/systems/WaveSystem.js`
- `src/core/Game.js`
- `test-difficulty-scaling.js`

**Implementation steps (subtask)**

1. `BAL-02.1` — [NGƯỜI] Theo DEC-01: nhánh A (loại bỏ luật) hoặc B (triển khai).
2. `BAL-02.2` — Nhánh A: xoá luật combo ≥ 15 khỏi GDD §3.2.E, ghi hành vi HP ≤ 2 thực tế vào BALANCE.md; không đổi code.
3. `BAL-02.3` — Nhánh B: thêm tín hiệu `comboPeak` từ Game sang `WaveSystem` (qua `advanceEffects` hoặc hook cuối wave — KHÔNG thêm `this.xxx` mới vào `updatePlaying`), áp +10% `speedMultiplier` cho đợt kế tiếp khi combo cao nhất đạt ≥ 15; thêm test vào `test-difficulty-scaling.js`.
4. `BAL-02.4` — Cập nhật BALANCE.md theo nhánh đã chọn.

**Acceptance criteria**

- [ ] Nhánh A: GDD không còn nhắc luật chưa triển khai.
- [ ] Nhánh B: test chứng minh +10% tốc độ đợt sau khi combo ≥ 15 và không tác dụng khi combo < 15.
- [ ] Không đổi hành vi Story/Endless ngoài luật mới.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-01 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm test
node scripts/print-balance.mjs
```

#### Feature FT-BAL-2 — Độ khó đo được

Harness mô phỏng tất định + snapshot test.

##### Story US-BAL-2

> Là Game Designer, tôi muốn mô phỏng tất định để thấy tác động của thay đổi cân bằng.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| BAL-03 | Harness mô phỏng cân bằng tất định và snapshot test | P3 | M (3) | S3 | not_started |

###### BAL-03 — Harness mô phỏng cân bằng tất định và snapshot test

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P3 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 3 |
| Người thực hiện | agent |
| Dependencies | BAL-01, TST-03 |
| Quyết định chặn | — |
| Gap liên quan | GAP-102 |
| Trạng thái | not_started |

**Mô tả.** Chưa có công cụ đo hệ quả của thay đổi cân bằng: chỉ có test khẳng định từng giá trị. Cần mô phỏng headless (không cần `Game`) chạy `WaveSystem` với seed cố định cho các độ khó/màn/wave và xuất chỉ số.

**Affected files**

- `scripts/simulate-balance.mjs (mới)`
- `tests/balance.snapshot.test.js (mới)`
- `tests/fixtures/balance-snapshot.json (mới)`
- `tests/manifest.json`
- `docs/BALANCE.md`

**Implementation steps (subtask)**

1. `BAL-03.1` — Viết `simulate-balance.mjs`: với mỗi độ khó × (Story màn 1–5, Endless W = 1..15) gieo `waveSystem.setSeed(seed)`, giả lập người chơi lý tưởng hạ mọi ghost sau T giây, thu: số spawn, khoảng spawn hiệu dụng, phân bố archetype, tỉ lệ ghost tactical, tổng rune, thời gian tối thiểu hoàn thành.
2. `BAL-03.2` — Đầu ra JSON ổn định (sắp khoá, làm tròn) và bảng Markdown.
3. `BAL-03.3` — Viết snapshot test so với `tests/fixtures/balance-snapshot.json`; có cờ `--update` có chủ đích để cập nhật snapshot.
4. `BAL-03.4` — Đăng ký vào manifest; mô tả cách dùng trong BALANCE.md.

**Acceptance criteria**

- [ ] Cùng seed → cùng JSON (chạy 2 lần cho cùng hash).
- [ ] Đổi một hằng cân bằng bất kỳ làm snapshot test đỏ.
- [ ] Test không ghi file ra ngoài.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/simulate-balance.mjs --seed 1 | shasum
node scripts/simulate-balance.mjs --seed 1 | shasum
node tests/balance.snapshot.test.js
```

## EP-IPA

### IP, tài sản (asset) & thương hiệu

**Mục tiêu:** Không còn hotlink/asset không rõ giấy phép; tên sản phẩm thống nhất; có LICENSE và NOTICES.  
**Ưu tiên epic:** P1

#### Feature FT-IPA-1 — Runtime tuân thủ

Không hotlink; có kiểm kê asset/IP.

##### Story US-IPA-1

> Là chủ dự án, tôi muốn game không tải tài nguyên trực tiếp từ máy chủ bên thứ ba.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| IPA-02 | Gỡ URL dự phòng tải tài nguyên trực tiếp từ google.com | P1 | S (2) | S0 | done |

###### IPA-02 — Gỡ URL dự phòng tải tài nguyên trực tiếp từ google.com

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | security / P1 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 0 |
| Người thực hiện | agent |
| Dependencies | TST-03 |
| Quyết định chặn | — |
| Gap liên quan | GAP-310 |
| Trạng thái | done (2026-11-10) |

**Mô tả.** Hai chỗ trong runtime có URL cuối cùng trỏ thẳng tới máy chủ Google: `src/systems/SoundSystem.js:1817` (`https://www.google.com/logos/2016/halloween16/r4/${name}.mp3`) và `src/entities/Player.js:97` (`.../${sheetName}`). Nếu mọi bản sao cục bộ không nạp được, game tải tài nguyên của bên thứ ba từ máy chủ của họ (đồng thời để lộ IP người chơi cho Google).

**Affected files**

- `src/systems/SoundSystem.js`
- `src/entities/Player.js`
- `tests/no-hotlinks.test.js (mới)`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `IPA-02.1` — Xoá hai URL khỏi danh sách `candidates`; bảo đảm khi mọi ứng viên cục bộ thất bại thì `_loadAudioTrack` trả `null` và sprite rơi về nhánh vẽ vector, không ném lỗi (xác nhận qua `test-sound-system.js`, `test-character-visuals.js`).
2. `IPA-02.2` — Thêm `tests/no-hotlinks.test.js`: quét `src/` và `main.js`, thất bại nếu có chuỗi `https?://` ngoài allowlist có lý do (ví dụ `www.w3.org` cho namespace SVG; `arcane-paws.game` chỉ là giá trị dự phòng chia sẻ). Phông Google Fonts nằm trong `index.html` (ngoài phạm vi quét; xử lý ở IPA-07/DEC-09).
3. `IPA-02.3` — Đăng ký test vào `tests/manifest.json`.
4. `IPA-02.4` — Chạy các suite sound/visual/character.

**Acceptance criteria**

- [ ] `grep -rn "google.com/logos" src main.js` không có kết quả.
- [ ] Test no-hotlinks đỏ khi thêm lại URL ngoài allowlist.
- [ ] Các suite sound/visual/character xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Có test hồi quy ĐỎ trên mã cũ và XANH trên mã đã sửa (ghi lại cách chứng minh).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
grep -rn "google.com/logos" src main.js || echo "sạch"
node tests/no-hotlinks.test.js
npm test
```

##### Story US-IPA-2

> Là chủ dự án, tôi muốn bảng kiểm kê asset với nguồn gốc và tình trạng giấy phép.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| IPA-01 | Kiểm kê asset và dấu vết IP (docs/ASSETS.md) | P1 | S (2) | S1 | not_started |

###### IPA-01 — Kiểm kê asset và dấu vết IP (docs/ASSETS.md)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | docs / P1 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 1 |
| Người thực hiện | agent+human |
| Dependencies | — |
| Quyết định chặn | — |
| Gap liên quan | GAP-401 |
| Trạng thái | not_started |

**Mô tả.** Bằng chứng trong source: `SoundSystem.js:21` ("Extracted directly from official Google Doodle audio sheets (main.mp3, victory.mp3, initial.mp3, end.mp3)"), `momoSprites.js:4` và `Player.js:60–77` ("Extracted directly from Google Doodle level1-png-sprite.png, level1-png1-sprite.png, and main-png-sprite.png"), tiêu đề `Constants.js` ("based on Google Doodle Halloween 2016 (Magic Cat Academy)"); menu hiển thị "MAGIC CAT ACADEMY". Không có bằng chứng giấy phép nào trong repo. Đây là RỦI RO được phát hiện, KHÔNG phải kết luận pháp lý.

**Affected files**

- `docs/ASSETS.md (mới)`

**Implementation steps (subtask)**

1. `IPA-01.1` — Liệt kê MỌI file đang track trong `assets/` và `public/` (và thư mục con) cộng `src/systems/catMeowAudioData.js` (7 KB base64): đường dẫn, kích thước, md5, nơi được tham chiếu trong code.
2. `IPA-01.2` — Với mỗi asset: nguồn gốc theo chú thích code, tình trạng giấy phép (`unknown | verified | original`), hành động đề xuất (`keep | replace | remove`).
3. `IPA-01.3` — Liệt kê dấu vết thương hiệu/IP trong code và tài liệu: "Magic Cat Academy" (9 file), "Google Doodle", URL `google.com/logos/2016/halloween16` (`SoundSystem.js:1817`, `Player.js:97`).
4. `IPA-01.4` — Liệt kê các tài sản ĐƯỢC TẠO TRONG repo (âm thanh tổng hợp Web Audio, chân dung SVG, vẽ canvas) làm nền cho phương án thay thế.
5. `IPA-01.5` — [NGƯỜI] Điền cột nguồn gốc/giấy phép mà chỉ chủ dự án biết; chuẩn bị phương án A/B/C cho DEC-03.

**Acceptance criteria**

- [ ] Mọi file git-tracked trong `assets/` và `public/` có đúng một dòng trong bảng.
- [ ] Mỗi dòng có hành động đề xuất.
- [ ] Có mục riêng cho dấu vết thương hiệu.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Tài liệu được rà soát chính tả/liên kết; mọi con số trích dẫn có thể tái tạo bằng lệnh nêu trong tài liệu.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node -e "const {execSync}=require('child_process');const fs=require('fs');const files=execSync('git ls-files assets public',{encoding:'utf8'}).trim().split('\n');const doc=fs.readFileSync('docs/ASSETS.md','utf8');const miss=files.filter(f=>!doc.includes(f));console.log('đang track:',files.length,'thiếu trong tài liệu:',miss.length);if(miss.length){console.log(miss.join('\n'));process.exit(1)}"
```

#### Feature FT-IPA-2 — Pipeline asset

Dedupe, thay thế, standalone đúng hợp đồng.

##### Story US-IPA-3

> Là dev, tôi muốn một thư mục asset chuẩn, không trùng, không 404.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| IPA-03 | Chuẩn hoá thư mục asset, gỡ bản trùng và sửa đường dẫn 404 | P2 | M (3) | S3 | not_started |

###### IPA-03 — Chuẩn hoá thư mục asset, gỡ bản trùng và sửa đường dẫn 404

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | chore / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 3 |
| Người thực hiện | agent |
| Dependencies | IPA-01, IPA-02, TST-07 |
| Quyết định chặn | — |
| Gap liên quan | GAP-311, GAP-106 |
| Trạng thái | not_started |

**Mô tả.** Cùng một file mp3/png tồn tại ở nhiều nơi (md5 giống hệt, đã đo): `assets/audio/*`, `public/*.mp3`, `public/audio/*.mp3`, `assets/*.png`, `public/*.png`, `public/assets/main-png-sprite.png` (và bản sao trong `dist/`). Smoke test cho thấy loader sprite thử `/assets/level1-png-sprite.png` và `/assets/level1-png1-sprite.png` → 404 rồi mới thấy ở gốc (`public/assets/` chỉ có `main-png-sprite.png`); `public/audio/cat_meow.mp3` không được tham chiếu ở đâu (âm meow đã nhúng base64 trong `catMeowAudioData.js`).

**Affected files**

- `assets/**`
- `public/**`
- `src/entities/Player.js`
- `src/systems/SoundSystem.js`
- `docs/ASSETS.md`

**Implementation steps (subtask)**

1. `IPA-03.1` — Chọn đường dẫn chuẩn: audio ở `public/audio/`, sprite ở `public/assets/` (điều chỉnh theo IPA-01).
2. `IPA-03.2` — Chuyển `level1-png-sprite.png` và `level1-png1-sprite.png` vào `public/assets/`; xoá các bản trùng còn lại SAU KHI `grep -rF` xác nhận không còn tham chiếu.
3. `IPA-03.3` — Rút gọn danh sách `candidates` của `SoundSystem._loadAudioTrack` và `Player._initSpriteSheets` xuống đường dẫn chuẩn cộng biến thể tương đối cho triển khai ở sub-path (`import.meta.env.BASE_URL`).
4. `IPA-03.4` — Xoá `public/audio/cat_meow.mp3` nếu vẫn không được tham chiếu.
5. `IPA-03.5` — Chạy smoke test (TST-07): danh sách 404 asset phải rỗng (favicon xử lý ở UXL-04).
6. `IPA-03.6` — Build ra thư mục tạm và xác nhận bundle/thư mục chứa đủ asset; cập nhật docs/ASSETS.md.

**Acceptance criteria**

- [ ] Mỗi asset chỉ còn đúng một bản trong `git ls-files`.
- [ ] Smoke test không còn 404 asset.
- [ ] Build chứa đủ audio/sprite; suite sound/visual xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
git ls-files "*.mp3" "*.png" | xargs shasum | awk '{print $1}' | sort | uniq -d | wc -l
node scripts/e2e-smoke.mjs
npm test
```

**Rủi ro**

- Đổi đường dẫn có thể làm hỏng triển khai ở sub-path — kiểm tra với `BASE_URL` khác `/`.

##### Story US-IPA-4

> Là chủ dự án, tôi muốn asset có vấn đề được thay thế trước khi phát hành.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| IPA-04 | Thay thế hoặc gỡ asset có nguồn gốc Google Doodle theo DEC-03 | P1 | XL (8) | S4 | not_started |

###### IPA-04 — Thay thế hoặc gỡ asset có nguồn gốc Google Doodle theo DEC-03

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | chore / P1 |
| Độ phức tạp / SP | XL / 8 |
| Sprint | 4 |
| Người thực hiện | agent+human |
| Dependencies | IPA-03 |
| Quyết định chặn | DEC-03 |
| Gap liên quan | GAP-401 |
| Trạng thái | not_started |

**Mô tả.** Thực hiện theo kết quả kiểm kê IPA-01 và DEC-03. Với phương án A: thay toàn bộ audio sheet và sprite nhân vật bằng tài sản gốc/được cấp phép; âm thanh tổng hợp bằng Web Audio đã có sẵn làm dự phòng (`SoundSystem` phát bản "authentic" nếu có). Phần art (khung hoạt hoạ Momo trong `momoSprites.js`, 3 sprite sheet) cần con người/đối tác tạo — không thể hoàn tất chỉ bằng agent.

**Affected files**

- `public/audio/**`
- `public/assets/**`
- `src/entities/momoSprites.js`
- `src/entities/Player.js`
- `src/systems/SoundSystem.js`
- `docs/ASSETS.md`
- `index.html`

**Implementation steps (subtask)**

1. `IPA-04.1` — [NGƯỜI] Xác nhận DEC-03 và cung cấp tài sản thay thế (hoặc phê duyệt phương án tổng hợp/vector).
2. `IPA-04.2` — Định nghĩa `ASSET_MANIFEST` (module nhỏ): danh sách audio sheet/sprite sheet kèm cờ bật/tắt; mặc định phản ánh tình trạng giấy phép (tắt khi chưa rõ).
3. `IPA-04.3` — Khi asset bị tắt: `SoundSystem` dùng nhánh tổng hợp; `Player` vẽ nhân vật vector (kiểm tra nhánh vector đủ chất lượng — liên quan DEC-09).
4. `IPA-04.4` — Thay file asset bằng bản mới (hoặc xoá) và cập nhật `docs/ASSETS.md`: không còn dòng "unknown + keep".
5. `IPA-04.5` — Chạy smoke test ở cả hai chế độ (có/không asset); chạy suite visual/sound.
6. `IPA-04.6` — Cập nhật các chú thích code nói "Extracted directly from Google Doodle".

**Acceptance criteria**

- [ ] Kiểm kê không còn asset ở trạng thái `unknown` với hành động `keep`.
- [ ] Game chạy đầy đủ chức năng khi không có sprite/audio sheet gốc.
- [ ] Build không chứa asset thuộc danh sách `replace/remove`.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-03 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/e2e-smoke.mjs
npm test
git ls-files public assets
```

**Rủi ro**

- Phụ thuộc nguồn lực art/audio bên ngoài — có thể trễ.
- Nhánh vector của Momo có thể kém hấp dẫn hơn sprite gốc (đánh đổi sản phẩm).

##### Story US-IPA-5

> Là người dùng, tôi muốn file standalone hoạt động đúng như tài liệu hứa.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| IPA-07 | Bản standalone tự đủ theo hợp đồng DEC-09 | P3 | M (3) | S5 | not_started |

###### IPA-07 — Bản standalone tự đủ theo hợp đồng DEC-09

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P3 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 5 |
| Người thực hiện | agent |
| Dependencies | IPA-04, TST-07 |
| Quyết định chặn | DEC-09 |
| Gap liên quan | GAP-106 |
| Trạng thái | not_started |

**Mô tả.** `scripts/export-bundle.js` in "100% self-contained" nhưng chỉ kiểm tra không có `<script src>`/CSS ngoài; mp3/png KHÔNG được nhúng (đã đếm: 0 `data:audio`, 0 `data:image/png` trong `arcane-paws-standalone.html`) và `index.html` còn tải Google Fonts từ `fonts.googleapis.com`. Mở qua `file://`: `fetch` audio bị chặn, sprite chỉ chạy nếu thư mục asset nằm cạnh file.

**Affected files**

- `scripts/export-bundle.js`
- `vite.config.js`
- `index.html`
- `src/systems/SoundSystem.js`
- `src/entities/Player.js`
- `scripts/e2e-smoke.mjs`
- `docs/ASSETS.md`

**Implementation steps (subtask)**

1. `IPA-07.1` — [NGƯỜI] Chờ DEC-09 (A: tổng hợp thuần; B: nhúng base64 asset được cấp phép; C: sửa tài liệu cho đúng thực tế).
2. `IPA-07.2` — A: bảo đảm bản standalone chạy đủ không cần asset ngoài (âm thanh tổng hợp + nhân vật vector) và thay Google Fonts bằng font hệ thống/`@font-face` nhúng nếu giấy phép cho phép. B: thêm bước inline asset thành data URI chỉ cho bản standalone (`export-bundle.js`) và để loader đọc từ đó. C: chỉ sửa tài liệu/thông báo của script.
3. `IPA-07.3` — Sửa `export-bundle.js` kiểm tra thật (không thiếu tham chiếu `data:`, không request ngoài) thay vì chỉ kiểm tra thẻ.
4. `IPA-07.4` — Mở rộng smoke test (`--standalone`) mở bản standalone qua `file://` và đếm request mạng ngoài (kỳ vọng 0 với A/B).
5. `IPA-07.5` — Cập nhật README/docs.

**Acceptance criteria**

- [ ] A/B: mở `file://` không phát sinh request ngoài, không lỗi console, có âm thanh; C: tài liệu đúng sự thật.
- [ ] Kích thước standalone được ghi nhận và nằm trong ngân sách REL-03.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-09 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/e2e-smoke.mjs --standalone
npm run build
npm test
```

#### Feature FT-IPA-3 — Danh tính & giấy phép

Tên sản phẩm thống nhất; LICENSE/NOTICES.

##### Story US-IPA-6

> Là chủ dự án, tôi muốn tên sản phẩm nhất quán mọi nơi.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| IPA-05 | Thống nhất tên sản phẩm trong UI, metadata và tài liệu | P2 | S (2) | S3 | not_started |

###### IPA-05 — Thống nhất tên sản phẩm trong UI, metadata và tài liệu

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | chore / P2 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 3 |
| Người thực hiện | agent |
| Dependencies | — |
| Quyết định chặn | DEC-04 |
| Gap liên quan | GAP-401 |
| Trạng thái | not_started |

**Mô tả.** Tên hiện không nhất quán: GDD "Arcane Paws: Spellscribe"; `index.html` (title, meta description, tiêu đề menu "MAGIC CAT ACADEMY"); admin "ARCANE PAWS"; `main.js` "Arcane Paws: Spellscribe". "Magic Cat Academy" xuất hiện trong 9 file (docs/GDD.md, index.html ×3, Constants.js, Player.js, BackgroundRenderer.js, SoundSystem.js, CharacterPortraits.js, StoryCanvasRenderer.js, WizardCardRenderer.js ×2) — một phần là chú thích nguồn gốc, một phần là tên hiển thị/thẻ chia sẻ.

**Affected files**

- `index.html`
- `docs/GDD.md`
- `package.json`
- `src/ui/WizardCardRenderer.js`
- `src/ui/CharacterPortraits.js`
- `src/ui/StoryCanvasRenderer.js`
- `scripts/export-bundle.js`
- `admin/index.html`
- `README.md`

**Implementation steps (subtask)**

1. `IPA-05.1` — [NGƯỜI] Chờ DEC-04.
2. `IPA-05.2` — Đổi `<title>`, meta description, tiêu đề menu và thẻ chia sẻ (`WizardCardRenderer.js`) sang tên đã chọn.
3. `IPA-05.3` — Đổi `name`/`description` trong `package.json`, tiêu đề README/GDD, chuỗi trong `scripts/export-bundle.js`, tiêu đề `admin/index.html` nếu cần.
4. `IPA-05.4` — Đổi JSDoc `@description` mô tả TÊN SẢN PHẨM ở `src/ui/CharacterPortraits.js` (dòng 3) và `src/ui/StoryCanvasRenderer.js` (dòng 3) — hai dòng này nằm trong phạm vi grep của tiêu chí chấp nhận nên phải đổi cùng task.
5. `IPA-05.5` — Chú thích nêu nguồn gốc asset dạng "Google Doodle Halloween 2016 (Magic Cat Academy)" (`Constants.js`, `Player.js`, `SoundSystem.js`, `BackgroundRenderer.js`) thuộc IPA-04, KHÔNG đổi ở task này; chúng nằm ngoài phạm vi grep của tiêu chí chấp nhận.
6. `IPA-05.6` — Chạy toàn bộ test (một số test có thể khoá chuỗi hiển thị) và smoke test.

**Acceptance criteria**

- [ ] `grep -rniE "magic cat academy" index.html src/ui docs/GDD.md README.md` không còn kết quả (khi DEC-04 = A hoặc B).
- [ ] `npm test` (gốc) xanh sau khi đổi tên; mọi test khoá chuỗi hiển thị cũ được cập nhật theo tên mới — không xoá hoặc nới assertion để làm xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-04 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
grep -rniE "magic cat academy" index.html src/ui docs/GDD.md README.md || echo "sạch"
npm test
```

##### Story US-IPA-7

> Là chủ dự án, tôi muốn LICENSE và thông báo bên thứ ba đầy đủ.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| IPA-06 | Thêm LICENSE và THIRD_PARTY_NOTICES.md | P2 | XS (1) | S4 | not_started |

###### IPA-06 — Thêm LICENSE và THIRD_PARTY_NOTICES.md

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | docs / P2 |
| Độ phức tạp / SP | XS / 1 |
| Sprint | 4 |
| Người thực hiện | agent+human |
| Dependencies | IPA-04 |
| Quyết định chặn | DEC-03 |
| Gap liên quan | GAP-202, GAP-401 |
| Trạng thái | not_started |

**Mô tả.** `package.json` khai báo `"license": "ISC"` nhưng repo không có file LICENSE; bản phân phối chứa mã của thư viện bên thứ ba (admin: react, react-dom, antd, @ant-design/icons, react-router-dom) và asset. Cần thông báo bên thứ ba cho những gì được phân phối.

**Affected files**

- `LICENSE (mới)`
- `THIRD_PARTY_NOTICES.md (mới)`
- `package.json`
- `admin/package.json`
- `docs/ASSETS.md`

**Implementation steps (subtask)**

1. `IPA-06.1` — [NGƯỜI] Xác nhận giấy phép của dự án (mặc định giữ ISC theo package.json).
2. `IPA-06.2` — Tạo `LICENSE` tương ứng.
3. `IPA-06.3` — Tạo `THIRD_PARTY_NOTICES.md`: dependency được ĐÓNG GÓI vào bản phân phối (game: xác minh bằng nội dung bundle — runtime hầu như là mã tự viết; admin: các gói ở trên) kèm giấy phép đọc từ `package.json` của từng gói; asset theo kết quả IPA-04.
4. `IPA-06.4` — Đồng bộ trường `license` ở cả hai package.json.

**Acceptance criteria**

- [ ] Có LICENSE và NOTICES; mọi gói được đóng gói đều có một dòng với giấy phép.
- [ ] NOTICES không chứa asset ở trạng thái `unknown`.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-03 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Tài liệu được rà soát chính tả/liên kết; mọi con số trích dẫn có thể tái tạo bằng lệnh nêu trong tài liệu.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
test -f LICENSE && test -f THIRD_PARTY_NOTICES.md && echo ok
node -e "console.log(require('./package.json').license)"
```

## EP-MOD

### Module vận hành Admin (LiveOps / Players / Analytics)

**Mục tiêu:** Chốt yêu cầu có căn cứ trước khi xây dựng.  
**Ưu tiên epic:** P3

#### Feature FT-MOD-1 — Đặc tả module vận hành

Yêu cầu và hợp đồng dữ liệu cho LiveOps/Players/Analytics.

##### Story US-MOD-1

> Là chủ dự án, tôi muốn yêu cầu có căn cứ cho LiveOps/Players/Analytics trước khi đầu tư.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| MOD-01 | Đặc tả yêu cầu cho Live Operations / Players / Analytics | P3 | S (2) | S6 | not_started |
| MOD-02 | [Parking lot] Telemetry ẩn danh tối thiểu và bảng Analytics | P3 | L (5) | parking | needs_clarification |

###### MOD-01 — Đặc tả yêu cầu cho Live Operations / Players / Analytics

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | docs / P3 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 6 |
| Người thực hiện | agent+human |
| Dependencies | — |
| Quyết định chặn | DEC-06 |
| Gap liên quan | GAP-104 |
| Trạng thái | not_started |

**Mô tả.** Ba module chỉ là khung: `/api/{liveops,players,analytics}` trả `items: [], integration: "not_connected"`; Dashboard hiển thị `—` cho activePlayers/gameSessions/scheduledEvents; game không gửi telemetry nào (không có lệnh gọi mạng nào ngoài việc nạp config/story). Không có yêu cầu sản phẩm nào trong repo cho các module này.

**Affected files**

- `docs/admin-modules-requirements.md (mới)`
- `admin/src/pages.tsx`
- `admin/server/policy.mjs`
- `docs/ai-planning/tasks.json`

**Implementation steps (subtask)**

1. `MOD-01.1` — [NGƯỜI] Chốt DEC-06 và mục tiêu kinh doanh của từng module.
2. `MOD-01.2` — Viết `docs/admin-modules-requirements.md`: người dùng/vai trò, user story, dữ liệu cần thu (sự kiện telemetry ẩn danh, không PII, opt-in, thời hạn lưu), API phác thảo, quyền (khớp `policy.mjs`), tiêu chí chấp nhận, độ ưu tiên.
3. `MOD-01.3` — Đề xuất lược đồ sự kiện telemetry tối thiểu và đánh giá rủi ro quyền riêng tư (đồng ý, trẻ em — GDD nhắm tới casual players).
4. `MOD-01.4` — Sinh task triển khai (MOD-02…) vào `tasks.json` theo quy trình thông thường (có phụ thuộc, sprint, AC), hoặc ghi rõ "chưa cần" nếu DEC-06 = A.
5. `MOD-01.5` — Nếu DEC-06 = A: ẩn các mục menu chưa kết nối (thay đổi nhỏ ở `modules`/`main.tsx`).

**Acceptance criteria**

- [ ] Tài liệu có yêu cầu và tiêu chí chấp nhận cho từng module được chọn.
- [ ] Task triển khai (nếu có) đã vào `tasks.json` và `plan.mjs validate` vẫn xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-06 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Tài liệu được rà soát chính tả/liên kết; mọi con số trích dẫn có thể tái tạo bằng lệnh nêu trong tài liệu.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node docs/ai-planning/tools/plan.mjs validate
```

###### MOD-02 — [Parking lot] Telemetry ẩn danh tối thiểu và bảng Analytics

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P3 |
| Độ phức tạp / SP | L / 5 |
| Sprint | parking lot (chưa xếp lịch) |
| Người thực hiện | agent+human |
| Dependencies | MOD-01 |
| Quyết định chặn | DEC-06 |
| Gap liên quan | GAP-104 |
| Trạng thái | needs_clarification |

**Mô tả.** Chỉ khởi động khi MOD-01 xác nhận nhu cầu (DEC-06 = B hoặc C). Phạm vi sẽ được tinh chỉnh theo đặc tả MOD-01; hiện chỉ là giữ chỗ để không quên khoảng trống "game telemetry not connected".

**Affected files**

- `docs/admin-modules-requirements.md`
- `admin/server/app.mjs`
- `admin/src/pages.tsx`
- `src/core/Game.js`

**Implementation steps (subtask)**

1. `MOD-02.1` — [NGƯỜI] Xác nhận phạm vi và chính sách quyền riêng tư từ MOD-01.
2. `MOD-02.2` — Định nghĩa lược đồ sự kiện (không PII) và endpoint thu thập có giới hạn tốc độ, kích thước.
3. `MOD-02.3` — Game: gửi sự kiện opt-in, có hàng đợi và tắt được trong Cài Đặt; không ảnh hưởng hiệu năng/khởi động.
4. `MOD-02.4` — Admin: bảng tổng hợp thật thay cho giá trị `—` của Dashboard; quyền `analytics:*`.
5. `MOD-02.5` — Test và tài liệu.

**Acceptance criteria**

- [ ] Dashboard hiển thị số liệu thật từ telemetry.
- [ ] Người chơi có thể tắt telemetry.
- [ ] Lược đồ sự kiện telemetry được liệt kê trong tài liệu; có test khẳng định payload chỉ chứa trường thuộc danh sách cho phép (không IP, không tên/email, không văn bản người chơi nhập) và server loại bỏ trường lạ.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-06 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm test
npm --prefix admin test
```

## EP-OPS

### Sẵn sàng vận hành production cho Admin

**Mục tiêu:** Lưu trữ bền vững, session không mất khi restart, có hướng dẫn triển khai tham chiếu (có điều kiện theo DEC-05).  
**Ưu tiên epic:** P2

#### Feature FT-OPS-1 — Lưu trữ & phiên bền vững

Repository + SQL + session store.

##### Story US-OPS-1

> Là vận hành viên, tôi muốn dữ liệu và phiên đăng nhập sống sót qua restart.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| OPS-01 | Giao diện repository lưu trữ (adapter JSON) tách khỏi app.mjs | P2 | M (3) | S5 | not_started |
| OPS-02 | Adapter SQLite và script migrate từ store.json | P2 | L (5) | S5 | not_started |
| OPS-03 | Session và throttle bền vững (không mất khi restart) | P2 | M (3) | S5 | not_started |
| OPS-06 | [Parking lot] Đa tài khoản và nhà cung cấp danh tính | P3 | XL (8) | parking | needs_clarification |

###### OPS-01 — Giao diện repository lưu trữ (adapter JSON) tách khỏi app.mjs

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | refactor / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 5 |
| Người thực hiện | agent |
| Dependencies | ADM-02, ADM-03 |
| Quyết định chặn | DEC-05 |
| Gap liên quan | GAP-110 |
| Trạng thái | not_started |

**Mô tả.** `app.mjs` vừa lo HTTP vừa tự quản `store` trong bộ nhớ + ghi tệp (`mutate` tuần tự + rename); `configuration.mjs` và `story.mjs` thao tác trực tiếp trên `store()`/`mutate()`. README thừa nhận lưu trữ chỉ phù hợp một tiến trình. Cần một ranh giới để thay bằng SQL.

**Affected files**

- `admin/server/repository.mjs (mới)`
- `admin/server/json-repository.mjs (mới)`
- `admin/server/app.mjs`
- `admin/server/configuration.mjs`
- `admin/server/story.mjs`
- `admin/tests/repository.contract.test.mjs (mới)`
- `admin/tests/server.test.mjs`
- `admin/README.md`

**Implementation steps (subtask)**

1. `OPS-01.1` — [NGƯỜI] Chờ DEC-05 (khác A).
2. `OPS-01.2` — Định nghĩa giao diện: `read()` snapshot bất biến, `transact(fn)` tuần tự có kiểm tra revision, `appendAudit(event)`, hợp đồng lỗi (409…).
3. `OPS-01.3` — Chuyển logic hiện tại (`mutate`, `structuredClone`, ghi `store.tmp` + rename, `mkdir mode 0o700`, file mode 0o600) vào `json-repository.mjs` KHÔNG đổi hành vi.
4. `OPS-01.4` — Sửa `app.mjs`, `configuration.mjs`, `story.mjs` dùng giao diện thay vì `store`/`mutate`.
5. `OPS-01.5` — Viết bộ test HỢP ĐỒNG (`repository.contract.test.mjs`) chạy với mọi adapter: ghi tuần tự không mất cập nhật, 409 khi revision cũ, audit và state cùng một giao dịch, không lộ trạng thái nửa chừng khi lỗi.
6. `OPS-01.6` — Toàn bộ test admin hiện có xanh không sửa assertion.

**Acceptance criteria**

- [ ] 19 test backend hiện có xanh, không đổi assertion.
- [ ] Bộ test hợp đồng xanh trên adapter JSON.
- [ ] Không còn truy cập `store`/`mutate` trực tiếp ngoài repository.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-05 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
grep -rn "mutate(" admin/server
```

###### OPS-02 — Adapter SQLite và script migrate từ store.json

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P2 |
| Độ phức tạp / SP | L / 5 |
| Sprint | 5 |
| Người thực hiện | agent+human |
| Dependencies | OPS-01 |
| Quyết định chặn | DEC-05 |
| Gap liên quan | GAP-110 |
| Trạng thái | not_started |

**Mô tả.** Thay JSON store bằng cơ sở dữ liệu giao dịch cho vận hành một host (SQLite). Chọn thư viện lúc thực hiện: `better-sqlite3` (native, cần build) hoặc module `node:sqlite` tích hợp của Node (xác minh trạng thái ổn định trong phiên bản Node được ghim; phụ thuộc DEC-05). Postgres là lựa chọn cho đa-instance (DEC-05 = C).

**Affected files**

- `admin/server/sqlite-repository.mjs (mới)`
- `admin/scripts/migrate-json-to-sqlite.mjs (mới)`
- `admin/server/index.mjs`
- `admin/package.json`
- `admin/.env.example`
- `admin/tests/repository.contract.test.mjs`
- `admin/README.md`

**Implementation steps (subtask)**

1. `OPS-02.1` — [NGƯỜI] Chốt thư viện SQLite và duyệt việc thêm dependency (cần `npm install`).
2. `OPS-02.2` — Thiết kế lược đồ: `environments(kind, env, revision, draft_json, published_id)`, `versions`, `audit`, `story`, `releases` với khoá ngoại/chỉ mục; mọi thay đổi trong `BEGIN IMMEDIATE … COMMIT`.
3. `OPS-02.3` — Cài `sqlite-repository.mjs` theo hợp đồng OPS-01; chọn adapter bằng `ADMIN_STORAGE=json|sqlite` và `ADMIN_DB_PATH`.
4. `OPS-02.4` — Viết `migrate-json-to-sqlite.mjs` (idempotent, có `--dry-run`, kiểm tra số lượng/hash sau khi chuyển, KHÔNG xoá `store.json`).
5. `OPS-02.5` — Chạy bộ test hợp đồng trên cả hai adapter cộng test đồng thời (nhiều ghi song song, 409 đúng).
6. `OPS-02.6` — Tài liệu: sao lưu (`sqlite3 .backup`), quyền tệp, giới hạn một host.

**Acceptance criteria**

- [ ] Bộ test hợp đồng xanh trên cả hai adapter.
- [ ] Chạy migrate lần 2 không nhân đôi dữ liệu.
- [ ] `ADMIN_STORAGE=json` vẫn là mặc định cho dev.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-05 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
node admin/scripts/migrate-json-to-sqlite.mjs --dry-run
```

**Rủi ro**

- Module native/`node:sqlite` thử nghiệm có thể gây khó khăn cho CI và triển khai.

###### OPS-03 — Session và throttle bền vững (không mất khi restart)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 5 |
| Người thực hiện | agent |
| Dependencies | OPS-02 |
| Quyết định chặn | DEC-05 |
| Gap liên quan | GAP-110 |
| Trạng thái | not_started |

**Mô tả.** Session và `attempts` nằm trong `Map` bộ nhớ (README: "restart invalidates sessions"); mỗi lần `node --watch` khởi động lại buộc đăng nhập lại.

**Affected files**

- `admin/server/app.mjs`
- `admin/server/sqlite-repository.mjs`
- `admin/server/repository.mjs`
- `admin/tests/server.test.mjs`
- `admin/README.md`

**Implementation steps (subtask)**

1. `OPS-03.1` — Mở rộng giao diện repository: `sessions` (băm id, user, expires) và `throttle` (khoá, count, until); chỉ lưu BĂM của token phiên (SHA-256), không lưu token thô.
2. `OPS-03.2` — Chuyển `app.mjs` dùng repository cho session/throttle; dọn mục hết hạn định kỳ.
3. `OPS-03.3` — Giữ cookie `HttpOnly; SameSite=Strict`, TTL 8 giờ, xoay phiên khi đăng nhập.
4. `OPS-03.4` — Test: đóng/mở lại server với cùng DB → phiên còn hiệu lực; hết hạn đúng; throttle còn hiệu lực qua restart.

**Acceptance criteria**

- [ ] Phiên đăng nhập sống sót qua restart tiến trình.
- [ ] Token không được lưu dạng thô trong DB.
- [ ] Mọi test hiện có xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-05 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
```

###### OPS-06 — [Parking lot] Đa tài khoản và nhà cung cấp danh tính

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P3 |
| Độ phức tạp / SP | XL / 8 |
| Sprint | parking lot (chưa xếp lịch) |
| Người thực hiện | agent+human |
| Dependencies | OPS-03 |
| Quyết định chặn | DEC-05 |
| Gap liên quan | GAP-110 |
| Trạng thái | needs_clarification |

**Mô tả.** README: "multi-account management, external identity provider integration, MFA, password recovery and role editing are extension points, not completed features." Hiện chỉ có một tài khoản bootstrap từ biến môi trường. Chỉ cần khi DEC-05 = C (hoặc B kèm nhu cầu nhiều người dùng).

**Affected files**

- `admin/server/app.mjs`
- `admin/server/policy.mjs`
- `admin/src/auth/Auth.tsx`
- `admin/src/pages.tsx`
- `admin/README.md`

**Implementation steps (subtask)**

1. `OPS-06.1` — [NGƯỜI] Chỉ bắt đầu nếu DEC-05 = C (hoặc B có nhu cầu nhiều người dùng).
2. `OPS-06.2` — Bảng `users` (email, scrypt hash, role, trạng thái, mfa), quản lý người dùng trong module System; gán vai trò chỉ ở phía server (không bao giờ nhận role từ client).
3. `OPS-06.3` — Đổi/đặt lại mật khẩu, khoá tài khoản, MFA (TOTP) hoặc tích hợp OIDC.
4. `OPS-06.4` — Audit cho thao tác quản trị người dùng; chặn tự nâng quyền; test phân quyền.

**Acceptance criteria**

- [ ] Nhiều tài khoản hoạt động với role riêng.
- [ ] Không thể tự nâng quyền.
- [ ] Có MFA hoặc IdP theo phạm vi đã chốt.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-05 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
npm --prefix admin run test:ui
```

#### Feature FT-OPS-2 — Triển khai có hướng dẫn

Docker/proxy/CSP/health + xuất bản tĩnh.

##### Story US-OPS-2

> Là vận hành viên, tôi muốn cấu hình triển khai tham chiếu và nội dung publish phục vụ được qua CDN.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| OPS-04 | Cấu hình triển khai tham chiếu: Docker, proxy, CSP, health | P2 | M (3) | S5 | not_started |
| OPS-05 | Xuất bản tĩnh: ghi JSON bất biến cho CDN khi publish | P3 | S (2) | S6 | not_started |

###### OPS-04 — Cấu hình triển khai tham chiếu: Docker, proxy, CSP, health

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | chore / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 5 |
| Người thực hiện | agent+human |
| Dependencies | ADM-04 |
| Quyết định chặn | DEC-05 |
| Gap liên quan | GAP-110 |
| Trạng thái | not_started |

**Mô tả.** README mô tả ranh giới triển khai bằng lời (cùng origin HTTPS, reverse proxy bảo toàn Host/Origin, SPA fallback không áp cho `/api`) nhưng không có artifact nào: không Dockerfile, không cấu hình proxy, không `/api/health`, không CSP/security headers. Các endpoint công khai cho game (`/api/game-config/*`, `/api/game-content/*`, `/api/story-content/published`) đang trả `Cache-Control: no-store` nên mọi lượt mở game đều chạm tiến trình admin.

**Affected files**

- `deploy/Dockerfile (mới)`
- `deploy/nginx.conf (mới)`
- `admin/server/app.mjs`
- `admin/README.md`
- `admin/tests/server.test.mjs`
- `docs/configuration-management.md`

**Implementation steps (subtask)**

1. `OPS-04.1` — [NGƯỜI] Chốt DEC-05 và mục tiêu host.
2. `OPS-04.2` — Thêm `GET /api/health` (không cần đăng nhập, chỉ trả `{"status":"ok"}`, không lộ phiên bản/đường dẫn).
3. `OPS-04.3` — `Dockerfile` đa tầng cho admin (build SPA, chạy server bằng user không phải root, bind loopback phía sau proxy; biến `ADMIN_*` qua env, không đóng gói `.env`).
4. `OPS-04.4` — `nginx.conf` mẫu: HTTPS; `/api` → 127.0.0.1:3001 (giữ Host/Origin); SPA fallback chỉ cho đường không phải `/api`; ALLOWLIST công khai cho 3 GET endpoint nội dung với cache ngắn (ví dụ `max-age=60`); đặt `ADMIN_TRUST_PROXY=1` (ADM-04).
5. `OPS-04.5` — Header bảo mật mẫu: CSP chặt cho SPA admin; CSP cho game (bản single-file có script inline → dùng hash/nonce hoặc `unsafe-inline` có chủ đích), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
6. `OPS-04.6` — Tài liệu hoá; thử bằng `docker build` (nếu có Docker) và `nginx -t` (nếu có nginx).

**Acceptance criteria**

- [ ] `/api/health` trả 200 không cần đăng nhập và không rò thông tin.
- [ ] Có Dockerfile và cấu hình proxy mẫu được kiểm cú pháp.
- [ ] Tài liệu nêu rõ endpoint công khai nào được cache và vì sao.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-05 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
docker build -f deploy/Dockerfile -t arcane-admin:test . || echo "Docker không khả dụng — kiểm thủ công"
nginx -t -c "$(pwd)/deploy/nginx.conf" || echo "nginx không khả dụng — kiểm thủ công"
```

###### OPS-05 — Xuất bản tĩnh: ghi JSON bất biến cho CDN khi publish

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P3 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 6 |
| Người thực hiện | agent |
| Dependencies | OPS-04 |
| Quyết định chặn | DEC-05 |
| Gap liên quan | GAP-110 |
| Trạng thái | not_started |

**Mô tả.** Cho phép game tải nội dung từ CDN/static host thay vì từ tiến trình admin: không cần CORS cho admin, giảm tải và game vẫn chạy khi admin ngừng.

**Affected files**

- `admin/server/configuration.mjs`
- `admin/server/story.mjs`
- `admin/server/app.mjs`
- `admin/.env.example`
- `admin/tests/configuration.test.mjs`
- `admin/tests/story.test.mjs`
- `admin/README.md`
- `docs/configuration-management.md`

**Implementation steps (subtask)**

1. `OPS-05.1` — Thêm `ADMIN_PUBLISH_DIR` (tuỳ chọn). Khi đặt, mỗi lần publish/rollback ghi nguyên tử (tệp tạm + rename) `game-config.<env>.json`, `game-content.<env>.json`, `story.json` — đúng nội dung envelope mà endpoint công khai trả.
2. `OPS-05.2` — Ghi SAU khi giao dịch lưu trữ thành công; lỗi ghi tệp không làm hỏng publish (ghi nhật ký và đánh dấu trong audit).
3. `OPS-05.3` — Tài liệu cách trỏ `VITE_*_URL` của game tới CDN và nên đặt `Cache-Control` nào.
4. `OPS-05.4` — Test: publish → tệp tồn tại và bằng response công khai; rollback ghi đè đúng; lỗi quyền ghi không gây 500.

**Acceptance criteria**

- [ ] Tệp xuất bản trùng byte-for-byte với response công khai.
- [ ] Không ghi gì khi `ADMIN_PUBLISH_DIR` không đặt.
- [ ] Lỗi ghi không làm hỏng publish.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-05 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm --prefix admin test
```

## EP-ARC

### Khả năng bảo trì của game

**Mục tiêu:** Refactor lõi vòng lặp an toàn nhờ harness đặc trưng; ranh giới module rõ ràng.  
**Ưu tiên epic:** P2

#### Feature FT-ARC-1 — Refactor an toàn

Harness đặc trưng rồi tách updatePlaying.

##### Story US-ARC-1

> Là dev, tôi muốn harness đặc trưng để thay đổi lõi game mà không sợ hồi quy.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| ARC-01 | Harness đặc trưng cho Game: createTestGame() và golden-master cho vòng lặp | P2 | M (3) | S2 | not_started |

###### ARC-01 — Harness đặc trưng cho Game: createTestGame() và golden-master cho vòng lặp

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 2 |
| Người thực hiện | agent |
| Dependencies | TST-03 |
| Quyết định chặn | — |
| Gap liên quan | GAP-113 |
| Trạng thái | not_started |

**Mô tả.** Hai test (`scripts/test-boss-gradual-arrival.js`, `scripts/test-boss-spawn-deadlock-prevention.js`) gọi `Game.prototype.updatePlaying.call(fakeContext, dt)` trên đối tượng dựng tay: mọi `this.xxx` mới dùng trong `updatePlaying` phải được thêm vào các fake context (đã từng xảy ra với `upgrades`, `progress`, `_addScore`). Mỗi test khác tự lặp bộ mock DOM/canvas/audio (ví dụ `fakeEl` trong `test-meta-features.js`). `updatePlaying` dài ~517 dòng (1185–1702) trong `Game.js` 3.322 dòng — không có lưới an toàn hành vi để refactor hoặc chèn nguồn spawn mới.

**Affected files**

- `tests/helpers/create-game.js (mới)`
- `tests/golden-master.test.js (mới)`
- `tests/fixtures/golden-master.json (mới)`
- `scripts/test-boss-gradual-arrival.js`
- `scripts/test-boss-spawn-deadlock-prevention.js`
- `test-meta-features.js`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `ARC-01.1` — Trích bộ mock DOM/canvas/audio dùng chung (nguồn: `test-meta-features.js`, `test-engagement-features.js`) thành `tests/helpers/create-game.js` với `createTestGame({ seed, difficulty, mode })` trả về `Game` THẬT (không fake-context). Giữ quy ước của mock: `getElementById` trả một stub (`classList` chỉ có add/remove/contains; kết quả `createElement` không có `style`; không có `toggle`) nên code UI phải guard truy cập DOM.
2. `ARC-01.2` — Viết 5 kịch bản golden-master tất định (seed và dt cố định): (a) thời điểm + thành phần các spawn đầu màn 1; (b) ghost chạm người chơi → mất tim + i-frame + shake; (c) projectile trúng → điểm/combo/ghost biến mất; (d) boss đến dần sau khi hết minion (hành vi của `test-boss-gradual-arrival`); (e) ghost tim hồi máu. Ghi trạng thái cuối (hash vị trí/HP/điểm/combo) vào `tests/fixtures/golden-master.json`; cờ `--update` có chủ đích.
3. `ARC-01.3` — Chuyển hai test fake-context sang `createTestGame()`, GIỮ NGUYÊN mọi assertion.
4. `ARC-01.4` — Đăng ký vào manifest; ghi chú sử dụng ngắn ở đầu `create-game.js`.
5. `ARC-01.5` — Chạy lại 20 lần để chắc chắn tất định.

**Acceptance criteria**

- [ ] 5 kịch bản golden-master xanh và tất định (20 lần chạy liên tiếp cùng kết quả).
- [ ] Không còn test nào gọi `Game.prototype.updatePlaying.call(`.
- [ ] Mọi assertion cũ của hai test được giữ nguyên.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
for i in $(seq 1 20); do node tests/golden-master.test.js >/dev/null 2>&1 || echo "FAIL $i"; done
grep -rn "updatePlaying.call" scripts tests test-*.js || echo "không còn"
npm test
```

**Rủi ro**

- Có thể phát hiện hành vi hiện tại không tất định (ví dụ `Math.random()` ở vị trí spawn tactical, Game.js ~1303) → cần seed/stub RNG trong harness, không đổi production.

##### Story US-ARC-2

> Là dev, tôi muốn updatePlaying được tách thành các bước nhỏ dễ đọc, dễ test.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| ARC-02 | Tách Game.updatePlaying thành các bước nhỏ (không đổi hành vi) | P3 | L (5) | S5 | not_started |
| ARC-03 | [Parking lot] Tách controller khỏi Game.js (Story/Lore, Cosmetics, Endless-save) | P3 | L (5) | parking | not_started |

###### ARC-02 — Tách Game.updatePlaying thành các bước nhỏ (không đổi hành vi)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | refactor / P3 |
| Độ phức tạp / SP | L / 5 |
| Sprint | 5 |
| Người thực hiện | agent |
| Dependencies | ARC-01, RUN-07 |
| Quyết định chặn | — |
| Gap liên quan | GAP-113 |
| Trạng thái | not_started |

**Mô tả.** `Game.updatePlaying` dài ~517 dòng (`Game.js` 1185–1702): spawn, di chuyển enemy, projectile, va chạm, boss, hiệu ứng, đếm… trong một hàm duy nhất, khó test và khó thêm nguồn spawn. Đây là refactor có rủi ro hồi quy cao nhất của kế hoạch → chỉ làm khi đã có golden-master (ARC-01) và sau khi tích hợp content (RUN-07) để tránh xung đột.

**Affected files**

- `src/core/Game.js`
- `tests/golden-master.test.js`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `ARC-02.1` — Chốt biên giới các bước bám cấu trúc thực tế của hàm (ví dụ `_stepSpawning`, `_stepEnemies`, `_stepProjectiles`, `_stepCollisions`, `_stepBossFlow`, `_stepCleanup` — tên chỉ minh hoạ).
2. `ARC-02.2` — Với MỖI bước: trích xuất nguyên văn vào phương thức riêng, giữ thứ tự gọi, KHÔNG đổi logic; chạy golden-master và `npm test` sau từng bước; commit riêng từng bước.
3. `ARC-02.3` — Giữ quy ước: logic theo khung không thuộc mô phỏng lõi nằm ở `PlayingState.update`/`Game.advanceEffects`, không ở `updatePlaying`.
4. `ARC-02.4` — Không đổi API công khai, không đổi hằng số.
5. `ARC-02.5` — So thời gian khung trước/sau bằng test hiệu năng sẵn có (`test-enemy-render-performance.js`) hoặc harness REL-02 nếu đã có.

**Acceptance criteria**

- [ ] Toàn bộ test và golden-master xanh sau MỖI commit bước.
- [ ] `updatePlaying` còn ≤ 60 dòng và chỉ điều phối các bước.
- [ ] Không có thay đổi hành vi quan sát được (golden-master không đổi).

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm test
node tests/golden-master.test.js
wc -l src/core/Game.js
```

**Rủi ro**

- Rủi ro hồi quy cao nhất của kế hoạch; dừng và hoàn tác bước nếu golden-master lệch.

###### ARC-03 — [Parking lot] Tách controller khỏi Game.js (Story/Lore, Cosmetics, Endless-save)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | refactor / P3 |
| Độ phức tạp / SP | L / 5 |
| Sprint | parking lot (chưa xếp lịch) |
| Người thực hiện | agent |
| Dependencies | ARC-02 |
| Quyết định chặn | — |
| Gap liên quan | GAP-113 |
| Trạng thái | not_started |

**Mô tả.** `Game.js` 3.322 dòng với trên 100 phương thức. Sau ARC-02 có thể tiếp tục tách theo trách nhiệm: `_pollStory/_showStoryLine/_awardLore`, cosmetics, endless save/restore, daily — mỗi nhóm thành controller có test riêng. Tùy chọn; chỉ làm nếu tốc độ phát triển bị cản trở bởi kích thước file.

**Affected files**

- `src/core/Game.js`
- `src/core/StoryScenes.js`
- `src/core/Cosmetics.js`
- `src/core/RunSave.js`

**Implementation steps (subtask)**

1. `ARC-03.1` — Chọn một nhóm trách nhiệm có ranh giới rõ nhất (đề xuất: story/lore) và liệt kê các trạng thái `this.*` nó sở hữu.
2. `ARC-03.2` — Tạo controller nhận `game` qua giao diện hẹp; di chuyển phương thức nguyên văn.
3. `ARC-03.3` — Giữ nguyên quy ước `_pollStory` được gọi từ `advanceEffects`.
4. `ARC-03.4` — Lặp lại cho nhóm kế tiếp sau khi test xanh.

**Acceptance criteria**

- [ ] `Game.js` giảm ≥ 20% số dòng mà golden-master và toàn bộ test vẫn xanh.
- [ ] Không có hành vi đổi.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm test
node tests/golden-master.test.js
wc -l src/core/Game.js
```

#### Feature FT-ARC-2 — Ranh giới module rõ ràng

Types sinh từ schema.

##### Story US-ARC-3

> Là dev, tôi muốn kiểu TypeScript luôn khớp schema nội dung.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| ARC-04 | Sinh gameplay-content.types.ts từ schema và test chống lệch | P3 | S (2) | S2 | not_started |
| ARC-05 | [Parking lot] Baseline kiểm tra kiểu cho JS của game (JSDoc + tsc --checkJs) | P3 | M (3) | parking | not_started |

###### ARC-04 — Sinh gameplay-content.types.ts từ schema và test chống lệch

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | refactor / P3 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 2 |
| Người thực hiện | agent |
| Dependencies | — |
| Quyết định chặn | — |
| Gap liên quan | GAP-112 |
| Trạng thái | not_started |

**Mô tả.** `shared/gameplay-content.types.ts` (56 dòng) được viết tay song song với `contentSchema`; khi schema đổi (đặc biệt nếu RUN-01 nâng schema) kiểu rất dễ lệch mà không ai biết. `shared/gameplay-content.js` còn import `../src/core/Constants.js` của game (`ENEMY_TYPES`, `RUNES`) — một ghép nối server↔game cần được ghi nhận.

**Affected files**

- `shared/gameplay-content.types.ts`
- `admin/scripts/gen-content-types.mjs (mới)`
- `admin/tests/types-sync.test.mjs (mới)`
- `admin/package.json`

**Implementation steps (subtask)**

1. `ARC-04.1` — Viết `admin/scripts/gen-content-types.mjs` đọc `contentSchema` và sinh TypeScript (object/array/number/choice→union/reference→string) với đầu file "GENERATED — đừng sửa tay"; cờ `--check` so với file hiện có và thoát 1 nếu lệch.
2. `ARC-04.2` — Sinh lại `shared/gameplay-content.types.ts`, giữ nguyên tên kiểu mà `admin/src/GameplayPage.tsx` đang import (`Content`, `EnemyDefinition`, …).
3. `ARC-04.3` — Thêm `admin/tests/types-sync.test.mjs` chạy generator và so với file đã commit; thêm script `gen:types`.
4. `ARC-04.4` — Ghi nhận trong tài liệu: `shared/` phụ thuộc `src/core/Constants.js` (chỉ danh sách id rune/archetype) — chấp nhận, nhưng cấm import mã có DOM.
5. `ARC-04.5` — Chạy `tsc --noEmit` của admin.

**Acceptance criteria**

- [ ] File types được sinh tự động và đồng bộ.
- [ ] Test đỏ nếu schema đổi mà không sinh lại.
- [ ] `tsc` của admin sạch; UI test xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
(cd admin && node scripts/gen-content-types.mjs --check)
npm --prefix admin test
(cd admin && npx tsc --noEmit)
```

###### ARC-05 — [Parking lot] Baseline kiểm tra kiểu cho JS của game (JSDoc + tsc --checkJs)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | refactor / P3 |
| Độ phức tạp / SP | M / 3 |
| Sprint | parking lot (chưa xếp lịch) |
| Người thực hiện | agent |
| Dependencies | ARC-04 |
| Quyết định chặn | — |
| Gap liên quan | GAP-113 |
| Trạng thái | not_started |

**Mô tả.** Game 27.088 dòng JS thuần không có kiểm tra kiểu; admin đã strict TS. Tùy chọn: thêm `jsconfig`/`tsconfig` chỉ để kiểm tra (`checkJs`), bắt đầu bằng `shared/` và `src/combat/`, tăng dần phạm vi.

**Affected files**

- `jsconfig.json (mới)`
- `src/combat/CombatSystem.js`
- `src/combat/StatusEffects.js`
- `package.json`

**Implementation steps (subtask)**

1. `ARC-05.1` — Thêm `jsconfig.json` với `checkJs: true` giới hạn `include` ở `shared/**` và `src/combat/**`.
2. `ARC-05.2` — Sửa lỗi kiểu thật bằng JSDoc; KHÔNG dùng `@ts-ignore` hàng loạt.
3. `ARC-05.3` — Thêm script `typecheck` và bước CI (cảnh báo trước, bắt buộc sau).
4. `ARC-05.4` — Mở rộng dần sang `src/core/*.js`.

**Acceptance criteria**

- [ ] `npm run typecheck` sạch cho phạm vi đã chọn.
- [ ] Không có `@ts-ignore` mới.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
npm run typecheck
```

#### Feature FT-ARC-3 — Chịu lỗi runtime

Một ngoại lệ ở một khung hình không được làm dừng game; có đường khôi phục, lưu tiến độ và ghi log.

##### Story US-ARC-4

> Là người chơi, tôi muốn game không đứng hình vĩnh viễn khi gặp lỗi bất ngờ, mà được thông báo, giữ được tiến độ và quay về menu.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| ARC-06 | Vòng lặp game chịu lỗi: bắt ngoại lệ theo khung, handler lỗi toàn cục và màn hình khôi phục | P1 | M (3) | S2 | not_started |

###### ARC-06 — Vòng lặp game chịu lỗi: bắt ngoại lệ theo khung, handler lỗi toàn cục và màn hình khôi phục

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | bug / P1 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 2 |
| Người thực hiện | agent |
| Dependencies | TST-03 |
| Quyết định chặn | — |
| Gap liên quan | GAP-312 |
| Trạng thái | not_started |

**Mô tả.** `Game.loop()` (`src/core/Game.js:1062–1082`) gọi `update()` + `render()` rồi mới đặt lại `requestAnimationFrame` ở cuối, không có `try/catch`/`finally`; không có handler lỗi toàn cục nào trong `src/`, `main.js`, `index.html` (GAP-312). Đã chứng minh tất định bằng fake-context: khung khỏe → rAF được đặt lại; `update()` hoặc `render()` ném lỗi → rAF KHÔNG được đặt lại ⇒ game đứng hình vĩnh viễn, không thông báo, không có đường quay lại ngoài tải lại trang. Rủi ro tăng khi dữ liệu CMS chảy vào đường update/render (RUN-03..07) nên task xếp ở Sprint 2, trước các task đó. Lưu ý kỹ thuật: `render()` gọi `ctx.save(); ctx.scale(dpr, dpr)` rồi `ctx.restore()` không có `try/finally` — cứu vòng lặp mà không khôi phục trạng thái canvas sẽ làm ma trận biến đổi bị nhân `dpr` dồn qua các khung.

**Affected files**

- `src/core/Game.js`
- `main.js`
- `styles/main.css`
- `test-loop-resilience.js (mới)`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `ARC-06.1` — Viết test ĐỎ trước — `test-loop-resilience.js`: dùng kỹ thuật fake-context như `scripts/test-boss-*.js` (`Game.prototype.loop.call(fake, ts)` với `globalThis.requestAnimationFrame` giả đếm lời gọi; nếu ARC-01 đã xong có thể dùng `createTestGame()`). Các ca: (a) khung khỏe → `update` rồi `render` đúng thứ tự, rAF được đặt lại đúng 1 lần; (b) `update()` ném → rAF vẫn được đặt lại và lỗi được báo qua `_onFrameError`; (c) `render()` ném → tương tự; (d) 3 khung lỗi liên tiếp → `_enterRecovery` được gọi đúng 1 lần, một khung khỏe xen giữa đặt lại bộ đếm; (e) log lỗi bị throttle (không in mỗi khung). Chạy: phải ĐỎ trên mã hiện tại.
2. `ARC-06.2` — Sửa `Game.loop`: bọc `update(dt)` và `render()` bằng `try/catch`, đặt lại rAF trong `finally` (khi `isRunning`). Thêm `_onFrameError(err, phase)`: đếm lỗi liên tiếp (`_frameErrors`), `console.error` có throttle (3 lần đầu rồi mỗi 60 lần), đặt lại về 0 sau một khung khỏe. KHÔNG sửa `updatePlaying` (hai test fake-context phụ thuộc vào nó).
3. `ARC-06.3` — Khôi phục canvas: trong `render()` dùng `try/finally` cho `save()/restore()`; sau một khung `render()` lỗi gọi `ctx.reset?.()` (hoặc `ctx.setTransform(1, 0, 0, 1, 0, 0)` nếu trình duyệt chưa có `reset`) trước khung kế. Test dùng ctx giả mô hình hóa ngăn xếp transform (save/restore/scale/setTransform/reset) và khẳng định hệ số scale hiệu dụng của khung kế tiếp bằng `dpr` (không phải `dpr²`).
4. `ARC-06.4` — `_enterRecovery()` (sau ≥ 3 khung lỗi liên tiếp): dừng mô phỏng (bỏ qua `update`/`render`, giữ vòng rAF rỗng), `progress.save()` trong `try/catch`, hiện lớp phủ lỗi dựng bằng DOM (`document.createElement`, `role="alertdialog"`, văn bản gán bằng `textContent` — không `innerHTML`; mọi truy cập DOM phải guard vì test Node mock DOM tối giản và kết quả `createElement` không có `style`, nên dùng class trong `styles/main.css` với z-index > 120) kèm hai nút: "Về menu" (gọi đường thoát hiện có `quitToMenu`/`resetGameData` trong `try/catch`; nếu cũng lỗi → `location.reload()`) và "Tải lại trang".
5. `ARC-06.5` — `main.js`: bọc khởi động (`new Game`, nạp cấu hình/story, `game.start()`) trong `try/catch` — lỗi lúc khởi động hiện thông báo với nút "Tải lại"; đăng ký `window.addEventListener("error")` và `"unhandledrejection"` chỉ GHI LOG (không bật lớp phủ cho mọi rejection, ví dụ `audioContext.resume()` bị từ chối).
6. `ARC-06.6` — Đăng ký `test-loop-resilience.js` vào `tests/manifest.json` (nhóm `suites`). Kiểm tra đột biến thủ công: tạm bỏ `try/catch`/`finally` → test phải ĐỎ; hoàn tác ngay. Chạy `npm test` và test admin; xử lý artifact build theo chính sách hiện hành.

**Acceptance criteria**

- [ ] Test mới ĐỎ trên mã cũ và XANH sau khi sửa; chạy 20 lần liên tiếp đều xanh.
- [ ] `node docs/ai-planning/evidence/repro-game-loop.mjs` thoát 0 (ở baseline: 2 dòng FAIL, thoát 1).
- [ ] Ngoại lệ ở `update()` hoặc `render()` không làm dừng vòng lặp; sau 3 khung lỗi liên tiếp lớp phủ khôi phục hiện (hoặc hook được gọi trong test Node) và mô phỏng dừng; "Về menu" đưa game về MENU không ném lỗi.
- [ ] Sau một khung `render()` lỗi, khung kế tiếp được vẽ với transform đúng (không bị nhân `dpr` dồn).
- [ ] Khung bình thường: thứ tự gọi và số lần đặt lại rAF không đổi; `updatePlaying` không bị sửa; không `innerHTML` với dữ liệu động; handler toàn cục chỉ ghi log.
- [ ] `npm test` xanh (thêm 1 suite) và test admin vẫn xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node test-loop-resilience.js
node docs/ai-planning/evidence/repro-game-loop.mjs
for i in $(seq 1 20); do node test-loop-resilience.js >/dev/null 2>&1 || echo "FAIL run $i"; done
npm test
git diff --stat -- src/ main.js styles/
```

**Rủi ro**

- Lớp phủ khôi phục có thể che giấu lỗi thật — chỉ hiện sau ≥ 3 khung lỗi liên tiếp và luôn `console.error`.
- `ctx.reset()` chưa có ở trình duyệt cũ — cần nhánh dự phòng `setTransform`.
- Đổi `Game.js` kéo theo rebuild artifact (xem DoD chung và FND-04).

## EP-UXL

### UX, accessibility & bản địa hóa

**Mục tiêu:** Khởi động nhanh, truy cập được, đổi ngôn ngữ lúc chạy (có điều kiện theo DEC-07).  
**Ưu tiên epic:** P2

#### Feature FT-UXL-1 — Bản địa hóa

Hạ tầng i18n và trích xuất chuỗi.

##### Story US-UXL-1

> Là người chơi, tôi muốn đổi ngôn ngữ giao diện trong Cài Đặt.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| UXL-01 | Hạ tầng i18n cho giao diện game (vi/en) và công tắc ngôn ngữ | P3 | L (5) | S6 | not_started |
| UXL-02 | Trích xuất chuỗi chrome UI sang bảng i18n (≥ 90%) | P3 | L (5) | S6 | not_started |

###### UXL-01 — Hạ tầng i18n cho giao diện game (vi/en) và công tắc ngôn ngữ

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P3 |
| Độ phức tạp / SP | L / 5 |
| Sprint | 6 |
| Người thực hiện | agent |
| Dependencies | TST-03 |
| Quyết định chặn | DEC-07 |
| Gap liên quan | GAP-105 |
| Trạng thái | not_started |

**Mô tả.** Ngôn ngữ chỉ tồn tại ở lớp story (`setStoryLocale(import.meta.env.VITE_STORY_LOCALE || "vi")`, chọn lúc build); toàn bộ chrome UI (`index.html` 939 dòng, `UIManager.js`, `MetaUI.js`, `Constants.js`…) cứng tiếng Việt; không có hàm `t()`, bảng chuỗi hay công tắc ngôn ngữ trong Cài Đặt.

**Affected files**

- `src/i18n/index.js (mới)`
- `src/i18n/vi.json (mới)`
- `src/i18n/en.json (mới)`
- `src/core/Settings.js`
- `main.js`
- `src/ui/MetaUI.js`
- `index.html`
- `test-i18n.js (mới)`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `UXL-01.1` — [NGƯỜI] Chờ DEC-07.
2. `UXL-01.2` — Tạo `src/i18n`: `t(key, params)`, `setLocale`, `getLocale`, fallback `vi`, sự kiện đổi locale; chuỗi thiếu trả về khoá kèm cảnh báo ở môi trường dev.
3. `UXL-01.3` — Thêm khoá cài đặt `language` (`vi|en`) vào `Settings.js` (mặc định, `sanitizeSetting`, tương thích ngược với bản lưu cũ); `main.js` khởi tạo locale từ cài đặt rồi mới đến `VITE_STORY_LOCALE`, đồng bộ `setStoryLocale`.
4. `UXL-01.4` — Thêm mục "Ngôn ngữ" vào màn Cài Đặt (MetaUI + index.html) với guard DOM.
5. `UXL-01.5` — Cơ chế áp dụng cho DOM tĩnh: thuộc tính `data-i18n` được `applyLocale(root)` cập nhật khi đổi locale — dùng `textContent`, KHÔNG dùng `innerHTML` với chuỗi dịch (xem SEC-01).
6. `UXL-01.6` — Test: `t()` fallback/params; đổi locale cập nhật story và DOM giả; cài đặt cũ không có `language` vẫn tải được.

**Acceptance criteria**

- [ ] Đổi ngôn ngữ trong Cài Đặt không cần tải lại trang (với các chuỗi đã trích xuất).
- [ ] Cài đặt cũ (không có `language`) vẫn tải được.
- [ ] Không có `innerHTML` mới nội suy chuỗi dịch.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-07 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node test-i18n.js
node test-meta-features.js
npm test
```

###### UXL-02 — Trích xuất chuỗi chrome UI sang bảng i18n (≥ 90%)

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P3 |
| Độ phức tạp / SP | L / 5 |
| Sprint | 6 |
| Người thực hiện | agent+human |
| Dependencies | UXL-01 |
| Quyết định chặn | DEC-07 |
| Gap liên quan | GAP-105 |
| Trạng thái | not_started |

**Mô tả.** Chuyển chuỗi hiển thị của menu, HUD, Cài Đặt, Game Over/Victory, toast, hướng dẫn sang khoá i18n, phủ ≥ 90% chuỗi chrome. Dữ liệu nội dung (tên màn, tiểu sử nhân vật `ACADEMY_CHARACTERS`, `LEVEL_CONFIGS`) để giai đoạn sau; thoại story đã có locale riêng.

**Affected files**

- `index.html`
- `src/ui/UIManager.js`
- `src/ui/MetaUI.js`
- `src/i18n/vi.json`
- `src/i18n/en.json`
- `scripts/count-hardcoded-strings.mjs (mới)`
- `test-story-lore.js`
- `test-meta-features.js`

**Implementation steps (subtask)**

1. `UXL-02.1` — Kiểm kê chuỗi: quét `index.html`, `UIManager.js`, `MetaUI.js` tìm văn bản có dấu tiếng Việt; viết `scripts/count-hardcoded-strings.mjs` đo tỉ lệ còn cứng; lập bảng khoá.
2. `UXL-02.2` — Thay từng nhóm màn hình (menu → HUD → Cài Đặt → kết quả → toast → hướng dẫn) bằng `t(...)`/`data-i18n`; chuỗi `vi` GIỮ NGUYÊN từng chữ để các test khoá văn bản (đặc biệt `test-story-lore.js`: slide intro/victory, "năm ô trống", "Nhật Ký Ký Ức") vẫn xanh.
3. `UXL-02.3` — [NGƯỜI] Duyệt chất lượng bản dịch `en` cho mọi khoá.
4. `UXL-02.4` — Test: tập khoá `vi` = tập khoá `en`; script đo ≥ 90%.
5. `UXL-02.5` — Smoke test chụp menu ở hai ngôn ngữ.

**Acceptance criteria**

- [ ] ≥ 90% chuỗi chrome đã trích xuất (script đo xác nhận).
- [ ] Test khoá văn bản story/lore xanh không sửa assertion.
- [ ] `vi` và `en` có cùng tập khoá.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các quyết định DEC-07 đã ở trạng thái `decided` TRƯỚC khi bắt đầu (không tự quyết).
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/count-hardcoded-strings.mjs
npm test
node scripts/e2e-smoke.mjs
```

#### Feature FT-UXL-2 — Accessibility & hoàn thiện

Ngữ nghĩa ARIA, focus, zoom; favicon/manifest.

##### Story US-UXL-2

> Là người chơi dùng công nghệ hỗ trợ, tôi muốn hộp thoại có ngữ nghĩa, focus đúng và có thể phóng to.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| UXL-03 | Accessibility: ngữ nghĩa hộp thoại, quản lý focus, phóng to, nhãn | P2 | M (3) | S6 | not_started |

###### UXL-03 — Accessibility: ngữ nghĩa hộp thoại, quản lý focus, phóng to, nhãn

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 6 |
| Người thực hiện | agent |
| Dependencies | TST-07 |
| Quyết định chặn | — |
| Gap liên quan | GAP-107 |
| Trạng thái | not_started |

**Mô tả.** Đã đo: `index.html` có 11 thuộc tính `aria-*` và 0 `role=`; viewport `maximum-scale=1.0, user-scalable=no` chặn phóng to (WCAG 1.4.4); các màn hình nổi (Cài Đặt, Kỷ Lục, Nhật Ký, Tủ Đồ, clip…) là `div.active` không có `role="dialog"`/`aria-modal`/bẫy focus. Game đã có tuỳ chọn tốt (colorBlind, altInput/bàn phím, assist, missHints); task này bổ sung phần ngữ nghĩa.

**Affected files**

- `index.html`
- `src/ui/MetaUI.js`
- `src/ui/UIManager.js`
- `styles/main.css`
- `scripts/e2e-smoke.mjs`

**Implementation steps (subtask)**

1. `UXL-03.1` — Màn hình nổi: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; mở → focus vào phần tử đầu tiên; đóng → trả focus về nút đã mở; `Esc` đóng; bẫy focus (Tab xoay vòng trong dialog).
2. `UXL-03.2` — Nút chỉ có biểu tượng có `aria-label`; điểm/đợt/HP có vùng `aria-live="polite"` (chỉ thông báo mốc quan trọng để tránh ồn).
3. `UXL-03.3` — Viewport: bỏ `user-scalable=no`/`maximum-scale`; giữ `touch-action: none` CHỈ trên canvas để nét vẽ không gây zoom/scroll; kiểm tra không có zoom ngoài ý muốn khi vẽ trên mobile (cần thử trên thiết bị thật — hiện UNKNOWN).
4. `UXL-03.4` — Kiểm tra `prefers-reduced-motion` (hiện 2 tham chiếu trong CSS) phủ các animation chính; kiểm tra tương phản chữ.
5. `UXL-03.5` — Mở rộng smoke test: mở Cài Đặt → có `role="dialog"` và focus nằm trong dialog; đóng → focus quay lại; `Esc` đóng.
6. `UXL-03.6` — Guard DOM trong code UI vì mock test chỉ có `classList.add/remove/contains`.

**Acceptance criteria**

- [ ] Mọi màn hình nổi có role/aria và quản lý focus (kiểm chứng bằng smoke test).
- [ ] Có thể phóng to trang trong menu bằng pinch/zoom của trình duyệt.
- [ ] Vẽ trên canvas không kích hoạt zoom/scroll.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/e2e-smoke.mjs
npm test
```

##### Story US-UXL-3

> Là người chơi, tôi muốn tab có favicon và có thể thêm vào màn hình chính.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| UXL-04 | Favicon và web manifest | P3 | S (2) | S6 | not_started |

###### UXL-04 — Favicon và web manifest

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | feature / P3 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 6 |
| Người thực hiện | agent |
| Dependencies | IPA-05, TST-07 |
| Quyết định chặn | — |
| Gap liên quan | GAP-203 |
| Trạng thái | not_started |

**Mô tả.** Smoke test ghi nhận `GET /favicon.ico` → 404; không có `manifest`; không có service worker. (PWA offline đầy đủ nằm NGOÀI phạm vi.)

**Affected files**

- `index.html`
- `public/manifest.webmanifest (mới)`
- `public/icon.svg (mới)`

**Implementation steps (subtask)**

1. `UXL-04.1` — Tạo biểu tượng SVG gốc (tự vẽ, KHÔNG dùng asset Doodle) và liên kết `<link rel="icon" type="image/svg+xml">`.
2. `UXL-04.2` — Tạo `manifest.webmanifest` (`name` theo DEC-04, `display: standalone`, `theme_color #07050d`, `background_color`, biểu tượng).
3. `UXL-04.3` — Liên kết manifest trong `index.html`; kiểm tra build sao chép `public/` đúng.
4. `UXL-04.4` — Smoke test: không còn 404 favicon/manifest.

**Acceptance criteria**

- [ ] Không còn 404 favicon/manifest.
- [ ] Manifest là JSON hợp lệ với các trường bắt buộc.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/e2e-smoke.mjs
node -e "JSON.parse(require('fs').readFileSync('public/manifest.webmanifest','utf8'));console.log('manifest ok')"
```

#### Feature FT-UXL-3 — Trải nghiệm khởi động

Nạp song song và màn chờ.

##### Story US-UXL-4

> Là người chơi, tôi muốn game khởi động nhanh kể cả khi máy chủ cấu hình chậm.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| UXL-05 | Khởi động song song cấu hình + story và màn chờ | P2 | S (2) | S2 | not_started |

###### UXL-05 — Khởi động song song cấu hình + story và màn chờ

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | refactor / P2 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 2 |
| Người thực hiện | agent |
| Dependencies | TST-03 |
| Quyết định chặn | — |
| Gap liên quan | GAP-111 |
| Trạng thái | not_started |

**Mô tả.** `main.js` `await` TUẦN TỰ `remoteConfiguration.load(...)` rồi `loadPublishedStory(...)`, mỗi cái có timeout 2,5 s, trước khi `game.start()`: khi đặt `VITE_*_URL` mà máy chủ chậm/không truy cập được, màn hình trống tới ~5 s (xác nhận bằng đọc source; chưa đo). Khi không đặt biến, không có độ trễ.

**Affected files**

- `main.js`
- `src/core/boot.js (mới)`
- `index.html`
- `styles/main.css`
- `test-boot.js (mới)`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `UXL-05.1` — Trích hàm `bootGame({ canvas, env, fetcher })` vào `src/core/boot.js`: khởi tạo `Game`, chạy `Promise.all` cho cấu hình/story (và content sau RUN-02), rồi áp dụng kết quả và `game.start()`.
2. `UXL-05.2` — Thêm màn chờ nhẹ `#boot-splash` (hiện ngay, ẩn khi `game.start()`); không tải tài nguyên ngoài.
3. `UXL-05.3` — Giữ nguyên fallback: lỗi/timeout → dùng cấu hình/story cục bộ; thứ tự áp dụng cài đặt như hiện tại.
4. `UXL-05.4` — Test `test-boot.js` với fetcher giả: cả hai request BẮT ĐẦU trước khi cái nào hoàn tất; tổng thời gian ≈ max(timeout) thay vì tổng; lỗi một nguồn không chặn nguồn kia.
5. `UXL-05.5` — Thử thủ công với URL trỏ vào server chậm (nếu có).

**Acceptance criteria**

- [ ] Các lần nạp chạy song song; thời gian chờ tối đa ≈ 2,5 s.
- [ ] Lỗi/timeout vẫn khởi động bằng nội dung cục bộ.
- [ ] Không đổi hành vi khi không đặt biến môi trường.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node test-boot.js
npm test
```

## EP-REL

### Sẵn sàng phát hành

**Mục tiêu:** Có E2E, ngân sách hiệu năng/kích thước, checklist phát hành và tài liệu hợp nhất.  
**Ưu tiên epic:** P1

#### Feature FT-REL-1 — Tin cậy end-to-end

E2E mở rộng gồm admin, audio, content runtime.

##### Story US-REL-1

> Là chủ dự án, tôi muốn kiểm thử đầu-cuối trước mỗi bản phát hành.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| REL-01 | E2E mở rộng: admin UI, giải mã audio, luồng content runtime | P1 | L (5) | S7 | not_started |

###### REL-01 — E2E mở rộng: admin UI, giải mã audio, luồng content runtime

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P1 |
| Độ phức tạp / SP | L / 5 |
| Sprint | 7 |
| Người thực hiện | agent |
| Dependencies | TST-07, RUN-08 |
| Quyết định chặn | — |
| Gap liên quan | GAP-108, GAP-403, GAP-404 |
| Trạng thái | not_started |

**Mô tả.** Mở rộng smoke test (TST-07) để đóng các điểm UNKNOWN: (1) preview `Enemy` của Gameplay Studio chưa bao giờ chạy trong trình duyệt (UI test mock `getContext` → null); (2) audio chưa được thực thi (smoke test không kích hoạt âm thanh; chưa biết sheet giải mã được trong trình duyệt); (3) luồng publish → game chạy chế độ nội dung chưa được kiểm thử trong trình duyệt.

**Affected files**

- `scripts/e2e-smoke.mjs`
- `scripts/e2e-admin.mjs (mới)`
- `tests/manifest.json`
- `.github/workflows/ci.yml`
- `package.json`

**Implementation steps (subtask)**

1. `REL-01.1` — Admin: dựng server admin với thư mục dữ liệu tạm + Vite preview/dev admin (cổng ngẫu nhiên); đăng nhập; mở Gameplay; thêm enemy; xác nhận canvas preview có pixel vẽ (đọc `getImageData` MỘT lần sau render — không đọc mỗi khung) và 0 lỗi console.
2. `REL-01.2` — Audio: sau một cử chỉ người dùng giả lập, gọi `SoundSystem._loadAudioTrack("main")` (hoặc nhánh tương đương theo IPA-04) và xác nhận `AudioBuffer` giải mã thành công hoặc nhánh tổng hợp phát được (kiểm RMS theo giây nếu cần; dùng `--autoplay-policy=no-user-gesture-required`).
3. `REL-01.3` — Content runtime: publish nội dung mẫu qua HTTP rồi mở game với `VITE_GAME_CONTENT_URL` tới server → "Chiến dịch tùy chỉnh" hiện và spawn đúng ít nhất 3 ghost đầu theo timeline.
4. `REL-01.4` — Đưa các kiểm tra vào CI (job `e2e`), tải ảnh chụp màn hình làm artifact khi lỗi.
5. `REL-01.5` — Dọn chắc chắn mọi tiến trình và thư mục tạm.

**Acceptance criteria**

- [ ] Preview Gameplay Studio vẽ được enemy trong trình duyệt thật.
- [ ] Audio giải mã/phát được hoặc nhánh dự phòng hoạt động.
- [ ] Luồng content runtime chạy trong trình duyệt thật.
- [ ] CI xanh và có artifact ảnh khi lỗi.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/e2e-smoke.mjs
node scripts/e2e-admin.mjs
gh run list --limit 1 --json conclusion
```

#### Feature FT-REL-2 — Ngân sách hiệu năng & kích thước

Perf harness và kiểm tra kích thước bundle.

##### Story US-REL-2

> Là dev, tôi muốn đo được FPS để hiệu năng không âm thầm xấu đi.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| REL-02 | Harness hiệu năng rAF-interval và baseline | P2 | M (3) | S7 | not_started |

###### REL-02 — Harness hiệu năng rAF-interval và baseline

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | test / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 7 |
| Người thực hiện | agent |
| Dependencies | TST-07, ARC-02 |
| Quyết định chặn | — |
| Gap liên quan | GAP-402, GAP-108 |
| Trạng thái | not_started |

**Mô tả.** Chưa có đo FPS tự động. Kinh nghiệm từ lần sửa hiệu năng trước (glow sprite): đo KHOẢNG CÁCH `requestAnimationFrame`, không đo thời gian JS (~0,2 ms/khung kể cả khi game chỉ chạy 10 fps vì chi phí nằm ở rasterisation); KHÔNG gọi `getImageData` mỗi khung (Chrome bỏ tăng tốc GPU và cho kết quả sai); khoá chất lượng bằng `game.quality.setPreference("high")`; tắt spawn và chèn ghost trực tiếp.

**Affected files**

- `scripts/perf-harness.mjs (mới)`
- `tests/perf-baseline.json (mới)`
- `package.json`
- `docs/RELEASE.md`

**Implementation steps (subtask)**

1. `REL-02.1` — Dùng CDP như TST-07 với Chrome `--headless=new --force-device-scale-factor=2`; `window.__ARCANE_GAME__`; khoá tier `high`; `changeState("PLAYING")`; vô hiệu spawn (`waveSystem.update = () => null`); chèn N ghost qua `enemyPool.acquire()` + `init()` + `enemies.push()` với `speed = 0`.
2. `REL-02.2` — Đo khoảng `requestAnimationFrame` trong 5 s cho N ∈ {10, 30, 45}; xuất fps trung bình, p95 thời gian khung, số khung > 25 ms.
3. `REL-02.3` — Ghi baseline vào `tests/perf-baseline.json` (kèm môi trường: Chrome, DPR, máy); chế độ `--compare` cảnh báo khi xấu hơn ngưỡng cấu hình được (ví dụ 20%).
4. `REL-02.4` — Trên CI: chạy ở chế độ chỉ báo cáo (render phần mềm không đại diện cho thiết bị thật); cục bộ: có thể chặn.
5. `REL-02.5` — Ghi trong `docs/RELEASE.md` cách đo trên thiết bị thật (mobile) vì CI không thay thế được.

**Acceptance criteria**

- [ ] Harness chạy tái lập; baseline được commit.
- [ ] Có `--compare` với ngưỡng cấu hình được.
- [ ] Tài liệu hướng dẫn đo trên thiết bị thật.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/perf-harness.mjs
node scripts/perf-harness.mjs --compare
```

##### Story US-REL-3

> Là dev, tôi muốn ngân sách kích thước bundle được CI giám sát.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| REL-03 | Ngân sách kích thước bundle và code-splitting cho admin | P2 | M (3) | S7 | not_started |

###### REL-03 — Ngân sách kích thước bundle và code-splitting cho admin

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | refactor / P2 |
| Độ phức tạp / SP | M / 3 |
| Sprint | 7 |
| Người thực hiện | agent |
| Dependencies | RUN-09 |
| Quyết định chặn | — |
| Gap liên quan | GAP-112 |
| Trạng thái | not_started |

**Mô tả.** Game: 667.200 B (gzip 175,8 kB) một file. Admin: một chunk JS 1.382,42 kB (gzip 434,74 kB) kèm cảnh báo > 500 kB của Vite; `GameplayPage.tsx` import `src/entities/Enemy.js` (2.991 dòng) của game vào bundle admin chỉ để vẽ preview.

**Affected files**

- `admin/src/main.tsx`
- `admin/src/GameplayPage.tsx`
- `admin/vite.config.ts`
- `scripts/check-bundle-size.mjs (mới)`
- `tests/bundle-budget.json (mới)`
- `.github/workflows/ci.yml`

**Implementation steps (subtask)**

1. `REL-03.1` — Admin: `React.lazy` cho các trang (Configuration, Gameplay, Story) và `import()` động cho `Enemy.js` trong preview; `manualChunks` tách `antd`/`react`.
2. `REL-03.2` — Viết `scripts/check-bundle-size.mjs` đọc kích thước (raw + gzip) từ build tạm của game và admin, so với `tests/bundle-budget.json` (game gzip ≤ 190 kB; admin chunk chính ≤ 500 kB raw); thoát 1 nếu vượt.
3. `REL-03.3` — Thêm bước vào CI.
4. `REL-03.4` — Xác nhận UI test và smoke admin vẫn xanh sau khi lazy-load.

**Acceptance criteria**

- [ ] Admin không còn chunk > 500 kB trong chunk chính.
- [ ] Kiểm tra ngân sách chạy trong CI và đỏ khi vượt.
- [ ] UI test admin xanh.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
(cd admin && npx vite build --outDir "$(mktemp -d)" --emptyOutDir)
node scripts/check-bundle-size.mjs
npm --prefix admin run test:ui
```

#### Feature FT-REL-3 — Quy trình phát hành

Checklist, changelog, hợp nhất tài liệu.

##### Story US-REL-4

> Là chủ dự án, tôi muốn checklist phát hành và changelog rõ ràng.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| REL-04 | Checklist phát hành, CHANGELOG và tag | P2 | S (2) | S7 | not_started |

###### REL-04 — Checklist phát hành, CHANGELOG và tag

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | docs / P2 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 7 |
| Người thực hiện | agent+human |
| Dependencies | REL-01, REL-02, REL-03, REL-05 |
| Quyết định chặn | — |
| Gap liên quan | GAP-109 |
| Trạng thái | not_started |

**Mô tả.** Chưa có quy trình phát hành: `package.json` ở 1.0.0 từ đầu; không có CHANGELOG, tag hay checklist.

**Affected files**

- `docs/RELEASE.md (mới)`
- `CHANGELOG.md (mới)`
- `package.json`
- `admin/package.json`

**Implementation steps (subtask)**

1. `REL-04.1` — Viết `docs/RELEASE.md`: điều kiện phát hành (mọi DEC liên quan đã quyết, đặc biệt DEC-03/DEC-04; kiểm kê IP sạch; `npm run test:all` xanh; CI xanh; E2E xanh; ngân sách bundle; artifact mới), các bước build/phát hành, cách đo thủ công trên thiết bị thật, kế hoạch rollback.
2. `REL-04.2` — Tạo `CHANGELOG.md` (có thể dùng skill `changelog`) từ lịch sử git và các task đã hoàn thành.
3. `REL-04.3` — Quy ước version (SemVer), nâng version khi phát hành, tag `v<semver>`.
4. `REL-04.4` — [NGƯỜI] Chủ dự án chạy checklist và ký go/no-go.

**Acceptance criteria**

- [ ] Checklist đầy đủ, mỗi mục có lệnh/bằng chứng kiểm tra.
- [ ] CHANGELOG phản ánh các thay đổi từ baseline.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Các bước đánh dấu [NGƯỜI] đã có xác nhận bằng văn bản của chủ dự án (ghi vào evidence).
- [ ] Tài liệu được rà soát chính tả/liên kết; mọi con số trích dẫn có thể tái tạo bằng lệnh nêu trong tài liệu.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node docs/ai-planning/tools/plan.mjs validate
npm run test:all
```

##### Story US-REL-5

> Là người đọc tài liệu, tôi muốn tài liệu hợp nhất và khớp thực tế.

| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |
|---|---|---|---|---|---|
| REL-05 | Hợp nhất tài liệu và kiểm tra liên kết | P2 | S (2) | S7 | not_started |

###### REL-05 — Hợp nhất tài liệu và kiểm tra liên kết

| Thuộc tính | Giá trị |
|---|---|
| Loại / Ưu tiên | docs / P2 |
| Độ phức tạp / SP | S / 2 |
| Sprint | 7 |
| Người thực hiện | agent |
| Dependencies | RUN-09, FND-03, BAL-01 |
| Quyết định chặn | — |
| Gap liên quan | GAP-109 |
| Trạng thái | not_started |

**Mô tả.** Sau các thay đổi (quyền gameplay, endpoint, biến môi trường, chế độ chơi, i18n, triển khai) tài liệu rải rác (README, admin/README.md, docs/*.md) phải được cập nhật đồng bộ và có một chỉ mục.

**Affected files**

- `docs/README.md (mới)`
- `README.md`
- `admin/README.md`
- `docs/configuration-management.md`
- `docs/story-cms.md`
- `docs/gameplay-content-editors.md`
- `docs/combat.md`
- `docs/GDD.md`
- `docs/ai-planning/ARCHITECTURE.md`
- `scripts/check-links.mjs (mới)`
- `tests/manifest.json`

**Implementation steps (subtask)**

1. `REL-05.1` — Tạo `docs/README.md` làm chỉ mục (GDD, BALANCE, combat, cấu hình, story CMS, gameplay content + runtime, ASSETS, RELEASE, ai-planning).
2. `REL-05.2` — Rà soát từng tài liệu so với code hiện tại; sửa các câu đã lỗi thời (ví dụ "does not yet consume", audit chứa values, quyền Analyst).
3. `REL-05.3` — Viết `scripts/check-links.mjs` kiểm tra liên kết tương đối trong mọi `*.md` (không cần mạng); đăng ký vào manifest.
4. `REL-05.4` — Đồng bộ `docs/ai-planning/ARCHITECTURE.md` với kiến trúc thực tế sau các sprint.

**Acceptance criteria**

- [ ] Mọi liên kết tương đối hợp lệ (script xanh).
- [ ] Không còn câu mô tả hành vi đã đổi.
- [ ] Có chỉ mục docs.

**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**

- [ ] Mọi tiêu chí chấp nhận (`acceptanceCriteria`) đã được kiểm chứng và có bằng chứng tương ứng.
- [ ] Tài liệu được rà soát chính tả/liên kết; mọi con số trích dẫn có thể tái tạo bằng lệnh nêu trong tài liệu.
- [ ] Áp dụng thêm TOÀN BỘ `meta.definitionOfDoneBase` (Definition of Done chung cho mọi task; `plan.mjs show <ID>` hiển thị đầy đủ).

**Verification commands**

```sh
node scripts/check-links.mjs
npm test
```

