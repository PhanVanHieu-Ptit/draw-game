/**
 * @file tests/audio-loading.test.js
 * @description How the SoundSystem fetches its music files and what it does when the page is hidden.
 *
 * Measured before these rules existed (headless Chrome, a host without the mp3 files, 15 s of play): every sound effect
 * that maps to a missing track re-ran the whole list of candidate folders, i.e. up to seven failing requests per sound.
 *  - a track that failed everywhere is left alone for a minute (negative cache),
 *  - the folder that served one track is tried first for the next,
 *  - a file:// page uses its procedural soundtrack without requesting local tracks,
 *  - the preload fetches ONE file at a time, the one the first fight needs before the end-of-run fanfares,
 *  - a hidden page stops the audio thread and a late timer cannot restart it.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { SoundSystem } = await import(pathToFileURL(path.join(ROOT, 'src/systems/SoundSystem.js')).href);

let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  ✅ PASS: ${name}`);
}

/** Run `fn` with a fake fetch / Date.now / location / window, restoring the real ones afterwards */
async function withEnvironment({ fetch, now, location, window: win } = {}, fn) {
  const saved = { fetch: globalThis.fetch, now: Date.now, location: globalThis.location, window: globalThis.window };
  if (fetch) globalThis.fetch = fetch;
  if (now) Date.now = now;
  if (location) globalThis.location = location;
  if (win) globalThis.window = win;
  try {
    return await fn();
  } finally {
    globalThis.fetch = saved.fetch;
    Date.now = saved.now;
    if (saved.location === undefined) delete globalThis.location; else globalThis.location = saved.location;
    if (saved.window === undefined) delete globalThis.window; else globalThis.window = saved.window;
  }
}

function makeSound(ctxState = 'running') {
  const sound = new SoundSystem({ autoUnlock: false });
  const calls = { suspend: 0, resume: 0 };
  sound.ctx = {
    state: ctxState,
    decodeAudioData: async (buffer) => ({ duration: 1, length: 8, numberOfChannels: 2, source: buffer }),
    suspend() { calls.suspend++; this.state = 'suspended'; return Promise.resolve(); },
    resume() { calls.resume++; this.state = 'running'; return Promise.resolve(); }
  };
  sound.__calls = calls;
  return sound;
}

const okResponse = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) });
const notFound = () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });

// ---- 1. Negative cache -------------------------------------------------------------------------------------
await check('a track that failed everywhere is not requested again for a minute', async () => {
  const requested = [];
  let clock = 1_000_000;
  await withEnvironment({ fetch: async (url) => { requested.push(String(url)); throw new Error('offline'); }, now: () => clock }, async () => {
    const sound = makeSound();
    assert.equal(await sound._loadAudioTrack('main'), null);
    const firstRound = requested.length;
    assert.ok(firstRound >= 2, 'every candidate folder is tried once');

    // ten more sound effects that want the same file: no new requests
    for (let i = 0; i < 10; i++) assert.equal(await sound._loadAudioTrack('main'), null);
    assert.equal(requested.length, firstRound, 'no request while the failure is fresh');

    // a different track is a different question
    await sound._loadAudioTrack('end');
    assert.equal(requested.length, firstRound * 2, 'another track is still tried');

    // after the retry window the host gets another chance
    clock += 61_000;
    await sound._loadAudioTrack('main');
    assert.equal(requested.length, firstRound * 3, 'retried after the window');
  });
});

await check('a host that answers 404 is cached the same way (resp.ok === false)', async () => {
  const requested = [];
  await withEnvironment({ fetch: async (url) => { requested.push(String(url)); return notFound(); } }, async () => {
    const sound = makeSound();
    await sound._loadAudioTrack('victory');
    const n = requested.length;
    await sound._loadAudioTrack('victory');
    await sound._loadAudioTrack('victory');
    assert.equal(requested.length, n);
  });
});

await check('a failed attempt can still succeed later and then stays loaded', async () => {
  let online = false;
  let clock = 5_000;
  await withEnvironment({ fetch: async () => (online ? okResponse() : notFound()), now: () => clock }, async () => {
    const sound = makeSound();
    assert.equal(await sound._loadAudioTrack('initial'), null);
    online = true;
    clock += 61_000;
    const buf = await sound._loadAudioTrack('initial');
    assert.ok(buf, 'loaded on the retry');
    assert.equal(sound._trackFailedAt.initial, undefined, 'the failure mark is cleared');
    assert.equal(await sound._loadAudioTrack('initial'), buf, 'then served from memory');
  });
});

// ---- 2. Folder hint ----------------------------------------------------------------------------------------
await check('the folder that served one track is tried first for the next', async () => {
  const requested = [];
  await withEnvironment({ fetch: async (url) => { requested.push(String(url)); return String(url).startsWith('./audio/') ? okResponse() : notFound(); } }, async () => {
    const sound = makeSound();
    assert.ok(await sound._loadAudioTrack('initial'));
    assert.deepEqual(requested, ['/audio/initial.mp3', './audio/initial.mp3'], 'the first track walks the list');
    requested.length = 0;
    assert.ok(await sound._loadAudioTrack('main'));
    assert.deepEqual(requested, ['./audio/main.mp3'], 'the next one goes straight to the folder that worked');
  });
});

await check('only own-origin relative paths are ever requested', async () => {
  const requested = [];
  await withEnvironment({ fetch: async (url) => { requested.push(String(url)); throw new Error('offline'); } }, async () => {
    const sound = makeSound();
    for (const name of ['main', 'initial', 'victory', 'end']) await sound._loadAudioTrack(name);
    assert.ok(requested.length > 0);
    assert.deepEqual(requested.filter((url) => /^(https?:)?\/\//i.test(url)), []);
  });
});

// ---- 3. file:// --------------------------------------------------------------------------------------------
await check('a file:// page makes no local-track requests, including repeated effects', async () => {
  const requested = [];
  await withEnvironment({
    location: { protocol: 'file:' },
    fetch: async (url) => { requested.push(String(url)); throw new TypeError('Failed to fetch'); }
  }, async () => {
    const sound = makeSound();
    assert.equal(await sound._loadAudioTrack('main'), null);
    assert.equal(await sound._loadAudioTrack('main'), null);
    assert.equal(await sound._loadAudioTrack('end'), null);
    assert.equal(requested.length, 0, 'standalone immediately uses the procedural audio');
  });
});

await check('on http a TypeError (network blip) still tries the other folders', async () => {
  const requested = [];
  await withEnvironment({
    location: { protocol: 'https:' },
    fetch: async (url) => { requested.push(String(url)); throw new TypeError('Failed to fetch'); }
  }, async () => {
    const sound = makeSound();
    await sound._loadAudioTrack('main');
    assert.ok(requested.length > 1);
  });
});

// ---- 4. Preload order --------------------------------------------------------------------------------------
await check('the preload fetches one track at a time: intro, fight music, then the fanfares', async () => {
  const requested = [];
  let inFlight = 0;
  let maxInFlight = 0;
  await withEnvironment({
    window: {},
    fetch: async (url) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      requested.push(String(url));
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return okResponse();
    }
  }, async () => {
    const sound = makeSound();
    sound.preloadAudio();
    sound.preloadAudio(); // init() and each unlock gesture call it again: must not start a second chain
    sound.preloadAudio();
    await sound._preloadChain;
    assert.equal(maxInFlight, 1, 'never two downloads at once');
    assert.deepEqual(requested.map((u) => u.replace(/^.*\//, '')), ['initial.mp3', 'main.mp3', 'victory.mp3', 'end.mp3']);
    assert.equal(sound._preloadChain, null, 'the chain is released when it ends');
    for (const name of ['initial', 'main', 'victory', 'end']) assert.ok(sound._audioBuffers[name], `${name} decoded`);
  });
});

// ---- 5. Hidden page ----------------------------------------------------------------------------------------
await check('a hidden page suspends the audio context and a late timer cannot restart it', () => {
  const sound = makeSound('running');
  sound.suspendForHidden();
  assert.equal(sound.ctx.state, 'suspended');
  assert.equal(sound.__calls.suspend, 1);
  assert.equal(sound._ensureReady(), false, 'no sound while hidden');
  assert.equal(sound.__calls.resume, 0, 'and the context is NOT resumed by the attempt');
  assert.equal(sound.init(), sound.ctx);
  assert.equal(sound.__calls.resume, 0, 'init() does not resume it either');
});

await check('coming back resumes exactly the context we suspended', () => {
  const sound = makeSound('running');
  sound.suspendForHidden();
  sound.resumeFromHidden();
  assert.equal(sound.ctx.state, 'running');
  assert.equal(sound.__calls.resume, 1);
  assert.equal(sound._ensureReady(), true);
  sound.resumeFromHidden();
  assert.equal(sound.__calls.resume, 1, 'a second call is a no-op');
});

await check('a context the browser had not unlocked yet is not touched on return', () => {
  const sound = makeSound('suspended'); // autoplay policy: never started
  sound.suspendForHidden();
  assert.equal(sound.__calls.suspend, 0, 'nothing to suspend');
  sound.resumeFromHidden();
  assert.equal(sound.__calls.resume, 0, 'and nothing of ours to resume: the unlock gesture still owns it');
});

await check('hiding the page before audio ever started is harmless', () => {
  const sound = new SoundSystem({ autoUnlock: false });
  sound.suspendForHidden();
  sound.resumeFromHidden();
  assert.equal(sound.ctx, null);
});

console.log(`\nAudio Loading Tests: ${checks} Passed, 0 Failed`);
