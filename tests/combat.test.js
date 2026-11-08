import assert from 'node:assert/strict';
import { CombatSystem, comboMultiplier, tickCombo, evaluatePerfect } from '../src/combat/CombatSystem.js';
import { StatusEffects } from '../src/combat/StatusEffects.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Player } from '../src/entities/Player.js';

const enemy = (runes = ['horizontal', 'horizontal']) => new Enemy({ symbolQueue: [...runes], x: 100, y: 100 });
const combat = new CombatSystem();
const events = [];
combat.onEvent(e => events.push(e));
let target = enemy();
let cast = combat.beginCast({ gesture: 'horizontal', score: 1 }, 0.5);
assert.equal(cast.perfect, false);
assert.equal(combat.hit(cast, target).matched, true);
assert.equal(combat.hit(cast, target).matched, false);
assert.equal(target.symbolQueue.length, 1);
assert.equal(combat.hit(cast, enemy()).matched, true);
assert.deepEqual(events.map(e => e.type), ['cast:started', 'hit:before', 'hit:resolved', 'hit:before', 'hit:resolved']);
assert.deepEqual(events.map(e => e.sequence), [1, 2, 3, 4, 5]);
const oldGeneration = target.combatGeneration;
target.init({ symbolQueue: ['horizontal'] });
assert.equal(combat.hit(cast, target, oldGeneration).matched, false);
assert.equal(target.symbolQueue.length, 1);
assert.equal(combat.hit(cast, target).destroyed, true);
const repeat = new CombatSystem({ damage: { allowRepeat: true } });
target = enemy(); cast = repeat.beginCast({ gesture: 'horizontal' });
assert(repeat.hit(cast, target).matched && repeat.hit(cast, target).destroyed);
const double = new CombatSystem({ damage: { runes: 2 } });
assert(double.hit(double.beginCast({ gesture: 'horizontal' }), enemy()).destroyed);
assert.equal(combat.score(100, 2, 1.25), 250);
assert.equal(comboMultiplier(4), 1); assert.equal(comboMultiplier(5), 2);
assert.equal(comboMultiplier(35), 5);
assert.deepEqual(tickCombo(5, 1, 1), { count: 0, timer: 0, multiplier: 1 });
assert.equal(tickCombo(5, 1, 0).timer, 1); // paused simulation
assert.equal(comboMultiplier(3, [{ min: 1, max: 5, mult: 7 }]), 7);
const thresholds = { minScore: 0.92, maxDuration: 1.5 };
assert(evaluatePerfect({ score: 0.92 }, 1.5, thresholds));
for (const [result, duration] of [[{ score: 0.91 }, 1], [{ score: 1 }, 1.51], [{ score: 1, synthetic: true }, 0], [{ score: 1 }, NaN]]) {
  assert.equal(evaluatePerfect(result, duration, thresholds), false);
}
const effects = new StatusEffects({ haste: { speedMultiplier: 2 } });
assert.equal(effects.apply('unknown', 1), false);
effects.apply('slow', 2); effects.apply('slow', 1);
assert.equal(effects.active.get('slow').remaining, 2);
effects.apply('haste', 1); assert.equal(effects.speedMultiplier, 1);
effects.tick(1); assert.equal(effects.speedMultiplier, 0.5);
effects.tick(0); assert.equal(effects.active.get('slow').remaining, 1);
effects.tick(1); assert.equal(effects.speedMultiplier, 1);
effects.apply('stun', 2); effects.clear(); assert.equal(effects.active.size, 0);
const player = new Player(800, 600);
assert(combat.damagePlayer(player));
const hp = player.hp;
assert.equal(combat.damagePlayer(player), false);
player.update(0, []); assert.equal(player.hp, hp); assert(player.isInvulnerable);
player.update(10, []); assert(combat.damagePlayer(player));
const features = new CombatSystem({ flags: { perfectCast: true, elementalInteraction: true, chainReaction: true, eliteModifiers: true } });
const featureEvents = []; features.onEvent(e => featureEvents.push(e.type));
cast = features.beginCast({ gesture: 'lightning', score: 1 }, 1);
assert(cast.perfect);
target = enemy(['lightning', 'vertical']); target.freeze(2);
assert(features.hit(cast, target).matched);
assert.equal(target.statusEffects.speedMultiplier, 0);
assert(features.hit(cast, enemy(['lightning'])).destroyed);
assert(featureEvents.includes('chain:reaction'));
assert(featureEvents.includes('element:reaction'));
target = enemy(); target.eliteModifier = 'armored';
assert.equal(features.hit(features.beginCast({ gesture: 'horizontal' }), target).matched, false);
assert(features.hit(features.beginCast({ gesture: 'horizontal' }), target).matched);
target.init({ symbolQueue: ['horizontal'] }); assert.equal(target.statusEffects.active.size, 0); assert.equal(target.eliteBlocks, 0);
const loadout = new CombatSystem({ flags: { spellLoadout: true }, loadout: ['vertical'] });
assert.equal(loadout.beginCast({ gesture: 'horizontal' }), null);
assert(loadout.beginCast({ gesture: 'vertical' }));
assert(loadout.beginCast({ gesture: 'horizontal' }, NaN, true)); // secret spells bypass loadout
console.log('Combat damage, scoring, combo, invulnerability, pooling, status and feature flag tests passed.');

// Exercise the actual state boundary: pause and resume countdown freeze simulation.
const { PlayingState, PauseState } = await import('../src/core/StateMachine.js');
const { Game } = await import('../src/core/Game.js');
const timedPlayer = new Player(800, 600);
combat.grantInvulnerability(timedPlayer, 2);
const timedEffects = new StatusEffects(); timedEffects.apply('stun', 2);
let countdown = true;
const simulation = {
  comboCount: 5, comboTimer: 2, comboDecayTime: 2.4,
  combat, player: timedPlayer, _combatFizzleDelay: 0.14,
  audioSystem: { playFizzle() { simulation.fizzles++; }, playCombo() {} },
  particleSystem: { emitFloatingText() {} }, fizzles: 0,
  tickResumeCountdown: () => countdown, advanceEffects: dt => dt,
  updatePlaying(dt) {
    timedPlayer.update(dt, []); timedEffects.tick(dt);
    this.comboTimer = tickCombo(this.comboCount, this.comboTimer, dt).timer;
    Game.prototype._tickCombatFeedback.call(this, dt);
  }
};
new PauseState(simulation).update(10);
new PlayingState(simulation).update(10);
assert.equal(timedPlayer.invulnerableTimer, 2);
assert.equal(timedEffects.active.get('stun').remaining, 2);
assert.equal(simulation.comboTimer, 2);
assert.equal(simulation._combatFizzleDelay, 0.14);
assert.equal(simulation.fizzles, 0);
countdown = false; new PlayingState(simulation).update(0.2);
assert.equal(simulation.fizzles, 1);
assert.equal(simulation.comboTimer, 1.8);
assert.equal(timedEffects.active.get('stun').remaining, 1.8);
assert.equal(timedPlayer.invulnerableTimer, 1.8);
assert.throws(() => new CombatSystem({ damage: { runes: Infinity } }), RangeError);
console.log('Pause and resume combat timer boundary tests passed.');
