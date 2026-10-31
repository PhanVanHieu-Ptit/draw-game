/**
 * @file Constants.js
 * @description Centralized game constants, runes, audio keys, and configuration.
 */

export const GAME_STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSE: 'PAUSE',
  GAMEOVER: 'GAMEOVER'
};

export const RUNES = {
  horizontal: {
    id: 'horizontal',
    symbol: '—',
    name: 'Arcane Slash',
    color: '#fbbf24',
    glow: '#f59e0b',
    lightColor: '#fef3c7',
    baseScore: 100,
    description: 'Chém ngang dũng mãnh'
  },
  vertical: {
    id: 'vertical',
    symbol: '|',
    name: 'Piercing Bolt',
    color: '#38bdf8',
    glow: '#0284c7',
    lightColor: '#e0f2fe',
    baseScore: 100,
    description: 'Tia đạn xuyên thấu'
  },
  caret: {
    id: 'caret',
    symbol: '∧',
    name: 'Apex Inversion',
    color: '#f97316',
    glow: '#ea580c',
    lightColor: '#ffedd5',
    baseScore: 150,
    description: 'Đỉnh núi ma thuật'
  },
  v_shape: {
    id: 'v_shape',
    symbol: '∨',
    name: 'Abyss Inversion',
    color: '#c084fc',
    glow: '#9333ea',
    lightColor: '#f3e8ff',
    baseScore: 150,
    description: 'Vực sâu trọng lực'
  },
  lightning: {
    id: 'lightning',
    symbol: '⚡',
    name: 'Overload Chain',
    color: '#34d399',
    glow: '#059669',
    lightColor: '#d1fae5',
    baseScore: 300,
    description: 'Tia sét hủy diệt'
  },
  heart: {
    id: 'heart',
    symbol: '❤️',
    name: 'Purifying Heart',
    color: '#f43f5e',
    glow: '#e11d48',
    lightColor: '#ffe4e6',
    baseScore: 200,
    description: 'Hồi phục sinh mệnh'
  }
};

export const ENEMY_TYPES = {
  REGULAR: {
    type: 'REGULAR',
    name: 'U Linh Thường',
    baseSpeed: 95,
    minSymbols: 1,
    maxSymbols: 2,
    radius: 28,
    color: '#e0e7ff',
    glowColor: '#818cf8',
    score: 100
  },
  SPEEDSTER: {
    type: 'SPEEDSTER',
    name: 'Bóng Ma Tốc Độ',
    baseSpeed: 210,
    minSymbols: 1,
    maxSymbols: 1,
    radius: 20,
    color: '#f472b6',
    glowColor: '#ec4899',
    score: 250
  },
  ARMORED: {
    type: 'ARMORED',
    name: 'Hắc Giáp Tướng Quân',
    baseSpeed: 52,
    minSymbols: 3,
    maxSymbols: 4,
    radius: 40,
    color: '#a78bfa',
    glowColor: '#7c3aed',
    score: 500
  },
  BOSS: {
    type: 'BOSS',
    name: 'Chúa Tể Hắc Ám',
    baseSpeed: 38,
    minSymbols: 4,
    maxSymbols: 6,
    radius: 52,
    color: '#831843',
    glowColor: '#f43f5e',
    score: 1500
  }
};

export const PLAYER_CONFIG = {
  MAX_HP: 5,
  HITBOX_RADIUS: 36,
  INVULNERABLE_DURATION: 1.2, // seconds
  DANGER_RADIUS: 140
};

export const COMBO_CONFIG = {
  DECAY_TIME: 2.4, // seconds to keep combo alive
  TIERS: [
    { min: 1, max: 4, mult: 1 },
    { min: 5, max: 9, mult: 2 },
    { min: 10, max: 19, mult: 3 },
    { min: 20, max: 34, mult: 4 },
    { min: 35, max: Infinity, mult: 5 }
  ]
};

export const STORAGE_KEYS = {
  HIGH_SCORE: 'arcane_paws_high_score_v1'
};
