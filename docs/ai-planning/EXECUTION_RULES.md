# EXECUTION RULES — quy tắc cho AI Coding Agent (và người) khi thực hiện kế hoạch

Tài liệu này là hợp đồng vận hành. [`tasks.json`](./tasks.json) là **nguồn sự thật duy nhất** của kế hoạch; `BACKLOG.md`, `SPRINT_PLAN.md` và khối tự động của `PROGRESS.md` được **sinh** từ nó — không sửa tay các file đó.

## 1. Nguyên tắc vàng

1. **Không tự đánh dấu hoàn thành khi chưa kiểm chứng.** `done` chỉ hợp lệ khi mọi lệnh trong `verificationCommands` đã chạy xanh và kết quả được ghi vào `evidence`. Công cụ từ chối `done` thiếu evidence.
2. **Không tự quyết các điểm thuộc chủ dự án** (`DEC-xx`). Task có `blockedByDecisions` còn `open` thì KHÔNG được bắt đầu. Agent không được gọi `plan.mjs decide` thay chủ dự án.
3. **Làm đúng một task mỗi lần, đúng phạm vi** `affectedFiles`. Cần chạm file ngoài danh sách → ghi lý do vào evidence; nếu thay đổi lớn → tách task mới.
4. **Không làm yếu test để làm xanh.** Cấm xoá/skip/nới assertion; test hồi quy cho bug phải ĐỎ trên mã cũ và XANH trên mã đã sửa.
5. **Không hoàn tác thay đổi không phải của mình.** Working tree có thể bị phiên khác sửa (đã xảy ra với `package.json` test script) — đọc lại file ngay trước khi sửa.
6. **Nếu phát hiện lỗi/việc mới** ngoài phạm vi: thêm task vào `tasks.json` (đúng schema, có `gapRefs`, dependency, sprint, AC), chạy `validate` + `render`; không "tiện tay sửa luôn".
7. **Dừng và hỏi** khi: đụng dữ liệu người dùng/bí mật, cần thay đổi trạng thái git (index, nhánh), cần mạng, cần cài/gỡ gói, hoặc kết quả mâu thuẫn với kế hoạch.

## 2. Vòng lặp thực hiện một task

```text
1  node docs/ai-planning/tools/plan.mjs next            # chọn task SẴN SÀNG (deps done, quyết định decided)
2  node docs/ai-planning/tools/plan.mjs show <ID>       # đọc đầy đủ: bước, AC, DoD, lệnh kiểm chứng
3  node docs/ai-planning/tools/plan.mjs set <ID> in_progress
4  git switch -c task/<ID>-<slug>                       # (cần duyệt theo .agent/rules)
5  thực hiện từng subtask <ID>.1, <ID>.2, … ; commit nhỏ sau mỗi subtask (bắt buộc với task L)
6  chạy MỌI verificationCommands ; chạy bộ test liên quan toàn cục
7  node docs/ai-planning/tools/plan.mjs set <ID> needs_review --evidence "<lệnh → kết quả>"
8  PR mô tả: Task ID, AC đã đạt (kèm bằng chứng), rủi ro, thay đổi ngoài affectedFiles (nếu có)
9  sau khi gộp/được duyệt: set <ID> done --evidence "<lệnh → kết quả>" --commit <sha>
```

Task `executor: agent+human` có các bước đánh dấu **[NGƯỜI]**: dừng ở bước đó, chuyển trạng thái `blocked` kèm evidence nêu rõ đang chờ gì, rồi chuyển sang task sẵn sàng khác.

## 3. Trạng thái và bằng chứng

| Trạng thái | Ý nghĩa | Điều kiện vào |
|---|---|---|
| `not_started` | chưa làm | — |
| `in_progress` | đang làm | dependency `done` + quyết định chặn `decided` |
| `blocked` | đủ thông tin nhưng đang chờ ngoài tầm tay (người, mạng, tài nguyên) | evidence nêu lý do (bắt buộc) |
| `needs_clarification` | thiếu thông tin để làm (phạm vi chưa chốt, lựa chọn chưa rõ, task quá lớn cần tách) | evidence nêu câu hỏi/thiếu sót cụ thể (bắt buộc); sau khi tinh chỉnh → đặt lại `not_started` |
| `needs_review` | đã làm xong, chờ người duyệt/gộp | evidence = kết quả các lệnh kiểm chứng |
| `failed` | đã thử nhưng lệnh kiểm chứng không xanh và không sửa được trong phạm vi task | evidence nêu lệnh nào thất bại, lỗi gì, đã thử gì (bắt buộc); KHÔNG xoá bản sửa dở khỏi nhánh |
| `done` | đã kiểm chứng | evidence + (nên có) commit; mọi dependency `done` |
| `cancelled` | bị hủy do quyết định thay đổi kế hoạch | evidence nêu DEC-xx và lý do |

`plan.mjs set` từ chối `blocked`, `needs_clarification`, `failed` nếu thiếu `--evidence`; `plan.mjs validate` báo lỗi nếu gặp các trạng thái này mà không có evidence. `plan.mjs next` luôn liệt kê riêng task `needs_clarification`/`failed` ở mục "CẦN CAN THIỆP / TINH CHỈNH" (kể cả task parking) để chúng không bị bỏ quên.

**Task bị chặn bởi quyết định `open`** không cần (và không nên) đặt `blocked` thủ công: trạng thái đó được suy ra từ `blockedByDecisions` và hiển thị ở mục "CHỜ QUYẾT ĐỊNH CHỦ DỰ ÁN" của `plan.mjs next`; đặt tay sẽ lỗi thời ngay khi `plan.mjs decide` chạy.

**Ánh xạ từ vựng:** prompt Sprint Planner dùng `pending → in_progress → review → completed`; tương ứng `not_started → in_progress → needs_review → done` ở đây (`meta.statusAliases`). Trạng thái của sprint được suy ra từ trạng thái các task (xem bảng "Tổng quan sprint" trong [SPRINT_PLAN.md](./SPRINT_PLAN.md)).

**Evidence tối thiểu:** lệnh đã chạy → kết quả ngắn gọn (ví dụ "`npm test` → 25 suite xanh, exit 0") → commit SHA. Không dán dữ liệu nhạy cảm. Với bug: ghi cách chứng minh test hồi quy đỏ trên mã cũ.

## 4. An toàn lệnh (kế thừa `.agent/rules/terminal-safety.md`)

- **Không đọc file `.env` hoặc khoá riêng** (đã áp dụng khi phân tích: `admin/.env` không được mở).
- Lệnh chỉ đọc (`ls`, `cat`, `grep`, `git status/diff/log`, `node --version`…) có thể chạy tự do.
- **Cần phê duyệt** trước: cài/gỡ gói; tạo/sửa/xoá/di chuyển file; build hoặc test **ghi file**; chạy dịch vụ nền; đổi nhánh/trạng thái git (`checkout`, `reset`, `rm --cached`…); yêu cầu mạng; đổi biến môi trường; chạy script có tác dụng phụ chưa rõ.
- **Cấm** nếu không có ủy quyền rõ ràng: `rm -rf`, `sudo`, `git push --force`, `git reset --hard`, `git clean -fd`, `curl | bash`.
- Build thử nghiệm luôn ra thư mục tạm: `npx vite build --outDir "$(mktemp -d)" --emptyOutDir` (KHÔNG chạy `npm run build` khi chỉ để kiểm tra — nó ghi đè artifact được track, trừ khi task yêu cầu).
- Không chạy `vite` dev cho tới khi FND-01 hoàn tất: nó ghi đè `node_modules/.vite/deps/_metadata.json` đang bị track. Nếu lỡ chạy: `git checkout -- node_modules/.vite/deps/_metadata.json` (cần duyệt).
- Khi chạy server/trình duyệt để thử: dùng cổng NGẪU NHIÊN (cổng 5199 đã bị dự án khác chiếm trên máy maintainer), dọn tiến trình và thư mục tạm kể cả khi lỗi.

## 5. Git

- Nhánh: `task/<ID>-<slug>` (ví dụ `task/ADM-01-utf8-body`). Một task = một PR; task L = nhiều commit (mỗi subtask một commit).
- Commit theo Conventional Commits, nêu Task ID: `fix(admin): decode request body once (ADM-01)`. Thêm dòng đồng tác giả nếu quy ước của agent/dự án yêu cầu.
- Không gộp nhiều task vào một commit; không `--force`; không commit `.env`, `admin/.data/`, `test-results/`.
- Artifact build: trước FND-04 theo quy ước cũ (commit lại `arcane-paws-standalone.html` và `dist/` khi đổi mã game); sau FND-04 theo chính sách mới và `npm run verify:artifacts`.
- Không đổi lịch sử (không rebase/squash trên nhánh đã đẩy) trừ khi chủ dự án yêu cầu.

## 6. Gotcha riêng của dự án (đã kiểm chứng với code hiện tại)

**Game và test**
- Hai test (`scripts/test-boss-gradual-arrival.js`, `scripts/test-boss-spawn-deadlock-prevention.js`) gọi `Game.prototype.updatePlaying.call(fakeContext, dt)`. Mọi `this.xxx` mới dùng trong `updatePlaying` phải được thêm vào các fake context đó (đã gặp với `upgrades`, `progress`, `_addScore`) — cho tới khi ARC-01 chuyển chúng sang `createTestGame()`.
- **Logic theo khung không thuộc mô phỏng lõi** → `PlayingState.update` / `Game.advanceEffects`, không phải `updatePlaying` (ví dụ `_pollStory`, `_updateEvents`, `_pollBossGimmicks`).
- Test Node mock DOM tối giản: `getElementById` trả một stub (`classList` chỉ có add/remove/contains; kết quả `createElement` không có `style`; không `toggle`). **Code UI phải guard truy cập DOM.**
- Ghost thêm (bất ngờ, gimmick boss) đi qua `WaveSystem.queueSpawn()`; boss chỉ phát `Enemy.gimmickEvent`, `Game` phản ứng. Ghost vàng không được tính vào số ghost sống/thù địch (`Game.js:1200–1201`).
- `game.bossRush` phải được xoá ở MỌI đường bắt đầu ván không phải Boss Rush: `Game.js:107, 2651, 2692`, `StateMachine.js:29`, `UIManager.js:351, 364`. Áp dụng tương tự cho `contentRun` (RUN-07).
- Mục tiêu thành tựu `bestiary_all` (11) gắn cứng với `BESTIARY.length` (`Achievements.js:145–148`): đừng thêm mục bestiary cho loại ghost mới.
- **Văn bản story bị test khoá** (`test-story-lore.js`): `STORY_SLIDES.INTRO` và `VICTORY` đúng 3 slide; `INTRO[0]` cần "Oliver"+"Nhật Thực", `INTRO[2]` cần "Luna"+"Nyx", `VICTORY[0]` cần "Umbra"; thoại viết tay ≤ 130 ký tự; slide 1 nhắc "năm ô trống", slide 2 nhắc "Nhật Ký Ký Ức". Đồng bộ với `docs/GDD.md` §9. Các câu thoại mở màn/trùm xuất hiện/trùm bị hạ chỉ được sửa ở `LEVEL_CONFIGS` (`storyIntroQuote`, `bossSpawnQuote`, `bossDefeatQuote`); `StoryScenes` và `STORY_CHAPTERS` chỉ tham chiếu chúng.
- Plot twist LUMEN dựa vào gợi ý rải ở `StoryScenes`, `Lore`, `STORY_CHAPTERS`, VICTORY — đổi một chỗ phải đổi đồng bộ.
- **Không thêm `shadowBlur` vào đường vẽ minion**; glow minion là sprite cache (`drawBodyGlow/drawEyeGlow/drawBadgeGlow`); boss giữ `shadowBlur` thật. Guard: `test-enemy-render-performance.js`. Một helper gọi `ctx.beginPath()` giữa `fill()` và `stroke()` sẽ làm mất path của `stroke()`.
- Đo hiệu năng bằng KHOẢNG CÁCH `requestAnimationFrame`, không đo thời gian JS; không gọi `getImageData` mỗi khung (Chrome bỏ tăng tốc GPU và cho kết quả sai); khoá `game.quality.setPreference("high")`.
- Game được lộ ra `window.__ARCANE_GAME__` (do `main.js`) để debug/harness.
- `test-engagement-features.js` đã flaky cho tới khi TST-01 xong: một lần đỏ ở đó chưa chắc là hồi quy — chạy lại trước khi điều tra.

**Admin và shared**
- Không bao giờ nhận `role` do client chọn; mọi mutation cần phiên + `X-Admin-Request: 1` + Origin cùng host + kiểm tra quyền phía server + `revision` (409).
- Endpoint đã xác thực giữ `Cache-Control: no-store`. Endpoint công khai (`/api/game-config/*`, `/api/game-content/*`, `/api/story-content/published`) chỉ trả bản đã publish.
- Schema `game-configuration` và `gameplay-content` là **strict**: thêm/xoá trường là thay đổi phá vỡ → phải nâng `SCHEMA_VERSION`/`CONTENT_SCHEMA_VERSION` và có kế hoạch migrate; không thêm trường "tiện tay".
- `shared/` phải đẳng cấu (không DOM/không API riêng Node). Hiện `gameplay-content.js` import `src/core/Constants.js` (chỉ dữ liệu) — đừng làm nặng thêm.
- Văn bản từ CMS luôn hiển thị bằng `textContent` (hoặc `escapeStoryText`), không bao giờ nội suy vào `innerHTML`.
- Test admin chạy `createAdminServer` với `dataDir` tạm và cổng 0; không đọc `.env`.

## 7. Công cụ `plan.mjs`

```text
node docs/ai-planning/tools/plan.mjs validate     # kiểm tra nhất quán; chạy TRƯỚC mỗi commit chạm tài liệu kế hoạch
node docs/ai-planning/tools/plan.mjs render       # sinh BACKLOG.md, SPRINT_PLAN.md, PROGRESS.md (khối tự động)
node docs/ai-planning/tools/plan.mjs next [--sprint N] [--all]
node docs/ai-planning/tools/plan.mjs show <ID>
node docs/ai-planning/tools/plan.mjs set <ID> <status> [--evidence "..."] [--commit <sha>]
node docs/ai-planning/tools/plan.mjs decide <DEC-ID> <option> [--note "..."]   # CHỈ chủ dự án
```

`validate` kiểm tra: ID duy nhất và đúng định dạng; chuỗi epic→feature→story→task; dependency tồn tại, không chu trình, không phụ thuộc sprint sau/parking; `storyPoints` khớp thang; quyết định chặn phải được quyết **trước** sprint của task đầu tiên bị chặn; mọi `affectedFiles` tồn tại hoặc được task nào đó tạo ra; truy vết hai chiều task↔GAP và REQ→GAP; mọi ID trong Markdown tồn tại; bảng mốc ROADMAP đúng sprint và mỗi mũi tên đường găng (ROADMAP §3) là phụ thuộc trực tiếp trong `tasks.json`; trạng thái `done` có evidence và dependency `done`; file sinh tự động còn mới.

## 8. Khi kế hoạch cần đổi

1. Sửa `tasks.json` (hoặc bảng trong `GAP_ANALYSIS.md`/`REQUIREMENTS.md` nếu là nội dung viết tay).
2. `plan.mjs render` rồi `plan.mjs validate` — phải sạch lỗi.
3. Ghi lý do vào "Nhật ký tiến độ" của [PROGRESS.md](./PROGRESS.md).
4. Nếu một quyết định `DEC-xx` đổi: lập lại các task bị ảnh hưởng (xem cảnh báo ở [SPRINT_PLAN.md](./SPRINT_PLAN.md)) và chuyển task bị hủy sang `cancelled` kèm evidence.
