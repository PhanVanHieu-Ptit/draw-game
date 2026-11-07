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
  VICTORY: 'VICTORY',
  PRACTICE: 'PRACTICE'
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
  },
  circle: {
    id: 'circle',
    symbol: '❄️',
    name: 'Frost Nova',
    color: '#38bdf8',
    glow: '#0284c7',
    lightColor: '#e0f2fe',
    baseScore: 250,
    description: 'Đóng băng ngưng đọng tất cả u linh (khi có U Linh Băng Giá)'
  },
  spiral: {
    id: 'spiral',
    symbol: '🌀',
    name: 'Gale Shockwave',
    color: '#34d399',
    glow: '#059669',
    lightColor: '#d1fae5',
    baseScore: 250,
    description: 'Đẩy lùi u linh ra xa (khi có U Linh Cuồng Phong)'
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
  FREEZE: {
    type: 'FREEZE',
    name: 'U Linh Băng Giá',
    baseSpeed: 45,
    minSymbols: 1,
    maxSymbols: 1,
    radius: 27,
    color: '#bae6fd',
    glowColor: '#38bdf8',
    score: 300
  },
  BLAST: {
    type: 'BLAST',
    name: 'U Linh Cuồng Phong',
    baseSpeed: 48,
    minSymbols: 1,
    maxSymbols: 1,
    radius: 27,
    color: '#a7f3d0',
    glowColor: '#10b981',
    score: 300
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
    heartMult: 1.0,
    freezeMult: 1.0,
    blastMult: 1.0,
    squadBonus: 0,
    description: 'Thử thách cân bằng: U linh tấn công đông đảo theo bầy, tốc độ vừa phải dễ vẽ.'
  },
  HARDCORE: {
    id: 'HARDCORE',
    name: 'Ác Mộng',
    badge: '💀 ÁC MỘNG',
    speedMult: 1.15,
    spawnIntervalMult: 0.82,
    heartMult: 0.80,
    freezeMult: 0.85,
    blastMult: 0.85,
    squadBonus: 1,
    description: 'Ác mộng: Bầy ma đông đúc, ra liên tục nhiều con, ấn ký dài và hiểm!'
  },
  INFERNO: {
    id: 'INFERNO',
    name: 'Địa Ngục',
    badge: '⚡ ĐỊA NGỤC',
    speedMult: 1.30,
    spawnIntervalMult: 0.68,
    heartMult: 0.65,
    freezeMult: 0.75,
    blastMult: 0.75,
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
    baseSpawnInterval: 1.75,
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
    storyIntroQuote: 'Momo, cẩn thận! Sương mù này nuốt chữ trên gáy sách, rồi nuốt cả ký ức người đọc. Dùng nét [—] và [|] giải trừ tà khí!',
    bossSpawnQuote: 'Ai dám gây náo loạn trong thánh địa tri thức của ta?! Hai trăm năm không ai mở sách, thì kệ sách cũng chẳng cần chủ nữa!',
    bossDefeatQuote: 'Kính của ta trong sáng trở lại rồi. Cảm ơn Momo! Kẻ cướp Cổ Thư vừa chạy xuống Nhà Bếp, mau đuổi theo!'
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
    totalMinions: 20,
    baseSpawnInterval: 1.40,
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
    storyIntroQuote: 'Momo ơi! Tớ đem bánh quy và súp hồi máu [❤️] tới đây! Cẩn thận các nét [∧] và [∨] nhé!',
    bossSpawnQuote: 'Món súp lãng quên 100 năm của ta... không một kẻ phàm trần nào được phép chối từ!',
    bossDefeatQuote: 'Mùi thơm này... hóa ra món ngon nhất là có người ngồi ăn cùng. Lên Tháp Thiên Văn đi, hắn vừa chạy qua đó!'
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
    totalMinions: 26,
    baseSpawnInterval: 1.15,
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
    bossSpawnQuote: 'Quỹ đạo vũ trụ đã an bài! Chẳng ai ngước nhìn trời nữa, vậy thì để trời rơi xuống đầu các ngươi!',
    bossDefeatQuote: 'Ánh sao phương bắc đã chỉ lối. Kẻ thao túng đang mượn sức mạnh thể thao ở Nhà Đấu để gom năng lượng!'
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
    totalMinions: 34,
    baseSpawnInterval: 0.90,
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
    bossDefeatQuote: 'Tuýt! Hết giờ! Phản xạ xuất sắc, Momo! Cửa lên Sân Thượng đã mở. Hãy cứu lấy người đang đợi ở trên đó.'
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
      text: 'Tại Thư Viện Học Viện Mèo Arcane, Momo đang cùng bạn thân Oliver nghiên cứu Cổ Thư Nhật Thực, phong ấn bảo hộ học viện suốt ba trăm năm. Cô bé thắc mắc mãi: ở trang cuối có một chỗ bị gạch xóa, như thể ai đó đã cố quên một cái tên.',
      enText: 'In the quiet Arcane Paws library, wizard cat Momo and foodie pal Oliver study the Grimoire of Whispering Eclipse, the seal that has guarded the academy for 300 years. One name on the last page has been scratched out.',
      illustration: 'library_reading',
      actionPrompt: 'Tiếp Tục ➜'
    },
    {
      title: 'Phong Ấn Bị Phá Vỡ! Lời Nguyền Trăng Máu',
      enTitle: 'The Blood Moon Eclipse!',
      text: 'Bất thình lình Trăng Máu lên, một bóng ma khổng lồ xé toạc ô kính màu và cướp lấy Cổ Thư! Làn sương u linh tràn khắp học viện, nuốt chữ trên gáy sách và nuốt cả ký ức của các thầy cô. Ai bị sương chạm vào đều nổi giận, vì cảm thấy mình đã bị lãng quên.',
      enText: 'Suddenly the Blood Moon rises and a colossal phantom smashes through the stained glass, seizing the Grimoire! A fog of oblivion floods the academy, and everyone it touches rages because they feel forgotten.',
      illustration: 'ghost_theft',
      actionPrompt: 'Tiếp Tục ➜'
    },
    {
      title: 'Hội Mèo Xuất Kích: Cầm Đũa Phép Lên!',
      enTitle: 'Unite The Arcane Paws!',
      text: 'Được Oliver, Luna, Nyx và Viện Trưởng Barnaby tiếp thêm dũng khí, Momo vung đũa phép thần kỳ, vẽ nên các ấn ký cổ ngữ. Mỗi nét vẽ không chỉ đánh tan u linh, mà còn là một lời nhắn: “Tớ vẫn nhớ cậu.”',
      enText: 'Empowered by Oliver, Luna, Nyx and Archmage Barnaby, Momo raises the Obsidian Wand to draw sacred runes. Every stroke does more than banish a ghost: it says, "I still remember you."',
      illustration: 'cat_wand_ready',
      actionPrompt: 'VÀO TRẬN NGAY! ⚡'
    }
  ],
  VICTORY: [
    {
      title: 'Linh Hồn Hiệp Sĩ Umbra Được Giải Thoát!',
      enTitle: 'Lord Umbra Redeemed!',
      text: 'Đòn ma pháp thanh tẩy chan chứa tình bạn của Momo xé tan màn sương. Chúa Tể Bóng Ma gục xuống, hiện nguyên hình là Hộ Vệ Umbra cổ xưa: một hiệp sĩ mèo, kiếm run run trong tay, mắt rưng rưng như người vừa tỉnh sau cơn ác mộng ba trăm năm.',
      enText: 'Momo\'s brilliant light spell tears the fog apart. The Dark Lord kneels and turns back into the ancient knight guardian Umbra, trembling and teary-eyed after a 300-year nightmare.',
      illustration: 'boss_defeated'
    },
    {
      title: 'Cổ Thư Trở Về, Nhưng Cái Tên Vẫn Còn Lạc',
      enTitle: 'The Grimoire Returns, The Name Is Still Lost',
      text: 'Cổ Thư Nhật Thực nhẹ nhàng đáp xuống tay Momo, phong ấn sáng lại. “Cảm ơn con,” hiệp sĩ thì thầm. “Nhưng Umbra chỉ là cái tên sương mù đặt cho ta. Tên thật của ta… ta cũng không nhớ nữa.” Trên bìa sách hiện ra năm ô trống, chờ được lấp đầy.',
      enText: 'The Grimoire floats into Momo\'s paws and the seal glows again. "Umbra is only the name the fog gave me," the knight whispers. "I no longer remember my own." Five empty blanks appear on the cover.',
      illustration: 'book_recovered'
    },
    {
      title: 'Bữa Tiệc Tưng Bừng, Và Một Lời Hứa Nhỏ',
      enTitle: 'A Grand Celebration, and a Small Promise',
      text: 'Học viện rực rỡ pháo hoa! Oliver bưng đĩa bánh nướng, Luna chỉ lên bầu trời sao, Nyx cùng các thầy cô hân hoan ăn mừng. Chỉ Momo đứng lặng bên cửa sổ, nắm chặt đũa phép: “Nhất định tớ sẽ tìm ra cái tên ấy.” (Mở Nhật Ký Ký Ức để lần theo manh mối.)',
      enText: 'Fireworks light the midnight sky! Oliver brings pastries, Luna points at the stars, Nyx and the teachers cheer. Only Momo stands quietly at the window: "I will find that name." (Open the Memory Journal for clues.)',
      illustration: 'happy_celebration'
    }
  ],
  // Unlocked by keeping all five pledges (see core/Lore.js)
  TRUE_ENDING: [
    {
      title: 'Năm Chữ Cái, Một Cái Tên',
      enTitle: 'Five Letters, One Name',
      text: 'Momo đặt năm mảnh sáng lên bìa Cổ Thư: L, U, M, E, N. Từng chữ bừng lên như đom đóm rồi ghép lại. “Lumen,” Momo gọi khẽ. “Ánh sáng.” Màn sương đã đặt cho ngài cái tên Umbra, “bóng tối”, để ngài tin rằng mình vốn là thứ đáng bị quên.',
      enText: 'Momo places five glowing shards on the Grimoire: L, U, M, E, N. "Lumen," she whispers. "Light." The fog had named him Umbra, "shadow", so he would believe he deserved to be forgotten.',
      illustration: 'name_restored'
    },
    {
      title: 'Lời Thú Nhận Của Viện Trưởng Barnaby',
      enTitle: 'Barnaby\'s Confession',
      text: 'Tượng đá của Barnaby nứt ra, đôi mắt cú già ngân ngấn. “Ta là cậu học trò nhỏ của ngài ấy. Ta nhớ tên ngài suốt ba trăm năm, nhưng mỗi lần thốt ra, sương lại cắn đau, nên ta chọn im lặng.” Momo ôm lấy ông: “Nhớ là một việc, dám gọi là một việc khác. Hôm nay mình cùng gọi, thầy nhé.”',
      enText: 'Barnaby\'s stone shell cracks. "I was his little apprentice. I remembered his name for 300 years, but the fog bit me whenever I spoke it, so I stayed silent." Momo hugs him: "Remembering is one thing, daring to say it is another. Let\'s say it together."',
      illustration: 'barnaby_confession'
    },
    {
      title: 'Chòm Sao Hiệp Sĩ Lumen',
      enTitle: 'The Constellation of Knight Lumen',
      text: 'Cả học viện cùng cất tiếng gọi “Lumen!”, và trên bầu trời, chòm sao bị tẩy mất ba trăm năm sáng lên: một chú mèo hiệp sĩ ngồi gác. Từ nay, mỗi kỳ Trăng Máu ai cũng gọi tên ngài. Nhưng ngoài kia, còn biết bao cái tên khác đang chờ được gọi…',
      enText: 'The whole academy calls out "Lumen!" and the constellation erased for 300 years blazes back: a knight cat keeping watch. But out there, so many other names are still waiting to be called...',
      illustration: 'constellation_lumen',
      actionPrompt: 'Về Kết Quả ➜'
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
    text: 'Cổ Thư Nhật Thực vừa bị cướp mất! Sương mù bao trùm thư viện, khiến Madame Libraria, người thủ thư hai trăm năm chưa ai mở sách của bà, cuồng nộ điều khiển hàng ngàn kệ sách bay. Viện Trưởng Barnaby dạy Momo hai nét ma pháp cơ bản [—] và [|], rồi khẽ lảng đi khi Momo hỏi về cái tên bị gạch trong sách.',
    enText: 'The Grimoire is stolen! Dark mist fills the library and Madame Libraria, whose books nobody has opened in 200 years, flings possessed book stacks. Barnaby teaches Momo the horizontal [—] and vertical [|] runes, and quietly changes the subject when she asks about the scratched-out name.',
    quotes: {
      intro: LEVEL_CONFIGS[0].storyIntroQuote,
      boss: LEVEL_CONFIGS[0].bossSpawnQuote,
      defeat: LEVEL_CONFIGS[0].bossDefeatQuote
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
    text: 'Dưới hầm bếp, Bếp Trưởng Bouillon khuấy ngọn lửa ma thuật, ép mọi người nếm món súp lãng quên vì ông đã quá lâu không có ai ngồi ăn cùng. Oliver lăn xả tiếp tế súp hồi sinh lực [❤️]. Cùng nhau, họ vẽ ấn ký nhọn [∧] và [∨] dập tắt nồi súp ma, và Momo nhặt được một mảnh ký ức về ổ bánh cháy lúc nửa đêm.',
    enText: 'Down in the kitchen, Chef Bouillon forces everyone to taste the Soup of Oblivion because nobody has eaten with him in ages. Oliver rushes in with healing [❤️] soup as Momo casts the wedge runes [∧] [∨], and finds a memory of a burnt loaf shared at midnight.',
    quotes: {
      intro: LEVEL_CONFIGS[1].storyIntroQuote,
      boss: LEVEL_CONFIGS[1].bossSpawnQuote,
      defeat: LEVEL_CONFIGS[1].bossDefeatQuote
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
    text: 'Giáo sư Stella bị các vòng xoay hành tinh giam cầm trong ảo ảnh tận thế, vì suốt bao năm chẳng ai còn ngước nhìn bầu trời. Luna chỉ cho Momo một khoảng trống hình mèo trên bản đồ sao cổ, và truyền dạy Ấn Ký Sét [⚡] để đập tan quỹ đạo lạc lối.',
    enText: 'Professor Stella is trapped in cosmic illusions because nobody looks up at the sky anymore. Luna shows Momo a cat-shaped gap on the old star chart and teaches her the Lightning Rune [⚡] to shatter the stray orbits.',
    quotes: {
      intro: LEVEL_CONFIGS[2].storyIntroQuote,
      boss: LEVEL_CONFIGS[2].bossSpawnQuote,
      defeat: LEVEL_CONFIGS[2].bossDefeatQuote
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
    text: 'Sàn gỗ rực lửa bốc khói! Hàng loạt u linh siêu tốc lao vụt qua dưới tiếng còi thịnh nộ của Coach Striker, người thầy chỉ còn nhớ bước chân của một ai đó đã từng chạy chậm lại để chờ ông. Nhờ Nyx chỉ điểm, Momo vượt qua bài kiểm tra phản xạ và đoạt chìa khóa lên sân thượng.',
    enText: 'The gym floor blazes as speedster ghosts dart past Coach Striker\'s fierce whistle. He only remembers the footsteps of someone who once ran slower to wait for him. Guided by Nyx, Momo aces the agility trial and takes the key to the rooftop.',
    quotes: {
      intro: LEVEL_CONFIGS[3].storyIntroQuote,
      boss: LEVEL_CONFIGS[3].bossSpawnQuote,
      defeat: LEVEL_CONFIGS[3].bossDefeatQuote
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
    text: 'Dưới Trăng Máu trên đỉnh tháp chuông, Chúa Tể Umbra giáng đòn bão lốc từ Cổ Thư. Sự thật hé lộ: ngài là chú mèo hiệp sĩ đã tự ràng mình vào phong ấn cách đây ba trăm năm rồi bị lãng quên, và “Umbra” chỉ là cái tên sương mù đặt cho ngài. Bằng sự cảm thông, Momo đã giải thoát cho ngài.',
    enText: 'Under the Blood Moon on the bell tower, Lord Umbra unleashes the Grimoire. He is the knight cat who bound himself into the seal 300 years ago and was forgotten, and \'Umbra\' is just the name the fog gave him. Momo frees him with compassion.',
    quotes: {
      intro: LEVEL_CONFIGS[4].storyIntroQuote,
      boss: LEVEL_CONFIGS[4].bossSpawnQuote,
      defeat: LEVEL_CONFIGS[4].bossDefeatQuote
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

/**
 * Timing of the on-screen announcements at the start of a stage / a boss fight. Banner and spawner share
 * these so the first ghost (or the boss) never arrives while the banner is still on screen.
 */
export const INTRO_TIMING = {
  READY_MS: 1000,          // "CHUẨN BỊ SẴN SÀNG" before the DRAW cue
  DRAW_MS: 700,            // the "VẼ!" cue
  BOSS_WARNING_MS: 1500,   // boss warning banner; must end before the boss spawns (2.2 s warning - 0.45 s delay)
  FIRST_SPAWN_S: 2.3       // first ghost of a stage: banner (READY + DRAW = 1.7 s) + a short breather
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
  DIFFICULTY: 'arcane_paws_difficulty_v1',
  SETTINGS: 'arcane_paws_settings_v1',
  PROGRESS: 'arcane_paws_progress_v1',
  ENDLESS_SAVE: 'arcane_paws_endless_save_v1'
};

