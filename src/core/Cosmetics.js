/**
 * @file Cosmetics.js
 * @description Cosmetic rewards: ink-trail colours and hats for Momo. They change how the game looks, never
 * how it plays. Every cosmetic is unlocked by something the player has already done (an achievement, a
 * daily-challenge streak, a Boss Rush clear, a live-event reward), so ownership is a pure function of ProgressStore and nothing
 * extra has to be stored besides what is equipped and which unlocks the player has been told about.
 *
 * Pure data and logic (no DOM, no canvas): drawing the hats lives in entities/Hats.js.
 */

/**
 * @typedef {Object} CosmeticUnlock
 * @property {string} [achievement] achievement id that unlocks it
 * @property {number} [streak] best daily-challenge streak (days) that unlocks it
 * @property {string} [stat] ProgressStore stat name ...
 * @property {number} [atLeast] ... that must reach this value
 */

/**
 * @typedef {Object} CosmeticDef
 * @property {string} id
 * @property {string} icon
 * @property {string} name
 * @property {CosmeticUnlock|null} unlock null = owned from the start
 * @property {string} hint shown while locked
 * @property {Object} [colors] trail colours: `glow` (fading strokes / outer glow), `active`, `mid`
 * @property {boolean} [rainbow] trail cycles through the hues
 */

/** @type {CosmeticDef[]} */
export const TRAILS = [
  {
    id: 'arcane', icon: '🔮', name: 'Tím Huyền Ảo', unlock: null, hint: '',
    colors: { glow: '#a855f7', active: '#e879f9', mid: '#f472b6' }
  },
  {
    id: 'gold', icon: '🌟', name: 'Kim Quang', unlock: { achievement: 'score_10k' },
    hint: 'Đạt 10.000 điểm trong một lượt chơi',
    colors: { glow: '#f59e0b', active: '#fbbf24', mid: '#fde68a' }
  },
  {
    id: 'frost', icon: '❄️', name: 'Băng Tinh', unlock: { achievement: 'freeze_10' },
    hint: 'Đóng băng u linh 10 lần',
    colors: { glow: '#0ea5e9', active: '#38bdf8', mid: '#bae6fd' }
  },
  {
    id: 'ember', icon: '🔥', name: 'Lửa Than', unlock: { achievement: 'combo_10' },
    hint: 'Đạt chuỗi combo 10',
    colors: { glow: '#ea580c', active: '#fb923c', mid: '#fdba74' }
  },
  {
    id: 'rose', icon: '🌸', name: 'Hoa Hồng', unlock: { achievement: 'heal_20' },
    hint: 'Hồi máu tổng cộng 20 lần',
    colors: { glow: '#e11d48', active: '#fb7185', mid: '#fecdd3' }
  },
  {
    id: 'aurora', icon: '🌌', name: 'Cực Quang', unlock: { streak: 7 },
    hint: 'Chơi Thử Thách Hằng Ngày 7 ngày liên tiếp',
    colors: { glow: '#059669', active: '#34d399', mid: '#a7f3d0' }
  },
  {
    id: 'lumen', icon: '🌠', name: 'Ánh Sao Lumen', unlock: { achievement: 'true_ending' },
    hint: 'Xem Hồi Kết Thật của Cốt Truyện',
    colors: { glow: '#38bdf8', active: '#fef08a', mid: '#ffffff' }
  },
  {
    id: 'rainbow', icon: '🌈', name: 'Cầu Vồng', unlock: { streak: 14 },
    hint: 'Chơi Thử Thách Hằng Ngày 14 ngày liên tiếp',
    colors: { glow: '#a855f7', active: '#e879f9', mid: '#f472b6' }, rainbow: true
  }
];

/** @type {CosmeticDef[]} */
export const HATS = [
  { id: 'none', icon: '🐱', name: 'Không Đội', unlock: null, hint: '' },
  {
    id: 'party', icon: '🎉', name: 'Nón Tiệc', unlock: { achievement: 'daily_first' },
    hint: 'Hoàn thành một Thử Thách Hằng Ngày'
  },
  {
    id: 'bow', icon: '🎀', name: 'Nơ Hồng', unlock: { streak: 3 },
    hint: 'Chơi Thử Thách Hằng Ngày 3 ngày liên tiếp'
  },
  {
    id: 'wizard', icon: '🧙', name: 'Mũ Sao Pháp Sư', unlock: { achievement: 'phrase_first' },
    hint: 'Niệm thành công một Câu Thần Chú'
  },
  {
    id: 'halo', icon: '😇', name: 'Vầng Hào Quang', unlock: { streak: 7 },
    hint: 'Chơi Thử Thách Hằng Ngày 7 ngày liên tiếp'
  },
  {
    id: 'crown', icon: '👑', name: 'Vương Miện', unlock: { achievement: 'story_clear' },
    hint: 'Hoàn thành Cốt Truyện'
  },
  {
    id: 'horns', icon: '😈', name: 'Sừng Quỷ Nhỏ', unlock: { achievement: 'rush_clear' },
    hint: 'Vượt qua Boss Rush'
  },
  {
    id: 'knight', icon: '🛡️', name: 'Mũ Hiệp Sĩ Lumen', unlock: { achievement: 'true_ending' },
    hint: 'Xem Hồi Kết Thật của Cốt Truyện'
  }
];

export const DEFAULT_TRAIL = 'arcane';
export const DEFAULT_HAT = 'none';

/** Daily-streak milestones that hand out rewards (shown in the Daily screen) */
export const STREAK_MILESTONES = [3, 7, 14];

const BY_ID = {
  trail: Object.fromEntries(TRAILS.map(t => [t.id, t])),
  hat: Object.fromEntries(HATS.map(h => [h.id, h]))
};

/** @param {'trail'|'hat'} kind */
export function getCosmetic(kind, id) {
  return (BY_ID[kind] && BY_ID[kind][id]) || null;
}

/** @param {'trail'|'hat'} kind */
export function listCosmetics(kind) {
  return kind === 'hat' ? HATS : TRAILS;
}

/** The trail definition to draw with (falls back to the default one) */
export function getTrail(id) {
  return BY_ID.trail[id] || BY_ID.trail[DEFAULT_TRAIL];
}

/**
 * @param {CosmeticDef} def
 * @param {import('./ProgressStore.js').ProgressStore} store
 * @returns {boolean}
 */
export function isCosmeticUnlocked(def, store) {
  if (!def) return false;
  const u = def.unlock;
  if (!u) return true;
  // An event reward owns the item whatever else it asks for (the store validated the grant)
  const kind = BY_ID.trail[def.id] === def ? 'trail' : 'hat';
  if (typeof store.hasEventCosmetic === 'function' && store.hasEventCosmetic(`${kind}:${def.id}`)) return true;
  if (u.achievement) return store.isUnlocked(u.achievement);
  if (u.streak) return store.data.stats.bestDailyStreak >= u.streak;
  if (u.stat) return (store.data.stats[u.stat] || 0) >= (u.atLeast || 1);
  return false;
}

/**
 * Mark every cosmetic that has become available since the last call as "announced".
 * @param {import('./ProgressStore.js').ProgressStore} store
 * @returns {Array<CosmeticDef & {kind: 'trail'|'hat'}>} the ones that are new (the caller tells the player)
 */
export function evaluateCosmetics(store) {
  const fresh = [];
  for (const kind of ['trail', 'hat']) {
    for (const def of listCosmetics(kind)) {
      if (!def.unlock) continue;
      if (store.isCosmeticSeen(def.id)) continue;
      if (isCosmeticUnlocked(def, store)) {
        store.markCosmeticSeen(def.id);
        fresh.push({ ...def, kind });
      }
    }
  }
  if (fresh.length > 0) store.save();
  return fresh;
}

/**
 * Trail colours for this frame. The rainbow trail walks the hue wheel with time.
 * @param {CosmeticDef} trail
 * @param {number} seconds
 * @returns {{glow: string, active: string, mid: string}}
 */
export function trailColors(trail, seconds = 0) {
  if (trail && trail.rainbow) {
    const h = Math.floor((seconds * 140) % 360);
    return {
      glow: `hsl(${(h + 300) % 360}, 90%, 55%)`,
      active: `hsl(${h}, 95%, 65%)`,
      mid: `hsl(${(h + 40) % 360}, 95%, 75%)`
    };
  }
  return (trail && trail.colors) || BY_ID.trail[DEFAULT_TRAIL].colors;
}
