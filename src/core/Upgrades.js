/**
 * @file Upgrades.js
 * @description Run-scoped upgrades the player picks between stages (Story) or every few waves (Endless).
 *
 * Upgrades live only for the current run: UpgradeState is reset when a run starts. Each upgrade is
 * data (id, text, max stacks, availability) plus a small `apply` hook for the ones that change state
 * immediately (heal, max HP). Passive effects are read by Game through the derived getters below, so
 * there is exactly one place that knows what each upgrade means numerically.
 */

/** Endless Mode offers an upgrade after every Nth wave */
export const ENDLESS_UPGRADE_EVERY = 3;
/** Hearts never exceed this many, so the HUD row still fits on a phone */
export const MAX_HP_CAP = 6;

/**
 * @typedef {Object} UpgradeDef
 * @property {string} id
 * @property {string} icon
 * @property {string} name
 * @property {string} desc Text for the card, may include {n} for the next stack's value
 * @property {number} max Maximum stacks in one run
 * @property {(ctx: {hp: number, maxHp: number}) => boolean} [available] extra offer condition
 * @property {(player: object) => void} [apply] instant effect applied when picked
 */

/** @type {Object<string, UpgradeDef>} */
export const UPGRADES = {
  combo_time: {
    id: 'combo_time', icon: '⏳', name: 'Nhịp Thở Dài', max: 3,
    desc: 'Chuỗi combo được giữ lâu hơn +0.6 giây.'
  },
  combo_shield: {
    id: 'combo_shield', icon: '🛡️', name: 'Lá Chắn Combo', max: 2,
    desc: 'Mỗi màn/đợt, bỏ qua 1 nét vẽ sai mà không bị vỡ combo.'
  },
  heal: {
    id: 'heal', icon: '💖', name: 'Ánh Sáng Chữa Lành', max: 99,
    desc: 'Hồi ngay 1 tim.',
    available: ({ hp, maxHp }) => hp < maxHp,
    apply: (player) => { player.heal(1); }
  },
  max_hp: {
    id: 'max_hp', icon: '❤️', name: 'Trái Tim Kiên Cường', max: 1,
    desc: `Tối đa +1 tim (tối đa ${MAX_HP_CAP}) và hồi đầy tim mới.`,
    available: ({ maxHp }) => maxHp < MAX_HP_CAP,
    apply: (player) => {
      if (player.maxHp < MAX_HP_CAP) {
        player.maxHp += 1;
        player.hp = Math.min(player.maxHp, player.hp + 1);
      }
    }
  },
  score_boost: {
    id: 'score_boost', icon: '✨', name: 'Vận May Điểm Số', max: 3,
    desc: 'Mọi điểm nhận được +15%.'
  },
  iframes: {
    id: 'iframes', icon: '🌟', name: 'Hào Quang Hộ Thân', max: 2,
    desc: 'Sau khi trúng đòn, bất tử thêm +0.5 giây.'
  },
  frost_long: {
    id: 'frost_long', icon: '❄️', name: 'Băng Giá Vĩnh Cửu', max: 2,
    desc: 'Băng Giá kéo dài thêm +1.5 giây.'
  },
  gale_strong: {
    id: 'gale_strong', icon: '🌀', name: 'Cuồng Phong Dữ Dội', max: 2,
    desc: 'Cuồng Phong đẩy lùi xa hơn +30%.'
  },
  slow_ghosts: {
    id: 'slow_ghosts', icon: '🐌', name: 'Bùa Chậm Chạp', max: 3,
    desc: 'U linh mới xuất hiện di chuyển chậm hơn 7%.'
  }
};

export class UpgradeState {
  constructor() {
    this.stacks = {};
    this.shieldCharges = 0;
    /** Passive bonuses of the equipped companion (see Companions.js); survives reset() */
    this.companion = {};
  }

  /** Forget the upgrades picked this run. The equipped companion stays equipped. */
  reset() {
    this.stacks = {};
    this.shieldCharges = this.shieldLimit;
  }

  /**
   * Equip a companion's passive bonuses.
   * @param {Object} [effects] `effects` object of a CompanionDef
   */
  setCompanionEffects(effects) {
    this.companion = { ...(effects || {}) };
    this.shieldCharges = this.shieldLimit;
  }

  count(id) {
    return this.stacks[id] || 0;
  }

  /** Total upgrades picked this run */
  total() {
    return Object.values(this.stacks).reduce((a, b) => a + b, 0);
  }

  /**
   * Record a pick. Instant effects (apply) are the caller's job, because they need the player.
   * @returns {boolean} false if the id is unknown or already at max stacks
   */
  add(id) {
    const def = UPGRADES[id];
    if (!def || this.count(id) >= def.max) return false;
    this.stacks[id] = this.count(id) + 1;
    if (id === 'combo_shield') this.shieldCharges = this.shieldLimit;
    return true;
  }

  // --- derived effect values -------------------------------------------------

  /** Extra seconds added to the combo decay window */
  get comboTimeBonus() { return this.count('combo_time') * 0.6 + (this.companion.comboTime || 0); }

  /** Free misses per level/wave */
  get shieldLimit() { return this.count('combo_shield') + (this.companion.shield || 0); }

  /** Multiplier on every score gain */
  get scoreMultiplier() { return 1 + this.count('score_boost') * 0.15; }

  /** Extra invulnerability seconds after being hit */
  get invulnerableBonus() { return this.count('iframes') * 0.5 + (this.companion.iframes || 0); }

  /** Extra seconds of Frost Nova */
  get freezeBonus() { return this.count('frost_long') * 1.5 + (this.companion.freeze || 0); }

  /** Heal one heart after every N cleared levels/waves (0 = never) */
  get healEvery() { return this.companion.healEvery || 0; }

  /** Multiplier on Gale Shockwave push force */
  get galeMultiplier() { return 1 + this.count('gale_strong') * 0.3; }

  /** Multiplier on the speed of ghosts that spawn from now on */
  get enemySpeedScale() { return Math.pow(0.93, this.count('slow_ghosts')); }

  /** Refill the combo shield (called when a new level / wave starts) */
  refillShield() {
    this.shieldCharges = this.shieldLimit;
  }

  /**
   * Spend one shield charge if there is one.
   * @returns {boolean} true if a miss was forgiven
   */
  consumeShield() {
    if (this.shieldCharges <= 0) return false;
    this.shieldCharges -= 1;
    return true;
  }
}

/**
 * Pick up to `count` distinct upgrades the player can still use.
 * @param {UpgradeState} state
 * @param {{hp: number, maxHp: number}} ctx current player status
 * @param {number} [count=3]
 * @param {() => number} [rng=Math.random] injectable for tests
 * @returns {UpgradeDef[]}
 */
export function rollUpgradeChoices(state, ctx, count = 3, rng = Math.random) {
  const pool = Object.values(UPGRADES).filter(def => {
    if (state.count(def.id) >= def.max) return false;
    return def.available ? def.available(ctx) : true;
  });

  // Fisher-Yates shuffle, then take the first `count`
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/**
 * Should an upgrade be offered after this completion event?
 * @param {'STORY'|'ENDLESS'} mode
 * @param {number} index Story: the level just cleared (1..5). Endless: the wave just cleared.
 * @returns {boolean}
 */
export function shouldOfferUpgrade(mode, index) {
  if (mode === 'ENDLESS') return index > 0 && index % ENDLESS_UPGRADE_EVERY === 0;
  // Story: after levels 1-4. Clearing level 5 ends the campaign, so there is nothing to prepare for.
  return index >= 1 && index <= 4;
}
