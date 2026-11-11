#!/usr/bin/env node
/**
 * Tái hiện 3 lỗi của Admin API đã xác nhận trong giai đoạn phân tích (2026-11-10).
 *
 *   GAP-301  Lưu tài liệu Gameplay > 16 KiB bị từ chối 413          → sửa bởi ADM-02
 *   GAP-302  Giải mã UTF-8 theo từng chunk làm hỏng tiếng Việt      → sửa bởi ADM-01
 *   GAP-303  Analyst nhận 403 trên endpoint Gameplay dù có quyền đọc → sửa bởi ADM-03 (cần DEC-10)
 *
 * Cách dùng:   node docs/ai-planning/evidence/repro-admin-bugs.mjs
 * Exit code:   0 = cả ba lỗi đã được sửa; 1 = còn ít nhất một lỗi (ở baseline in ra 3 dòng FAIL).
 *
 * An toàn: chạy server THẬT (`admin/server/app.mjs`) với thư mục dữ liệu tạm trong os.tmpdir() và cổng ngẫu nhiên;
 * không ghi vào repository, không đọc `.env`, tự dọn dẹp.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import http from 'node:http';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const { createAdminServer } = await import(pathToFileURL(join(ROOT, 'admin/server/app.mjs')).href);
const content = await import(pathToFileURL(join(ROOT, 'shared/gameplay-content.js')).href);

const credentials = { email: 'repro@example.com', password: 'repro-password-long-enough' };

async function boot(role = 'Super Admin') {
  const dataDir = await mkdtemp(join(tmpdir(), 'arcane-repro-'));
  const server = createAdminServer({ ...credentials, dataDir, role });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'x-admin-request': '1' }, body: JSON.stringify(credentials) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const headers = { cookie, 'x-admin-request': '1' };
  return {
    port, cookie,
    call: (path, init = {}) => fetch(base + path, { ...init, headers: { ...headers, ...(init.headers || {}) } }),
    close: async () => { await new Promise((r) => server.close(r)); await rm(dataDir, { recursive: true, force: true }); },
  };
}

// Gửi một POST, CẮT body tại chỉ số `splitAt` và chờ giữa hai nửa để server nhận hai chunk riêng biệt.
function postSplit({ port, cookie }, path, body, splitAt) {
  return new Promise((resolveReq, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'POST', headers: { cookie, 'x-admin-request': '1', 'content-type': 'application/json', 'content-length': body.length } }, (res) => {
      res.resume(); res.on('end', () => resolveReq(res.statusCode));
    });
    req.on('error', reject);
    req.write(body.subarray(0, splitAt));
    setTimeout(() => { req.end(body.subarray(splitAt)); }, 60);
  });
}

function buildContent(enemies, waves) {
  const v = structuredClone(content.contentDefaults);
  for (let i = 0; i < enemies; i++) {
    const e = content.createContentValue(content.contentSchema.fields.enemies.item);
    e.id = `enemy_${i}`; e.name = `Enemy number ${i}`; e.gestures = ['horizontal', 'vertical', 'caret'];
    v.enemies.push(e);
  }
  for (let w = 0; w < waves; w++) {
    const wave = content.createContentValue(content.contentSchema.fields.waves.item);
    wave.id = `wave_${w}`; wave.name = `Wave ${w}`; wave.start = w * 40; wave.duration = 30;
    for (let g = 0; g < 3; g++) {
      const group = content.createContentValue(content.contentSchema.fields.waves.item.fields.groups.item);
      group.enemyId = `enemy_${(w + g) % Math.max(1, enemies)}`; group.count = 3; group.offset = g * 5; group.interval = 1;
      wave.groups.push(group);
    }
    v.waves.push(wave);
  }
  return v;
}

let failures = 0;
const report = (id, ok, text) => { if (!ok) failures++; console.log(`${id} [${ok ? 'PASS' : 'FAIL'}] ${text}`); };

// ── EXP1 / GAP-301 ────────────────────────────────────────────────────────────
{
  const sizes = [];
  for (const [enemies, waves] of [[24, 25], [30, 25], [100, 230]]) {
    const { call, close } = await boot('Super Admin');
    const state = await (await call('/api/gameplay/environments/development')).json();
    const values = buildContent(enemies, waves);
    const schemaErrors = content.validateContent(values).length;
    const body = JSON.stringify({ revision: state.revision, values });
    const res = await call('/api/gameplay/environments/development/save', { method: 'POST', body });
    sizes.push({ bytes: Buffer.byteLength(body), status: res.status, schemaErrors });
    await close();
  }
  for (const s of sizes) console.log(`      tài liệu ${String(s.bytes).padStart(7)} B (schema hợp lệ: ${s.schemaErrors === 0}) → HTTP ${s.status}`);
  const big = sizes.at(-1);
  report('EXP1', big.status === 200, `tài liệu Gameplay hợp lệ ~${Math.round(big.bytes / 1024)} KB phải lưu được (nhận HTTP ${big.status})`);
}

// ── EXP2 / GAP-303 ────────────────────────────────────────────────────────────
{
  const { permits } = await import(pathToFileURL(join(ROOT, 'admin/server/policy.mjs')).href);
  const { call, close } = await boot('Analyst');
  const res = await call('/api/gameplay/environments/development');
  console.log(`      policy: Analyst gameplay:read = ${permits({ role: 'Analyst' }, 'gameplay:read')}; configuration:read = ${permits({ role: 'Analyst' }, 'configuration:read')}`);
  report('EXP2', res.status === 200, `Analyst đọc Gameplay (policy + README cho phép) phải nhận 200 (nhận HTTP ${res.status})`);
  const write = await call('/api/gameplay/environments/development/save', { method: 'POST', body: JSON.stringify({ revision: 0, values: buildContent(1, 1) }) });
  report('EXP2b', write.status === 403, `Analyst KHÔNG được ghi Gameplay: phải nhận 403 (nhận HTTP ${write.status})`);
  await close();
}

// ── EXP3 / GAP-302 ────────────────────────────────────────────────────────────
{
  const ctx = await boot('Super Admin');
  const current = await (await ctx.call('/api/content/story')).json();
  const story = structuredClone(current.draft);
  const sample = 'Ngước nhìn sao trời, ế ề ể ễ ệ ạ ả ấ ầ ẩ ẫ ậ ';
  story.locales.vi['experiment.multibyte'] = sample.repeat(2000);
  const body = Buffer.from(JSON.stringify({ revision: current.revision, story }), 'utf8');
  // Chỉ số cắt nằm GIỮA một ký tự đa byte (byte tiếp nối 10xxxxxx) gần giữa body.
  let splitAt = Math.floor(body.length / 2);
  while ((body[splitAt] & 0xc0) !== 0x80) splitAt++;
  const status = await postSplit(ctx, '/api/content/story/draft', body, splitAt);
  const back = await (await ctx.call('/api/content/story')).json();
  const stored = back.draft?.locales?.vi?.['experiment.multibyte'] ?? '';
  const bad = (stored.match(/�/g) || []).length;
  console.log(`      body ${body.length} B, cắt tại byte ${splitAt}; POST → HTTP ${status}; ký tự U+FFFD trong dữ liệu lưu: ${bad}`);
  report('EXP3', status === 200 && stored === sample.repeat(2000), `chuỗi tiếng Việt phải round-trip nguyên vẹn qua body bị chia chunk (U+FFFD = ${bad})`);
  await ctx.close();
}

console.log(failures ? `\n${failures} kiểm tra FAIL — lỗi còn tồn tại.` : '\nTất cả kiểm tra PASS — các lỗi đã được sửa.');
process.exit(failures ? 1 : 0);
