/**
 * @file tests/load-performance.test.js
 * @description Guards the first-load fixes that are plain file layout and markup (so they cannot quietly regress):
 *  - no third-party stylesheet blocks the first paint (a plain <link rel="stylesheet" href="https://..."> does),
 *  - public/ holds every file once (the deploy folder carried 1.6 MB of byte-identical copies),
 *  - the FIRST path the loaders try for each music file and sprite sheet exists (two sprite sheets used to cost two
 *    404 round trips each before the third try found them).
 * The standalone contract (DEC-09) is deliberately NOT touched here.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  ✅ PASS: ${name}`);
}

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name === '.DS_Store') continue;
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

await check('index.html has no render-blocking third-party stylesheet', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const withoutNoscript = html.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
  // `\srel=` so the `this.rel='stylesheet'` inside a preload tag's onload handler is not mistaken for the attribute
  const blocking = (withoutNoscript.match(/<link\b[^>]*>/gi) || []).filter((tag) => /\srel=["']stylesheet["']/i.test(tag) && /\shref=["']https?:\/\//i.test(tag));
  assert.deepEqual(blocking, [], 'a web font stylesheet must be preloaded and applied on load, not linked as a plain stylesheet');
});

await check('the web font stylesheet is still requested (preload) and has a no-JS fallback', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<link rel="preload" as="style" href="https:\/\/fonts\.googleapis\.com\/[^"]+display=swap" onload="this\.onload=null;this\.rel='stylesheet'">/);
  assert.match(html, /<noscript><link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\//);
});

await check('public/ contains no two files with identical content', () => {
  const seen = new Map();
  const duplicates = [];
  for (const file of walk(PUBLIC)) {
    const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
    const rel = path.relative(ROOT, file);
    if (seen.has(hash)) duplicates.push(`${rel} == ${seen.get(hash)}`);
    else seen.set(hash, rel);
  }
  assert.deepEqual(duplicates, []);
});

await check('every music file the loader asks for first exists where it asks (/audio/<name>.mp3)', () => {
  for (const name of ['main', 'initial', 'victory', 'end']) {
    assert.ok(fs.existsSync(path.join(PUBLIC, 'audio', `${name}.mp3`)), `public/audio/${name}.mp3`);
  }
});

await check('every sprite sheet exists at the first path Player tries (assets/<sheet>)', () => {
  const player = fs.readFileSync(path.join(ROOT, 'src/entities/Player.js'), 'utf8');
  const sheets = [...player.matchAll(/'([\w-]+-png1?-sprite\.png)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(sheets)].sort(), ['level1-png-sprite.png', 'level1-png1-sprite.png', 'main-png-sprite.png']);
  assert.match(player, /`assets\/\$\{sheetName\}`,/, 'assets/<sheet> is the first candidate');
  for (const sheet of new Set(sheets)) assert.ok(fs.existsSync(path.join(PUBLIC, 'assets', sheet)), `public/assets/${sheet}`);
});

console.log(`\nLoad Performance Tests: ${checks} Passed, 0 Failed`);
