/**
 * @file test-story-lore.js
 * @description Covers the story upgrade "Cái Tên Bị Lãng Quên":
 *  1. Lore data and pledge rules (core/Lore.js)
 *  2. Persistence, achievements and cosmetic rewards (ProgressStore, Achievements, Cosmetics)
 *  3. Story scenes and companion barks (core/StoryScenes.js)
 *  4. The dialogue clock (core/StoryDirector.js)
 *  5. Slides and the story setting
 *  6. Game integration: scenes in a run, memory shards, pledges, endings
 *  7. Ending overlay (UIManager) and the true-ending illustrations
 */

import { MEMORY_SHARDS, FORGOTTEN_NAME, evaluatePledge, loreLetters, loreSummary, mysteryHint, shardForLevel } from './src/core/Lore.js';
import { STORY_SCENES, BEATS, SPEAKERS, BARKS, buildScene, buildBark, lineDuration, resolveSpeaker } from './src/core/StoryScenes.js';
import { StoryDirector } from './src/core/StoryDirector.js';
import { ProgressStore } from './src/core/ProgressStore.js';
import { ACHIEVEMENTS, evaluateAchievements } from './src/core/Achievements.js';
import { HATS, TRAILS, isCosmeticUnlocked } from './src/core/Cosmetics.js';
import { SettingsStore, DEFAULT_SETTINGS, sanitizeSetting } from './src/core/Settings.js';
import { LEVEL_CONFIGS, STORY_SLIDES, STORY_CHAPTERS, GAME_STATES } from './src/core/Constants.js';
import { StoryCanvasRenderer } from './src/ui/StoryCanvasRenderer.js';
import { drawHat } from './src/entities/Hats.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

// A canvas context that accepts any drawing call
function proxyCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
const proxyCanvas = () => { const ctx = proxyCtx(); return { width: 480, height: 240, getContext: () => ctx }; };

console.log('🧪 Story upgrade verification (the forgotten name)\n');

// ===== 1. Lore data and pledge rules ===========================================================
console.log('--- 1. Lore data and pledges ---');
{
  assert(MEMORY_SHARDS.length === 5, 'one memory shard per Story level');
  assert(MEMORY_SHARDS.map(s => s.level).join() === '1,2,3,4,5', 'shards are ordered by level');
  assert(MEMORY_SHARDS.map(s => s.letter).join('') === FORGOTTEN_NAME && FORGOTTEN_NAME === 'LUMEN', 'the five letters spell LUMEN');
  assert(MEMORY_SHARDS.every(s => s.pledge.enVirtue.toUpperCase().startsWith(s.letter)), "each pledge's English virtue starts with its level's letter");
  assert(MEMORY_SHARDS.every(s => s.shard.length > 80 && s.pledge.riddle && s.pledge.objective && s.pledge.reveal && s.title && s.icon),
    'every shard has its story text, a riddle, a plain objective and a reveal');
  assert(shardForLevel(3).letter === 'M' && shardForLevel(9) === null, 'shardForLevel finds a level (null outside 1..5)');
  assert(MEMORY_SHARDS.every(s => LEVEL_CONFIGS[s.level - 1].bossName.includes(s.keeper)), "each shard's keeper is that level's boss");

  // Pledge rules, at and just past the boundary
  const base = { damage: 5, maxCombo: 0, phrases: 0, casts: 20, hits: 10, hearts: 1 };
  assert(evaluatePledge(1, { ...base, damage: 0 }) && !evaluatePledge(1, { ...base, damage: 1 }), 'L: no damage taken in the level');
  assert(evaluatePledge(2, { ...base, maxCombo: 12 }) && !evaluatePledge(2, { ...base, maxCombo: 11 }), 'U: combo 12 inside the level');
  assert(evaluatePledge(3, { ...base, phrases: 1 }) && !evaluatePledge(3, base), 'M: a Spell Phrase cast inside the level');
  assert(evaluatePledge(4, { ...base, casts: 20, hits: 16 }) && !evaluatePledge(4, { ...base, casts: 20, hits: 15 }), 'E: 80% of strokes landed');
  assert(!evaluatePledge(4, { ...base, casts: 4, hits: 4 }), 'E: a handful of lucky strokes is not accuracy (needs a minimum of strokes)');
  assert(evaluatePledge(5, { ...base, hearts: 3 }) && !evaluatePledge(5, { ...base, hearts: 2 }), 'N: Lord Umbra falls with 3 hearts left');
  assert(!evaluatePledge(1, {}) && !evaluatePledge(1, null) && !evaluatePledge(7, base), 'missing facts or an unknown level never keep a pledge');
}

// ===== 2. Persistence, achievements, rewards ==================================================
console.log('\n--- 2. Progress, achievements, cosmetics ---');
{
  const storage = new MemoryStorage();
  const p = new ProgressStore(storage);
  assert(p.shardCount() === 0 && p.pledgeCount() === 0 && !p.isEndingSeen('normal'), 'a new player has an empty journal');
  assert(p.unlockShard(2) === true && p.unlockShard(2) === false, 'a shard is new only the first time');
  assert(p.keepPledge(2) === true && p.keepPledge(2) === false, 'a pledge is new only the first time');
  assert(p.unlockShard(0) === false && p.unlockShard(6) === false && p.keepPledge('x') === false, 'levels outside 1..5 are refused');
  assert(p.markEndingSeen('normal') === true && p.markEndingSeen('normal') === false && p.markEndingSeen('bogus') === false, 'an ending is counted once; unknown kinds are refused');
  p.save();

  const q = new ProgressStore(storage);
  assert(q.hasShard(2) && q.hasPledge(2) && q.isEndingSeen('normal') && !q.hasShard(1), 'the journal survives a reload');

  // Corrupt saved data must not crash or invent progress
  const bad = new MemoryStorage();
  bad.setItem('arcane_paws_progress_v1', JSON.stringify({ lore: { shards: { 1: true, 99: true, x: true }, pledges: 'nope', endings: { true: 1, hacked: 1 } } }));
  const b = new ProgressStore(bad);
  assert(b.shardCount() === 1 && b.hasShard(1) && b.pledgeCount() === 0, 'only valid levels are kept from a damaged save');
  assert(b.isEndingSeen('true') && !b.isEndingSeen('hacked'), 'only known ending kinds are kept');
  const old = new MemoryStorage();
  old.setItem('arcane_paws_progress_v1', JSON.stringify({ stats: { runs: 3 } }));
  assert(new ProgressStore(old).shardCount() === 0, 'a save from before this update loads with an empty journal');

  // Summary, letters and the menu hint
  const s = new ProgressStore(new MemoryStorage());
  assert(loreSummary(s).name === '_ _ _ _ _' && !loreSummary(s).ready, 'nothing found yet: five blanks');
  assert(mysteryHint(s).includes('Hạ các trùm'), 'a new player is told to defeat the bosses');
  s.unlockShard(1); s.keepPledge(1);
  assert(loreSummary(s).name === 'L _ _ _ _' && loreLetters(s)[0].known && !loreLetters(s)[1].known, 'a kept pledge lights its letter');
  assert(mysteryHint(s).includes('Màn 2') && mysteryHint(s).includes('Chef Bouillon'), 'the hint points at the next shard when no riddle is open');
  s.unlockShard(2);
  assert(mysteryHint(s) === MEMORY_SHARDS[1].pledge.riddle, 'with a shard but no pledge, the hint is that level\'s riddle');
  for (let l = 1; l <= 5; l++) { s.unlockShard(l); s.keepPledge(l); }
  assert(loreSummary(s).name === 'L U M E N' && loreSummary(s).ready, 'five pledges spell LUMEN and open the true ending');

  // Achievements and rewards
  const a = new ProgressStore(new MemoryStorage());
  assert(new Set(ACHIEVEMENTS.map(x => x.id)).size === ACHIEVEMENTS.length, 'achievement ids stay unique');
  a.unlockShard(1);
  assert(!evaluateAchievements(a).some(x => x.id === 'lore_shards'), 'one shard is not the collection');
  for (let l = 1; l <= 5; l++) a.unlockShard(l);
  assert(evaluateAchievements(a).some(x => x.id === 'lore_shards'), 'five shards earn "Người Giữ Ký Ức"');
  a.keepPledge(3);
  assert(evaluateAchievements(a).some(x => x.id === 'pledge_first'), 'the first pledge earns "Lời Hứa Đầu Tiên"');
  for (let l = 1; l <= 5; l++) a.keepPledge(l);
  const earned = evaluateAchievements(a).map(x => x.id);
  assert(earned.includes('pledge_all') && !earned.includes('true_ending'), 'five pledges earn "Năm Chữ Cái" but not the ending itself');

  const knight = HATS.find(h => h.id === 'knight');
  const lumen = TRAILS.find(t => t.id === 'lumen');
  assert(!isCosmeticUnlocked(knight, a) && !isCosmeticUnlocked(lumen, a), 'the reward hat and trail stay locked until the true ending is seen');
  a.markEndingSeen('true');
  assert(a.data.stats.trueEndings === 1, 'seeing the true ending is counted');
  assert(evaluateAchievements(a).some(x => x.id === 'true_ending'), 'the true ending earns "Cái Tên Được Nhớ"');
  assert(isCosmeticUnlocked(knight, a) && isCosmeticUnlocked(lumen, a), 'and unlocks the Lumen hat and trail');

  const ctx = proxyCtx();
  let ok = true;
  try { for (const t of [0, 0.7, 3.1]) drawHat(ctx, 'knight', { x: 10, y: 10, w: 50 }, t); } catch (e) { ok = false; }
  assert(ok, 'the knight hat draws without errors');
}

// ===== 3. Scenes and barks =====================================================================
console.log('\n--- 3. Scenes and barks ---');
{
  assert(Object.keys(STORY_SCENES).join() === '1,2,3,4,5', 'every Story level has scenes');
  assert([1, 2, 3, 4, 5].every(l => BEATS.every(b => Array.isArray(STORY_SCENES[l][b]))), 'every level defines every beat (possibly empty)');
  for (const level of [1, 2, 3, 4, 5]) {
    for (const beat of ['intro', 'bossSpawn', 'bossDefeat']) {
      assert(buildScene(level, beat).length > 0, `level ${level} has a ${beat} scene`);
    }
  }
  assert([1, 2, 3, 4, 5].every(l => buildScene(l, 'bossSpawn')[0].text === LEVEL_CONFIGS[l - 1].bossSpawnQuote),
    'the boss battle cry is the level\'s own quote (written once)');
  assert([1, 2, 3, 4, 5].every(l => buildScene(l, 'bossDefeat')[0].text === LEVEL_CONFIGS[l - 1].bossDefeatQuote && buildScene(l, 'bossDefeat')[0].role.includes('Thanh Tẩy')),
    "the parting words are the level's defeat quote, from a purified boss");
  assert(STORY_CHAPTERS.every((c, i) => c.quotes.intro === LEVEL_CONFIGS[i].storyIntroQuote && c.quotes.defeat === LEVEL_CONFIGS[i].bossDefeatQuote),
    'the story review screen shows the same quotes as the run');

  // First time vs replay
  const first = buildScene(1, 'intro');
  const again = buildScene(1, 'intro', { replay: true });
  assert(first.length === 3 && again.length === 1, 'level 1 intro: three lines the first time, one on a replay');
  assert(first.some(l => l.who === 'grimoire') && !again.some(l => l.who === 'grimoire'), 'the Grimoire\'s whisper is for the first visit only');
  assert(buildScene(1, 'mid').length === 1 && buildScene(1, 'mid', { replay: true }).length === 0, 'the mid-level remark is skipped on a replay');
  assert(buildScene(5, 'bossHurtLast').length === 2 && buildScene(2, 'bossHurtLast').length === 0, 'only the finale has a last-life exchange');
  assert(buildScene(9, 'intro').length === 0 && buildScene(1, 'nope').length === 0, 'unknown level or beat gives no lines');

  // Speakers
  const momo = resolveSpeaker('momo', 1);
  assert(momo.name === 'Momo' && momo.characterId === 'momo', 'Momo speaks (she was silent before)');
  assert(first[0].characterId === 'barnaby' && first[0].name.includes('Barnaby'), 'level 1 opens with Barnaby');
  assert(buildScene(2, 'intro')[0].characterId === 'oliver' && buildScene(3, 'intro')[0].characterId === 'luna' && buildScene(4, 'intro')[0].characterId === 'nyx',
    'levels 2-4 open with their companions');
  assert(buildScene(5, 'intro')[0].who === 'allies' && buildScene(5, 'intro')[0].name.includes('Liên Minh'), 'the finale opens with the whole alliance');
  const boss = resolveSpeaker('boss', 3);
  assert(boss.name === 'Professor Stella' && boss.characterId === 'boss_planetarium' && boss.color !== resolveSpeaker('freed', 3).color,
    'a boss keeps her name and portrait; a purified boss gets a different colour');
  assert(buildScene(1, 'intro').every(l => l.ms >= 2800 && l.ms <= 6000), 'every line stays on screen between 2.8 s and 6 s');
  assert(lineDuration('x') === 2800 && lineDuration('x'.repeat(400)) === 6000 && lineDuration('x'.repeat(60)) > 2800, 'duration grows with length, within bounds');
  assert(Object.values(STORY_SCENES).every(sc => Object.values(sc).every(lines => lines.every(l => (l.text || '').length <= 130))), 'no hand-written line is a wall of text (<= 130 characters)');

  // Barks
  assert(['momo', 'oliver', 'luna', 'nyx', 'barnaby'].every(id => BARKS[id].combo.length >= 2 && BARKS[id].lowHp.length >= 2), 'every companion has two lines per reaction');
  assert(buildBark('oliver', 'combo', 0).text !== buildBark('oliver', 'combo', 1).text, 'the wording rotates between uses');
  assert(buildBark('oliver', 'combo', 2).text === buildBark('oliver', 'combo', 0).text, 'and wraps around');
  assert(buildBark('nobody', 'lowHp', 0).name === 'Momo', 'an unknown companion falls back to Momo');
  assert(buildBark('luna', 'bogus', 0) === null, 'an unknown reaction gives nothing');
  assert(buildBark('nyx', 'combo', 0).ms >= 2600, 'a reaction stays long enough to read');
  assert(Object.keys(SPEAKERS).includes('allies') && Object.keys(SPEAKERS).includes('grimoire'), 'the alliance and the Grimoire can speak');
}

// ===== 4. Dialogue clock =======================================================================
console.log('\n--- 4. StoryDirector ---');
{
  const shown = [];
  const d = new StoryDirector((l) => shown.push(l.text));
  const lines = (...texts) => texts.map(t => ({ text: t, ms: 3000 }));

  assert(d.play(lines('a', 'b', 'c')) === true && shown.join() === 'a', 'a scene starts with its first line at once');
  d.update(3.0);
  assert(shown.join() === 'a', 'the next line waits for the gap after the first');
  d.update(0.4);
  assert(shown.join() === 'a,b', 'then the second line follows');
  d.update(3.4); d.update(3.4);
  assert(shown.join() === 'a,b,c' && !d.busy, 'the scene plays out and the director goes quiet');
  assert(d.update(0) === undefined && d.update(-1) === undefined, 'a zero or negative step is ignored');

  // Scheduling
  const s2 = [];
  const d2 = new StoryDirector((l) => s2.push(l.text));
  d2.schedule(2.2, lines('later'));
  d2.update(2.0);
  assert(s2.length === 0, 'a scheduled scene waits');
  d2.update(0.3);
  assert(s2.join() === 'later', 'and starts when its time comes');
  d2.schedule(1, lines('never'));
  d2.cancel();
  d2.update(5);
  assert(s2.join() === 'later' && !d2.busy, 'cancel() drops scheduled and queued lines');

  // A second scene queues behind the first
  const s3 = [];
  const d3 = new StoryDirector((l) => s3.push(l.text));
  d3.play(lines('one'));
  d3.play(lines('two'));
  assert(s3.join() === 'one' && d3.queue.length === 1, 'a scene started during another one waits its turn');

  // Barks
  const s4 = [];
  const d4 = new StoryDirector((l) => s4.push(l.text));
  const make = (n) => ({ text: `bark${n}`, ms: 3000 });
  assert(d4.bark('combo', make) === true && s4.join() === 'bark0', 'a companion reacts when nothing else is going on');
  assert(d4.bark('lowHp', make) === false, 'a second reaction right after is refused (rate limit)');
  d4.update(3.1);
  assert(d4.bark('lowHp', make) === false, 'still refused after the first one ended (cool-down)');
  d4.update(40);
  assert(d4.bark('combo', make) === true && s4[1] === 'bark1', 'allowed again after the cool-down, and the wording moves on');

  const s5 = [];
  const d5 = new StoryDirector((l) => s5.push(l.text));
  d5.play(lines('scene'));
  assert(d5.bark('combo', make) === false, 'a reaction never talks over a scene');
  d5.update(3.4);
  assert(d5.bark('combo', make) === false, 'and stays quiet for a few seconds after the scene');
  d5.update(6.1);
  assert(d5.bark('combo', make) === true, 'then it may speak');
  d5.cancel();
  d5.barkCooldown = 0;
  d5.bark('combo', make);
  d5.play(lines('boss'));
  assert(s5[s5.length - 1] === 'boss', 'a scene cuts a reaction short instead of waiting behind it');

  // Setting
  const s6 = [];
  const d6 = new StoryDirector((l) => s6.push(l.text));
  d6.play(lines('x', 'y'));
  d6.setEnabled(false);
  assert(!d6.busy && d6.play(lines('z')) === false && d6.bark('combo', make) === false && s6.join() === 'x', 'switching story lines off clears the queue and silences everything');
  d6.setEnabled(true);
  assert(d6.play(lines('back')) === true, 'switching them on again works');
}

// ===== 5. Slides and the setting ===============================================================
console.log('\n--- 5. Slides and settings ---');
{
  assert(STORY_SLIDES.INTRO.length === 3 && STORY_SLIDES.VICTORY.length === 3, 'intro and victory keep three slides each');
  assert(STORY_SLIDES.TRUE_ENDING.length === 3, 'the true ending has three slides');
  assert(STORY_SLIDES.TRUE_ENDING.every(sl => sl.title && sl.text.length > 100 && sl.enText && sl.enTitle), 'every true-ending slide has Vietnamese and English text');
  assert(STORY_SLIDES.TRUE_ENDING[0].text.includes('L, U, M, E, N') && STORY_SLIDES.TRUE_ENDING[0].text.includes('Lumen'), 'the true ending names Lumen');
  assert(STORY_SLIDES.TRUE_ENDING[1].text.includes('Barnaby'), "and has Barnaby's confession");
  assert(STORY_SLIDES.VICTORY[1].text.includes('năm ô trống'), 'the ordinary ending leaves the five blanks as a hook');
  assert(STORY_SLIDES.VICTORY[2].text.includes('Nhật Ký Ký Ức'), 'and points to the journal');
  assert(STORY_SLIDES.INTRO[0].text.includes('bị gạch xóa'), 'the opening plants the scratched-out name');
  assert(DEFAULT_SETTINGS.storyLines === true, 'story lines are on by default');
  assert(sanitizeSetting('storyLines', 'false') === false && sanitizeSetting('storyLines', 'true') === true && sanitizeSetting('storyLines', 7) === undefined, 'the setting is validated like the other switches');
  const st = new SettingsStore(new MemoryStorage());
  st.set('storyLines', false);
  assert(new SettingsStore(st._storage).get('storyLines') === false, 'it is remembered');
}

// ===== 6. Game integration =====================================================================
console.log('\n--- 6. Game integration ---');
{
  const noopCtx = {
    save() {}, restore() {}, clearRect() {}, fillRect() {}, scale() {}, translate() {}, rotate() {},
    beginPath() {}, arc() {}, fill() {}, stroke() {}, drawImage() {}, moveTo() {}, lineTo() {}, rect() {},
    closePath() {}, fillText() {}, setLineDash() {}, clip() {}, roundRect() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 10 })
  };
  const fakeEl = () => ({
    addEventListener() {}, classList: { add() {}, remove() {}, contains: () => false },
    style: { setProperty() {} }, textContent: '', innerHTML: '', innerText: '', appendChild() {},
    querySelectorAll: () => [], querySelector: () => null, setAttribute() {}
  });
  global.window = {
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {},
    location: { href: 'https://example.test/play/?x=1', search: '' }
  };
  global.document = {
    addEventListener() {}, hidden: false,
    createElement: () => ({ getContext: () => noopCtx, classList: { add() {}, remove() {}, contains: () => false }, appendChild() {}, width: 100, height: 100 }),
    getElementById: () => fakeEl(), querySelectorAll: () => [], querySelector: () => null
  };
  const mockCanvas = {
    getContext: () => noopCtx, parentElement: { clientWidth: 1280, clientHeight: 720 },
    width: 1280, height: 720, style: {}, addEventListener() {}
  };

  const { Game } = await import('./src/core/Game.js');
  const game = new Game(mockCanvas);
  game.progress = new ProgressStore(new MemoryStorage());
  game.settings = new SettingsStore(new MemoryStorage());
  game.settings.onChange((k, v) => game._applySetting(k, v));
  const toasts = [];
  game.uiManager.meta.showToast = (html) => toasts.push(html);
  const said = [];
  game.uiManager.showDialogue = (o) => said.push(o);
  const startStory = (level = 1) => {
    game.bossRush = false;
    game.waveSystem.setMode('STORY');
    game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true, startLevel: level });
    said.length = 0;
  };
  const tick = (seconds) => { for (let t = 0; t < seconds; t += 0.1) game.advanceEffects(0.1); };

  // --- the opening scene of a level
  game.waveSystem.setMode('STORY');
  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true, startLevel: 1 });
  assert(said.length === 0 && game.storyDirector.pending.length === 1, 'the opening scene is scheduled when the level starts (and only once)');
  tick(2.0);
  assert(said.length === 0, 'it waits for the stage banner to clear');
  tick(0.5);
  assert(said.length === 1 && said[0].name.includes('Barnaby') && said[0].text === LEVEL_CONFIGS[0].storyIntroQuote && said[0].characterId === 'barnaby',
    "Barnaby speaks first, with the level's own intro quote");
  tick(12);
  assert(said.length === 3 && said[1].name === 'Momo' && said[2].name.includes('Cổ Thư'), 'then Momo answers and the Grimoire whispers');
  assert(said.every(l => l.duration >= 2800), 'each line gets a readable duration');

  // --- mid-level remark: once, at half of the ordinary ghosts
  const ws = game.waveSystem;
  game.storyDirector.cancel();
  said.length = 0;
  ws.enemiesSpawnedInWave = Math.ceil(ws.totalEnemiesInWave / 2) - 1;
  tick(0.2);
  assert(said.length === 0, 'nothing is said before half of the ghosts have appeared');
  ws.enemiesSpawnedInWave = Math.ceil(ws.totalEnemiesInWave / 2);
  tick(0.2);
  assert(said.length === 1 && said[0].name.includes('Barnaby') && said[0].text.includes('sợ bị quên'), 'at half-way Barnaby makes his remark');
  tick(10);
  assert(said.length === 1, 'and it is said only once per level');

  // --- boss beats follow the boss's lives
  startStory(5);
  game.storyDirector.cancel();
  const fakeBoss = { isBoss: true, bossLives: 5, maxBossLives: 5 };
  game.enemies.push(fakeBoss);
  tick(0.2);
  fakeBoss.bossLives = 4;
  tick(0.2);
  assert(said.length === 1 && said[0].name === 'Lord Umbra' && said[0].text.includes('tên ta tan mất'), "Umbra's first lost life makes him falter");
  fakeBoss.bossLives = 3; fakeBoss.bossLives = 2;
  tick(0.2);
  assert(said.length === 1, 'lives in between say nothing');
  tick(8);
  fakeBoss.bossLives = 1;
  tick(0.2);
  assert(said.some(l => l.name.includes('Barnaby') && l.text.includes('đang run')), 'on the last life Barnaby notices the knight\'s hand shaking');
  tick(8);
  assert(said.some(l => l.name === 'Lord Umbra' && l.text.includes('cậu học trò')), 'and Umbra half-remembers his apprentice');
  game.enemies.length = 0;

  // --- the memory shard and the pledges
  game.settings.set('storyLines', true);
  startStory(1);
  game.metrics.damageTaken = game._levelStartDamage; // flawless
  let lore = game._awardLore(1);
  assert(lore && lore.newShard && lore.newPledge && lore.def.letter === 'L', 'a flawless level 1 earns the shard and the pledge');
  assert(game.progress.hasShard(1) && game.progress.hasPledge(1), 'both are written to the journal');
  assert(toasts.some(t => t.includes('Mảnh Ký Ức mới')), 'the player is told about the new shard');
  assert(game.uiManager.meta._loreNew === true, 'the menu strip is flagged as new');
  lore = game._awardLore(1);
  assert(lore && !lore.newShard && !lore.newPledge, 'earning them again gives nothing new');

  startStory(1);
  game.progress = new ProgressStore(new MemoryStorage());
  game.metrics.damageTaken = game._levelStartDamage + 1;
  lore = game._awardLore(1);
  assert(lore.newShard && !lore.newPledge && !game.progress.hasPledge(1), 'a hit costs the pledge but not the shard');

  game.metrics.damageTaken = game._levelStartDamage;
  game.runAssisted = true;
  game.progress = new ProgressStore(new MemoryStorage());
  lore = game._awardLore(1);
  assert(lore.newShard && !lore.newPledge, 'an assisted run reads the story but does not keep the challenge');
  game.runAssisted = false;

  // per-level counters for the other pledges
  startStory(2);
  game.progress = new ProgressStore(new MemoryStorage());
  game.comboCount = 12;
  tick(0.2);
  lore = game._awardLore(2);
  assert(lore.newPledge && game.progress.hasPledge(2), 'combo 12 inside level 2 keeps its pledge');
  startStory(3);
  game._castPhrase({ id: 'p', name: 'Phrase', icon: '✨', effect: 'none', desc: '' });
  lore = game._awardLore(3);
  assert(lore.newPledge && game.progress.hasPledge(3), 'casting a Spell Phrase in level 3 keeps its pledge');
  startStory(4);
  game.metrics.spellsCast += 20; game.metrics.spellsHit += 16;
  lore = game._awardLore(4);
  assert(lore.newPledge && game.progress.hasPledge(4), '80% accuracy inside level 4 keeps its pledge');
  startStory(4);
  game.progress = new ProgressStore(new MemoryStorage());
  game.metrics.spellsCast += 20; game.metrics.spellsHit += 10;
  assert(!game._awardLore(4).newPledge, 'sloppy strokes do not');
  startStory(5);
  game.player.hp = 3;
  assert(game._awardLore(5).newPledge && game.progress.hasPledge(5), 'defeating Umbra with 3 hearts keeps the last pledge');
  startStory(5);
  game.progress = new ProgressStore(new MemoryStorage());
  game.player.hp = 2;
  assert(!game._awardLore(5).newPledge, 'with 2 hearts it does not');

  // levels do not leak into each other
  startStory(1);
  game.progress = new ProgressStore(new MemoryStorage());
  game.metrics.damageTaken += 3;
  game.waveSystem.initLevel(2);
  game.comboCount = 0;
  assert(game._levelFacts().damage === 0, 'damage from the previous level does not count against the next one');

  // modes that must not touch the mystery
  game.progress = new ProgressStore(new MemoryStorage());
  game.bossRush = true;
  assert(game._awardLore(1) === null && game.progress.shardCount() === 0, 'Boss Rush never writes to the journal');
  game.bossRush = false;
  game.waveSystem.setMode('ENDLESS');
  assert(game._awardLore(1) === null, 'neither does Endless');
  game.waveSystem.setMode('STORY');

  // Boss Rush trims the scenes to the battle cry and the parting words
  game.bossRush = true;
  assert(game._scene(2, 'intro').length === 0 && game._scene(2, 'bossSpawn').length === 1 && game._scene(2, 'bossDefeat').length === 1,
    'in Boss Rush only the battle cry and the parting words are spoken');
  game.bossRush = false;
  game.progress.unlockShard(2);
  assert(game._scene(2, 'intro').length === 1 && game._scene(2, 'mid').length === 0, 'a level whose shard is owned plays the short version');

  // --- the defeat scene and what the upgrade screen receives
  startStory(1);
  game.progress = new ProgressStore(new MemoryStorage());
  game.metrics.damageTaken = game._levelStartDamage;
  game.waveSystem.notifyBossDefeated();
  assert(game._pendingLore !== null || game.upgradePending, 'the shard is prepared for the upgrade screen');
  assert(said.length === 1 && said[0].role.includes('Thanh Tẩy') && said[0].text === LEVEL_CONFIGS[0].bossDefeatQuote, "the purified boss says the level's parting words");
  assert(game.progress.hasShard(1) && game.progress.hasPledge(1), 'defeating the boss writes the journal');
  clearTimeout(game._upgradeTimer);

  // --- barks
  startStory(1);
  game.storyDirector.cancel();
  game.comboCount = 10;
  tick(0.2);
  assert(said.length === 1 && said[0].name === 'Momo' && BARKS.momo.combo.includes(said[0].text), 'at combo 10 Momo cheers herself on');
  game.player.hp = 1;
  tick(0.2);
  assert(said.length === 1, 'a second reaction right away is held back');
  game.storyDirector.cancel();
  said.length = 0;
  game.progress.unlockShard(1); game.progress.markLevelCleared(2);
  game.progress.setCompanion('oliver');
  game.player.hp = 5; tick(0.2);
  game.storyDirector.cancel();
  game.player.hp = 1; tick(0.2);
  assert(said.length === 1 && said[0].name.includes('Oliver') && BARKS.oliver.lowHp.includes(said[0].text), 'on the last heart the equipped companion speaks');

  // --- the setting
  game.storyDirector.cancel();
  said.length = 0;
  game.settings.set('storyLines', false);
  assert(game.storyDirector.enabled === false, 'switching story lines off reaches the director');
  game.player.hp = 5; tick(0.2); game.player.hp = 1; tick(0.2);
  game.comboCount = 0; game._barkedCombo = false; game.comboCount = 11; tick(0.2);
  assert(said.length === 0, 'and the characters stay silent');
  game.settings.set('storyLines', true);

  // --- leaving the run silences the characters
  startStory(1);
  game.storyDirector.schedule(1, [{ text: 'late', ms: 3000 }]);
  game.stateMachine.changeState(GAME_STATES.GAMEOVER, {});
  assert(!game.storyDirector.busy && game.storyDirector.pending.length === 0, 'ending the run cancels what was still to be said');

  // --- endings
  game.progress = new ProgressStore(new MemoryStorage());
  game.waveSystem.setMode('STORY');
  game.bossRush = false;
  assert(game.pickEndings().join() === 'normal', 'the first win shows the ordinary ending');
  game.markEndingSeen('normal');
  assert(game.pickEndings().length === 0, 'it is not forced again');
  for (let l = 1; l <= 5; l++) { game.progress.unlockShard(l); game.progress.keepPledge(l); }
  assert(game.pickEndings().join() === 'true', 'with every pledge kept the next win shows the true ending');
  game.progress = new ProgressStore(new MemoryStorage());
  for (let l = 1; l <= 5; l++) { game.progress.unlockShard(l); game.progress.keepPledge(l); }
  assert(game.pickEndings().join() === 'normal,true', 'a first win that completes the name shows both, in order');
  game.bossRush = true;
  assert(game.pickEndings().length === 0, 'a Boss Rush win is not the story\'s ending');
  game.bossRush = false;
  game.waveSystem.setMode('ENDLESS');
  assert(game.pickEndings().length === 0, 'nor is an Endless run');
  game.waveSystem.setMode('STORY');
  const unlocked = [];
  const realAnnounce = game._announceAchievements.bind(game);
  game._announceAchievements = (list, t) => { unlocked.push(...list.map(x => x.id)); return realAnnounce(list, t); };
  game.markEndingSeen('true');
  assert(unlocked.includes('true_ending') && game.progress.isEndingSeen('true'), 'seeing the true ending is rewarded straight away');
  assert(isCosmeticUnlocked(HATS.find(h => h.id === 'knight'), game.progress), 'with the Lumen hat');
}

// ===== 7. Ending overlay and illustrations ====================================================
console.log('\n--- 7. Ending overlay and illustrations ---');
{
  const canvas = proxyCanvas();
  let ok = true;
  try {
    for (let slide = 0; slide < 3; slide++) for (const t of [0, 1.5, 4, 7.5, 11.9]) StoryCanvasRenderer.renderEnding(canvas, slide, t);
    StoryCanvasRenderer.renderEnding(canvas, 99, 1);
    StoryCanvasRenderer.renderEnding(null, 0, 0);
  } catch (e) { ok = false; console.error(e); }
  assert(ok, 'all three true-ending illustrations draw at any moment of their loop');

  const { Game } = await import('./src/core/Game.js');
  const noopCtx = {
    save() {}, restore() {}, clearRect() {}, fillRect() {}, scale() {}, translate() {}, rotate() {},
    beginPath() {}, arc() {}, fill() {}, stroke() {}, drawImage() {}, moveTo() {}, lineTo() {}, rect() {},
    closePath() {}, fillText() {}, setLineDash() {}, clip() {}, roundRect() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 10 })
  };
  const game = new Game({ getContext: () => noopCtx, parentElement: { clientWidth: 1280, clientHeight: 720 }, width: 1280, height: 720, style: {}, addEventListener() {} });
  game.progress = new ProgressStore(new MemoryStorage());
  const ui = game.uiManager;
  ui.storyCanvas = proxyCanvas();
  const classes = new Set();
  ui.storyScreen = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) } };
  ui._startStoryAnim = () => {};
  ui._stopStoryAnim = () => {};

  ui.playEnding(['normal', 'true']);
  assert(ui._endingOverlay && classes.has('active') && classes.has('ending-overlay') && ui.currentStoryAct === 'victory' && ui.currentStoryIndex === 0,
    'the ordinary ending opens as an overlay on its first slide');
  assert(game.progress.isEndingSeen('normal') && !game.progress.isEndingSeen('true'), 'it counts as seen as soon as it starts (a skip does not force a replay)');
  assert(ui.btnStoryPrev.style.visibility === 'hidden', 'there is nothing before the first slide');
  ui.showStoryVictorySlide(2);
  assert(ui.btnStoryNext.innerHTML.includes('Tiếp Tục'), 'at the end of the first ending the button leads on to the next one');
  ui._nextEnding();
  assert(ui.currentStoryAct === 'trueEnding' && ui.currentStoryIndex === 0 && game.progress.isEndingSeen('true'), 'the true ending follows');
  ui.showStoryEndingSlide(2);
  assert(ui.btnStoryNext.innerHTML.includes('Xem Kết Quả'), 'and its last slide leads to the result screen');
  assert(ui.storySlideTitle.textContent === STORY_SLIDES.TRUE_ENDING[2].title, 'the slide text is shown');
  ui._nextEnding();
  assert(!ui._endingOverlay && !classes.has('active') && !classes.has('ending-overlay'), 'after the last slide the overlay is gone');

  // Watching again: not counted again, and the label says so
  const before = game.progress.data.stats.trueEndings;
  ui.playEnding(['true'], { replay: true });
  ui.showStoryEndingSlide(2);
  assert(ui.btnStoryNext.innerHTML.includes('Đóng') && game.progress.data.stats.trueEndings === before, 'a replay is not counted again and ends with "Đóng"');
  ui.closeEnding();
  assert(!ui._endingOverlay, 'closeEnding() removes it (Esc / skip)');
  ui.closeEnding();
  assert(!ui._endingOverlay, 'closing twice is harmless');
}

console.log('\n========================================');
console.log(`Story Lore Tests: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');
process.exit(failed === 0 ? 0 : 1);
