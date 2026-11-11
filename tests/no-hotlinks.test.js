/**
 * @file tests/no-hotlinks.test.js
 * @description The game must not load assets from other people's servers (IPA-02). Two layers:
 *  1. Static scan: no `http(s)://` string in src/, shared/ or main.js (everything that ends up in the game bundle)
 *     except the allowlist below. Fonts live in index.html, which is outside this scan (see IPA-07 / DEC-09).
 *  2. Behaviour: when every local copy of the audio tracks and sprite sheets fails to load, the game asks for
 *     nothing outside its own origin, does not throw, and falls back (no audio buffer, vector-drawn Momo).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_ROOTS = ['src', 'shared', 'main.js'];
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.css', '.html', '.json', '.svg']);

/** URLs the game may contain. Each needs a reason; matching is by exact prefix, so look-alike hosts do not pass. */
const ALLOWED = [
  { prefix: 'https://arcane-paws.game/', reason: 'placeholder base for share / challenge links when there is no window.location; never fetched' }
];

const URL_PATTERN = /https?:\/\/[^\s'"`)<>]+/g;

/** @returns {Array<{line: number, url: string}>} every absolute http(s) URL in `text` */
function findUrls(text) {
  const found = [];
  text.split('\n').forEach((lineText, index) => {
    for (const match of lineText.matchAll(URL_PATTERN)) found.push({ line: index + 1, url: match[0] });
  });
  return found;
}

/**
 * @param {Record<string, string>} files root-relative path -> contents
 * @returns {string[]} "path:line url" for every URL that is not allowlisted
 */
function findHotlinks(files, allowed = ALLOWED) {
  const bad = [];
  for (const [file, text] of Object.entries(files)) {
    for (const { line, url } of findUrls(text)) {
      if (!allowed.some((entry) => url.startsWith(entry.prefix))) bad.push(`${file}:${line} ${url}`);
    }
  }
  return bad;
}

function readScanRoots() {
  const files = {};
  const visit = (rel) => {
    const abs = path.join(ROOT, rel);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(abs)) visit(`${rel}/${name}`);
    } else if (TEXT_EXTENSIONS.has(path.extname(rel))) {
      files[rel] = fs.readFileSync(abs, 'utf8');
    }
  };
  for (const entry of SCAN_ROOTS) if (fs.existsSync(path.join(ROOT, entry))) visit(entry);
  return files;
}

let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  ✅ PASS: ${name}`);
}

// ---- 1. The scanner itself ---------------------------------------------------------------------------------
await check('the scanner flags a hotlink with its file and line', () => {
  const bad = findHotlinks({ 'src/x.js': "const a = 1;\nconst u = `https://www.google.com/logos/2016/halloween16/r4/${n}.mp3`;" });
  assert.deepEqual(bad, ['src/x.js:2 https://www.google.com/logos/2016/halloween16/r4/${n}.mp3']);
});
await check('the scanner flags plain http as well', () => {
  assert.equal(findHotlinks({ 'src/x.js': "fetch('http://cdn.example.test/a.png')" }).length, 1);
});
await check('an allowlisted URL passes, a look-alike host does not', () => {
  assert.deepEqual(findHotlinks({ 'src/x.js': "base = 'https://arcane-paws.game/';" }), []);
  assert.equal(findHotlinks({ 'src/x.js': "base = 'https://arcane-paws.game.evil.test/';" }).length, 1);
  assert.equal(findHotlinks({ 'src/x.js': "base = 'https://evil.test/https://arcane-paws.game/';" }).length, 1);
});
await check('relative asset paths are not URLs to flag', () => {
  assert.deepEqual(findHotlinks({ 'src/x.js': "const c = ['/audio/a.mp3', './audio/a.mp3', 'assets/a.png'];" }), []);
});

// ---- 2. The real source tree -------------------------------------------------------------------------------
await check('src/, shared/ and main.js contain no URL outside the allowlist', () => {
  const files = readScanRoots();
  assert.ok(Object.keys(files).length > 50, 'the scan must actually read the source tree');
  assert.ok('main.js' in files && 'src/systems/SoundSystem.js' in files && 'src/entities/Player.js' in files);
  assert.deepEqual(findHotlinks(files), []);
});

// ---- 3. Behaviour when every local copy fails --------------------------------------------------------------
await check('audio: with every fetch failing, only own-origin paths are tried and the loader returns null', async () => {
  const realFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => { requested.push(String(url)); throw new Error('offline'); };
  try {
    const { SoundSystem } = await import(pathToFileURL(path.join(ROOT, 'src/systems/SoundSystem.js')).href);
    const sound = new SoundSystem();
    sound.ctx = { decodeAudioData: async (buffer) => buffer };
    assert.equal(await sound._loadAudioTrack('main'), null);
    assert.ok(requested.length > 0, 'local candidates are still tried');
    assert.deepEqual(requested.filter((url) => /^(https?:)?\/\//i.test(url)), []);
  } finally {
    globalThis.fetch = realFetch;
  }
});

await check('sprites: with every image failing, only own-origin paths are tried and Momo stays vector-drawn', async () => {
  const RealImage = globalThis.Image;
  const sources = [];
  globalThis.Image = class { set src(value) { sources.push(String(value)); queueMicrotask(() => this.onerror && this.onerror()); } };
  try {
    const { Player } = await import(pathToFileURL(path.join(ROOT, 'src/entities/Player.js')).href);
    const player = new Player(800, 600);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(sources.length > 0, 'local candidates are still tried');
    assert.deepEqual(sources.filter((url) => /^(https?:)?\/\//i.test(url)), []);
    assert.equal(player.spriteLoaded, false, 'no sheet loaded, so the vector fallback is used');
  } finally {
    if (RealImage === undefined) delete globalThis.Image;
    else globalThis.Image = RealImage;
  }
});

console.log(`\nHotlink Tests: ${checks} Passed, 0 Failed`);
