/**
 * @file Companions.js
 * @description Academy companions you can bring on a run. Each one has a small passive, unlocked by
 * clearing a Story level for the first time. Momo is always available.
 *
 * A passive is a plain object of numeric bonuses (see `effects`). UpgradeState merges the active
 * companion's effects with the run upgrades, so the rest of the game only reads one set of numbers.
 */

export const DEFAULT_COMPANION = 'momo';

/**
 * @typedef {Object} CompanionDef
 * @property {string} id Matches ACADEMY_CHARACTERS ids (so portraits / lore can be reused)
 * @property {string} passive Short name of the passive ability
 * @property {string} desc What the passive does, in plain words
 * @property {number} unlockLevel Story level that must be cleared (0 = available from the start)
 * @property {Object} effects Numeric bonuses merged into UpgradeState
 * @property {number} [effects.comboTime] Extra seconds a combo survives
 * @property {number} [effects.shield] Free missed strokes per level/wave
 * @property {number} [effects.freeze] Extra seconds of Frost Nova
 * @property {number} [effects.iframes] Extra invulnerable seconds after being hit
 * @property {number} [effects.healEvery] Heal 1 heart after every N cleared levels/waves
 */

/** @type {Object<string, CompanionDef>} */
export const COMPANIONS = {
  momo: {
    id: 'momo', unlockLevel: 0,
    passive: 'Nhịp Điệu Của Momo',
    desc: 'Chuỗi combo được giữ lâu hơn +0.3 giây.',
    effects: { comboTime: 0.3 }
  },
  oliver: {
    id: 'oliver', unlockLevel: 1,
    passive: 'Súp Bánh Quy',
    desc: 'Hồi 1 tim sau mỗi 2 màn/đợt hoàn thành.',
    effects: { healEvery: 2 }
  },
  luna: {
    id: 'luna', unlockLevel: 2,
    passive: 'Sao Băng Trường Tồn',
    desc: 'Băng Giá kéo dài thêm +1 giây.',
    effects: { freeze: 1.0 }
  },
  nyx: {
    id: 'nyx', unlockLevel: 3,
    passive: 'Khinh Công Tam Thể',
    desc: 'Sau khi trúng đòn, bất tử thêm +0.4 giây.',
    effects: { iframes: 0.4 }
  },
  barnaby: {
    id: 'barnaby', unlockLevel: 4,
    passive: 'Phong Ấn Viện Trưởng',
    desc: 'Mỗi màn/đợt, bỏ qua 1 nét vẽ sai mà không vỡ combo.',
    effects: { shield: 1 }
  }
};

/** Display order in the companions screen */
export const COMPANION_ORDER = ['momo', 'oliver', 'luna', 'nyx', 'barnaby'];

/**
 * @param {string} id
 * @returns {CompanionDef}
 */
export function getCompanion(id) {
  return COMPANIONS[id] || COMPANIONS[DEFAULT_COMPANION];
}

/**
 * @param {string} id
 * @param {{ isLevelCleared: (n: number) => boolean }} store ProgressStore
 * @returns {boolean}
 */
export function isCompanionUnlocked(id, store) {
  const def = COMPANIONS[id];
  if (!def) return false;
  return def.unlockLevel === 0 || store.isLevelCleared(def.unlockLevel);
}

/** @returns {string[]} ids of every unlocked companion, in display order */
export function unlockedCompanions(store) {
  return COMPANION_ORDER.filter(id => isCompanionUnlocked(id, store));
}

/**
 * Companions that become available because `level` was just cleared for the first time.
 * @param {number} level Story level (1..5)
 * @returns {CompanionDef[]}
 */
export function companionsUnlockedByLevel(level) {
  return COMPANION_ORDER.map(id => COMPANIONS[id]).filter(def => def.unlockLevel === level);
}
