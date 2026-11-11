#!/usr/bin/env node
/**
 * Tái hiện lỗi GAP-312: vòng lặp game dừng vĩnh viễn khi một khung ném ngoại lệ.
 *
 *   GAP-312  Game.loop() không có try/catch; requestAnimationFrame chỉ được đặt lại ở cuối hàm   → sửa bởi ARC-06
 *
 * Cách dùng:   node docs/ai-planning/evidence/repro-game-loop.mjs
 * Exit code:   0 = vòng lặp chịu được ngoại lệ (đã sửa); 1 = còn lỗi (ở baseline in ra 2 dòng FAIL).
 *
 * An toàn: chỉ import `src/core/Game.js` rồi gọi `Game.prototype.loop.call(fake, ts)` trên một đối tượng dựng tay —
 * cùng kỹ thuật mà `scripts/test-boss-*.js` đã dùng. Không DOM thật, không ghi file, không mạng.
 *
 * `fake` là Proxy: mọi phương thức phụ trợ dạng `_xyz` mà bản sửa có thể thêm (ví dụ `_onFrameError`) đều là no-op,
 * nên script vẫn đúng sau khi ARC-06 hoàn tất. Điều duy nhất được kiểm tra là: sau một khung ném lỗi,
 * requestAnimationFrame có được đặt lại không.
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, resolve, dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const { Game } = await import(pathToFileURL(join(ROOT, 'src/core/Game.js')).href);

function runFrame({ updateThrows = false, renderThrows = false } = {}) {
  let rafCalls = 0;
  globalThis.requestAnimationFrame = () => ++rafCalls;
  const target = {
    isRunning: true, lastTime: 1000, quality: null, _rafId: null, _boundLoop: () => {},
    update() { if (updateThrows) throw new Error('boom in update'); },
    render() { if (renderThrows) throw new Error('boom in render'); },
  };
  const fake = new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : (typeof k === 'string' && k.startsWith('_') ? () => {} : undefined)),
  });
  const originalError = console.error;
  console.error = () => {}; // bản sửa có thể ghi log lỗi; không in nhiễu
  let escaped = null;
  try { Game.prototype.loop.call(fake, 1016); } catch (e) { escaped = e.message; }
  finally { console.error = originalError; }
  return { escaped, rearmed: rafCalls > 0 };
}

let failures = 0;
const report = (id, ok, text) => { if (!ok) failures++; console.log(`${id} [${ok ? 'PASS' : 'FAIL'}] ${text}`); };

const healthy = runFrame();
report('LOOP1', healthy.rearmed && healthy.escaped === null, `khung khỏe: rAF được đặt lại (đặt lại: ${healthy.rearmed})`);

const u = runFrame({ updateThrows: true });
report('LOOP2', u.rearmed, `update() ném lỗi: rAF phải vẫn được đặt lại (ngoại lệ thoát khỏi loop: ${u.escaped}; đặt lại: ${u.rearmed})`);

const r = runFrame({ renderThrows: true });
report('LOOP3', r.rearmed, `render() ném lỗi: rAF phải vẫn được đặt lại (ngoại lệ thoát khỏi loop: ${r.escaped}; đặt lại: ${r.rearmed})`);

console.log(failures
  ? `\n${failures} kiểm tra FAIL — một ngoại lệ ở một khung làm dừng game vĩnh viễn (không có thông báo, không đường quay lại).`
  : '\nTất cả kiểm tra PASS — vòng lặp chịu được ngoại lệ ở một khung.');
process.exit(failures ? 1 : 0);
