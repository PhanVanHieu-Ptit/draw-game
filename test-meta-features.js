/**
 * @file test-meta-features.js
 * @description Covers the "meta" features around the core loop:
 *  1. gesture miss feedback (hints, reasons, practice scoring, sensitivity)
 *  2. settings store
 *  3. per (mode x difficulty) records
 *  4. practice mastery
 *  5. achievements & bestiary
 *  6. daily challenge (date key, seeded waves, modifiers, share links)
 *  7. run upgrades & companions
 *  8. danger cues (edge arrows, last heart)
 *  9. accessibility (assist speed, alternative input, unranked runs)
 * 10. smart pause (countdown) and Endless autosave
 * 11. wow moments (slow motion) and the end-of-run recap
 */

import { GestureEngine, getMissHint, getGuideStroke, SENSITIVITY_LEVELS } from './src/GestureEngine.js';
import { SettingsStore, DEFAULT_SETTINGS, sanitizeSetting } from './src/core/Settings.js';
import { ProgressStore, MASTERY_PASSES, masteryThreshold } from './src/core/ProgressStore.js';
import { ACHIEVEMENTS, BESTIARY, evaluateAchievements, bestiaryId } from './src/core/Achievements.js';
import { UpgradeState, UPGRADES, rollUpgradeChoices, shouldOfferUpgrade } from './src/core/Upgrades.js';
import {
  dateKey, isValidDateKey, shiftDateKey, mulberry32, waveRng, getDailyChallenge, DAILY_MODIFIERS,
  buildDailyChallengeUrl, parseDailyChallengeParams
} from './src/core/Challenge.js';
import { COMPANIONS, COMPANION_ORDER, isCompanionUnlocked, companionsUnlockedByLevel, getCompanion } from './src/core/Companions.js';
import { RunSaveStore, sanitizeSnapshot } from './src/core/RunSave.js';
import { WaveSystem } from './src/systems/WaveSystem.js';
import { DangerIndicator } from './src/systems/DangerIndicator.js';
import { describeAttempt } from './src/systems/PracticeSession.js';
import { RUNES, GAME_STATES, STORAGE_KEYS } from './src/core/Constants.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

/** In-memory stand-in for localStorage */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

// ---------------------------------------------------------------------------------------------
// Minimal DOM so Game (and its UI) can be constructed under Node
// ---------------------------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------------------------
console.log('🧪 Meta features verification\n');

// ===== 1. Gesture miss feedback ================================================================
console.log('--- 1. Gesture miss feedback ---');
{
  const engine = new GestureEngine({ minScore: 0.65, minPathLength: 15, pointCount: 32, boxSize: 100 });
  const scale = (pts, size = 200, ox = 300, oy = 200) => pts.map(p => ({ x: ox + (p.x / 100) * size, y: oy + (p.y / 100) * size }));

  // Every rune's own guide stroke is recognised as that rune with a high accuracy
  const runeIds = Object.keys(RUNES);
  const allRecognised = runeIds.every((id) => {
    const r = engine.scoreFor(scale(getGuideStroke(id)), id);
    return r.passed && r.accuracy >= 0.85;
  });
  assert(runeIds.length === 8 && allRecognised, 'every rune is recognised (accuracy >= 85%) when drawn along its own guide stroke');

  // A tilted line is not a clean horizontal: reason and hint tell the player what to fix
  const tilted = Array.from({ length: 25 }, (_, i) => ({ x: 300 + i * 10, y: 200 + i * 9 }));
  const miss = engine.recognize(tilted);
  assert(miss.gesture === null && !!miss.reason, 'a diagonal stroke is rejected with a reason code');
  const hint = getMissHint(miss.reason, miss.candidate, miss.score);
  assert(typeof hint === 'string' && hint.length > 10, `hint is a readable sentence ("${hint}")`);
  assert(getMissHint('too_short') !== null, 'a stroke that is too short still gets a hint');
  assert(getMissHint('no_input') === null, 'an empty touch gets no hint (nothing to correct)');
  assert(getMissHint('low_score', 'caret', 0.1).includes('Chưa rõ'), 'a stroke resembling nothing does not claim to look like a rune');
  assert(getMissHint('open', 'circle', 0.7).includes('Frost Nova'), 'a hint names the rune the stroke resembled');

  // Sensitivity changes the acceptance threshold
  engine.setSensitivity('strict');
  assert(engine.minScore === SENSITIVITY_LEVELS.strict, 'strict sensitivity raises the minimum score');
  engine.setSensitivity('easy');
  assert(engine.minScore === SENSITIVITY_LEVELS.easy && SENSITIVITY_LEVELS.easy < SENSITIVITY_LEVELS.normal, 'easy sensitivity lowers the minimum score');
  engine.setSensitivity('bogus');
  assert(engine.minScore === SENSITIVITY_LEVELS.easy, 'an unknown sensitivity value is ignored');

  // Practice wording
  assert(describeAttempt({ passed: true, accuracy: 0.97, reason: null }, 'heart').tone === 'great', 'practice: a near-perfect stroke is "great"');
  assert(describeAttempt({ passed: false, accuracy: 0.4, reason: 'confused', recognizedAs: 'caret' }, 'v_shape').text.includes('∧'), 'practice: a confused stroke names the rune it resembled');
}

// ===== 2. Settings ============================================================================
console.log('\n--- 2. Settings ---');
{
  const store = new MemoryStorage();
  const s = new SettingsStore(store);
  assert(JSON.stringify(s.all()) === JSON.stringify(DEFAULT_SETTINGS), 'defaults load when nothing is stored');
  const events = [];
  s.onChange((k, v) => events.push([k, v]));
  assert(s.set('catVolume', 30) === true && s.get('catVolume') === 30, 'cat volume is its own setting');
  assert(s.set('catVolume', 30) === false, 'setting the same value again is not a change');
  assert(s.set('musicVolume', 250) && s.get('musicVolume') === 100, 'volumes are clamped to 0..100');
  assert(s.set('sensitivity', 'strict') && s.get('sensitivity') === 'strict', 'sensitivity accepts a valid level');
  assert(s.set('sensitivity', 'ultra') === false && s.get('sensitivity') === 'strict', 'an invalid sensitivity is rejected');
  assert(s.set('assist', '30') && s.get('assist') === 30, 'assist accepts a numeric string from a UI button');
  assert(s.set('assist', 45) === false, 'assist only accepts the offered levels');
  assert(s.set('colorBlind', true) && s.get('colorBlind') === true, 'colour-blind mode toggles');
  assert(s.set('nope', 1) === false, 'unknown keys are ignored');
  assert(events.some(([k]) => k === 'catVolume') && events.length >= 5, 'listeners are notified of changes');

  const reloaded = new SettingsStore(store);
  assert(reloaded.get('catVolume') === 30 && reloaded.get('sensitivity') === 'strict' && reloaded.get('assist') === 30, 'settings persist across sessions');
  store.setItem(STORAGE_KEYS.SETTINGS, '{broken json');
  assert(new SettingsStore(store).get('musicVolume') === DEFAULT_SETTINGS.musicVolume, 'corrupt saved data falls back to defaults');
  store.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ masterVolume: 'loud', haptics: 'maybe', quality: 'ultra' }));
  const dirty = new SettingsStore(store);
  assert(dirty.get('masterVolume') === 50 && dirty.get('haptics') === true && dirty.get('quality') === 'auto', 'invalid saved values are replaced by defaults one by one');
  assert(sanitizeSetting('haptics', 'false') === false, 'boolean strings are understood');
  s.reset();
  assert(JSON.stringify(s.all()) === JSON.stringify(DEFAULT_SETTINGS), 'reset restores every default');
  const noStorage = new SettingsStore(null);
  assert(noStorage.set('haptics', false) && noStorage.get('haptics') === false, 'works in memory when storage is unavailable');
}

// ===== 3. Records per mode x difficulty ========================================================
console.log('\n--- 3. Records per mode x difficulty ---');
{
  const store = new MemoryStorage();
  const p = new ProgressStore(store);
  const base = { spellsCast: 40, spellsHit: 30, seconds: 120 };
  const r1 = p.recordRun({ mode: 'STORY', difficulty: 'NORMAL', score: 5000, level: 3, combo: 12, accuracy: 75, ...base });
  assert(r1.isNewScore && r1.isNewLevel && r1.isNewCombo, 'first run sets every record');
  p.recordRun({ mode: 'ENDLESS', difficulty: 'INFERNO', score: 99999, level: 15, combo: 40, accuracy: 80, ...base });
  assert(p.getRecord('STORY', 'NORMAL').score === 5000, 'a huge Endless Inferno score does not leak into Story Normal');
  assert(p.getRecord('ENDLESS', 'INFERNO').level === 15 && p.getRecord('ENDLESS', 'NORMAL').score === 0, 'each (mode x difficulty) has its own record');
  const r2 = p.recordRun({ mode: 'STORY', difficulty: 'NORMAL', score: 4200, level: 5, combo: 8, accuracy: 70, ...base });
  assert(!r2.isNewScore && r2.isNewLevel && !r2.isNewCombo, 'only the improved entries are flagged as new records');
  assert(r2.scoreGap === 800, 'the gap to the best score is reported ("only 800 short")');
  assert(p.getRecord('STORY', 'NORMAL').plays === 2, 'plays are counted');

  const unranked = p.recordRun({ mode: 'STORY', difficulty: 'NORMAL', score: 90000, level: 5, combo: 90, accuracy: 100, ranked: false, assisted: true, ...base });
  assert(!unranked.isNewScore && p.getRecord('STORY', 'NORMAL').score === 5000, 'an unranked run does not touch the records');
  assert(p.data.stats.bestScore === 99999 && p.data.stats.bestCombo === 40, 'an assisted run does not raise "best ever" stats');
  assert(p.data.stats.runs === 4, 'but it still counts as a run played');

  p.save();
  const again = new ProgressStore(store);
  assert(again.getRecord('ENDLESS', 'INFERNO').score === 99999, 'records persist');
  store.setItem(STORAGE_KEYS.PROGRESS, '[1,2');
  assert(new ProgressStore(store).data.stats.runs === 0, 'corrupt progress data starts fresh instead of crashing');
  store.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify({ records: { 'STORY:NORMAL': { score: -5, level: 'x', combo: 3 } }, stats: { kills: 'many' }, daily: { 'not-a-date': { score: 5 } }, cleared: { 9: true, 2: true } }));
  const sane = new ProgressStore(store);
  assert(sane.getRecord('STORY', 'NORMAL').score === 0 && sane.getRecord('STORY', 'NORMAL').combo === 3, 'invalid numbers in saved records are neutralised');
  assert(sane.data.stats.kills === 0 && Object.keys(sane.data.daily).length === 0, 'invalid stats / daily keys are dropped');
  assert(sane.isLevelCleared(2) && !sane.isLevelCleared(9), 'only real story levels are accepted as cleared');
}

// ===== 4. Practice mastery =====================================================================
console.log('\n--- 4. Practice mastery ---');
{
  const p = new ProgressStore(new MemoryStorage());
  const need = masteryThreshold('heart');
  assert(masteryThreshold('horizontal') > need, 'straight lines demand more accuracy than the curvy runes');
  p.recordPractice('heart', need - 0.1, true);
  assert(p.getPractice('heart').passes === 1 && p.getPractice('heart').good === 0, 'a recognised but sloppy stroke does not count towards mastery');
  p.recordPractice('heart', 0.99, false);
  assert(p.getPractice('heart').good === 0 && p.getPractice('heart').attempts === 2, 'a failed stroke is an attempt but never "good"');
  let last;
  for (let i = 0; i < MASTERY_PASSES; i++) last = p.recordPractice('heart', need + 0.05, true);
  assert(last.becameMastered && p.isMastered('heart') && p.masteredCount() === 1, `${MASTERY_PASSES} good strokes master a rune`);
  assert(p.recordPractice('heart', 0.95, true).becameMastered === false, 'mastery is announced only once');
  assert(p.recordPractice('nonsense', 1, true).mastered === false, 'unknown runes are ignored');
}

// ===== 5. Achievements & bestiary ==============================================================
console.log('\n--- 5. Achievements & bestiary ---');
{
  const p = new ProgressStore(new MemoryStorage());
  assert(evaluateAchievements(p).length === 0, 'nothing is earned on a fresh save');
  p.recordKill('REGULAR', 'lightning');
  const first = evaluateAchievements(p);
  assert(first.some(a => a.id === 'first_blood'), 'the first kill earns "first blood"');
  assert(evaluateAchievements(p).length === 0, 'an achievement is earned only once');
  for (let i = 0; i < 99; i++) p.recordKill('REGULAR', 'lightning');
  const ids = evaluateAchievements(p).map(a => a.id);
  assert(ids.includes('hunter_100') && ids.includes('lightning_100'), '100 kills (all with lightning) earn the hunter and lightning achievements');
  assert(p.getKills('REGULAR') === 100 && p.isSeen('REGULAR'), 'kills are counted per ghost kind and mark it as seen');
  assert(!p.isSeen('BOSS_CHEF'), 'a ghost never met stays hidden ("???")');
  assert(bestiaryId({ isHeartGhost: true, type: 'REGULAR' }) === 'HEART', 'heart ghosts are identified by their flag');
  assert(bestiaryId({ type: 'SPEEDSTER' }) === 'SPEEDSTER' && bestiaryId({ type: 'BOSS_COACH' }) === 'BOSS_COACH', 'archetypes map to bestiary ids');
  assert(BESTIARY.every(b => b.name && b.desc), 'every bestiary entry has a name and description');
  assert(new Set(ACHIEVEMENTS.map(a => a.id)).size === ACHIEVEMENTS.length, 'achievement ids are unique');
  p.addStat('cleanCombos');
  assert(evaluateAchievements(p).some(a => a.id === 'clean_combo'), '"combo 5 without being hit" is an achievement');
}

// ===== 6. Daily challenge ======================================================================
console.log('\n--- 6. Daily challenge ---');
{
  assert(dateKey(new Date(Date.UTC(2026, 10, 5, 23, 59))) === '2026-11-05', 'the date key is the UTC date');
  assert(isValidDateKey('2026-02-28') && !isValidDateKey('2026-02-30') && !isValidDateKey('tomorrow'), 'date keys are validated');
  assert(shiftDateKey('2026-03-01', -1) === '2026-02-28', 'date arithmetic handles month ends');

  const a = getDailyChallenge('2026-11-05');
  const b = getDailyChallenge('2026-11-05');
  assert(a.seed === b.seed && a.modifier.id === b.modifier.id, 'the same day always gives the same challenge');
  const mods = new Set(Array.from({ length: 40 }, (_, i) => getDailyChallenge(shiftDateKey('2026-01-01', i)).modifier.id));
  assert(mods.size >= 4, `different days rotate through the modifiers (${mods.size} seen in 40 days)`);

  const rng1 = mulberry32(42); const rng2 = mulberry32(42);
  assert(rng1() === rng2() && rng1() !== mulberry32(43)(), 'the seeded generator is reproducible');
  assert(waveRng(7, 3)() === waveRng(7, 3)() && waveRng(7, 3)() !== waveRng(7, 4)(), 'each wave has its own generator');

  // Two players on the same day get identical ghosts in the same wave, even if they got there differently
  const spawnSequence = (ws, wave) => {
    ws.initLevel(wave);
    const out = [];
    for (let i = 0; i < 60; i++) { const r = ws.update(0.6, 5, 0, 0); if (r) out.push(JSON.stringify(r)); }
    return out.join('|');
  };
  const w1 = new WaveSystem(); w1.setMode('ENDLESS'); w1.setSeed(a.seed);
  const w2 = new WaveSystem(); w2.setMode('ENDLESS'); w2.setSeed(a.seed);
  spawnSequence(w2, 2); // player 2 played wave 2 first (consumes randomness)
  assert(spawnSequence(w1, 4) === spawnSequence(w2, 4), 'wave 4 is identical for both players, whatever they played before');
  const w3 = new WaveSystem(); w3.setMode('ENDLESS'); w3.setSeed(getDailyChallenge('2026-11-06').seed);
  assert(spawnSequence(w3, 4) !== spawnSequence(w1, 4), 'a different day brings different ghosts');

  // Modifiers
  const flat = new WaveSystem(); flat.setMode('ENDLESS');
  flat.setModifier(DAILY_MODIFIERS.find(m => m.id === 'flat_lines'));
  let allFlat = true; let anyTactical = false;
  for (let wave = 1; wave <= 6; wave++) {
    flat.initLevel(wave);
    for (let i = 0; i < 80; i++) {
      const r = flat.update(0.6, 2, 0, 0);
      const list = Array.isArray(r) ? r : (r ? [r] : []);
      for (const c of list) {
        if (c.isHeartGhost || c.isFreezeGhost || c.isBlastGhost) anyTactical = true;
        if (!c.symbolQueue.every(s => s === 'horizontal' || s === 'vertical')) allFlat = false;
      }
    }
  }
  assert(allFlat && !anyTactical, '"horizontal & vertical only" really restricts every ghost (and removes heart / frost / gale ghosts)');
  const plain = new WaveSystem(); plain.setMode('ENDLESS'); plain.initLevel(3);
  const fastSpeed = new WaveSystem(); fastSpeed.setMode('ENDLESS'); fastSpeed.setModifier(DAILY_MODIFIERS.find(m => m.id === 'whirlwind')); fastSpeed.initLevel(3);
  assert(fastSpeed.speedMultiplier > plain.speedMultiplier * 1.2, 'the "whirlwind" twist speeds ghosts up');
  const swarm = new WaveSystem(); swarm.setMode('ENDLESS'); swarm.setModifier(DAILY_MODIFIERS.find(m => m.id === 'swarm')); swarm.initLevel(3);
  assert(swarm.spawnInterval < plain.spawnInterval, 'the "swarm" twist makes ghosts arrive faster');
  const noHeart = new WaveSystem(); noHeart.setMode('ENDLESS'); noHeart.setModifier(DAILY_MODIFIERS.find(m => m.id === 'no_hearts')); noHeart.initLevel(2);
  let sawHeart = false;
  for (let i = 0; i < 300; i++) { const r = noHeart.update(0.6, 1, 0, 0); (Array.isArray(r) ? r : r ? [r] : []).forEach(c => { if (c.isHeartGhost) sawHeart = true; }); }
  assert(!sawHeart, '"no hearts" never spawns a healing ghost, even at 1 HP');
  noHeart.setSeed(null); noHeart.setModifier(null);
  assert(noHeart.modifier === null && noHeart.rng === Math.random, 'clearing the seed and twist returns to ordinary randomness');

  // Share links
  const url = buildDailyChallengeUrl('https://example.test/play/?old=1#x', '2026-11-05', 12345.6, 'Momo');
  assert(url === 'https://example.test/play/?daily=2026-11-05&score=12346&from=Momo', 'the share link carries date, score and sender');
  const parsed = parseDailyChallengeParams('?daily=2026-11-05&score=12346&from=Momo');
  assert(parsed && parsed.key === '2026-11-05' && parsed.score === 12346 && parsed.from === 'Momo', 'the share link is read back');
  assert(parseDailyChallengeParams('?daily=hacked') === null && parseDailyChallengeParams('') === null, 'garbage links are ignored');
  const evil = parseDailyChallengeParams('?daily=2026-11-05&score=-5&from=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
  assert(evil && !/[<>]/.test(evil.from) && evil.score === 0, 'a sender name from the URL is stripped of markup, a bad score becomes 0');

  // Daily records & streak
  const p = new ProgressStore(new MemoryStorage());
  const r1 = p.recordDaily('2026-11-03', { score: 100, wave: 2, combo: 3 });
  p.recordDaily('2026-11-04', { score: 200, wave: 3, combo: 4 });
  const r3 = p.recordDaily('2026-11-05', { score: 300, wave: 4, combo: 5 });
  assert(r1.isNewBest && r3.streak === 3, 'playing three days in a row gives a 3-day streak');
  assert(p.recordDaily('2026-11-05', { score: 250, wave: 1, combo: 1 }).isNewBest === false && p.getDaily('2026-11-05').score === 300, 'only the best score of a day is kept');
  assert(p.dailyStreak('2026-11-06') === 3, 'the streak is still alive the day after');
  assert(p.dailyStreak('2026-11-08') === 0, 'but it breaks after a missed day');
  assert(evaluateAchievements(p).some(a => a.id === 'daily_streak_3'), 'a 3-day streak earns an achievement');
}

// ===== 7. Upgrades & companions ================================================================
console.log('\n--- 7. Upgrades & companions ---');
{
  const u = new UpgradeState();
  assert(u.comboTimeBonus === 0 && u.scoreMultiplier === 1 && u.shieldLimit === 0, 'no bonuses at the start');
  u.add('combo_time'); u.add('combo_time');
  assert(Math.abs(u.comboTimeBonus - 1.2) < 1e-9, 'combo time stacks (+0.6s each)');
  for (let i = 0; i < 5; i++) u.add('combo_time');
  assert(u.count('combo_time') === UPGRADES.combo_time.max, 'stacks are capped');
  assert(u.add('does_not_exist') === false, 'unknown upgrades are rejected');
  u.add('combo_shield');
  assert(u.consumeShield() === true && u.consumeShield() === false, 'a combo shield forgives exactly one miss per charge');
  u.refillShield();
  assert(u.shieldCharges === 1, 'the shield recharges for the next stage');
  u.reset();
  assert(u.count('combo_time') === 0 && u.comboTimeBonus === 0, 'reset clears run upgrades');

  const rng = mulberry32(1);
  const picks = rollUpgradeChoices(new UpgradeState(), { hp: 5, maxHp: 5 }, 3, rng);
  assert(picks.length === 3 && new Set(picks.map(x => x.id)).size === 3, 'three different upgrades are offered');
  assert(!rollUpgradeChoices(new UpgradeState(), { hp: 5, maxHp: 5 }, 9, mulberry32(2)).some(x => x.id === 'heal'), 'healing is not offered at full health');
  assert(!rollUpgradeChoices(new UpgradeState(), { hp: 3, maxHp: 6 }, 9, mulberry32(3)).some(x => x.id === 'max_hp'), 'max-HP is not offered at the hearts cap');
  assert(shouldOfferUpgrade('ENDLESS', 3) && !shouldOfferUpgrade('ENDLESS', 4) && shouldOfferUpgrade('ENDLESS', 6), 'Endless offers an upgrade every 3 waves');
  assert(shouldOfferUpgrade('STORY', 1) && shouldOfferUpgrade('STORY', 4) && !shouldOfferUpgrade('STORY', 5), 'Story offers one after levels 1-4 (not after the finale)');

  // Companions
  const p = new ProgressStore(new MemoryStorage());
  assert(isCompanionUnlocked('momo', p) && !isCompanionUnlocked('oliver', p), 'Momo is free, the others are locked');
  assert(companionsUnlockedByLevel(1).map(c => c.id).join() === 'oliver', 'clearing level 1 unlocks Oliver');
  p.markLevelCleared(1);
  assert(isCompanionUnlocked('oliver', p) && !isCompanionUnlocked('luna', p), 'clearing a level unlocks its companion only');
  [2, 3, 4].forEach(l => p.markLevelCleared(l));
  assert(COMPANION_ORDER.every(id => isCompanionUnlocked(id, p)), 'clearing levels 1-4 unlocks every companion');
  assert(p.setCompanion('nyx') && p.getCompanion() === 'nyx' && p.setCompanion('zorro') === false, 'a companion can be equipped; fake ids are rejected');
  assert(evaluateAchievements(p).some(a => a.id === 'companions_all'), 'unlocking every companion earns an achievement');

  const eq = new UpgradeState();
  eq.setCompanionEffects(getCompanion('barnaby').effects);
  assert(eq.shieldLimit === 1 && eq.shieldCharges === 1, 'Barnaby gives a combo shield');
  eq.add('combo_shield');
  assert(eq.shieldLimit === 2, 'a companion passive stacks with run upgrades');
  eq.reset();
  assert(eq.shieldLimit === 1, 'a new run keeps the equipped companion');
  eq.setCompanionEffects(getCompanion('nyx').effects);
  assert(eq.invulnerableBonus === 0.4, 'Nyx gives extra invulnerability');
  eq.setCompanionEffects(getCompanion('oliver').effects);
  assert(eq.healEvery === 2, 'Oliver heals every 2 stages');
  eq.setCompanionEffects(getCompanion('luna').effects);
  assert(eq.freezeBonus === 1, 'Luna lengthens Frost Nova');
  assert(Object.values(COMPANIONS).every(c => c.desc && c.passive), 'every companion describes its passive');
}

// ===== 8. Danger cues ==========================================================================
console.log('\n--- 8. Danger cues ---');
{
  const d = new DangerIndicator();
  const player = { x: 400, y: 300, hp: 5, maxHp: 5 };
  const mk = (o) => ({ isDead: false, isHeartGhost: false, isFrozen: false, radius: 24, speed: 80, type: 'REGULAR', ...o });
  const arrows = d.collectArrows([
    mk({ x: -60, y: 200, type: 'SPEEDSTER', speed: 120 }),   // fast, off-screen left
    mk({ x: 400, y: 300 }),                                  // on screen: no arrow
    mk({ x: 1400, y: 100, speed: 5 }),                       // off-screen but slow and far: ignored
    mk({ x: 500, y: -50, isDead: true })                     // dead: ignored
  ], player, 800, 600);
  assert(arrows.length === 1 && arrows[0].fast, 'only the fast ghost outside the view gets an arrow');
  assert(arrows[0].x === 28 && Math.abs(Math.abs(arrows[0].angle) - Math.PI) < 0.5, 'the arrow sits on the edge nearest the ghost and points towards it');
  const many = Array.from({ length: 30 }, (_, i) => mk({ x: -50, y: 30 + i * 15, speed: 150 }));
  assert(d.collectArrows(many, player, 800, 600).length <= 10, 'arrows are capped so the edge never turns into noise');

  assert(DangerIndicator.isCritical({ hp: 1, maxHp: 5 }) && !DangerIndicator.isCritical({ hp: 2, maxHp: 5 }) && !DangerIndicator.isCritical({ hp: 0, maxHp: 5 }), 'critical means exactly one heart left');
  let beats = 0;
  const game = { player: { hp: 1, maxHp: 5 }, audioSystem: { soundHeartbeat: () => { beats++; } }, hapticSystem: { pulse: () => {} } };
  for (let i = 0; i < 300; i++) d.update(0.016, game); // ~4.8s
  assert(d.critical && beats >= 5 && beats <= 7, `a heartbeat plays about every 0.8s on the last heart (${beats} beats in 4.8s)`);
  game.player.hp = 3;
  const before = beats;
  for (let i = 0; i < 120; i++) d.update(0.016, game);
  assert(!d.critical && beats === before, 'the heartbeat stops as soon as Momo is healed');
}

// ===== 9-11. Game-level behaviour ==============================================================
console.log('\n--- 9-11. Game: accessibility, smart pause, autosave, wow moments, recap ---');
{
  const { Game } = await import('./src/core/Game.js');
  const { Enemy } = await import('./src/entities/Enemy.js');
  const game = new Game(mockCanvas);
  // Fresh, isolated storage for the stores this test mutates
  game.progress = new ProgressStore(new MemoryStorage());
  game.runSave = new RunSaveStore(new MemoryStorage());
  game.settings = new SettingsStore(new MemoryStorage());
  game.settings.onChange((k, v) => game._applySetting(k, v));
  const toasts = [];
  game.uiManager.meta.showToast = (html) => toasts.push(html);

  // --- starting a run
  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
  assert(game.stateMachine.getCurrentStateName() === 'PLAYING' && game.resumeCountdown === 0, 'a fresh run starts without a countdown');

  // --- smart pause: 3-2-1 on resume
  game.stateMachine.changeState(GAME_STATES.PAUSE);
  game.stateMachine.changeState(GAME_STATES.PLAYING);
  assert(game.resumeCountdown > 2, 'resuming from pause starts a 3-2-1 countdown');
  assert(game.inputHandler.isEnabled === false, 'drawing is disabled during the countdown');
  const hpBefore = game.player.hp;
  game.enemies.length = 0;
  let frozen = true;
  const startScore = game.score;
  for (let i = 0; i < 60; i++) { game.stateMachine.update(0.016); }
  frozen = game.waveSystem.enemiesSpawnedInWave === 0 && game.resumeCountdown > 1.3;
  assert(frozen, 'the world is frozen while counting down (no ghosts spawn)');
  for (let i = 0; i < 200; i++) game.stateMachine.update(0.016);
  assert(game.resumeCountdown === 0 && game.inputHandler.isEnabled === true, 'after about 2.4s the game is live again');
  game.stateMachine.changeState(GAME_STATES.PAUSE);
  game.stateMachine.changeState(GAME_STATES.PLAYING);
  game.stateMachine.changeState(GAME_STATES.PAUSE);
  assert(game.resumeCountdown === 0, 'pausing again during the countdown cancels it');
  game.stateMachine.changeState(GAME_STATES.PLAYING);
  game.cancelResumeCountdown(); game.inputHandler.setEnabled(true);

  // --- hiding the tab / rotating pauses a run
  document.hidden = true; game._onVisibilityChange();
  assert(game.stateMachine.getCurrentStateName() === 'PAUSE', 'hiding the tab pauses the run');
  document.hidden = false;
  game.stateMachine.changeState(GAME_STATES.PLAYING); game.cancelResumeCountdown(); game.inputHandler.setEnabled(true);

  // --- wow moments
  game.triggerSlowMo(1, 0.3, true);
  const slowed = game.advanceEffects(0.016);
  assert(slowed < 0.016 * 0.4, 'slow motion shrinks the time step');
  assert(game._moodRate < 1, 'the music slows down with it');
  for (let i = 0; i < 100; i++) game.advanceEffects(0.016);
  assert(Math.abs(game.advanceEffects(0.016) - 0.016) < 1e-9, 'time returns to normal afterwards');
  game._slowMoCooldown = 0; game.slowMo.timer = 0;
  game.triggerSlowMo(0.5, 0.4);
  const t1 = game.slowMo.timer;
  game.slowMo.timer = 0;
  game.triggerSlowMo(0.5, 0.4);
  assert(t1 > 0 && game.slowMo.timer === 0, 'slow motion is rate-limited (never chains back to back) unless forced');

  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
  game.enemies.length = 0;
  game._slowMoCooldown = 0;
  const e = new Enemy({ type: 'REGULAR', x: 300, y: 300, symbolQueue: ['horizontal'], speedMultiplier: 0, targetPlayerPos: game.player });
  e.symbolQueue = ['horizontal', 'horizontal', 'horizontal', 'horizontal', 'horizontal', 'horizontal'];
  game.enemies.push(e);
  for (let i = 0; i < 5; i++) game.onGestureRecognized({ gesture: 'horizontal', score: 0.9, candidate: 'horizontal', reason: null }, []);
  assert(game.comboCount === 5 && game.slowMo.timer > 0, 'reaching combo 5 triggers slow motion');

  // --- recap facts
  game.onGestureRecognized({ gesture: 'horizontal', score: 0.97, candidate: 'horizontal', reason: null }, []);
  for (let i = 0; i < 5; i++) game.onGestureRecognized({ gesture: null, score: 0.6, candidate: 'caret', reason: 'low_score' }, []);
  const replay = game.getRunReplay();
  assert(replay.topRune === 'horizontal' && replay.topRuneCount >= 6, 'the recap names the favourite rune');
  assert(replay.bestAccuracy === 97 && replay.bestAccuracyRune === 'horizontal', 'the recap names the sharpest stroke');
  assert(replay.weakestRune === 'caret', 'the recap points at the rune that was missed most');

  // --- unranked runs: assist / alternative input
  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
  assert(game.isAssisted() === false, 'a normal run is ranked');
  game.settings.set('assist', 30);
  assert(Math.abs(game.assistScale - 0.7) < 1e-9 && game.isAssisted(), 'assist 30% slows ghosts to 70% and flags the run');
  game.settings.set('assist', 0);
  assert(game.isAssisted(), 'turning assist off mid-run does not make the run ranked again');
  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
  assert(!game.isAssisted(), 'a new run is ranked again');
  const accBefore = game.metrics.accSum || 0;
  const ok = game.castRune('horizontal');
  assert(ok && game.isAssisted() && game.metrics.runeUse.horizontal === 1 && (game.metrics.accSum || 0) === accBefore, 'the on-screen pad casts a rune, flags the run, and does not fake accuracy');
  assert(game.castRune('not_a_rune') === false, 'unknown pad buttons are ignored');
  game.score = 55555; game.metrics.maxCombo = 20;
  const s = game.finishRun(false);
  assert(s.assisted && !s.isNewHighScore && game.progress.getRecord('STORY', 'NORMAL').score === 0, 'an assisted run is not saved to the records');

  // --- Endless autosave
  game.runSave.clear();
  game.waveSystem.setMode('ENDLESS');
  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
  game.waveSystem.initLevel(1);
  assert(game.runSave.exists() === false, 'wave 1 is not worth saving');
  game.upgrades.add('score_boost');
  game.score = 4000; game.metrics.maxCombo = 12; game.player.hp = 3;
  game.waveSystem.initLevel(4);
  const snap = game.runSave.load();
  assert(snap && snap.wave === 4 && snap.score === 4000 && snap.hp === 3 && snap.upgrades.score_boost === 1, 'each new wave autosaves wave, score, hearts and upgrades');
  game.stateMachine.changeState(GAME_STATES.MENU);
  game.upgrades.reset(); game.score = 0;
  assert(game.resumeEndless() === true, 'the saved run can be resumed');
  assert(game.waveSystem.gameMode === 'ENDLESS' && game.waveSystem.currentWave === 4 && game.score === 4000 && game.player.hp === 3 && game.upgrades.count('score_boost') === 1, 'resuming restores wave, score, hearts and upgrades');
  assert(game.stateMachine.getCurrentStateName() === 'PLAYING', 'and puts the player back in the game');
  game.player.hp = 0; game.stateMachine.changeState(GAME_STATES.GAMEOVER);
  assert(game.runSave.exists() === false, 'dying clears the autosave');
  assert(sanitizeSnapshot({ v: 1, mode: 'ENDLESS', savedAt: Date.now(), wave: 5, hp: 99, maxHp: 99, upgrades: { combo_time: 99, fake: 3 } }).maxHp === 6, 'a tampered save is clamped to legal values');
  assert(sanitizeSnapshot({ v: 1, mode: 'ENDLESS', savedAt: 1, wave: 5 }) === null, 'a very old save is dropped');
  assert(sanitizeSnapshot({ v: 1, mode: 'STORY', savedAt: Date.now(), wave: 5 }) === null && sanitizeSnapshot(null) === null, 'only Endless saves are accepted');

  // --- Daily challenge run
  game.runSave.clear();
  game.startDaily();
  assert(game.challenge && game.waveSystem.seed === game.challenge.seed && game.waveSystem.gameMode === 'ENDLESS', 'starting the daily challenge seeds the waves');
  assert(game.waveSystem.modifier && game.waveSystem.modifier.id === game.challenge.modifier.id, 'and applies the day\'s twist');
  const expectedHp = game.challenge.modifier.maxHp || 5;
  assert(game.player.maxHp === expectedHp, `Momo's hearts follow the twist (${expectedHp})`);
  game.score = 1500; game.metrics.maxCombo = 7;
  game.waveSystem.initLevel(3);
  assert(game.runSave.exists() === false, 'daily runs are never autosaved');
  const regularBefore = JSON.stringify(game.progress.data.records);
  game.player.hp = 0; game.stateMachine.changeState(GAME_STATES.GAMEOVER);
  assert(game.progress.getDaily(dateKey()).score === 1500, 'the daily score goes to the daily board');
  assert(JSON.stringify(game.progress.data.records) === regularBefore, 'and leaves the regular records alone');
  game.stateMachine.changeState(GAME_STATES.MENU);
  assert(game.challenge === null, 'going back to the menu ends daily mode');
  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
  assert(game.waveSystem.seed === null && game.waveSystem.modifier === null && game.player.maxHp === 5, 'the next ordinary run is unseeded with full hearts');

  // --- Companion equip & Oliver's soup, story unlock
  game.progress = new ProgressStore(new MemoryStorage());
  assert(game.setCompanion('oliver') === false, 'a locked companion cannot be equipped');
  game.waveSystem.setMode('STORY');
  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true, startLevel: 1 });
  game._onStageCleared(1);
  assert(game.progress.isLevelCleared(1) && toasts.some(t => t.includes('Oliver')), 'clearing story level 1 unlocks Oliver and announces it');
  game.upgradePending = false; clearTimeout(game._upgradeTimer); game.waveSystem.intermissionHold = false;
  assert(game.setCompanion('oliver') === true && game.upgrades.healEvery === 2, 'once unlocked, Oliver can be equipped');
  game.player.hp = 2;
  game._stagesClearedThisRun = 1;
  game._onStageCleared(2);
  clearTimeout(game._upgradeTimer);
  assert(game.player.hp === 3, "Oliver's soup heals a heart every 2nd cleared stage");

  // --- colour-blind flag reaches Enemy rendering
  game.settings.set('colorBlind', true);
  assert(Enemy.colorBlind === true, 'colour-blind mode switches the rune textures on');
  game.settings.set('colorBlind', false);
  assert(Enemy.colorBlind === false, 'and off again');

  // --- cat volume wiring
  const calls = [];
  game.audioSystem.setCatVolume = (v) => calls.push(v);
  game.settings.set('catVolume', 40);
  assert(calls.length === 1 && Math.abs(calls[0] - 0.4) < 1e-9, 'the cat volume setting drives its own audio bus');
}

console.log('\n========================================');
console.log(`Meta Features Tests: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');
process.exit(failed === 0 ? 0 : 1);
