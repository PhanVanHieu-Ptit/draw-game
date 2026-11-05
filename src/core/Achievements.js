/**
 * @file Achievements.js
 * @description Achievement definitions, the bestiary (enemy collection) and the evaluator.
 *
 * Every achievement is a pure function of the lifetime counters in ProgressStore, so there is no
 * hidden state: `progress(store)` returns the current value, the achievement is earned once it
 * reaches `target`. Game calls evaluateAchievements() after meaningful events and shows a toast
 * for each newly earned one.
 */

import { ENEMY_TYPES, RUNES } from './Constants.js';
import { COMPANION_ORDER, isCompanionUnlocked } from './Companions.js';

/**
 * @typedef {Object} AchievementDef
 * @property {string} id
 * @property {string} icon
 * @property {string} name
 * @property {string} desc
 * @property {number} target
 * @property {(store: import('./ProgressStore.js').ProgressStore) => number} progress
 */

/** @type {AchievementDef[]} */
export const ACHIEVEMENTS = [
  // --- Combat ----------------------------------------------------------
  {
    id: 'first_blood', icon: '🪄', name: 'Nét Bút Đầu Tiên',
    desc: 'Thanh tẩy u linh đầu tiên', target: 1, progress: s => s.data.stats.kills
  },
  {
    id: 'hunter_100', icon: '👻', name: 'Thợ Săn U Linh',
    desc: 'Thanh tẩy tổng cộng 100 u linh', target: 100, progress: s => s.data.stats.kills
  },
  {
    id: 'hunter_1000', icon: '🏰', name: 'Người Gác Học Viện',
    desc: 'Thanh tẩy tổng cộng 1.000 u linh', target: 1000, progress: s => s.data.stats.kills
  },
  {
    id: 'score_10k', icon: '✨', name: 'Vạn Điểm Phép Thuật',
    desc: 'Đạt 10.000 điểm trong một lượt chơi', target: 10000, progress: s => s.data.stats.bestScore
  },
  {
    id: 'score_50k', icon: '💫', name: 'Pháp Sư Lừng Danh',
    desc: 'Đạt 50.000 điểm trong một lượt chơi', target: 50000, progress: s => s.data.stats.bestScore
  },

  // --- Combo & precision ---------------------------------------------
  {
    id: 'combo_10', icon: '🔥', name: 'Nhịp Điệu Ma Thuật',
    desc: 'Đạt chuỗi combo 10', target: 10, progress: s => s.data.stats.bestCombo
  },
  {
    id: 'combo_35', icon: '🌟', name: 'Bậc Thầy Combo',
    desc: 'Đạt chuỗi combo 35 (nhân điểm x5)', target: 35, progress: s => s.data.stats.bestCombo
  },
  {
    id: 'clean_combo', icon: '🧿', name: 'Bất Khả Xâm Phạm',
    desc: 'Đạt chuỗi combo 5 mà chưa bị trúng đòn nào trong màn/đợt đó', target: 1,
    progress: s => s.data.stats.cleanCombos
  },
  {
    id: 'accuracy_90', icon: '🎯', name: 'Nét Vẽ Chuẩn Xác',
    desc: 'Kết thúc một lượt với độ chính xác từ 90% (tối thiểu 30 nét vẽ)', target: 90,
    progress: s => s.data.stats.bestAccuracy
  },

  // --- Spells ------------------------------------------------------------
  {
    id: 'lightning_100', icon: '⚡', name: 'Cơn Thịnh Nộ',
    desc: 'Dùng Tia Sét hạ gục 100 u linh', target: 100, progress: s => s.data.stats.killsByRune.lightning || 0
  },
  {
    id: 'heal_20', icon: '💖', name: 'Bàn Tay Chữa Lành',
    desc: 'Hồi máu 20 lần', target: 20, progress: s => s.data.stats.heals
  },
  {
    id: 'freeze_10', icon: '❄️', name: 'Chúa Tể Băng Giá',
    desc: 'Kích hoạt Băng Giá 10 lần', target: 10, progress: s => s.data.stats.freezes
  },
  {
    id: 'gale_10', icon: '🌀', name: 'Bão Tố Xoáy',
    desc: 'Kích hoạt Cuồng Phong 10 lần', target: 10, progress: s => s.data.stats.gales
  },

  // --- Campaign ---------------------------------------------------------
  {
    id: 'boss_1', icon: '👑', name: 'Thanh Tẩy Trùm Đầu Tiên',
    desc: 'Đánh bại một trùm', target: 1, progress: s => s.data.stats.bossesDefeated
  },
  {
    id: 'flawless_level', icon: '🛡️', name: 'Không Một Vết Xước',
    desc: 'Hoàn thành một màn mà không mất giọt máu nào', target: 1, progress: s => s.data.stats.flawlessLevels
  },
  {
    id: 'story_clear', icon: '🏆', name: 'Giải Cứu Học Viện',
    desc: 'Hoàn thành toàn bộ chế độ Cốt Truyện', target: 1, progress: s => s.data.stats.wins
  },
  {
    id: 'story_inferno', icon: '😈', name: 'Huyền Thoại Địa Ngục',
    desc: 'Hoàn thành Cốt Truyện ở độ khó Địa Ngục', target: 1,
    progress: s => s.getRecord('STORY', 'INFERNO').wins
  },
  {
    id: 'endless_10', icon: '♾️', name: 'Sống Sót Vô Tận',
    desc: 'Đến được Đợt 10 trong chế độ Vô Tận', target: 10, progress: s => s.data.stats.bestEndlessWave
  },
  {
    id: 'endless_20', icon: '🌌', name: 'Bất Diệt',
    desc: 'Đến được Đợt 20 trong chế độ Vô Tận', target: 20, progress: s => s.data.stats.bestEndlessWave
  },

  // --- Daily challenge & collection -----------------------------------------
  {
    id: 'daily_first', icon: '📅', name: 'Thử Thách Đầu Tiên',
    desc: 'Hoàn thành một Thử Thách Hằng Ngày', target: 1, progress: s => s.data.stats.dailyPlays
  },
  {
    id: 'daily_streak_3', icon: '🔥', name: 'Ba Ngày Liên Tiếp',
    desc: 'Chơi Thử Thách Hằng Ngày 3 ngày liên tiếp', target: 3, progress: s => s.data.stats.bestDailyStreak
  },
  {
    id: 'companions_all', icon: '🐾', name: 'Hội Bạn Đầy Đủ',
    desc: 'Mở khóa cả 5 đồng hành của học viện', target: COMPANION_ORDER.length,
    progress: s => COMPANION_ORDER.filter(id => isCompanionUnlocked(id, s)).length
  },
  {
    id: 'bestiary_all', icon: '📚', name: 'Nhà Sưu Tầm U Linh',
    desc: 'Gặp đủ mọi loại u linh trong Bộ Sưu Tập', target: 11,
    progress: s => BESTIARY.filter(b => s.isSeen(b.id)).length
  },

  // --- Growth ---------------------------------------------------------
  {
    id: 'upgrades_10', icon: '🎁', name: 'Nhà Sưu Tầm Phép Lạ',
    desc: 'Chọn tổng cộng 10 nâng cấp trong các lượt chơi', target: 10, progress: s => s.data.stats.upgradesTaken
  },
  {
    id: 'practice_20', icon: '📖', name: 'Học Trò Chăm Chỉ',
    desc: 'Vẽ đúng 20 lần trong Phòng Luyện Vẽ', target: 20, progress: s => s.data.stats.practicePasses
  },
  {
    id: 'rune_master', icon: '🎓', name: 'Bậc Thầy Cổ Ngữ',
    desc: 'Thành thạo cả 8 ấn ký trong Phòng Luyện Vẽ', target: Object.keys(RUNES).length,
    progress: s => s.masteredCount()
  }
];

/**
 * Earn every achievement whose target has been reached.
 * @param {import('./ProgressStore.js').ProgressStore} store
 * @returns {AchievementDef[]} newly earned achievements (also persisted when there are any)
 */
export function evaluateAchievements(store) {
  const earned = [];
  for (const def of ACHIEVEMENTS) {
    if (store.isUnlocked(def.id)) continue;
    if (def.progress(store) >= def.target && store.unlock(def.id)) {
      earned.push(def);
    }
  }
  if (earned.length > 0) store.save();
  return earned;
}

/** Progress shown on the achievement card: [current clamped to target, target] */
export function achievementProgress(store, def) {
  const current = Math.max(0, def.progress(store));
  return [Math.min(current, def.target), def.target];
}

/**
 * The bestiary: every kind of ghost the player can meet.
 * `id` is what Game reports when an enemy appears / is defeated (see bestiaryId()).
 */
export const BESTIARY = [
  { id: 'REGULAR', icon: '👻', name: ENEMY_TYPES.REGULAR.name, boss: false,
    desc: 'Lang thang tiến về phía Momo, mang 1–4 ấn ký trên đầu.' },
  { id: 'SPEEDSTER', icon: '💨', name: ENEMY_TYPES.SPEEDSTER.name, boss: false,
    desc: 'Nhỏ và rất nhanh. Hãy hạ nó trước khi chạm tới Momo.' },
  { id: 'ARMORED', icon: '🛡️', name: ENEMY_TYPES.ARMORED.name, boss: false,
    desc: 'Chậm nhưng to xác, mang chuỗi 3–6 ấn ký phải vẽ lần lượt.' },
  { id: 'FREEZE', icon: '❄️', name: ENEMY_TYPES.FREEZE.name, boss: false,
    desc: 'Hạ gục để đóng băng toàn bộ kẻ địch (vẽ vòng tròn).' },
  { id: 'BLAST', icon: '🌀', name: ENEMY_TYPES.BLAST.name, boss: false,
    desc: 'Hạ gục để thổi bay cả bầy ra xa (vẽ xoắn ốc).' },
  { id: 'HEART', icon: '💖', name: 'U Linh Tim', boss: false,
    desc: 'Đứng yên và hiền lành. Chạm vào hoặc vẽ trái tim để hồi máu.' },
  { id: 'BOSS_LIBRARIAN', icon: '📚', name: ENEMY_TYPES.BOSS_LIBRARIAN.name, boss: true,
    desc: 'Trùm màn 1 — canh giữ Thư Viện Cổ Kính.' },
  { id: 'BOSS_CHEF', icon: '🍲', name: ENEMY_TYPES.BOSS_CHEF.name, boss: true,
    desc: 'Trùm màn 2 — thống trị Nhà Ăn & Bếp Ma.' },
  { id: 'BOSS_PLANETARIUM', icon: '🔭', name: ENEMY_TYPES.BOSS_PLANETARIUM.name, boss: true,
    desc: 'Trùm màn 3 — điều khiển các chòm sao trong Lớp Học.' },
  { id: 'BOSS_COACH', icon: '🏀', name: ENEMY_TYPES.BOSS_COACH.name, boss: true,
    desc: 'Trùm màn 4 — nhanh nhẹn nhất Nhà Thi Đấu.' },
  { id: 'BOSS_MASTER', icon: '👑', name: ENEMY_TYPES.BOSS_MASTER.name, boss: true,
    desc: 'Trùm cuối — Chúa tể trên Sân Thượng Lâu Đài.' }
];

/**
 * Map a live enemy to its bestiary id. Special tactical ghosts are identified by their flags first
 * (a "heart ghost" is a flag on a regular archetype, not an archetype of its own).
 * @param {{ type?: string, isHeartGhost?: boolean, isFreezeGhost?: boolean, isBlastGhost?: boolean }} enemy
 * @returns {string}
 */
export function bestiaryId(enemy) {
  if (!enemy) return 'REGULAR';
  if (enemy.isHeartGhost) return 'HEART';
  if (enemy.isFreezeGhost) return 'FREEZE';
  if (enemy.isBlastGhost) return 'BLAST';
  if (enemy.type === 'BOSS') return 'BOSS_MASTER';
  return enemy.type || 'REGULAR';
}
