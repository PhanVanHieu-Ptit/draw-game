import { COMBO_CONFIG, RUNES } from '../core/Constants.js';

export const COMBAT_DEFAULTS = {
  flags: { perfectCast: false, chainReaction: false, elementalInteraction: false, spellLoadout: false, eliteModifiers: false },
  perfect: { minScore: 0.92, maxDuration: 1.5, scoreMultiplier: 1.5 },
  damage: { runes: 1, player: 1, allowRepeat: false },
  scoring: { multiplier: 1, chainBonus: 25 },
  combo: { tiers: COMBO_CONFIG.TIERS, warningFraction: 0.25 },
  loadout: Object.keys(RUNES),
  elements: { lightning: 'lightning', circle: 'ice', spiral: 'wind' },
  interactions: { 'ice:lightning': { status: 'stun', duration: 0.6 } },
  elite: { armored: { blockedHits: 1 }, swift: { speedMultiplier: 1.2 } }
};

export function comboMultiplier(count, tiers = COMBO_CONFIG.TIERS) {
  return tiers.find(t => count >= t.min && count <= t.max)?.mult ?? 1;
}
export function tickCombo(count, timer, dt) {
  const remaining = Math.max(0, timer - Math.max(0, dt));
  return { count: remaining > 0 ? count : 0, timer: remaining, multiplier: remaining > 0 ? comboMultiplier(count) : 1 };
}
export function evaluatePerfect(result, duration, thresholds) {
  return !result.synthetic && Number.isFinite(result.score) && result.score >= thresholds.minScore &&
    Number.isFinite(duration) && duration <= thresholds.maxDuration && duration >= 0;
}

/** Synchronous ordered events. Casts own their hit ledger; no global per-frame event history. */
export class CombatSystem {
  constructor(options = {}) {
    this.rules = { ...COMBAT_DEFAULTS, ...options };
    for (const key of ['flags', 'perfect', 'damage', 'scoring', 'combo', 'elements', 'interactions', 'elite']) {
      this.rules[key] = { ...COMBAT_DEFAULTS[key], ...options[key] };
    }
    this.rules.loadout = [...this.rules.loadout];
    this.rules.combo.tiers = this.rules.combo.tiers.map(tier => ({ ...tier }));
    for (const key of ['runes', 'player']) {
      const amount = this.rules.damage[key];
      if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) throw new RangeError(`Invalid ${key} damage`);
    }
    this.listeners = new Set();
    this.sequence = 0;
    this.castSequence = 0;
  }
  onEvent(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(type, data = {}) {
    const event = Object.freeze({ ...data, type, sequence: ++this.sequence });
    for (const listener of this.listeners) listener(event);
    return event;
  }
  beginCast(result, duration, internal = false) {
    if (!RUNES[result.gesture] || (!internal && this.rules.flags.spellLoadout && !this.rules.loadout.includes(result.gesture))) return null;
    const cast = { id: ++this.castSequence, gesture: result.gesture, hits: new WeakMap(), hitCount: 0,
      perfect: this.rules.flags.perfectCast && evaluatePerfect(result, duration, this.rules.perfect) };
    this.emit('cast:started', { cast });
    return cast;
  }
  score(points, ...multipliers) {
    return Math.max(0, Math.round(points * this.rules.scoring.multiplier * multipliers.reduce((a, b) => a * b, 1)));
  }
  heal(player, amount = 1) {
    const applied = player.heal(amount);
    this.emit('player:healed', { player, amount: applied ? amount : 0 });
    return applied;
  }
  grantInvulnerability(player, seconds) {
    player.invulnerableTimer = Math.max(player.invulnerableTimer, seconds);
    player.isInvulnerable = true;
    this.emit('player:protected', { player, seconds: player.invulnerableTimer });
  }
  damagePlayer(player) {
    const applied = player.takeDamage(this.rules.damage.player);
    this.emit(applied ? 'player:damaged' : 'player:blocked', { player });
    return applied;
  }
  hit(cast, enemy, generation = enemy.combatGeneration) {
    const miss = { matched: false, destroyed: false };
    if (!cast || enemy.isDead || generation !== enemy.combatGeneration) return miss;
    if (!this.rules.damage.allowRepeat && cast.hits.get(enemy) === generation) return miss;
    // Reserve before calling entity code, including blocked and failed hits.
    cast.hits.set(enemy, generation);
    this.emit('hit:before', { cast, enemy });
    const elite = this.rules.flags.eliteModifiers && this.rules.elite[enemy.eliteModifier];
    if (elite?.blockedHits && enemy.eliteBlocks < elite.blockedHits) {
      enemy.eliteBlocks++;
      this.emit('hit:blocked', { cast, enemy });
      return miss;
    }
    let result = miss;
    for (let i = 0; i < this.rules.damage.runes; i++) {
      const next = enemy.takeHit(cast.gesture);
      if (!next.matched) break;
      result = next;
      if (next.destroyed || next.isPhaseComplete) break;
    }
    if (result.matched) {
      cast.hitCount++;
      if (this.rules.flags.elementalInteraction) {
        const element = this.rules.elements[cast.gesture];
        const previous = enemy.isFrozen ? 'ice' : enemy.combatElement;
        const reaction = this.rules.interactions[`${previous}:${element}`];
        if (reaction) {
          enemy.statusEffects?.apply(reaction.status, reaction.duration);
          this.emit('element:reaction', { cast, enemy, reaction });
        }
        if (element) enemy.combatElement = element;
      }
      this.emit('hit:resolved', { cast, enemy, result });
      if (this.rules.flags.chainReaction && cast.hitCount > 1) this.emit('chain:reaction', { cast, enemy, bonus: this.rules.scoring.chainBonus });
    }
    return result;
  }
}
