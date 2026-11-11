#!/usr/bin/env node
/**
 * plan.mjs — công cụ cho docs/ai-planning. Không phụ thuộc gói ngoài; CHỈ đọc/ghi trong docs/ai-planning.
 *
 *   node docs/ai-planning/tools/plan.mjs validate
 *       Kiểm tra nhất quán tasks.json ↔ các file Markdown (ID, dependency, sprint, quyết định, gap, yêu cầu,
 *       đường dẫn file, trạng thái) và xác nhận các file sinh tự động còn mới.
 *   node docs/ai-planning/tools/plan.mjs render
 *       Sinh lại BACKLOG.md, SPRINT_PLAN.md và khối tự động của PROGRESS.md từ tasks.json.
 *   node docs/ai-planning/tools/plan.mjs next [--sprint N] [--all]
 *       Liệt kê task SẴN SÀNG (dependency đã done, quyết định đã decided).
 *   node docs/ai-planning/tools/plan.mjs show <TASK-ID>
 *       In đầy đủ một task, kèm Definition of Done chung.
 *   node docs/ai-planning/tools/plan.mjs set <TASK-ID> <status> [--evidence "..."] [--commit <sha>]
 *       Đổi trạng thái có kiểm tra (done cần evidence + dependency done + quyết định đã decided;
 *       blocked / needs_clarification / failed cần evidence nêu lý do).
 *   node docs/ai-planning/tools/plan.mjs decide <DEC-ID> <option-key> [--note "..."]
 *       Ghi nhận quyết định của CHỦ DỰ ÁN (agent không được tự gọi lệnh này thay chủ dự án).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAN = resolve(HERE, '..');
const ROOT = resolve(PLAN, '..', '..');
const JSON_PATH = join(PLAN, 'tasks.json');

const EPIC_CODES = ['FND', 'TST', 'ADM', 'SEC', 'RUN', 'BAL', 'IPA', 'MOD', 'OPS', 'ARC', 'UXL', 'REL'];
const TASK_RE = new RegExp(`\\b(?:${EPIC_CODES.join('|')})-\\d{2}\\b`, 'g');
const REQUIRED_FILES = ['PROJECT_ANALYSIS.md', 'REQUIREMENTS.md', 'GAP_ANALYSIS.md', 'ROADMAP.md', 'BACKLOG.md', 'SPRINT_PLAN.md', 'ARCHITECTURE.md', 'RISKS.md', 'EXECUTION_RULES.md', 'PROGRESS.md', 'tasks.json'];
const GAP_STATUS = ['COMPLETED', 'PARTIAL', 'MISSING', 'BUG', 'UNKNOWN'];
const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const TYPES = ['chore', 'bug', 'feature', 'refactor', 'test', 'docs', 'security'];
const EXECUTORS = ['agent', 'human', 'agent+human'];
const NEEDS_REASON = ['blocked', 'needs_clarification', 'failed']; // đổi sang các trạng thái này phải kèm evidence nêu lý do
const BEGIN = '<!-- BEGIN GENERATED -->';
const END = '<!-- END GENERATED -->';

const load = () => JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const save = (d) => writeFileSync(JSON_PATH, JSON.stringify(d, null, 2) + '\n');
const read = (name) => (existsSync(join(PLAN, name)) ? readFileSync(join(PLAN, name), 'utf8') : '');
const today = () => new Date().toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const list = (a) => (a && a.length ? a.join(', ') : '—');

// ───────────────────────────── tiện ích đồ thị ─────────────────────────────
function indexTasks(d) { return new Map(d.tasks.map((t) => [t.id, t])); }

function topoOrder(tasks) {
  const ids = new Set(tasks.map((t) => t.id));
  const indeg = new Map(tasks.map((t) => [t.id, 0]));
  for (const t of tasks) for (const dep of t.dependencies) if (ids.has(dep)) indeg.set(t.id, indeg.get(t.id) + 1);
  const ready = tasks.filter((t) => indeg.get(t.id) === 0).map((t) => t.id).sort();
  const out = [];
  while (ready.length) {
    const id = ready.shift();
    out.push(id);
    for (const t of tasks) if (t.dependencies.includes(id) && ids.has(t.id)) {
      indeg.set(t.id, indeg.get(t.id) - 1);
      if (indeg.get(t.id) === 0) { ready.push(t.id); ready.sort(); }
    }
  }
  return out;
}

function orderedTasks(d) {
  const sprintsOf = [...d.sprints.map((s) => s.id), null];
  const byId = indexTasks(d);
  const out = [];
  for (const sp of sprintsOf) {
    const group = d.tasks.filter((t) => t.sprint === sp);
    for (const id of topoOrder(group)) out.push(byId.get(id));
    for (const t of group) if (!out.includes(t)) out.push(t); // phòng khi có chu trình (validate sẽ báo lỗi)
  }
  return out;
}

// ───────────────────────────── validate ─────────────────────────────
function parseTable(md, idRe) {
  const rows = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
    if (cells.length && idRe.test(cells[0])) rows.push(cells);
  }
  return rows;
}

export function validate(d) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  if (d.schemaVersion !== 1) err('schemaVersion phải là 1.');
  for (const k of ['meta', 'decisions', 'epics', 'features', 'stories', 'sprints', 'tasks'])
    if (d[k] === undefined) err(`Thiếu khoá cấp cao: ${k}`);
  if (errors.length) return { errors, warnings };

  const scale = d.meta.storyPointScale;
  const dupCheck = (name, arr) => {
    const seen = new Set();
    for (const x of arr) { if (seen.has(x.id)) err(`${name}: ID trùng ${x.id}`); seen.add(x.id); }
    return seen;
  };
  const epicIds = dupCheck('epic', d.epics);
  const featureIds = dupCheck('feature', d.features);
  const storyIds = dupCheck('story', d.stories);
  const taskIds = dupCheck('task', d.tasks);
  const decIds = dupCheck('decision', d.decisions);

  // epic / feature / story
  for (const e of d.epics) {
    if (!/^EP-[A-Z]{3}$/.test(e.id) || !EPIC_CODES.includes(e.id.slice(3))) err(`epic ${e.id}: định dạng/mã không hợp lệ`);
    if (!PRIORITIES.includes(e.priority)) err(`epic ${e.id}: priority không hợp lệ`);
    if (!e.title || !e.goal) err(`epic ${e.id}: thiếu title/goal`);
  }
  for (const f of d.features) {
    const m = /^FT-([A-Z]{3})-\d+$/.exec(f.id);
    if (!m) err(`feature ${f.id}: định dạng không hợp lệ`);
    if (!epicIds.has(f.epic)) err(`feature ${f.id}: epic ${f.epic} không tồn tại`);
    else if (m && f.epic !== `EP-${m[1]}`) err(`feature ${f.id}: tiền tố không khớp epic ${f.epic}`);
  }
  for (const s of d.stories) {
    const m = /^US-([A-Z]{3})-\d+$/.exec(s.id);
    if (!m) err(`story ${s.id}: định dạng không hợp lệ`);
    const f = d.features.find((x) => x.id === s.feature);
    if (!f) err(`story ${s.id}: feature ${s.feature} không tồn tại`);
    else if (m && f.epic !== `EP-${m[1]}`) err(`story ${s.id}: tiền tố không khớp feature ${s.feature}`);
    if (!s.statement) err(`story ${s.id}: thiếu statement`);
  }

  // sprint
  d.sprints.forEach((s, i) => {
    if (s.id !== i) err(`sprint: id phải liên tục từ 0 (gặp ${s.id} ở vị trí ${i})`);
    for (const k of ['name', 'goal', 'scope']) if (!s[k]) err(`sprint ${s.id}: thiếu ${k}`);
    for (const k of ['deliverables', 'acceptanceCriteria', 'exitCriteria', 'risks'])
      if (!Array.isArray(s[k]) || !s[k].length) err(`sprint ${s.id}: ${k} phải là mảng không rỗng`);
  });
  const sprintIds = new Set(d.sprints.map((s) => s.id));

  // quyết định
  for (const dec of d.decisions) {
    if (!/^DEC-\d{2}$/.test(dec.id)) err(`decision ${dec.id}: định dạng không hợp lệ`);
    const keys = (dec.options || []).map((o) => o.key);
    if (keys.length < 2) err(`decision ${dec.id}: cần ≥ 2 option`);
    if (!keys.includes(dec.recommendation)) err(`decision ${dec.id}: recommendation không thuộc options`);
    if (!['open', 'decided'].includes(dec.status)) err(`decision ${dec.id}: status không hợp lệ`);
    if (dec.status === 'decided' && !keys.includes(dec.decidedOption)) err(`decision ${dec.id}: decidedOption không hợp lệ`);
    if (dec.status === 'decided' && !dec.decidedAt) err(`decision ${dec.id}: thiếu decidedAt`);
    if (!Number.isInteger(dec.neededBy) || !sprintIds.has(dec.neededBy)) err(`decision ${dec.id}: neededBy phải là id sprint hợp lệ`);
  }

  // task
  const byId = indexTasks(d);
  const newFiles = new Set();
  for (const t of d.tasks) for (const f of t.affectedFiles || []) if (/\(mới\)\s*$/.test(f)) newFiles.add(f.replace(/\s*\(.*\)\s*$/, ''));

  for (const t of d.tasks) {
    const at = `task ${t.id}`;
    const m = /^([A-Z]{3})-\d{2}$/.exec(t.id);
    if (!m || !EPIC_CODES.includes(m[1])) err(`${at}: ID không hợp lệ`);
    if (!epicIds.has(t.epic)) err(`${at}: epic ${t.epic} không tồn tại`);
    else if (m && t.epic !== `EP-${m[1]}`) err(`${at}: tiền tố ID không khớp epic ${t.epic}`);
    const feat = d.features.find((f) => f.id === t.feature);
    if (!feat) err(`${at}: feature ${t.feature} không tồn tại`);
    else if (feat.epic !== t.epic) err(`${at}: feature ${t.feature} không thuộc epic ${t.epic}`);
    const st = d.stories.find((s) => s.id === t.story);
    if (!st) err(`${at}: story ${t.story} không tồn tại`);
    else if (st.feature !== t.feature) err(`${at}: story ${t.story} không thuộc feature ${t.feature}`);
    for (const k of ['title', 'description']) if (!t[k] || typeof t[k] !== 'string') err(`${at}: thiếu ${k}`);
    if (!PRIORITIES.includes(t.priority)) err(`${at}: priority không hợp lệ`);
    if (!TYPES.includes(t.type)) err(`${at}: type không hợp lệ (${t.type})`);
    if (!EXECUTORS.includes(t.executor)) err(`${at}: executor không hợp lệ`);
    if (!Object.hasOwn(scale, t.complexity)) err(`${at}: complexity không hợp lệ`);
    else if (t.storyPoints !== scale[t.complexity]) err(`${at}: storyPoints ${t.storyPoints} ≠ thang ${scale[t.complexity]} của ${t.complexity}`);
    if (t.sprint !== null && !sprintIds.has(t.sprint)) err(`${at}: sprint ${t.sprint} không tồn tại`);
    if (!Array.isArray(t.gapRefs) || !t.gapRefs.length) err(`${at}: phải có ≥ 1 gapRef (truy vết yêu cầu → gap → task)`);
    for (const k of ['affectedFiles', 'acceptanceCriteria', 'definitionOfDone', 'verificationCommands'])
      if (!Array.isArray(t[k]) || !t[k].length) err(`${at}: ${k} phải là mảng không rỗng`);
    if (!Array.isArray(t.implementationSteps) || t.implementationSteps.length < 2) err(`${at}: implementationSteps cần ≥ 2 bước`);
    if (t.complexity === 'L' && (t.implementationSteps || []).length < 4) warn(`${at}: task L nên có ≥ 4 subtask`);
    if (t.complexity === 'XL' && t.executor === 'agent') err(`${at}: XL phải có executor có yếu tố con người`);
    for (const dep of t.dependencies || []) {
      if (dep === t.id) err(`${at}: tự phụ thuộc chính nó`);
      const dt = byId.get(dep);
      if (!dt) { err(`${at}: dependency ${dep} không tồn tại`); continue; }
      if (t.sprint !== null) {
        if (dt.sprint === null) err(`${at}: task đã xếp sprint không được phụ thuộc task parking ${dep}`);
        else if (dt.sprint > t.sprint) err(`${at}: dependency ${dep} ở sprint ${dt.sprint} > sprint ${t.sprint}`);
      }
    }
    for (const dec of t.blockedByDecisions || []) if (!decIds.has(dec)) err(`${at}: quyết định ${dec} không tồn tại`);
    for (const f of t.affectedFiles || []) {
      const isNew = /\(mới\)\s*$/.test(f);
      const p = f.replace(/\s*\(.*\)\s*$/, '');
      if (isNew || p.includes('*')) continue;
      if (!existsSync(join(ROOT, p)) && !newFiles.has(p)) err(`${at}: affectedFile không tồn tại và không được task nào tạo: ${p}`);
    }
    // trạng thái
    if (!d.meta.statusValues.includes(t.status)) err(`${at}: status không hợp lệ`);
    const depsDone = (t.dependencies || []).every((x) => byId.get(x)?.status === 'done');
    const decOk = (t.blockedByDecisions || []).every((x) => d.decisions.find((y) => y.id === x)?.status === 'decided');
    if (t.status === 'done') {
      if (!Array.isArray(t.evidence) || !t.evidence.length) err(`${at}: done nhưng không có evidence`);
      if (!t.completedAt) err(`${at}: done nhưng thiếu completedAt`);
    }
    if (NEEDS_REASON.includes(t.status) && (!Array.isArray(t.evidence) || !t.evidence.length)) err(`${at}: ${t.status} nhưng không có evidence nêu lý do`);
    if (['in_progress', 'needs_review', 'done'].includes(t.status)) {
      if (!depsDone) err(`${at}: ${t.status} nhưng dependency chưa done`);
      if (!decOk) err(`${at}: ${t.status} nhưng quyết định chặn còn mở`);
    }
  }

  // chu trình
  const order = topoOrder(d.tasks);
  if (order.length !== d.tasks.length) {
    const stuck = d.tasks.filter((t) => !order.includes(t.id)).map((t) => t.id);
    err(`Phát hiện chu trình dependency trong: ${stuck.join(', ')}`);
  }

  // quyết định ↔ sprint
  for (const dec of d.decisions) {
    const blocked = d.tasks.filter((t) => (t.blockedByDecisions || []).includes(dec.id));
    if (!blocked.length) warn(`decision ${dec.id}: không chặn task nào`);
    const sprinted = blocked.filter((t) => t.sprint !== null);
    if (sprinted.length) {
      const first = Math.min(...sprinted.map((t) => t.sprint));
      if (dec.neededBy > first) err(`decision ${dec.id}: neededBy=${dec.neededBy} nhưng task bị chặn đầu tiên ở sprint ${first}`);
    }
  }

  // tải sprint
  for (const s of d.sprints) {
    const sp = d.tasks.filter((t) => t.sprint === s.id).reduce((n, t) => n + t.storyPoints, 0);
    if (!d.tasks.some((t) => t.sprint === s.id)) err(`sprint ${s.id}: không có task`);
    if (sp > d.meta.sprintCapacitySP * 1.25) warn(`sprint ${s.id}: ${sp} SP vượt 125% sức chứa giả định (${d.meta.sprintCapacitySP})`);
  }

  // tệp bắt buộc
  for (const f of REQUIRED_FILES) if (!existsSync(join(PLAN, f))) err(`Thiếu file bắt buộc: docs/ai-planning/${f}`);

  // ── tham chiếu chéo trong Markdown ──
  const gapDoc = read('GAP_ANALYSIS.md');
  const reqDoc = read('REQUIREMENTS.md');
  const gapRows = parseTable(gapDoc, /^GAP-\d{3}$/);
  const gaps = new Map();
  for (const c of gapRows) {
    const [id, status, , , tasksCell = '', decCell = ''] = c;
    if (gaps.has(id)) err(`GAP_ANALYSIS.md: GAP trùng ${id}`);
    if (!GAP_STATUS.includes(status)) err(`GAP_ANALYSIS.md: ${id} có status không hợp lệ (${status})`);
    const tIds = tasksCell.match(TASK_RE) || [];
    const dIds = decCell.match(/DEC-\d{2}/g) || [];
    gaps.set(id, { status, tIds, dIds });
    if (status !== 'COMPLETED' && !tIds.length && !dIds.length) err(`GAP_ANALYSIS.md: ${id} (${status}) không có task/quyết định xử lý`);
    for (const x of tIds) {
      const tk = byId.get(x);
      if (!tk) err(`GAP_ANALYSIS.md: ${id} tham chiếu task không tồn tại ${x}`);
      else if (!tk.gapRefs.includes(id)) err(`GAP_ANALYSIS.md: ${id} liệt kê ${x} nhưng ${x}.gapRefs không có ${id}`);
    }
    for (const x of dIds) if (!decIds.has(x)) err(`GAP_ANALYSIS.md: ${id} tham chiếu quyết định không tồn tại ${x}`);
    if (status !== 'COMPLETED' && !new RegExp(`^###\\s+${id}\\b`, 'm').test(gapDoc)) err(`GAP_ANALYSIS.md: thiếu mục chi tiết "### ${id}"`);
  }
  for (const t of d.tasks) for (const g of t.gapRefs || []) {
    if (!gaps.has(g)) err(`task ${t.id}: gapRef ${g} không có trong GAP_ANALYSIS.md`);
    else if (!gaps.get(g).tIds.includes(t.id)) err(`task ${t.id}: gapRef ${g} nhưng bảng GAP_ANALYSIS.md không liệt kê ${t.id}`);
  }
  const reqRows = parseTable(reqDoc, /^REQ-[A-Z]\d{2}$/);
  const reqIds = new Set();
  for (const c of reqRows) {
    const [id, , , , status, gapCell = ''] = c;
    if (reqIds.has(id)) err(`REQUIREMENTS.md: REQ trùng ${id}`);
    reqIds.add(id);
    if (!GAP_STATUS.includes(status)) err(`REQUIREMENTS.md: ${id} có status không hợp lệ (${status})`);
    const gs = gapCell.match(/GAP-\d{3}/g) || [];
    if (status !== 'COMPLETED' && !gs.length) err(`REQUIREMENTS.md: ${id} (${status}) không trỏ tới GAP nào`);
    for (const g of gs) if (!gaps.has(g)) err(`REQUIREMENTS.md: ${id} tham chiếu GAP không tồn tại ${g}`);
  }
  if (!reqRows.length) err('REQUIREMENTS.md: không tìm thấy bảng yêu cầu (REQ-xNN)');
  if (!gapRows.length) err('GAP_ANALYSIS.md: không tìm thấy bảng GAP');

  // ID xuất hiện trong mọi Markdown phải tồn tại
  for (const name of readdirSync(PLAN).filter((f) => f.endsWith('.md'))) {
    const lines = read(name).split('\n');
    lines.forEach((line, i) => {
      for (const id of line.match(TASK_RE) || []) if (!taskIds.has(id)) err(`${name}:${i + 1}: task ${id} không tồn tại`);
      for (const id of line.match(/\bDEC-\d{2}\b/g) || []) if (!decIds.has(id)) err(`${name}:${i + 1}: quyết định ${id} không tồn tại`);
      for (const id of line.match(/\bGAP-\d{3}\b/g) || []) if (!gaps.has(id)) err(`${name}:${i + 1}: ${id} không được định nghĩa trong GAP_ANALYSIS.md`);
      for (const id of line.match(/\bREQ-[A-Z]\d{2}\b/g) || []) if (!reqIds.has(id)) err(`${name}:${i + 1}: ${id} không được định nghĩa trong REQUIREMENTS.md`);
    });
  }

  // bảng mốc trong ROADMAP.md: task nêu trong hàng `| M<n> · … | S<k> | ...` phải thuộc sprint k.
  // (v1.1.0: regex cũ /^M\d$/ không khớp ô "M0 · Baseline…" nên kiểm tra này từng KHÔNG chạy; nay khớp theo đầu ô và báo lỗi nếu không đọc được hàng nào.)
  const milestoneRows = parseTable(read('ROADMAP.md'), /^M\d\b/);
  if (!milestoneRows.length) err('ROADMAP.md: không đọc được hàng mốc nào (ô đầu phải bắt đầu bằng M<n>)');
  for (const c of milestoneRows) {
    const sm = /^S(\d+)$/.exec(c[1] || '');
    if (!sm) { err(`ROADMAP.md: hàng mốc ${c[0]} thiếu cột sprint dạng S<k>`); continue; }
    for (const id of c.slice(2).join(' ').match(TASK_RE) || []) {
      const tk = byId.get(id);
      if (tk && tk.sprint !== Number(sm[1])) err(`ROADMAP.md: ${c[0]} (S${sm[1]}) liệt kê ${id} nhưng ${id} ở sprint ${tk.sprint === null ? 'parking' : tk.sprint}`);
    }
  }

  // đường găng trong ROADMAP.md §3: mỗi mũi tên `A → B` giữa hai task phải là phụ thuộc TRỰC TIẾP (B.dependencies ∋ A).
  // Quy ước: mỗi dòng đúng một chuỗi; `X + Y → Z` = Z cần cả X và Y; đoạn chỉ có DEC-xx/chữ thì bỏ qua. (v1.1.0)
  {
    const road = /^## 3\. Đường găng[^\n]*\n([\s\S]*?)(?=^## \d)/m.exec(read('ROADMAP.md'));
    if (!road) err('ROADMAP.md: thiếu mục "## 3. Đường găng"');
    else {
      let arrows = 0;
      for (const line of road[1].split('\n')) {
        if (!line.includes('→')) continue;
        const segs = line.split('→').map((s) => s.match(TASK_RE) || []);
        for (let i = 0; i + 1 < segs.length; i++) {
          if (!segs[i].length || !segs[i + 1].length) continue;
          for (const b of segs[i + 1]) for (const a of segs[i]) {
            arrows++;
            const tb = byId.get(b);
            if (tb && !tb.dependencies.includes(a)) err(`ROADMAP.md (§3 đường găng): "${a} → ${b}" nhưng ${b} không phụ thuộc trực tiếp ${a} (phụ thuộc: ${list(tb.dependencies)})`);
          }
        }
      }
      if (!arrows) err('ROADMAP.md §3: không đọc được mũi tên đường găng nào giữa các task');
    }
  }

  // file sinh tự động còn mới? (nếu dữ liệu đã sai thì render có thể không thực hiện được — không để validator sập)
  try {
    const fresh = [['BACKLOG.md', renderBacklog(d)], ['SPRINT_PLAN.md', renderSprintPlan(d)]];
    for (const [name, content] of fresh) if (read(name) !== content) err(`${name} đã cũ so với tasks.json — chạy: node docs/ai-planning/tools/plan.mjs render`);
    const prog = read('PROGRESS.md');
    const block = renderProgressBlock(d);
    if (!prog.includes(BEGIN) || !prog.includes(END)) err('PROGRESS.md: thiếu cặp marker GENERATED');
    else if (prog.slice(prog.indexOf(BEGIN), prog.indexOf(END) + END.length) !== `${BEGIN}\n${block}\n${END}`) err('PROGRESS.md: khối tự động đã cũ — chạy: node docs/ai-planning/tools/plan.mjs render');
  } catch (e) {
    if (!errors.length) err(`Không render được để so sánh độ mới: ${e.message}`);
  }

  return { errors, warnings };
}

// ───────────────────────────── render ─────────────────────────────
const nid = (id) => id.replace(/-/g, '_');
const TOTAL_SP = (tasks) => tasks.reduce((n, t) => n + t.storyPoints, 0);
// Trạng thái sprint suy ra từ task (không lưu): task `cancelled` không tính; mọi task còn lại `done` → done;
// có task đã rời `not_started` (kể cả blocked/failed/needs_clarification) → in_progress; ngược lại not_started.
function sprintStatus(ts) {
  const live = ts.filter((t) => t.status !== 'cancelled');
  if (!live.length) return 'cancelled';
  if (live.every((t) => t.status === 'done')) return 'done';
  return live.some((t) => t.status !== 'not_started') ? 'in_progress' : 'not_started';
}

function taskLine(t) {
  return `| ${t.id} | ${esc(t.title)} | ${t.priority} | ${t.complexity} (${t.storyPoints}) | ${t.sprint === null ? 'parking' : 'S' + t.sprint} | ${t.status} |`;
}

export function renderBacklog(d) {
  const L = [];
  const byId = indexTasks(d);
  L.push('# BACKLOG — Epic → Feature → User Story → Task → Subtask', '');
  L.push('> **File sinh tự động từ [`tasks.json`](./tasks.json) bởi `tools/plan.mjs render`. KHÔNG sửa tay** — sửa `tasks.json` rồi chạy `node docs/ai-planning/tools/plan.mjs render`.', '');
  L.push(`Baseline: nhánh \`${d.meta.baseline.branch}\`, commit \`${d.meta.baseline.commit}\`, kế hoạch v${d.meta.planVersion} (${d.meta.createdAt}).`, '');
  L.push('## Quy ước', '');
  for (const c of d.meta.conventions) L.push(`- ${c}`);
  L.push('', '### Thang độ phức tạp → Story Points', '', '| Complexity | SP | Ý nghĩa |', '|---|---:|---|');
  for (const [k, v] of Object.entries(d.meta.storyPointScale)) L.push(`| ${k} | ${v} | ${esc(d.meta.complexityGuide[k])} |`);
  L.push('', '### Mức ưu tiên', '', '| Mức | Ý nghĩa |', '|---|---|');
  for (const [k, v] of Object.entries(d.meta.priorityGuide)) L.push(`| ${k} | ${esc(v)} |`);
  L.push('', '### Quy tắc trạng thái', '');
  for (const r of d.meta.statusRules) L.push(`- ${r}`);
  L.push('', '## Definition of Done chung (áp dụng cho MỌI task)', '');
  for (const r of d.meta.definitionOfDoneBase) L.push(`- [ ] ${r}`);
  L.push('', '## Tổng quan', '');
  const sched = d.tasks.filter((t) => t.sprint !== null);
  const park = d.tasks.filter((t) => t.sprint === null);
  L.push(`- **${d.tasks.length}** task (${sched.length} đã xếp vào ${d.sprints.length} sprint = ${TOTAL_SP(sched)} SP; ${park.length} ở parking lot = ${TOTAL_SP(park)} SP), **${d.epics.length}** epic, **${d.features.length}** feature, **${d.stories.length}** user story, **${d.decisions.length}** quyết định cần chủ dự án.`, '');
  L.push('| Epic | Tiêu đề | Ưu tiên | Task | SP |', '|---|---|---|---:|---:|');
  for (const e of d.epics) {
    const ts = d.tasks.filter((t) => t.epic === e.id);
    L.push(`| [${e.id}](#${e.id.toLowerCase()}) | ${esc(e.title)} | ${e.priority} | ${ts.length} | ${TOTAL_SP(ts)} |`);
  }
  L.push('');
  for (const e of d.epics) {
    L.push(`## ${e.id}`, '', `### ${e.title}`, '', `**Mục tiêu:** ${e.goal}  `, `**Ưu tiên epic:** ${e.priority}`, '');
    for (const f of d.features.filter((x) => x.epic === e.id)) {
      L.push(`#### Feature ${f.id} — ${f.title}`, '', f.description, '');
      for (const s of d.stories.filter((x) => x.feature === f.id)) {
        L.push(`##### Story ${s.id}`, '', `> ${s.statement}`, '');
        const ts = d.tasks.filter((t) => t.story === s.id);
        if (!ts.length) { L.push('_(chưa có task)_', ''); continue; }
        L.push('| Task | Tiêu đề | Ưu tiên | Độ phức tạp (SP) | Sprint | Trạng thái |', '|---|---|---|---|---|---|');
        for (const t of ts) L.push(taskLine(t));
        L.push('');
        for (const t of ts) {
          L.push(`###### ${t.id} — ${t.title}`, '');
          L.push('| Thuộc tính | Giá trị |', '|---|---|');
          L.push(`| Loại / Ưu tiên | ${t.type} / ${t.priority} |`);
          L.push(`| Độ phức tạp / SP | ${t.complexity} / ${t.storyPoints} |`);
          L.push(`| Sprint | ${t.sprint === null ? 'parking lot (chưa xếp lịch)' : t.sprint} |`);
          L.push(`| Người thực hiện | ${t.executor} |`);
          L.push(`| Dependencies | ${list(t.dependencies)} |`);
          L.push(`| Quyết định chặn | ${list(t.blockedByDecisions)} |`);
          L.push(`| Gap liên quan | ${list(t.gapRefs)} |`);
          L.push(`| Trạng thái | ${t.status}${t.completedAt ? ` (${t.completedAt})` : ''} |`, '');
          L.push('**Mô tả.** ' + t.description, '');
          L.push('**Affected files**', '');
          for (const f of t.affectedFiles) L.push(`- \`${f}\``);
          L.push('', '**Implementation steps (subtask)**', '');
          t.implementationSteps.forEach((s, i) => L.push(`${i + 1}. \`${t.id}.${i + 1}\` — ${s}`));
          L.push('', '**Acceptance criteria**', '');
          for (const a of t.acceptanceCriteria) L.push(`- [ ] ${a}`);
          L.push('', '**Definition of Done (riêng task; cộng với DoD chung ở đầu file)**', '');
          for (const a of t.definitionOfDone) L.push(`- [ ] ${a}`);
          L.push('', '**Verification commands**', '', '```sh');
          for (const c of t.verificationCommands) L.push(c);
          L.push('```', '');
          if (t.risks && t.risks.length) { L.push('**Rủi ro**', ''); for (const r of t.risks) L.push(`- ${r}`); L.push(''); }
        }
      }
    }
  }
  void byId;
  return L.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

export function renderSprintPlan(d) {
  const L = [];
  const byId = indexTasks(d);
  L.push('# SPRINT PLAN', '');
  L.push('> **File sinh tự động từ [`tasks.json`](./tasks.json) bởi `tools/plan.mjs render`. KHÔNG sửa tay.**', '');
  L.push('## Giả định về năng lực', '', `- Sức chứa giả định: **${d.meta.sprintCapacitySP} SP/sprint** (±4). ${d.meta.capacityNote}`);
  L.push('- Kế hoạch được lập với MỌI quyết định ở phương án khuyến nghị. Nếu chủ dự án chọn phương án khác, cần lập lại kế hoạch (ví dụ DEC-02 = C hủy phần lớn nhóm RUN; DEC-05 = A hủy OPS-01..05 và ADM-05; DEC-07 = A hủy UXL-01/02).');
  L.push('- Task chỉ được bắt đầu khi mọi dependency `done` VÀ mọi quyết định chặn đã `decided`.', '');
  const cap = d.meta.sprintCapacitySP;
  L.push('## Tổng quan sprint', '', '| Sprint | Tên | Trạng thái | Task | SP | So với sức chứa giả định | Quyết định cần có trước |', '|---:|---|---|---:|---:|---:|---|');
  for (const s of d.sprints) {
    const ts = d.tasks.filter((t) => t.sprint === s.id);
    const decs = d.decisions.filter((x) => x.neededBy === s.id).map((x) => x.id);
    L.push(`| [S${s.id}](#sprint-${s.id}) | ${esc(s.name)} | ${sprintStatus(ts)} | ${ts.length} | ${TOTAL_SP(ts)} | ${Math.round((TOTAL_SP(ts) / cap) * 100)}% | ${list(decs)} |`);
  }
  const park = d.tasks.filter((t) => t.sprint === null);
  const scheduled = d.tasks.filter((t) => t.sprint !== null);
  L.push(`| [Parking](#parking-lot) | Có điều kiện / tùy chọn | — | ${park.length} | ${TOTAL_SP(park)} | — | — |`);
  L.push(`| **Tổng** | | | **${d.tasks.length}** | **${TOTAL_SP(d.tasks)}** | | |`, '');
  L.push(`Tổng SP = **${TOTAL_SP(d.tasks)}**: đã xếp sprint **${TOTAL_SP(scheduled)}** (${scheduled.length} task) + parking lot **${TOTAL_SP(park)}** (${park.length} task). "Trạng thái" của sprint được SUY RA từ trạng thái các task (không lưu riêng nên không thể lỗi thời).`, '');

  L.push('## Đồ thị dependency', '', 'Màu: đỏ = P0, cam = P1, xanh = P2, xám = P3. Mũi tên A → B nghĩa là B phụ thuộc A.', '', '```mermaid', 'flowchart LR');
  for (const s of d.sprints) {
    L.push(`  subgraph S${s.id}["Sprint ${s.id} · ${s.name.replace(/"/g, "'")}"]`);
    for (const t of d.tasks.filter((x) => x.sprint === s.id)) L.push(`    ${nid(t.id)}["${t.id}"]`);
    L.push('  end');
  }
  if (park.length) {
    L.push('  subgraph PL["Parking lot"]');
    for (const t of park) L.push(`    ${nid(t.id)}["${t.id}"]`);
    L.push('  end');
  }
  for (const t of orderedTasks(d)) for (const dep of t.dependencies) L.push(`  ${nid(dep)} --> ${nid(t.id)}`);
  L.push('  classDef p0 fill:#fee2e2,stroke:#b91c1c,color:#111;', '  classDef p1 fill:#ffedd5,stroke:#c2410c,color:#111;', '  classDef p2 fill:#dbeafe,stroke:#1d4ed8,color:#111;', '  classDef p3 fill:#f3f4f6,stroke:#6b7280,color:#111;');
  for (const p of PRIORITIES) {
    const ids = d.tasks.filter((t) => t.priority === p).map((t) => nid(t.id));
    if (ids.length) L.push(`  class ${ids.join(',')} ${p.toLowerCase()};`);
  }
  L.push('```', '');

  for (const s of d.sprints) {
    L.push(`## Sprint ${s.id}`, '', `### ${s.name}`, '');
    const ts = orderedTasks(d).filter((t) => t.sprint === s.id);
    L.push(`**Sprint Goal.** ${s.goal}`, '', `**Scope.** ${s.scope}`, '', `**Trạng thái.** ${sprintStatus(ts)}`, '', `**Quy mô.** ${ts.length} task · **${TOTAL_SP(ts)} SP** (${Math.round((TOTAL_SP(ts) / cap) * 100)}% sức chứa giả định ${cap} SP)`, '');
    const decs = d.decisions.filter((x) => x.neededBy === s.id);
    L.push('**Quyết định cần có trước khi bắt đầu sprint.** ' + (decs.length ? decs.map((x) => `${x.id} (${x.title})`).join('; ') : 'không'), '');
    L.push('**Task (theo thứ tự thực hiện gợi ý).**', '', '| Task | Tiêu đề | P | SP | Dependencies | Quyết định chặn | Executor |', '|---|---|---|---:|---|---|---|');
    for (const t of ts) L.push(`| ${t.id} | ${esc(t.title)} | ${t.priority} | ${t.storyPoints} | ${list(t.dependencies)} | ${list(t.blockedByDecisions)} | ${t.executor} |`);
    const ext = [...new Set(ts.flatMap((t) => t.dependencies).filter((x) => byId.get(x)?.sprint !== s.id))];
    L.push('', '**Dependencies từ sprint trước.** ' + (ext.length ? ext.join(', ') : 'không'), '');
    L.push('**Deliverables.**', ''); for (const x of s.deliverables) L.push(`- ${x}`);
    L.push('', '**Acceptance Criteria.**', ''); for (const x of s.acceptanceCriteria) L.push(`- ${x}`);
    L.push('', '**Exit Criteria.**', ''); for (const x of s.exitCriteria) L.push(`- ${x}`);
    L.push('', '**Rủi ro.**', ''); for (const x of s.risks) L.push(`- ${x}`);
    L.push('');
  }
  L.push('## Parking lot', '', 'Task có điều kiện hoặc tùy chọn — chưa xếp sprint; chỉ khởi động khi điều kiện nêu trong mô tả được chủ dự án xác nhận. Task đã xếp sprint không được phụ thuộc các task này.', '');
  L.push('| Task | Tiêu đề | P | SP | Điều kiện | Dependencies |', '|---|---|---|---:|---|---|');
  for (const t of park) L.push(`| ${t.id} | ${esc(t.title)} | ${t.priority} | ${t.storyPoints} | ${list(t.blockedByDecisions)} | ${list(t.dependencies)} |`);
  L.push('', '## Danh sách quyết định cần chủ dự án', '', 'Trạng thái hiện tại nằm trong [`PROGRESS.md`](./PROGRESS.md). Agent KHÔNG được tự quyết.', '');
  L.push('| ID | Cần trước sprint | Tiêu đề | Khuyến nghị | Chặn task |', '|---|---:|---|---|---|');
  for (const x of d.decisions) {
    const blocks = d.tasks.filter((t) => (t.blockedByDecisions || []).includes(x.id)).map((t) => t.id);
    L.push(`| ${x.id} | ${x.neededBy} | ${esc(x.title)} | ${x.recommendation} — ${esc(x.options.find((o) => o.key === x.recommendation).label)} | ${list(blocks)} |`);
  }
  for (const x of d.decisions) {
    L.push('', `### ${x.id} — ${x.title}`, '', x.question, '');
    for (const o of x.options) L.push(`- **${o.key}**${o.key === x.recommendation ? ' (khuyến nghị)' : ''}: ${o.label}`);
    L.push('', `_Lý do khuyến nghị:_ ${x.rationale}`);
  }
  return L.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

export function renderProgressBlock(d) {
  const L = [];
  const count = (s) => d.tasks.filter((t) => t.status === s).length;
  const done = d.tasks.filter((t) => t.status === 'done');
  L.push('### Tổng hợp', '', '| Trạng thái | Số task |', '|---|---:|');
  for (const s of d.meta.statusValues) L.push(`| ${s} | ${count(s)} |`);
  L.push(`| **Tổng** | **${d.tasks.length}** |`, '');
  L.push(`SP hoàn thành (đã xác minh): **${TOTAL_SP(done)} / ${TOTAL_SP(d.tasks)}** (đã xếp sprint: ${TOTAL_SP(done.filter((t) => t.sprint !== null))} / ${TOTAL_SP(d.tasks.filter((t) => t.sprint !== null))}). Sprint hiện tại: **S${d.meta.currentSprint}**.`, '');
  L.push('### Theo sprint', '', '| Sprint | Task done / tổng | SP done / tổng |', '|---:|---:|---:|');
  for (const s of d.sprints) {
    const ts = d.tasks.filter((t) => t.sprint === s.id);
    const dn = ts.filter((t) => t.status === 'done');
    L.push(`| S${s.id} | ${dn.length} / ${ts.length} | ${TOTAL_SP(dn)} / ${TOTAL_SP(ts)} |`);
  }
  L.push('', '### Quyết định của chủ dự án', '', '| ID | Cần trước S | Trạng thái | Lựa chọn | Ngày | Ghi chú |', '|---|---:|---|---|---|---|');
  for (const x of d.decisions) L.push(`| ${x.id} | ${x.neededBy} | ${x.status} | ${x.decidedOption ?? '—'} | ${x.decidedAt ?? '—'} | ${esc(x.note || '')} |`);
  L.push('', '### Từng task', '', '| Task | Sprint | Trạng thái | Hoàn thành | Evidence |', '|---|---|---|---|---|');
  for (const t of orderedTasks(d)) {
    const ev = t.evidence.length ? esc(t.evidence.at(-1).text).slice(0, 100) : '—';
    L.push(`| ${t.id} | ${t.sprint === null ? 'parking' : 'S' + t.sprint} | ${t.status} | ${t.completedAt ?? '—'} | ${ev} |`);
  }
  return L.join('\n');
}

const PROGRESS_HEAD = `# PROGRESS

> Bảng bên dưới giữa hai marker được **sinh tự động** từ [\`tasks.json\`](./tasks.json) (\`node docs/ai-planning/tools/plan.mjs render\`). Phần "Nhật ký tiến độ" phía dưới là của con người/agent viết tay.
>
> **Không tự đánh dấu task hoàn thành khi chưa kiểm chứng.** Trạng thái chỉ đổi qua \`plan.mjs set\` và \`done\` bắt buộc có evidence (lệnh + kết quả + commit).

`;

function renderProgressFile(d, existing) {
  const block = `${BEGIN}\n${renderProgressBlock(d)}\n${END}`;
  if (existing && existing.includes(BEGIN) && existing.includes(END)) {
    return existing.slice(0, existing.indexOf(BEGIN)) + block + existing.slice(existing.indexOf(END) + END.length);
  }
  return `${PROGRESS_HEAD}${block}

## Nhật ký tiến độ

Ghi theo thứ tự thời gian (mới nhất ở trên). Mỗi dòng: \`YYYY-MM-DD — <Task ID> — <việc đã làm / bằng chứng / vấn đề>\`.

- 2026-11-10 — (kế hoạch) — Lập kế hoạch ban đầu từ phân tích repo tại commit ${d.meta.baseline.commit}; chưa có task nào bắt đầu. Số liệu baseline: xem PROJECT_ANALYSIS.md §"Nhật ký xác minh".
`;
}

function renderAll(d) {
  writeFileSync(join(PLAN, 'BACKLOG.md'), renderBacklog(d));
  writeFileSync(join(PLAN, 'SPRINT_PLAN.md'), renderSprintPlan(d));
  writeFileSync(join(PLAN, 'PROGRESS.md'), renderProgressFile(d, read('PROGRESS.md')));
}

// ───────────────────────────── lệnh ─────────────────────────────
function arg(name) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; }

function cmdNext(d) {
  const byId = indexTasks(d);
  const limit = process.argv.includes('--all') ? Infinity : (arg('--sprint') !== undefined ? Number(arg('--sprint')) : d.meta.currentSprint);
  const only = arg('--sprint') !== undefined;
  const rows = [];
  for (const t of orderedTasks(d)) {
    if (!['not_started', 'blocked'].includes(t.status)) continue;
    if (t.sprint === null) continue;
    if (only ? t.sprint !== limit : t.sprint > limit) continue;
    const depsOk = t.dependencies.every((x) => byId.get(x)?.status === 'done');
    const openDec = t.blockedByDecisions.filter((x) => d.decisions.find((y) => y.id === x).status !== 'decided');
    rows.push({ t, depsOk, openDec });
  }
  const ready = rows.filter((r) => r.depsOk && !r.openDec.length);
  console.log(`SẴN SÀNG (${ready.length}) — sprint ${only ? limit : '≤ ' + limit}:`);
  for (const { t } of ready) console.log(`  ${t.id.padEnd(7)} ${t.priority}  ${String(t.storyPoints).padStart(2)}SP  S${t.sprint}  ${t.title}`);
  const waitingDec = rows.filter((r) => r.depsOk && r.openDec.length);
  if (waitingDec.length) {
    console.log(`\nCHỜ QUYẾT ĐỊNH CHỦ DỰ ÁN (${waitingDec.length}):`);
    for (const { t, openDec } of waitingDec) console.log(`  ${t.id.padEnd(7)} cần: ${openDec.join(', ')}`);
  }
  const waitingDeps = rows.filter((r) => !r.depsOk);
  if (waitingDeps.length) {
    console.log(`\nCHỜ DEPENDENCY (${waitingDeps.length}):`);
    for (const { t } of waitingDeps) console.log(`  ${t.id.padEnd(7)} chờ: ${t.dependencies.filter((x) => byId.get(x)?.status !== 'done').join(', ')}`);
  }
  // task cần người/tinh chỉnh: không bao giờ được rơi khỏi tầm nhìn dù nằm ngoài phạm vi sprint đang xét (kể cả parking)
  const attention = d.tasks.filter((t) => ['needs_clarification', 'failed'].includes(t.status));
  if (attention.length) {
    console.log(`\nCẦN CAN THIỆP / TINH CHỈNH (${attention.length}):`);
    for (const t of attention) console.log(`  ${t.id.padEnd(7)} ${t.status.padEnd(19)} ${(t.evidence.at(-1)?.text || '').slice(0, 110)}`);
  }
}

function cmdShow(d, id) {
  const t = indexTasks(d).get(id);
  if (!t) { console.error(`Không có task ${id}`); process.exit(1); }
  const out = [`${t.id} — ${t.title}`, '='.repeat(60), t.description, '',
    `Loại/Ưu tiên/Độ phức tạp: ${t.type} / ${t.priority} / ${t.complexity} (${t.storyPoints} SP)`,
    `Sprint: ${t.sprint === null ? 'parking' : t.sprint}   Executor: ${t.executor}   Trạng thái: ${t.status}`,
    `Dependencies: ${list(t.dependencies)}   Quyết định chặn: ${list(t.blockedByDecisions)}   Gap: ${list(t.gapRefs)}`, '',
    'AFFECTED FILES:', ...t.affectedFiles.map((f) => `  - ${f}`), '',
    'IMPLEMENTATION STEPS:', ...t.implementationSteps.map((s, i) => `  ${t.id}.${i + 1}  ${s}`), '',
    'ACCEPTANCE CRITERIA:', ...t.acceptanceCriteria.map((a) => `  [ ] ${a}`), '',
    'DEFINITION OF DONE (riêng task):', ...t.definitionOfDone.map((a) => `  [ ] ${a}`), '',
    'DEFINITION OF DONE (chung):', ...d.meta.definitionOfDoneBase.map((a) => `  [ ] ${a}`), '',
    'VERIFICATION COMMANDS:', ...t.verificationCommands.map((c) => `  $ ${c}`)];
  if (t.risks.length) out.push('', 'RỦI RO:', ...t.risks.map((r) => `  - ${r}`));
  console.log(out.join('\n'));
}

function cmdSet(d, id, status) {
  const t = indexTasks(d).get(id);
  if (!t) { console.error(`Không có task ${id}`); process.exit(1); }
  if (!d.meta.statusValues.includes(status)) { console.error(`status phải thuộc: ${d.meta.statusValues.join(', ')}`); process.exit(1); }
  const byId = indexTasks(d);
  const depsDone = t.dependencies.every((x) => byId.get(x)?.status === 'done');
  const decOk = t.blockedByDecisions.every((x) => d.decisions.find((y) => y.id === x).status === 'decided');
  const evidence = arg('--evidence');
  if (['in_progress', 'needs_review', 'done'].includes(status)) {
    if (!depsDone) { console.error(`Từ chối: dependency chưa done (${t.dependencies.filter((x) => byId.get(x)?.status !== 'done').join(', ')})`); process.exit(1); }
    if (!decOk) { console.error(`Từ chối: quyết định chặn còn mở (${t.blockedByDecisions.filter((x) => d.decisions.find((y) => y.id === x).status !== 'decided').join(', ')})`); process.exit(1); }
  }
  if (status === 'done' && !evidence) { console.error('Từ chối: `done` bắt buộc --evidence "<lệnh + kết quả>" (và nên --commit <sha>).'); process.exit(1); }
  if (NEEDS_REASON.includes(status) && !evidence) { console.error(`Từ chối: \`${status}\` bắt buộc --evidence "<lý do cụ thể: chờ gì / câu hỏi nào / lệnh nào thất bại>".`); process.exit(1); }
  t.status = status;
  if (evidence) t.evidence.push({ date: today(), text: evidence, ...(arg('--commit') ? { commit: arg('--commit') } : {}) });
  t.completedAt = status === 'done' ? today() : null;
  save(d);
  renderAll(d);
  console.log(`${id} → ${status}`);
}

function cmdDecide(d, id, option) {
  const x = d.decisions.find((y) => y.id === id);
  if (!x) { console.error(`Không có quyết định ${id}`); process.exit(1); }
  if (!x.options.some((o) => o.key === option)) { console.error(`option phải thuộc: ${x.options.map((o) => o.key).join(', ')}`); process.exit(1); }
  x.status = 'decided'; x.decidedOption = option; x.decidedAt = today(); x.note = arg('--note') || '';
  save(d);
  renderAll(d);
  console.log(`${id} = ${option}. Lưu ý: nếu khác khuyến nghị (${x.recommendation}) hãy rà lại kế hoạch (xem SPRINT_PLAN.md).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, a1, a2] = process.argv.slice(2);
  const d = load();
  if (cmd === 'validate') {
    const { errors, warnings } = validate(d);
    for (const w of warnings) console.log(`CẢNH BÁO: ${w}`);
    for (const e of errors) console.log(`LỖI: ${e}`);
    const sp = d.tasks.filter((t) => t.sprint !== null).reduce((n, t) => n + t.storyPoints, 0);
    console.log(`\n${d.tasks.length} task, ${d.epics.length} epic, ${d.features.length} feature, ${d.stories.length} story, ${d.decisions.length} quyết định, ${d.sprints.length} sprint (${sp} SP đã xếp) — ${errors.length} lỗi, ${warnings.length} cảnh báo.`);
    process.exit(errors.length ? 1 : 0);
  } else if (cmd === 'render') { renderAll(d); console.log('Đã sinh BACKLOG.md, SPRINT_PLAN.md, PROGRESS.md.'); }
  else if (cmd === 'next') cmdNext(d);
  else if (cmd === 'show') cmdShow(d, a1);
  else if (cmd === 'set') cmdSet(d, a1, a2);
  else if (cmd === 'decide') cmdDecide(d, a1, a2);
  else { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); process.exit(cmd ? 1 : 0); }
}
