import assert from 'node:assert/strict';
import { FeedbackChannel, selectThreat, enemyIdentity, bossProgress, GameplayHUD } from '../src/ui/GameplayFeedback.js';
import { SettingsStore } from '../src/core/Settings.js';
import { UIManager } from '../src/ui/UIManager.js';
import { Game } from '../src/core/Game.js';
import { ParticleSystem } from '../src/systems/ParticleSystem.js';
import { Enemy } from '../src/entities/Enemy.js';

let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS: ${name}`); };
check('urgent feedback survives routine events; no delayed queue or duplicate extension', () => {
  const channel = new FeedbackChannel();
  assert(channel.post('phase', { priority: 4, duration: 2 }));
  assert.equal(channel.post('hit'), false);
  channel.tick(1);
  assert.equal(channel.post('phase', { priority: 4 }), false);
  assert.equal(channel.current.remaining, 1);
  channel.tick(0); assert.equal(channel.current.remaining, 1);
  channel.tick(1); assert.equal(channel.current, null);
  assert(channel.post('next cast'));
  channel.clear(); assert.equal(channel.current, null);
});
const player = { x: 100, y: 100, radius: 20 };
const ghost = (props = {}) => ({ x: 280, y: 100, speed: 50, radius: 20, symbolQueue: ['horizontal'], ...props });
check('time to collision selects an urgent fast enemy ahead of spawn order', () => {
  const slow = ghost({ x: 190, speed: 5 });
  const fast = ghost({ x: 230, speed: 100, type: 'SPEEDSTER' });
  const threat = selectThreat([slow, fast], player, 400, 300);
  assert.equal(threat.enemy, fast); assert.equal(threat.eta, .9); assert(threat.urgent);
  assert.equal(threat.direction, '→'); assert.equal(threat.rune.symbol, '—');
});
check('hidden runes stay hidden and safe enemies do not generate attack warnings', () => {
  const hidden = ghost({ symbolsHidden: true, x: -10 });
  const safe = ['isDead', 'isHeartGhost', 'isGolden', 'isFrozen', 'isRetreating', 'isMinionRetreating'].map(key => ghost({ x: 101, [key]: true }));
  const cue = selectThreat([...safe, hidden], player, 400, 300);
  assert.equal(cue.enemy, hidden); assert.equal(cue.rune, null); assert(cue.outside);
  assert.equal(cue.direction, '←');
  assert.equal(selectThreat(safe, player, 400, 300), null);
});
check('enemy identities include distinct symbols and names without colour dependence', () => {
  const identities = [ghost(), ghost({ isBoss: true }), ghost({ type: 'SPEEDSTER' }), ghost({ type: 'ARMORED' }), ghost({ isFreezeGhost: true }), ghost({ isBlastGhost: true }), ghost({ isGolden: true }), ghost({ isHeartGhost: true })].map(enemyIdentity);
  assert.equal(new Set(identities).size, 8);
});
check('boss progress follows rune depletion and remains stable at phase handoff', () => {
  const boss = { maxBossLives: 3, bossLives: 3, bossPhases: [['horizontal', 'vertical'], ['caret']], symbolQueue: ['vertical'], currentPhaseIndex: 0 };
  assert.equal(bossProgress(boss).fraction, 5 / 6);
  boss.bossLives = 2; boss.symbolQueue = []; boss.isRetreating = true; boss.phaseClearedOnRetreat = true;
  assert.equal(bossProgress(boss).fraction, 2 / 3);
  boss.symbolQueue = ['caret']; boss.currentPhaseIndex = 1; boss.isRetreating = false;
  assert.equal(bossProgress(boss).fraction, 2 / 3);
  assert.equal(bossProgress(boss).phase, 2);
  boss.bossLives = 0; assert.equal(bossProgress(boss).fraction, 0);
});
check('compact HUD preference validates and persists without changing assists', () => {
  const data = new Map(); const storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  const settings = new SettingsStore(storage);
  assert.equal(settings.get('compactHud'), false);
  assert(settings.set('compactHud', true));
  const reload = new SettingsStore(storage);
  assert.equal(reload.get('compactHud'), true); assert.equal(reload.get('assist'), 0);
  assert.equal(reload.set('compactHud', 'invalid'), false);
});
check('cooldown rejection gives immediate remaining time without changing score, damage, or ready time', () => {
  const messages = [];
  const state = { stateMachine: { getCurrentStateName: () => 'PLAYING' }, resumeCountdown: 0, metrics: { spellsCast: 0 },
    uiManager: { meta: { isUpgradeOpen: () => false }, showCombatFeedback: (...args) => messages.push(args) },
    runConfiguration: { values: { spells: { cooldownSeconds: 2 } } }, _configurationTime: 5,
    _spellReadyAt: { horizontal: 6.5 }, score: 123, player: { hp: 4 }, comboCount: 7 };
  Game.prototype.executeSpell.call(state, { gesture: 'horizontal', score: 1 });
  assert.match(messages[0][0], /HỒI CHIÊU · 1.5s/);
  assert.equal(state._spellReadyAt.horizontal, 6.5); assert.equal(state.score, 123);
  assert.equal(state.player.hp, 4); assert.equal(state.comboCount, 7);
});
check('resume provides three full seconds and input stays disabled until complete', () => {
  const digits = []; const enabled = [];
  const state = { uiManager: { meta: { setCountdown: n => digits.push(n) } }, inputHandler: { setEnabled: n => enabled.push(n) }, audioSystem: { resumeBGM() {} } };
  Game.prototype.beginResumeCountdown.call(state);
  assert.equal(state.resumeCountdown, 3); assert.deepEqual(enabled, [false]);
  assert(Game.prototype.tickResumeCountdown.call(state, 1));
  assert(Game.prototype.tickResumeCountdown.call(state, 1));
  assert.equal(Game.prototype.tickResumeCountdown.call(state, 1), false);
  assert.deepEqual(digits, [3, 2, 1, 0]); assert.deepEqual(enabled, [false, true]);
});
check('the game cooldown clock freezes during pause and the full resume countdown', () => {
  let state = 'PAUSE';
  const game = { stateMachine: { getCurrentStateName: () => state, update() {} }, _configurationTime: 10, resumeCountdown: 0 };
  Game.prototype.update.call(game, 1); assert.equal(game._configurationTime, 10);
  state = 'PLAYING'; game.resumeCountdown = 2;
  Game.prototype.update.call(game, 1); assert.equal(game._configurationTime, 10);
  game.resumeCountdown = 0;
  Game.prototype.update.call(game, .5); assert.equal(game._configurationTime, 10.5);
});
function element() {
  const classes = new Set();
  return { textContent: '', attrs: {}, style: {}, children: [], classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
    setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(child) { this.children.push(child); } };
}
const nodes = new Map();
globalThis.document = { getElementById: id => nodes.get(id) || null, createElement: element };
check('Perfect Cast and multiple targets share one feedback message; latest failure replaces it', () => {
  const ui = Object.create(UIManager.prototype);
  ui.game = { settings: { get: () => false } }; ui.gestureFeedback = element();
  ui.showGestureFeedback('horizontal', .99, true, null, null, { perfect: true, targets: 4 });
  assert.match(ui.gestureFeedback.textContent, /PERFECT CAST.*4 MỤC TIÊU/);
  ui.showGestureFeedback(null, .2, false, null, { reason: 'unrecognized' });
  assert.match(ui.gestureFeedback.textContent, /KHÔNG KHỚP/);
  ui.updateGameplayFeedback(2.4); assert.equal(ui.gestureFeedback.classList.contains('show'), false);
});
check('HUD reflects cooldown, invulnerability, wave and boss values without mutating mechanics', () => {
  for (const id of ['health-value', 'hearts-container', 'player-protection', 'wave-progress', 'boss-status', 'boss-label', 'boss-meter', 'boss-fill', 'combat-readout', 'threat-cue', 'game-notices', 'combat-alert', 'spell-cooldowns']) nodes.set(id, element());
  const boss = ghost({ isBoss: true, maxBossLives: 2, bossLives: 2, bossPhases: [['horizontal', 'vertical']], symbolQueue: ['horizontal', 'vertical'] });
  const game = { player: { ...player, hp: 1, maxHp: 5, isInvulnerable: true, invulnerableTimer: 1.25 }, enemies: [boss], width: 400, height: 300,
    waveSystem: { currentWave: 2, totalEnemiesInWave: 12, enemiesSpawnedInWave: 5 },
    runConfiguration: { values: { spells: { cooldownSeconds: 2 } } }, _configurationTime: 5, _spellReadyAt: { horizontal: 6 },
    combat: { rules: { flags: { spellLoadout: true }, loadout: ['horizontal', 'vertical'] } } };
  const hud = new GameplayHUD(game); hud.update();
  assert.equal(nodes.get('health-value').textContent, 'HP 1/5');
  assert.equal(nodes.get('player-protection').textContent, '🛡 1.3s');
  assert.equal(nodes.get('boss-meter').attrs['aria-valuenow'], '100');
  assert.equal(hud.cooldowns.get('horizontal').textContent, '— 1.0s');
  assert.match(hud.cooldowns.get('vertical').textContent, /✓/);
  game._configurationTime = 6; game.player.isInvulnerable = false; game.enemies = []; hud.update();
  assert.equal(nodes.get('player-protection').textContent, '');
  assert.match(hud.cooldowns.get('horizontal').textContent, /✓/);
  assert.equal(nodes.get('wave-progress').textContent, 'ĐỢT 2 · CÒN 7');
  assert.equal(game._spellReadyAt.horizontal, 6); assert.equal(game.player.hp, 1);
});
check('crowd and reduced effects reduce particles while retaining hit feedback', () => {
  const ps = new ParticleSystem(300);
  ps.emitHitBurst(0, 0, '#fff', 16); const normal = ps.activeParticleCount;
  ps.clear(); ps.feedbackDensity = .25; ps.emitHitBurst(0, 0, '#fff', 16);
  assert(ps.activeParticleCount > 0 && ps.activeParticleCount < normal);
  ps.clear(); ps.feedbackDensity = .5; ps.emitMonsterDeathExplosion(0, 0, 'REGULAR');
  assert(ps.activeParticleCount > 0);
});
check('enemy pool reuse clears the selected urgent marker', () => {
  const e = new Enemy({ type: 'REGULAR', symbolQueue: ['horizontal'] });
  e.feedbackUrgent = true; e.feedbackCompact = true; e.init({ type: 'REGULAR', symbolQueue: ['vertical'] });
  assert.equal(e.feedbackUrgent, false); assert.equal(e.feedbackCompact, false);
});
delete globalThis.document;
console.log(`${checks} passed`);
