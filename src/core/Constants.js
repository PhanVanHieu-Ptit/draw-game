/**
 * @file Constants.js
 * @description Centralized game constants, runes, audio keys, story cutscenes, and 5-level configuration
 * based on Google Doodle Halloween 2016 (Magic Cat Academy).
 */

export const GAME_STATES = {
  MENU: 'MENU',
  STORY: 'STORY',
  PLAYING: 'PLAYING',
  PAUSE: 'PAUSE',
  GAMEOVER: 'GAMEOVER',
  VICTORY: 'VICTORY'
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
  // Generic Boss fallback
  BOSS: {
    type: 'BOSS',
    name: 'Chúa Tể U Linh',
    baseSpeed: 38,
    minSymbols: 5,
    maxSymbols: 7,
    radius: 54,
    color: '#f43f5e',
    glowColor: '#be123c',
    score: 1500
  },
  // Level-specific Boss Archetypes matching Google Doodle 2016
  BOSS_LIBRARIAN: {
    type: 'BOSS_LIBRARIAN',
    isBoss: true,
    name: 'Bóng Ma Thủ Thư',
    enName: 'Librarian Ghost',
    baseSpeed: 36,
    radius: 50,
    color: '#93c5fd',
    glowColor: '#3b82f6',
    score: 1000
  },
  BOSS_CHEF: {
    type: 'BOSS_CHEF',
    isBoss: true,
    name: 'Bóng Ma Đầu Bếp',
    enName: 'Chef Ghost',
    baseSpeed: 38,
    radius: 52,
    color: '#fdba74',
    glowColor: '#f97316',
    score: 1200
  },
  BOSS_PLANETARIUM: {
    type: 'BOSS_PLANETARIUM',
    isBoss: true,
    name: 'Bóng Ma Thiên Văn',
    enName: 'Astronomy Ghost',
    baseSpeed: 36,
    radius: 52,
    color: '#c084fc',
    glowColor: '#9333ea',
    score: 1500
  },
  BOSS_COACH: {
    type: 'BOSS_COACH',
    isBoss: true,
    name: 'Bóng Ma Huấn Luyện Viên',
    enName: 'Coach Ghost',
    baseSpeed: 42,
    radius: 54,
    color: '#6ee7b7',
    glowColor: '#10b981',
    score: 1800
  },
  BOSS_MASTER: {
    type: 'BOSS_MASTER',
    isBoss: true,
    name: 'Chúa Tể Bóng Ma',
    enName: 'Master Ghost',
    baseSpeed: 34,
    radius: 60,
    color: '#f43f5e',
    glowColor: '#e11d48',
    score: 3000
  }
};

/**
 * 5 Progressive Stages directly modeled after Google Doodle Halloween 2016:
 * Level 1: The Library (Thư viện)
 * Level 2: The Cafeteria (Phòng ăn / Nhà bếp)
 * Level 3: The Classroom (Lớp học / Phòng Thiên văn)
 * Level 4: The Gymnasium (Phòng thể dục)
 * Level 5: The Rooftop (Sân thượng lâu đài - Final Boss)
 */
export const LEVEL_CONFIGS = [
  {
    level: 1,
    id: 'library',
    name: 'Thư Viện Cổ Kính',
    enName: 'The Library',
    tagline: 'Màn đêm buông xuống thư viện học viện...',
    description: 'Nơi khởi nguồn tai họa! U linh tràn ngập các kệ sách cổ.',
    themeColor: '#3b82f6',
    ambientColor: '#1e1b4b',
    totalMinions: 10,
    baseSpawnInterval: 2.5,
    speedMultiplier: 1.0,
    allowedRunes: ['horizontal', 'vertical'],
    hasSpeedster: false,
    hasArmored: false,
    bossType: 'BOSS_LIBRARIAN',
    bossName: 'Bóng Ma Thủ Thư (Librarian Ghost)',
    bossLives: 3,
    bossPhases: [
      ['horizontal', 'vertical'],
      ['vertical', 'horizontal', 'vertical'],
      ['horizontal', 'vertical', 'horizontal', 'vertical']
    ],
    bossSymbols: ['horizontal', 'vertical', 'horizontal', 'vertical']
  },
  {
    level: 2,
    id: 'cafeteria',
    name: 'Nhà Ăn & Bếp Ma',
    enName: 'The Cafeteria',
    tagline: 'Vạc ma thuật sôi sùng sục...',
    description: 'Mùi hương phép thuật quái đản bốc lên từ các nồi súp ma ám.',
    themeColor: '#f97316',
    ambientColor: '#271206',
    totalMinions: 14,
    baseSpawnInterval: 2.2,
    speedMultiplier: 1.08,
    allowedRunes: ['horizontal', 'vertical', 'caret', 'v_shape'],
    hasSpeedster: true,
    hasArmored: false,
    bossType: 'BOSS_CHEF',
    bossName: 'Bóng Ma Đầu Bếp (Chef Ghost)',
    bossLives: 3,
    bossPhases: [
      ['caret', 'v_shape'],
      ['horizontal', 'caret', 'v_shape'],
      ['v_shape', 'caret', 'horizontal', 'vertical']
    ],
    bossSymbols: ['caret', 'v_shape', 'horizontal', 'vertical', 'caret']
  },
  {
    level: 3,
    id: 'classroom',
    name: 'Lớp Học Phép Thuật',
    enName: 'The Classroom',
    tagline: 'Bảng phấn cổ xưa & bầu trời thiên văn...',
    description: 'Các mô hình hành tinh xoay vần và ống nghiệm phát sáng huyền bí.',
    themeColor: '#c084fc',
    ambientColor: '#1d0b36',
    totalMinions: 18,
    baseSpawnInterval: 1.9,
    speedMultiplier: 1.15,
    allowedRunes: ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning'],
    hasSpeedster: true,
    hasArmored: true,
    bossType: 'BOSS_PLANETARIUM',
    bossName: 'Bóng Ma Thiên Văn (Astronomy Ghost)',
    bossLives: 4,
    bossPhases: [
      ['v_shape', 'caret'],
      ['lightning', 'horizontal'],
      ['caret', 'v_shape', 'lightning'],
      ['lightning', 'vertical', 'v_shape', 'caret']
    ],
    bossSymbols: ['v_shape', 'caret', 'lightning', 'horizontal', 'v_shape']
  },
  {
    level: 4,
    id: 'gymnasium',
    name: 'Nhà Thi Đấu Thể Thao',
    enName: 'The Gymnasium',
    tagline: 'Tiếng còi ma quái vang vọng...',
    description: 'Sàn gỗ rực lửa và những dụng cụ thể thao ma ám bay lượn.',
    themeColor: '#34d399',
    ambientColor: '#06281c',
    totalMinions: 22,
    baseSpawnInterval: 1.65,
    speedMultiplier: 1.22,
    allowedRunes: ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning'],
    hasSpeedster: true,
    hasArmored: true,
    bossType: 'BOSS_COACH',
    bossName: 'Bóng Ma Huấn Luyện Viên (Coach Ghost)',
    bossLives: 4,
    bossPhases: [
      ['horizontal', 'caret', 'v_shape'],
      ['lightning', 'vertical', 'caret'],
      ['v_shape', 'lightning', 'horizontal', 'vertical'],
      ['lightning', 'caret', 'v_shape', 'horizontal', 'lightning']
    ],
    bossSymbols: ['lightning', 'horizontal', 'caret', 'vertical', 'v_shape', 'lightning']
  },
  {
    level: 5,
    id: 'rooftop',
    name: 'Sân Thượng Lâu Đài',
    enName: 'The Rooftop',
    tagline: 'Trận chiến định mệnh dưới trăng máu!',
    description: 'Chúa tể hắc ám đang giữ cuốn sách thần chú cổ đại trên đỉnh tháp.',
    themeColor: '#f43f5e',
    ambientColor: '#2b0713',
    totalMinions: 26,
    baseSpawnInterval: 1.45,
    speedMultiplier: 1.30,
    allowedRunes: ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning'],
    hasSpeedster: true,
    hasArmored: true,
    bossType: 'BOSS_MASTER',
    bossName: 'Chúa Tể Bóng Ma (Master Ghost)',
    bossLives: 5,
    bossPhases: [
      ['horizontal', 'vertical', 'lightning'],
      ['caret', 'v_shape', 'lightning', 'horizontal'],
      ['lightning', 'horizontal', 'vertical', 'lightning'],
      ['v_shape', 'caret', 'lightning', 'vertical', 'horizontal'],
      ['lightning', 'caret', 'v_shape', 'horizontal', 'vertical', 'lightning']
    ],
    bossSymbols: ['lightning', 'horizontal', 'vertical', 'caret', 'v_shape', 'lightning', 'horizontal']
  }
];

export const STORY_SLIDES = {
  INTRO: [
    {
      title: 'Học Viện Mèo Phép Thuật',
      enTitle: 'Magic Cat Academy',
      text: 'Momo là một chú mèo phù thủy chăm chỉ đang nghiên cứu cuốn Sách Thần Chú Cổ Đại trong thư viện yên tĩnh dưới ánh nến.',
      enText: 'Momo, a wizard cat student, is studying the ancient Master Spellbook in the quiet academy library.',
      illustration: 'library_reading',
      actionPrompt: 'Tiếp Tục ➜'
    },
    {
      title: 'Vụ Trộm Bí Ẩn!',
      enTitle: 'The Stolen Spellbook!',
      text: 'Bất thình lình, một bóng ma tinh quái lao qua cửa sổ thư viện, cướp mất cuốn sách thần chú quyền năng và biến mất vào màn đêm!',
      enText: 'Suddenly, a mischievous ghost swoops in, snatches the sacred Master Spellbook, and flies away into the darkness!',
      illustration: 'ghost_theft',
      actionPrompt: 'Tiếp Tục ➜'
    },
    {
      title: 'Cầm Đũa Phép Lên!',
      enTitle: 'Draw Your Wand!',
      text: 'Quân đoàn u linh tràn ngập ngôi trường! Hãy cùng Momo vung đũa phép, vẽ các ấn ký ma thuật để thanh tẩy lũ ma và lấy lại cuốn sách!',
      enText: 'Spirits are invading the school! Help Momo draw magic runes in the air to banish ghosts and retrieve the book!',
      illustration: 'cat_wand_ready',
      actionPrompt: 'VÀO TRẬN NGAY! ⚡'
    }
  ],
  VICTORY: [
    {
      title: 'Chúa Tể Ma Bị Đánh Bại!',
      enTitle: 'Master Ghost Defeated!',
      text: 'Dưới ánh trăng rằm rực rỡ trên sân thượng, đòn ma pháp uy lực của Momo đã hoàn toàn thanh tẩy Chúa Tể Bóng Ma!',
      enText: 'High above the academy rooftop, Momo\'s brilliant final spell shatters the dark grasp of the Master Ghost!',
      illustration: 'boss_defeated'
    },
    {
      title: 'Cuốn Sách Thần Chú Trở Về!',
      enTitle: 'The Spellbook Returns!',
      text: 'Cuốn Sách Thần Chú Cổ Đại rơi xuống từ không trung và được Momo bắt lấy trọn vẹn trong vòng tay ấm áp.',
      enText: 'The ancient Master Spellbook floats gently down into Momo\'s paws. The dark curse is broken!',
      illustration: 'book_recovered'
    },
    {
      title: 'Bình Yên Trở Lại Học Viện!',
      enTitle: 'Peace Restored to the Academy!',
      text: 'Ngôi trường phép thuật bừng sáng rạng rỡ. Momo và các bạn mèo cùng nhau ăn mừng chiến thắng vang dội mùa Halloween!',
      enText: 'The school radiates with magical warmth. Momo celebrates with her feline classmates — the academy is saved!',
      illustration: 'happy_celebration'
    }
  ]
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
  HIGH_SCORE: 'arcane_paws_high_score_v1',
  UNLOCKED_LEVEL: 'arcane_paws_unlocked_level_v1',
  TUTORIAL_COMPLETED: 'arcane_paws_tutorial_completed_v1'
};
