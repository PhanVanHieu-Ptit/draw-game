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
    baseSpeed: 68,
    minSymbols: 1,
    maxSymbols: 4,
    radius: 28,
    color: '#e0e7ff',
    glowColor: '#818cf8',
    score: 100
  },
  SPEEDSTER: {
    type: 'SPEEDSTER',
    name: 'Bóng Ma Tốc Độ',
    baseSpeed: 110,
    minSymbols: 1,
    maxSymbols: 3,
    radius: 20,
    color: '#f472b6',
    glowColor: '#ec4899',
    score: 250
  },
  ARMORED: {
    type: 'ARMORED',
    name: 'Hắc Giáp Tướng Quân',
    baseSpeed: 42,
    minSymbols: 3,
    maxSymbols: 6,
    radius: 40,
    color: '#a78bfa',
    glowColor: '#7c3aed',
    score: 500
  },
  // Generic Boss fallback
  BOSS: {
    type: 'BOSS',
    name: 'Chúa Tể U Linh',
    baseSpeed: 30,
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
    baseSpeed: 28,
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
    baseSpeed: 30,
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
    baseSpeed: 30,
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
    baseSpeed: 34,
    radius: 54,
    color: '#6ee7b7',
    glowColor: '#10b981',
    score: 1800
  },
  BOSS_MASTER: {
    type: 'BOSS_MASTER',
    isBoss: true,
    isFinalBoss: true,
    name: 'Chúa Tể Bóng Ma',
    enName: 'Master Ghost',
    baseSpeed: 28,
    radius: 140,
    color: '#f43f5e',
    glowColor: '#e11d48',
    score: 3000
  }
};

/**
 * Game Difficulty Modes
 */
export const DIFFICULTY_LEVELS = {
  NORMAL: {
    id: 'NORMAL',
    name: 'Tiêu Chuẩn',
    badge: '🔥 TIÊU CHUẨN',
    speedMult: 1.0,
    spawnIntervalMult: 1.0,
    heartMult: 0.85,
    squadBonus: 0,
    description: 'Thử thách cân bằng: U linh tấn công đông đảo theo bầy, tốc độ vừa phải dễ vẽ.'
  },
  HARDCORE: {
    id: 'HARDCORE',
    name: 'Ác Mộng',
    badge: '💀 ÁC MỘNG',
    speedMult: 1.15,
    spawnIntervalMult: 0.82,
    heartMult: 0.45,
    squadBonus: 1,
    description: 'Ác mộng: Bầy ma đông đúc, ra liên tục nhiều con, ấn ký dài và hiểm!'
  },
  INFERNO: {
    id: 'INFERNO',
    name: 'Địa Ngục',
    badge: '⚡ ĐỊA NGỤC',
    speedMult: 1.30,
    spawnIntervalMult: 0.68,
    heartMult: 0.25,
    squadBonus: 2,
    description: 'Thử thách cực hạn: Bão u linh 4-6 con ập vào 4 phía, ấn ký đa dạng!'
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
    totalMinions: 12,
    baseSpawnInterval: 1.35,
    speedMultiplier: 0.85,
    allowedRunes: ['horizontal', 'vertical'],
    hasSpeedster: false,
    hasArmored: false,
    bossType: 'BOSS_LIBRARIAN',
    bossName: 'Bóng Ma Thủ Thư (Madame Libraria)',
    bossLives: 3,
    bossPhases: [
      ['horizontal', 'vertical'],
      ['vertical', 'horizontal', 'vertical'],
      ['horizontal', 'vertical', 'horizontal', 'vertical']
    ],
    bossSymbols: ['horizontal', 'vertical', 'horizontal', 'vertical'],
    companion: {
      name: 'Viện Trưởng Barnaby',
      role: 'Đại Pháp Sư Cú Già',
      icon: '🦉',
      color: '#60a5fa'
    },
    storyIntroQuote: 'Momo! Madame Libraria đang bị sương mù u linh làm mờ mắt. Hãy dùng nét vẽ [—] và [|] giải trừ tà khí!',
    bossSpawnQuote: 'Ai dám gây náo loạn trong thánh địa tri thức của ta?! Hãy nếm mùi các kệ sách cuồng nộ!',
    bossDefeatQuote: 'Kính của ta... đã trong sáng trở lại rồi. Cảm ơn Momo! Kẻ cướp Cổ Thư đang chạy xuống Nhà Bếp!'
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
    totalMinions: 22,
    baseSpawnInterval: 1.10,
    speedMultiplier: 0.95,
    allowedRunes: ['horizontal', 'vertical', 'caret', 'v_shape'],
    hasSpeedster: true,
    hasArmored: false,
    bossType: 'BOSS_CHEF',
    bossName: 'Bóng Ma Đầu Bếp (Chef Bouillon)',
    bossLives: 3,
    bossPhases: [
      ['caret', 'v_shape', 'horizontal'],
      ['horizontal', 'caret', 'v_shape', 'vertical'],
      ['v_shape', 'caret', 'horizontal', 'vertical', 'caret']
    ],
    bossSymbols: ['caret', 'v_shape', 'horizontal', 'vertical', 'caret'],
    companion: {
      name: 'Oliver Cam Cam',
      role: 'Dược Sĩ Bánh Quy',
      icon: '🐱🥐',
      color: '#fb923c'
    },
    storyIntroQuote: 'Momo ơi! Tớ đem bánh quy và nồi súp hồi máu [❤️] tiếp tế đây! Hãy cẩn thận các nét [∧] và [∨]!',
    bossSpawnQuote: 'Món súp lãng quên 100 năm của ta... không một kẻ phàm trần nào được phép chối từ!',
    bossDefeatQuote: 'Mùi thơm này... hóa ra hương vị tuyệt nhất lại là sự yên bình của các cô cậu mèo. Lên Tháp Thiên Văn mau!'
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
    totalMinions: 30,
    baseSpawnInterval: 0.90,
    speedMultiplier: 1.05,
    allowedRunes: ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning'],
    hasSpeedster: true,
    hasArmored: true,
    bossType: 'BOSS_PLANETARIUM',
    bossName: 'Bóng Ma Thiên Văn (Professor Stella)',
    bossLives: 4,
    bossPhases: [
      ['v_shape', 'caret', 'lightning'],
      ['lightning', 'horizontal', 'vertical', 'caret'],
      ['caret', 'v_shape', 'lightning', 'horizontal', 'vertical'],
      ['lightning', 'vertical', 'v_shape', 'caret', 'lightning']
    ],
    bossSymbols: ['v_shape', 'caret', 'lightning', 'horizontal', 'v_shape'],
    companion: {
      name: 'Luna Bạch Miêu',
      role: 'Chiêm Tinh Học Giả',
      icon: '🐱✨',
      color: '#c084fc'
    },
    storyIntroQuote: 'Các chòm sao đang hỗn loạn! Hãy vẽ Ấn Ký Sét [⚡] để đập tan lớp giáp ma của các hành tinh lạc lối!',
    bossSpawnQuote: 'Quỹ đạo vũ trụ đã an bài! Các ngươi không thể đảo ngược định mệnh của Đêm Trăng Máu!',
    bossDefeatQuote: 'Ánh sao phương bắc đã chỉ lối... Kẻ thao túng đang mượn sức mạnh thể thao ở Nhà Đấu để gom năng lượng!'
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
    totalMinions: 38,
    baseSpawnInterval: 0.75,
    speedMultiplier: 1.15,
    allowedRunes: ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning'],
    hasSpeedster: true,
    hasArmored: true,
    bossType: 'BOSS_COACH',
    bossName: 'Bóng Ma Huấn Luyện Viên (Coach Striker)',
    bossLives: 4,
    bossPhases: [
      ['horizontal', 'caret', 'v_shape', 'lightning'],
      ['lightning', 'vertical', 'caret', 'horizontal'],
      ['v_shape', 'lightning', 'horizontal', 'vertical', 'lightning'],
      ['lightning', 'caret', 'v_shape', 'horizontal', 'vertical', 'lightning']
    ],
    bossSymbols: ['lightning', 'horizontal', 'caret', 'vertical', 'v_shape', 'lightning'],
    companion: {
      name: 'Nyx Tam Thể',
      role: 'Đạo Tặc Tốc Độ',
      icon: '🐱⚡',
      color: '#34d399'
    },
    storyIntroQuote: 'Xem ai nhanh hơn nào Momo! Lũ ma siêu tốc lượn lách ghê lắm, vung đũa thật dứt khoát vào nhé!',
    bossSpawnQuote: 'Tuýt! Không ai được bỏ qua bài tập kỷ luật thép! 100 vòng quanh sân đấu ma thuật ngay!',
    bossDefeatQuote: 'Tuýt... Hết giờ! Phản xạ xuất sắc lắm, Momo! Cửa dẫn lên Sân Thượng Đỉnh Tháp đã mở, đi cứu lấy trường học!'
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
    totalMinions: 0, // Level 5 is directly the Colossal Boss Battle right from the start!
    baseSpawnInterval: 0.65,
    speedMultiplier: 1.25,
    allowedRunes: ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning'],
    hasSpeedster: true,
    hasArmored: true,
    bossType: 'BOSS_MASTER',
    bossName: 'Chúa Tể Bóng Ma (Lord Umbra)',
    bossLives: 5,
    bossPhases: [
      ['horizontal', 'vertical', 'lightning', 'caret'],
      ['caret', 'v_shape', 'lightning', 'horizontal', 'vertical'],
      ['lightning', 'horizontal', 'vertical', 'caret', 'v_shape'],
      ['v_shape', 'caret', 'lightning', 'vertical', 'horizontal', 'lightning'],
      ['lightning', 'caret', 'v_shape', 'horizontal', 'vertical', 'lightning', 'horizontal']
    ],
    bossSymbols: ['lightning', 'horizontal', 'vertical', 'caret', 'v_shape', 'lightning', 'horizontal'],
    companion: {
      name: 'Liên Minh Mèo Phép Thuật',
      role: 'Momo & Những Người Bạn',
      icon: '🐾🌟',
      color: '#f43f5e'
    },
    storyIntroQuote: 'Oliver, Luna, Nyx và Viện Trưởng Barnaby cùng truyền sức mạnh! Đỉnh tháp trăng máu - trận chiến định mệnh!',
    bossSpawnQuote: '300 năm qua các ngươi đã lãng quên ta! Đêm nay, ranh giới hai cõi sẽ vĩnh viễn hòa làm một!',
    bossDefeatQuote: 'Ánh sáng ấm áp này... Ta nhớ ra rồi... Ta từng là chú mèo hiệp sĩ bảo vệ ngôi trường này...'
  }
];

export const STORY_SLIDES = {
  INTRO: [
    {
      title: 'Cổ Thư Nhật Thực Trong Đêm Yên Tĩnh',
      enTitle: 'The Whispering Grimoire',
      text: 'Tại Thư Viện Học Viện Mèo Arcane, Momo đang cùng bạn thân Oliver nghiên cứu Cổ Thư Nhật Thực — phong ấn bảo hộ sự bình yên suốt 100 năm.',
      enText: 'In the quiet Arcane Paws library, wizard cat Momo and foodie pal Oliver study the Grimoire of Whispering Eclipse — an ancient century-old seal.',
      illustration: 'library_reading',
      actionPrompt: 'Tiếp Tục ➜'
    },
    {
      title: 'Phong Ấn Bị Phá Vỡ! Lời Nguyền Trăng Máu',
      enTitle: 'The Blood Moon Eclipse!',
      text: 'Bất thình lình, Chúa Tể Bóng Ma xé toạc màn đêm, cướp lấy Cổ Thư! Làn khói u linh tràn ngập làm tha hóa các thầy cô và khuấy đảo toàn bộ 5 khu vực trường học.',
      enText: 'Suddenly, a colossal phantom smashes through the stained glass, seizing the Grimoire! Dark spectral fog corrupts academy grounds and staff alike!',
      illustration: 'ghost_theft',
      actionPrompt: 'Tiếp Tục ➜'
    },
    {
      title: 'Hội Mèo Xuất Kích: Cầm Đũa Phép Lên!',
      enTitle: 'Unite The Arcane Paws!',
      text: 'Được Oliver, Luna, Nyx và Viện Trưởng Barnaby tiếp thêm dũng khí, Momo vung đũa phép thần kỳ, vẽ nên các ấn ký cổ ngữ để thanh tẩy học viện!',
      enText: 'Empowered by Oliver, Luna, Nyx and Archmage Barnaby, Momo raises the Obsidian Wand to draw sacred runes and redeem the academy!',
      illustration: 'cat_wand_ready',
      actionPrompt: 'VÀO TRẬN NGAY! ⚡'
    }
  ],
  VICTORY: [
    {
      title: 'Linh Hồn Hiệp Sĩ Umbra Được Giải Thoát!',
      enTitle: 'Lord Umbra Redeemed!',
      text: 'Đòn ma pháp thanh tẩy chan chứa tình bạn của Momo đã phá tan lời nguyền. Chúa Tể Bóng Ma hiện nguyên hình là Hộ Vệ Umbra cổ xưa, mỉm cười thanh thản.',
      enText: 'Momo\'s brilliant light spell purifies the ancient knight spirit Lord Umbra, dissolving centuries of loneliness into shining golden butterflies.',
      illustration: 'boss_defeated'
    },
    {
      title: 'Cổ Thư Trở Về - Ranh Giới Hòa Giải!',
      enTitle: 'The Sacred Grimoire Restored!',
      text: 'Cổ Thư Nhật Thực nhẹ nhàng đáp xuống tay Momo. Ranh giới giữa thế giới u linh và thế giới loài mèo được gắn kết trong hòa bình vĩnh cửu.',
      enText: 'The sacred Master Spellbook floats gently into Momo\'s paws. The spirit rift closes, ushering harmony between realms.',
      illustration: 'book_recovered'
    },
    {
      title: 'Bữa Tiệc Tưng Bừng Toàn Học Viện!',
      enTitle: 'Grand Academy Celebration!',
      text: 'Học viện rực rỡ pháo hoa! Momo, Oliver với đĩa bánh nướng, Luna bên quả cầu sao và Nyx cùng các thầy cô hân hoan ăn mừng chiến thắng huy hoàng!',
      enText: 'Fireworks light the midnight sky! Momo, Oliver with pastry treats, Luna, Nyx, and the whole academy celebrate a legendary victory!',
      illustration: 'happy_celebration'
    }
  ]
};

export const STORY_CHAPTERS = [
  {
    chapter: 1,
    level: 1,
    levelId: 'library',
    badge: 'CHƯƠNG 1 • THƯ VIỆN CỔ KÍNH',
    title: 'Màn Đêm Buông Xuống Thư Viện Cổ Kính',
    enTitle: 'Chapter 1: Shadows in the Ancient Library',
    slideIndex: 3,
    companion: {
      name: 'Viện Trưởng Barnaby',
      role: 'Đại Pháp Sư Cú Già',
      icon: '🦉',
      color: '#60a5fa'
    },
    bossName: 'Bóng Ma Thủ Thư (Madame Libraria)',
    bossIcon: '👻📚',
    runes: 'Ngang [—] và Dọc [|]',
    text: 'Cổ Thư Nhật Thực vừa bị cướp mất! Sương mù tà khí bao trùm thư viện khiến Madame Libraria cuồng nộ điều khiển hàng ngàn kệ sách bay. Viện Trưởng Barnaby phân tách linh hồn chỉ dẫn Momo dùng 2 nét ma pháp cơ bản [—] và [|] để giải trừ u mê cho bà.',
    enText: 'The Grimoire is stolen! Dark mist fills the library as Madame Libraria flings possessed book stacks. Archmage Barnaby instructs Momo to draw horizontal [—] and vertical [|] runes.',
    quotes: {
      intro: 'Momo! Madame Libraria đang bị sương mù u linh làm mờ mắt. Hãy dùng nét vẽ [—] và [|] giải trừ tà khí!',
      boss: 'Ai dám gây náo loạn trong thánh địa tri thức của ta?! Hãy nếm mùi các kệ sách cuồng nộ!',
      defeat: 'Kính của ta... đã trong sáng trở lại rồi. Cảm ơn Momo! Kẻ cướp Cổ Thư đang chạy xuống Nhà Bếp!'
    }
  },
  {
    chapter: 2,
    level: 2,
    levelId: 'cafeteria',
    badge: 'CHƯƠNG 2 • NHÀ ĂN & BẾP MA',
    title: 'Hương Vị Ma Quái & Vạc Súp Lãng Quên',
    enTitle: 'Chapter 2: The Haunted Feast & Bubbling Cauldron',
    slideIndex: 4,
    companion: {
      name: 'Oliver Cam Cam',
      role: 'Dược Sĩ Bánh Quy',
      icon: '🐱🥐',
      color: '#fb923c'
    },
    bossName: 'Bóng Ma Đầu Bếp (Chef Bouillon)',
    bossIcon: '👻🍲',
    runes: 'Caret [∧], V-Shape [∨] & Hồi Máu [❤️]',
    text: 'Dưới hầm bếp, Bếp Trưởng Bouillon khuấy động ngọn lửa ma thuật, ép mọi người nếm món súp lãng quên. Đúng lúc Momo bị bao vây, chú mèo béo Oliver lăn xả tiếp tế súp hồi sinh lực [❤️]. Cùng nhau, họ vẽ ấn ký nhọn [∧] và [∨] dập tắt nồi súp ma.',
    enText: 'Down in the kitchen, Chef Bouillon brews the Soup of Oblivion. Oliver rushes to the rescue with healing [❤️] treats as Momo casts sharp wedge runes to pacify the chef.',
    quotes: {
      intro: 'Momo ơi! Tớ đem bánh quy và nồi súp hồi máu [❤️] tiếp tế đây! Hãy cẩn thận các nét [∧] và [∨]!',
      boss: 'Món súp lãng quên 100 năm của ta... không một kẻ phàm trần nào được phép chối từ!',
      defeat: 'Mùi thơm này... hóa ra hương vị tuyệt nhất lại là sự yên bình của các cô cậu mèo. Lên Tháp Thiên Văn mau!'
    }
  },
  {
    chapter: 3,
    level: 3,
    levelId: 'classroom',
    badge: 'CHƯƠNG 3 • LỚP HỌC THIÊN VĂN',
    title: 'Quỹ Đạo Thiên Thể & Ấn Ký Sét Giáng',
    enTitle: 'Chapter 3: Celestial Orbits & Thunder Runes',
    slideIndex: 5,
    companion: {
      name: 'Luna Bạch Miêu',
      role: 'Chiêm Tinh Học Giả',
      icon: '🐱✨',
      color: '#c084fc'
    },
    bossName: 'Bóng Ma Thiên Văn (Professor Stella)',
    bossIcon: '👻🪐',
    runes: 'Ấn Ký Sấm Sét [⚡]',
    text: 'Giáo sư Stella bị các vòng xoay hành tinh giam cầm trong ảo ảnh tận thế, tạo ra các lớp giáp phòng thủ kiên cố. Cô mèo bạch miêu Luna giải mã hiện tượng Trăng Máu, truyền dạy cho Momo bí thuật Ấn Ký Sét [⚡] để đập tan quỹ đạo sao lạc lối.',
    enText: 'Professor Stella is trapped in apocalyptic cosmic illusions, shielding herself with planetary spheres. Luna reveals the secrets of the Lightning Rune [⚡] to shatter the shields.',
    quotes: {
      intro: 'Các chòm sao đang hỗn loạn! Hãy vẽ Ấn Ký Sét [⚡] để đập tan lớp giáp ma của các hành tinh lạc lối!',
      boss: 'Quỹ đạo vũ trụ đã an bài! Các ngươi không thể đảo ngược định mệnh của Đêm Trăng Máu!',
      defeat: 'Ánh sao phương bắc đã chỉ lối... Kẻ thao túng đang mượn sức mạnh thể thao ở Nhà Đấu để gom năng lượng!'
    }
  },
  {
    chapter: 4,
    level: 4,
    levelId: 'gymnasium',
    badge: 'CHƯƠNG 4 • NHÀ THI ĐẤU MA ÁM',
    title: 'Tiếng Còi Bão Táp & Lũ Ma Siêu Tốc',
    enTitle: 'Chapter 4: The Whistle of Storms & Speedster Trials',
    slideIndex: 6,
    companion: {
      name: 'Nyx Tam Thể',
      role: 'Đạo Tặc Tốc Độ',
      icon: '🐱⚡',
      color: '#34d399'
    },
    bossName: 'Bóng Ma Huấn Luyện Viên (Coach Striker)',
    bossIcon: '👻🏀',
    runes: 'Phản Xạ Cực Nhanh & Ấn Ký Hỗn Hợp',
    text: 'Sàn gỗ rực lửa bốc khói! Hàng loạt u linh siêu tốc lao vụt qua tầm mắt dưới tiếng còi thịnh nộ của Coach Striker. Nhờ sự lắt léo và chỉ điểm của Nyx Tam Thể, Momo vượt qua bài kiểm tra phản xạ đỉnh cao, đoạt chìa khóa dẫn lên sân thượng tháp cao.',
    enText: 'The gym floor blazes as Speedster ghosts dart through the court under Coach Striker\'s fierce whistle. Guided by nimble rogue Nyx, Momo aces the agility trial.',
    quotes: {
      intro: 'Xem ai nhanh hơn nào Momo! Lũ ma siêu tốc lượn lách ghê lắm, vung đũa thật dứt khoát vào nhé!',
      boss: 'Tuýt! Không ai được bỏ qua bài tập kỷ luật thép! 100 vòng quanh sân đấu ma thuật ngay!',
      defeat: 'Tuýt... Hết giờ! Phản xạ xuất sắc lắm, Momo! Cửa dẫn lên Sân Thượng Đỉnh Tháp đã mở, đi cứu lấy trường học!'
    }
  },
  {
    chapter: 5,
    level: 5,
    levelId: 'rooftop',
    badge: 'CHƯƠNG 5 • SÂN THƯỢNG LÂU ĐÀI',
    title: 'Đêm Trăng Máu & Sự Thật Về Chúa Tể Umbra',
    enTitle: 'Chapter 5: Blood Moon Destiny & Lord Umbra',
    slideIndex: 7,
    companion: {
      name: 'Liên Minh Mèo Phép Thuật',
      role: 'Momo & Những Người Bạn',
      icon: '🐾🌟',
      color: '#f43f5e'
    },
    bossName: 'Chúa Tể Bóng Ma (Lord Umbra)',
    bossIcon: '👑👻',
    runes: 'Phối Hợp Toàn Bộ Ấn Ký Cổ Ngữ',
    text: 'Dưới vầng Trăng Máu rực lửa trên đỉnh tháp chuông, Chúa Tể Umbra giáng đòn bão lốc cuồng nộ từ Cổ Thư. Sự thật hé lộ: Umbra chính là chú mèo hiệp sĩ bảo hộ cổ xưa bị lãng quên 300 năm. Bằng sự cảm thông và ánh sáng thuần khiết, Momo đã giải thoát cho ngài.',
    enText: 'High upon the rooftop under the crimson moon, Lord Umbra unleashes the Grimoire. Revealed as the forgotten ancient feline knight, he is finally redeemed by Momo\'s compassion.',
    quotes: {
      intro: 'Oliver, Luna, Nyx và Viện Trưởng Barnaby cùng truyền sức mạnh! Đỉnh tháp trăng máu - trận chiến định mệnh!',
      boss: '300 năm qua các ngươi đã lãng quên ta! Đêm nay, ranh giới hai cõi sẽ vĩnh viễn hòa làm một!',
      defeat: 'Ánh sáng ấm áp này... Ta nhớ ra rồi... Ta từng là chú mèo hiệp sĩ bảo vệ ngôi trường này...'
    }
  }
];

STORY_SLIDES.CHAPTERS = STORY_CHAPTERS;

export const ACADEMY_CHARACTERS = [
  {
    id: 'momo',
    name: 'Momo',
    title: 'Pháp Sư Mèo Đen',
    enTitle: 'The Arcane Shadowblade',
    faction: 'ally',
    icon: '🐱🪄',
    themeColor: '#c084fc',
    element: 'Âm Dương Ma Pháp (Arcane Balance)',
    quote: 'Nét vẽ quyết đoán sẽ cắt đứt mọi bóng tối!',
    bio: 'Nhân vật chính của học viện Arcane Paws. Với đôi mắt hổ phách sáng ngời và đũa phép gỗ mun, Momo sở hữu khả năng nhìn thấu và vẽ chuẩn xác các ấn ký cổ ngữ trong không gian.'
  },
  {
    id: 'oliver',
    name: 'Oliver Cam Cam',
    title: 'Dược Sĩ Bánh Quy',
    enTitle: 'The Pastry Alchemist',
    faction: 'ally',
    icon: '🐱🥐',
    themeColor: '#fb923c',
    element: 'Sinh Lực & Thảo Dược (Heart Rune ❤️)',
    quote: 'Đừng lo Momo! Bánh quy bơ mật ong hồi phục 100% sinh lực đây!',
    bio: 'Chú mèo vàng mướp tròn trịa, bạn thân nhất của Momo. Thường xuyên ngủ gật trong giờ lý thuyết nhưng lại là thiên tài pha chế súp thảo mộc và tạo ra các U Linh Trái Tim tiếp tế.'
  },
  {
    id: 'luna',
    name: 'Luna Bạch Miêu',
    title: 'Học Giả Thiên Văn',
    enTitle: 'The Starlight Astrologer',
    faction: 'ally',
    icon: '🐱✨',
    themeColor: '#38bdf8',
    element: 'Thiên Cầu & Sấm Sét (Lightning Rune ⚡)',
    quote: 'Chuyển động của các vì sao không bao giờ nói dối.',
    bio: 'Cô mèo trắng tuyết với đôi mắt nhị sắc xanh biếc và vàng kim. Luna am hiểu sâu sắc về chu kỳ Trăng Máu và là người giải mã tia sét giáng xuống các u linh mang giáp phòng thủ.'
  },
  {
    id: 'nyx',
    name: 'Nyx Tam Thể',
    title: 'Đạo Tặc Tốc Độ',
    enTitle: 'The Calico Shadow-Striker',
    faction: 'ally',
    icon: '🐱⚡',
    themeColor: '#34d399',
    element: 'Phong Lôi Vận Tốc (Agility Rush)',
    quote: 'Nhanh hơn một cái chớp mắt, đó mới là nghệ thuật vung đũa!',
    bio: 'Cá tính tinh nghịch, thích trèo lên những mái nhà cao nhất học viện. Dù hay trêu chọc Momo nhưng luôn có mặt kịp thời để chỉ điểm đường bay của lũ u linh siêu tốc.'
  },
  {
    id: 'barnaby',
    name: 'Viện Trưởng Barnaby',
    title: 'Đại Pháp Sư Cú Già',
    enTitle: 'The Guardian Archmage',
    faction: 'ally',
    icon: '🦉📜',
    themeColor: '#60a5fa',
    element: 'Cổ Ngữ Viện Trưởng (Ancient Wisdom)',
    quote: 'Lòng can đảm của các em chính là phong ấn mạnh nhất trên đời.',
    bio: 'Người bảo hộ lâu đời của học viện. Dù thân xác bị tạm phong ấn thành tượng đá dưới trăng máu, ý niệm của cụ vẫn dẫn dắt Momo qua từng trang giấy phép bay lượn.'
  },
  {
    id: 'boss_librarian',
    name: 'Madame Libraria',
    title: 'Bóng Ma Thủ Thư',
    enTitle: 'The Keeper of Lost Pages',
    faction: 'spirit',
    icon: '👻📚',
    themeColor: '#3b82f6',
    element: 'Trang Sách Cuồng Nộ (Horizontal & Vertical)',
    quote: 'Ai cho phép các ngươi gập góc cuốn bách khoa toàn thư?!',
    bio: 'Linh hồn thủ thư hơn 200 tuổi, cực kỳ yêu quý từng trang sách. Bị tà khí trăng máu kích động thành cơn thịnh nộ kệ sách bay. Khi được thanh tẩy, bà lại là người dẫn đường ân cần.'
  },
  {
    id: 'boss_chef',
    name: 'Chef Bouillon',
    title: 'Bóng Ma Đầu Bếp',
    enTitle: 'The Phantom Gourmand',
    faction: 'spirit',
    icon: '👻🍲',
    themeColor: '#f97316',
    element: 'Vạc Súp Lửa Ma (Caret & V-Shape)',
    quote: 'Chưa nếm cạn nồi súp này thì không ai được rời khỏi bàn ăn!',
    bio: 'Bếp trưởng ma quái ngự trị gian bếp khổng lồ. Nỗi ám ảnh phải nấu món ngon cho cả trường khiến ông bị u mê. Cây muôi ma thuật của ông có thể khuấy động cả một cơn bão linh hồn.'
  },
  {
    id: 'boss_planetarium',
    name: 'Professor Stella',
    title: 'Bóng Ma Thiên Văn',
    enTitle: 'The Orbit Master',
    faction: 'spirit',
    icon: '👻🪐',
    themeColor: '#c084fc',
    element: 'Quỹ Đạo Thiên Thể (Cosmic Barriers)',
    quote: 'Vũ trụ sắp va chạm! Hãy để các hành tinh nghiền nát tất cả!',
    bio: 'Giáo sư chiêm tinh bị kẹt giữa các vòng quay của mô hình thiên văn cổ. Các quả cầu xoay quanh tạo thành lớp giáp vững chắc chỉ có thể phá vỡ bằng ấn ký sấm sét liên hoàn.'
  },
  {
    id: 'boss_coach',
    name: 'Coach Striker',
    title: 'Bóng Ma Huấn Luyện Viên',
    enTitle: 'The Spectral Whistle-Master',
    faction: 'spirit',
    icon: '👻🏀',
    themeColor: '#34d399',
    element: 'Kỷ Luật Phản Xạ (Speed Trials)',
    quote: 'Hít đất 500 cái hoặc bị u linh dí chạy quanh sân!',
    bio: 'Hồn ma thầy dạy thể thao nghiêm khắc nhất lịch sử học viện. Ông chỉ trao chìa khóa lên sân thượng cho học trò nào chứng minh được tốc độ vẽ nét và phản xạ đỉnh cao.'
  },
  {
    id: 'boss_master',
    name: 'Lord Umbra',
    title: 'Chúa Tể Bóng Đêm / Hiệp Sĩ Hộ Vệ Cổ',
    enTitle: 'The Forgotten Sovereign',
    faction: 'spirit',
    icon: '👑👻',
    themeColor: '#f43f5e',
    element: 'Bão Lốc Hỗn Mang (All Elemental Runes)',
    quote: '300 năm cô độc dưới bóng tối... Đã đến lúc các ngươi phải nhớ tên ta!',
    bio: 'Boss tối thượng của học viện. Thực chất là chú mèo hộ vệ đầu tiên đã hy sinh phong ấn quái vật cổ xưa nhưng bị lịch sử lãng quên. Nỗi u uất biến ngài thành chúa tể bóng ma, trước khi được Momo thấu hiểu và giải thoát.'
  }
];

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
  TUTORIAL_COMPLETED: 'arcane_paws_tutorial_completed_v1',
  DIFFICULTY: 'arcane_paws_difficulty_v1'
};

