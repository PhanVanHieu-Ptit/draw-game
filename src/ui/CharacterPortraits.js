/**
 * @file CharacterPortraits.js
 * @description High-fidelity SVG character portraits and lore visual assets for Magic Cat Academy.
 * Faithfully matches character story descriptions:
 * - Momo: Arcane black cat with amber eyes, wizard hat, and glowing lavender obsidian wand.
 * - Oliver: Chubby orange tabby alchemist with green apron, warm smile, and healing pastries.
 * - Luna: Pure white scholar with heterochromia (cyan/gold eyes), crescent moon tiara, and starlight.
 * - Nyx: Calico shadow-striker with speed headband, playful wink, and emerald wind trails.
 * - Barnaby: Wise grey horned owl with scholar spectacles, wizard mortarboard, and parchment scroll.
 * - Madame Libraria: Ethereal cyan ghost with reading glasses and floating antique grimoire.
 * - Chef Bouillon: Fiery orange specter with tall chef toque, curling mustache, and giant soup ladle.
 * - Professor Stella: Cosmic amethyst galaxy specter with planetary orbital rings and celestial orb.
 * - Coach Striker: Broad athletic emerald specter with referee whistle and sports headband.
 * - Lord Umbra: Imposing shadow feline knight with jagged crown, crimson eyes, and guardian crest.
 */

export const CHARACTER_LORE_DATA = {
  momo: {
    id: 'momo',
    name: 'Momo',
    title: 'Pháp Sư Mèo Đen',
    faction: 'ally',
    themeColor: '#c084fc',
    bgGradient: 'radial-gradient(circle, #2e1065 0%, #09090b 100%)',
    equipment: 'Đũa Phép Hắc Diện Thạch & Mũ Tinh Tú',
    location: 'Học Viện Arcane Paws (Nhân Vật Chính)',
    runes: ['—', '|', '∧', '∨', '⚡', '❤️'],
    chapterIndex: 1,
    quote: 'Nét vẽ quyết đoán sẽ cắt đứt mọi bóng tối!'
  },
  oliver: {
    id: 'oliver',
    name: 'Oliver Cam Cam',
    title: 'Dược Sĩ Bánh Quy',
    faction: 'ally',
    themeColor: '#fb923c',
    bgGradient: 'radial-gradient(circle, #431407 0%, #1c0a00 100%)',
    equipment: 'Tạp Dề Thảo Mộc & Vạc Bánh Quy Hồi Sinh',
    location: 'Màn 2: Nhà Ăn & Bếp Ma',
    runes: ['❤️'],
    chapterIndex: 2,
    quote: 'Đừng lo Momo! Bánh quy bơ mật ong hồi phục 100% sinh lực đây!'
  },
  luna: {
    id: 'luna',
    name: 'Luna Bạch Miêu',
    title: 'Học Giả Thiên Văn',
    faction: 'ally',
    themeColor: '#38bdf8',
    bgGradient: 'radial-gradient(circle, #082f49 0%, #030712 100%)',
    equipment: 'Vương Miện Trăng Khuyết & Kính Thiên Văn Cổ',
    location: 'Màn 3: Lớp Học Phép Thuật',
    runes: ['⚡'],
    chapterIndex: 3,
    quote: 'Chuyển động của các vì sao không bao giờ nói dối.'
  },
  nyx: {
    id: 'nyx',
    name: 'Nyx Tam Thể',
    title: 'Đạo Tặc Tốc Độ',
    faction: 'ally',
    themeColor: '#34d399',
    bgGradient: 'radial-gradient(circle, #064e3b 0%, #022c22 100%)',
    equipment: 'Khăn Choàng Tốc Biến & Găng Vuốt Gió',
    location: 'Màn 4: Nhà Thi Đấu Thể Thao',
    runes: ['—', '⚡'],
    chapterIndex: 4,
    quote: 'Nhanh hơn một cái chớp mắt, đó mới là nghệ thuật vung đũa!'
  },
  barnaby: {
    id: 'barnaby',
    name: 'Viện Trưởng Barnaby',
    title: 'Đại Pháp Sư Cú Già',
    faction: 'ally',
    themeColor: '#60a5fa',
    bgGradient: 'radial-gradient(circle, #1e3a8a 0%, #0f172a 100%)',
    equipment: 'Kính Hoàng Kim & Cuộn Cổ Thư Viện Trưởng',
    location: 'Màn 1 & Màn 5: Tháp Chuông Đỉnh Cao',
    runes: ['—', '|'],
    chapterIndex: 1,
    quote: 'Lòng can đảm của các em chính là phong ấn mạnh nhất trên đời.'
  },
  boss_librarian: {
    id: 'boss_librarian',
    name: 'Madame Libraria',
    title: 'Bóng Ma Thủ Thư',
    faction: 'spirit',
    themeColor: '#3b82f6',
    bgGradient: 'radial-gradient(circle, #172554 0%, #030712 100%)',
    equipment: 'Cổ Thư Khổng Lồ & Kính Đọc Ma Thuật',
    location: 'Boss Màn 1: Thư Viện Cổ Kính',
    runes: ['—', '|'],
    chapterIndex: 1,
    quote: 'Ai cho phép các ngươi gập góc cuốn bách khoa toàn thư?!'
  },
  boss_chef: {
    id: 'boss_chef',
    name: 'Chef Bouillon',
    title: 'Bóng Ma Đầu Bếp',
    faction: 'spirit',
    themeColor: '#f97316',
    bgGradient: 'radial-gradient(circle, #7c2d12 0%, #271206 100%)',
    equipment: 'Muôi Sắt Khổng Lồ & Nồi Súp Lãng Quên 100 Năm',
    location: 'Boss Màn 2: Nhà Ăn & Bếp Ma',
    runes: ['∧', '∨'],
    chapterIndex: 2,
    quote: 'Chưa nếm cạn nồi súp này thì không ai được rời khỏi bàn ăn!'
  },
  boss_planetarium: {
    id: 'boss_planetarium',
    name: 'Professor Stella',
    title: 'Bóng Ma Thiên Văn',
    faction: 'spirit',
    themeColor: '#c084fc',
    bgGradient: 'radial-gradient(circle, #581c87 0%, #1d0b36 100%)',
    equipment: 'Vành Đai Quỹ Đạo Sao Thổ & Cầu Ma Trận',
    location: 'Boss Màn 3: Lớp Học Thiên Văn',
    runes: ['⚡', '∧', '∨'],
    chapterIndex: 3,
    quote: 'Vũ trụ sắp va chạm! Hãy để các hành tinh nghiền nát tất cả!'
  },
  boss_coach: {
    id: 'boss_coach',
    name: 'Coach Striker',
    title: 'Bóng Ma Huấn Luyện Viên',
    faction: 'spirit',
    themeColor: '#34d399',
    bgGradient: 'radial-gradient(circle, #065f46 0%, #022c22 100%)',
    equipment: 'Còi Bão Táp & Bóng Linh Hồn Siêu Tốc',
    location: 'Boss Màn 4: Nhà Thi Đấu Thể Thao',
    runes: ['—', '|', '∧', '∨', '⚡'],
    chapterIndex: 4,
    quote: 'Hít đất 500 cái hoặc bị u linh dí chạy quanh sân!'
  },
  boss_master: {
    id: 'boss_master',
    name: 'Lord Umbra',
    title: 'Chúa Tể Bóng Đêm / Hiệp Sĩ Hộ Vệ Cổ',
    faction: 'spirit',
    themeColor: '#f43f5e',
    bgGradient: 'radial-gradient(circle, #4c0519 0%, #09090b 100%)',
    equipment: 'Vương Miện Pha Lê Tối & Giáp Hộ Vệ Cổ 300 Năm',
    location: 'Boss Tối Thượng Màn 5: Sân Thượng Lâu Đài',
    runes: ['—', '|', '∧', '∨', '⚡', '❤️'],
    chapterIndex: 5,
    quote: '300 năm cô độc dưới bóng tối... Đã đến lúc các ngươi phải nhớ tên ta!'
  }
};

/**
 * Generate scalable, highly stylized SVG portrait artwork for any character
 * @param {string} id Character identifier
 * @param {number} size Output width/height in pixels
 * @returns {string} SVG string markup
 */
export function getCharacterPortraitSvg(id, size = 64) {
  const normId = (id || '').toLowerCase().trim();

  switch (normId) {
    case 'momo':
      return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="char-portrait-svg" aria-label="Momo">
          <defs>
            <radialGradient id="momo-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#3b1a64" />
              <stop offset="100%" stop-color="#120624" />
            </radialGradient>
            <linearGradient id="momo-hat" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#7c3aed" />
              <stop offset="100%" stop-color="#4c1d95" />
            </linearGradient>
            <filter id="momo-wand-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#momo-bg)" stroke="#c084fc" stroke-width="2.5" />
          
          <!-- Outer Ears -->
          <polygon points="25,48 16,14 44,32" fill="#18181b" stroke="#3f3f46" stroke-width="1.5" />
          <polygon points="75,48 84,14 56,32" fill="#18181b" stroke="#3f3f46" stroke-width="1.5" />
          <!-- Inner Ears -->
          <polygon points="27,42 21,20 40,32" fill="#f472b6" />
          <polygon points="73,42 79,20 60,32" fill="#f472b6" />

          <!-- Face Shape -->
          <path d="M 24,52 C 22,76 78,76 76,52 C 76,38 24,38 24,52 Z" fill="#18181b" />
          <ellipse cx="50" cy="56" rx="28" ry="24" fill="#09090b" />

          <!-- Amber Eyes with Cat Slit & Twinkle -->
          <ellipse cx="38" cy="54" rx="7" ry="8.5" fill="#fbbf24" stroke="#d97706" stroke-width="1" />
          <ellipse cx="62" cy="54" rx="7" ry="8.5" fill="#fbbf24" stroke="#d97706" stroke-width="1" />
          <ellipse cx="38" cy="54" rx="2.5" ry="6.5" fill="#18181b" />
          <ellipse cx="62" cy="54" rx="2.5" ry="6.5" fill="#18181b" />
          <circle cx="36" cy="50" r="2" fill="#ffffff" />
          <circle cx="60" cy="50" r="2" fill="#ffffff" />

          <!-- Pink Nose & Whiskers -->
          <polygon points="50,65 47,62 53,62" fill="#f472b6" />
          <line x1="28" y1="62" x2="14" y2="60" stroke="#a1a1aa" stroke-width="1.5" stroke-linecap="round" />
          <line x1="28" y1="66" x2="12" y2="68" stroke="#a1a1aa" stroke-width="1.5" stroke-linecap="round" />
          <line x1="72" y1="62" x2="86" y2="60" stroke="#a1a1aa" stroke-width="1.5" stroke-linecap="round" />
          <line x1="72" y1="66" x2="88" y2="68" stroke="#a1a1aa" stroke-width="1.5" stroke-linecap="round" />

          <!-- Wizard Hat -->
          <path d="M 30,36 Q 50,8 60,6 Q 55,24 70,36 Z" fill="url(#momo-hat)" stroke="#c084fc" stroke-width="1.5" />
          <ellipse cx="50" cy="36" rx="25" ry="6" fill="#581c87" stroke="#c084fc" stroke-width="1.5" />
          <polygon points="50,33 52,38 48,38" fill="#fbbf24" />

          <!-- Obsidian Wand & Arcane Flame -->
          <g filter="url(#momo-wand-glow)">
            <line x1="72" y1="84" x2="86" y2="58" stroke="#3f3f46" stroke-width="3" stroke-linecap="round" />
            <circle cx="86" cy="56" r="4.5" fill="#c084fc" />
            <polygon points="86,47 88,54 94,56 88,58 86,65 84,58 78,56 84,54" fill="#f5d0fe" />
          </g>
        </svg>
      `;

    case 'oliver':
      return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="char-portrait-svg" aria-label="Oliver Cam Cam">
          <defs>
            <radialGradient id="oliver-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#7c2d12" />
              <stop offset="100%" stop-color="#271206" />
            </radialGradient>
            <linearGradient id="croissant-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fef08a" />
              <stop offset="50%" stop-color="#f59e0b" />
              <stop offset="100%" stop-color="#b45309" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#oliver-bg)" stroke="#fb923c" stroke-width="2.5" />

          <!-- Chubby Rounded Ears -->
          <path d="M 20,44 Q 14,18 38,28 Z" fill="#ea580c" stroke="#c2410c" stroke-width="1.5" />
          <path d="M 80,44 Q 86,18 62,28 Z" fill="#ea580c" stroke="#c2410c" stroke-width="1.5" />
          <path d="M 23,40 Q 18,22 34,30 Z" fill="#fed7aa" />
          <path d="M 77,40 Q 82,22 66,30 Z" fill="#fed7aa" />

          <!-- Chubby Ginger Tabby Face -->
          <circle cx="50" cy="56" r="32" fill="#fb923c" />
          <!-- Tabby Forehead Stripes -->
          <path d="M 44,30 L 46,38 M 50,28 L 50,40 M 56,30 L 54,38" stroke="#c2410c" stroke-width="2.5" stroke-linecap="round" />

          <!-- Cheerful Chubby Cream Cheeks -->
          <ellipse cx="40" cy="65" rx="14" ry="11" fill="#fffbeb" />
          <ellipse cx="60" cy="65" rx="14" ry="11" fill="#fffbeb" />
          <!-- Blushing Cheeks -->
          <circle cx="30" cy="62" r="5" fill="#f87171" opacity="0.6" />
          <circle cx="70" cy="62" r="5" fill="#f87171" opacity="0.6" />

          <!-- Happy Curved Squinting Eyes -->
          <path d="M 33,52 Q 40,46 47,52" fill="none" stroke="#7c2d12" stroke-width="3" stroke-linecap="round" />
          <path d="M 53,52 Q 60,46 67,52" fill="none" stroke="#7c2d12" stroke-width="3" stroke-linecap="round" />

          <!-- Cute Button Nose & Smiling Mouth -->
          <polygon points="50,60 46,57 54,57" fill="#fb7185" />
          <path d="M 45,64 Q 50,68 55,64" fill="none" stroke="#7c2d12" stroke-width="2" stroke-linecap="round" />

          <!-- Alchemist Green Apron / Bow -->
          <path d="M 36,80 Q 50,86 64,80 L 62,94 Q 50,96 38,94 Z" fill="#10b981" stroke="#059669" stroke-width="1.5" />
          <circle cx="50" cy="85" r="3.5" fill="#f43f5e" />

          <!-- Warm Golden Croissant with Heart Steam -->
          <g transform="translate(64, 62) scale(0.65)">
            <path d="M 8,24 Q 24,6 40,24 Q 30,32 8,24 Z" fill="url(#croissant-gold)" stroke="#78350f" stroke-width="2" />
            <path d="M 24,0 Q 20,-6 14,-6 Q 8,-6 8,0 Q 8,8 24,18 Q 40,8 40,0 Q 40,-6 34,-6 Q 28,-6 24,0 Z" fill="#f43f5e" transform="translate(4, -14) scale(0.4)" />
          </g>
        </svg>
      `;

    case 'luna':
      return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="char-portrait-svg" aria-label="Luna Bạch Miêu">
          <defs>
            <radialGradient id="luna-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#0c4a6e" />
              <stop offset="100%" stop-color="#030712" />
            </radialGradient>
            <linearGradient id="crescent-silver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffffff" />
              <stop offset="100%" stop-color="#93c5fd" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#luna-bg)" stroke="#38bdf8" stroke-width="2.5" />

          <!-- Slender White Ears -->
          <polygon points="24,46 16,16 42,32" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <polygon points="76,46 84,16 58,32" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <polygon points="26,42 20,22 39,32" fill="#fbcfe8" />
          <polygon points="74,42 80,22 61,32" fill="#fbcfe8" />

          <!-- Elegant Fluffy White Face -->
          <circle cx="50" cy="54" r="30" fill="#ffffff" />
          <ellipse cx="26" cy="58" rx="6" ry="10" fill="#ffffff" />
          <ellipse cx="74" cy="58" rx="6" ry="10" fill="#ffffff" />

          <!-- Heterochromia Eyes (Left Cyan, Right Amber Gold) -->
          <!-- Left Eye: Cyan -->
          <ellipse cx="38" cy="53" rx="7" ry="8.5" fill="#38bdf8" stroke="#0284c7" stroke-width="1.2" />
          <circle cx="38" cy="53" r="3" fill="#0f172a" />
          <circle cx="36" cy="49" r="2.2" fill="#ffffff" />
          <circle cx="41" cy="55" r="1.2" fill="#ffffff" />

          <!-- Right Eye: Golden Amber -->
          <ellipse cx="62" cy="53" rx="7" ry="8.5" fill="#fbbf24" stroke="#d97706" stroke-width="1.2" />
          <circle cx="62" cy="53" r="3" fill="#0f172a" />
          <circle cx="60" cy="49" r="2.2" fill="#ffffff" />
          <circle cx="65" cy="55" r="1.2" fill="#ffffff" />

          <!-- Delicate Pink Nose -->
          <polygon points="50,62 47,59 53,59" fill="#f472b6" />
          <path d="M 46,65 Q 50,68 54,65" fill="none" stroke="#cbd5e1" stroke-width="1.5" />

          <!-- Crescent Moon Forehead Tiara -->
          <path d="M 50,30 Q 56,36 50,42 Q 44,36 50,30 Z" fill="none" />
          <path d="M 46,28 A 8 8 0 0 0 54,40 A 6 6 0 0 1 46,28 Z" fill="url(#crescent-silver)" stroke="#60a5fa" stroke-width="1" />
          <circle cx="50" cy="34" r="1.5" fill="#38bdf8" />

          <!-- Starlight Sparkles -->
          <polygon points="20,70 22,74 26,75 22,76 20,80 18,76 14,75 18,74" fill="#38bdf8" />
          <polygon points="78,32 79,35 82,36 79,37 78,40 77,37 74,36 77,35" fill="#fbbf24" />
        </svg>
      `;

    case 'nyx':
      return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="char-portrait-svg" aria-label="Nyx Tam Thể">
          <defs>
            <radialGradient id="nyx-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#064e3b" />
              <stop offset="100%" stop-color="#022c22" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#nyx-bg)" stroke="#34d399" stroke-width="2.5" />

          <!-- Calico Patch Ears -->
          <!-- Left Ear: Midnight Onyx -->
          <polygon points="25,46 16,16 42,32" fill="#18181b" stroke="#3f3f46" stroke-width="1.5" />
          <polygon points="27,42 21,22 38,32" fill="#f472b6" />
          <!-- Right Ear: Ginger Orange -->
          <polygon points="75,46 84,16 58,32" fill="#ea580c" stroke="#c2410c" stroke-width="1.5" />
          <polygon points="73,42 79,22 62,32" fill="#fed7aa" />

          <!-- Calico Base Face (Ivory White) -->
          <circle cx="50" cy="55" r="30" fill="#fef08a" />
          <!-- Black Onyx Patch over Left Eye -->
          <path d="M 28,40 Q 22,58 38,62 Q 46,54 44,40 Z" fill="#18181b" />
          <!-- Ginger Patch over Right Brow -->
          <path d="M 58,35 Q 74,38 72,52 Q 62,48 58,35 Z" fill="#ea580c" />

          <!-- Left Eye: Cheeky Wink ^ -->
          <path d="M 33,52 L 37,48 L 41,52" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

          <!-- Right Eye: Vibrant Emerald Green with Smirk -->
          <ellipse cx="62" cy="51" rx="6.5" ry="8" fill="#10b981" stroke="#047857" stroke-width="1.2" />
          <ellipse cx="62" cy="51" rx="2.5" ry="6" fill="#064e3b" />
          <circle cx="60" cy="48" r="2" fill="#ffffff" />

          <!-- Playful Smirk Nose & Mouth -->
          <polygon points="50,61 47,58 53,58" fill="#f472b6" />
          <path d="M 48,64 Q 56,68 60,63" fill="none" stroke="#78350f" stroke-width="2" stroke-linecap="round" />

          <!-- Emerald Agility Headband with Wingtails -->
          <path d="M 22,38 Q 50,32 78,38 L 76,43 Q 50,37 24,43 Z" fill="#059669" stroke="#34d399" stroke-width="1" />
          <polygon points="80,36 94,32 86,42" fill="#10b981" />

          <!-- Speed Trails & Sparks -->
          <path d="M 12,68 L 24,66 M 10,74 L 20,72" stroke="#34d399" stroke-width="2" stroke-linecap="round" />
          <polygon points="82,64 85,68 89,66 86,72 82,64" fill="#fbbf24" />
        </svg>
      `;

    case 'barnaby':
      return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="char-portrait-svg" aria-label="Viện Trưởng Barnaby">
          <defs>
            <radialGradient id="barnaby-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#1e3a8a" />
              <stop offset="100%" stop-color="#0f172a" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#barnaby-bg)" stroke="#60a5fa" stroke-width="2.5" />

          <!-- Horned Owl Ear Tufts -->
          <polygon points="26,38 12,14 38,24" fill="#334155" stroke="#64748b" stroke-width="1.5" />
          <polygon points="74,38 88,14 62,24" fill="#334155" stroke="#64748b" stroke-width="1.5" />
          <polygon points="24,32 16,18 32,24" fill="#94a3b8" />
          <polygon points="76,32 84,18 68,24" fill="#94a3b8" />

          <!-- Slate Grey Feathery Body & Head -->
          <ellipse cx="50" cy="56" rx="32" ry="28" fill="#475569" />
          <!-- Cream Facial Disc Tuft -->
          <path d="M 28,52 Q 50,60 50,68 Q 50,60 72,52 Q 78,38 50,44 Q 22,38 28,52 Z" fill="#f1f5f9" opacity="0.9" />

          <!-- Golden Scholar Spectacles -->
          <circle cx="37" cy="50" r="10" fill="none" stroke="#fbbf24" stroke-width="2.5" />
          <circle cx="63" cy="50" r="10" fill="none" stroke="#fbbf24" stroke-width="2.5" />
          <line x1="47" y1="50" x2="53" y2="50" stroke="#fbbf24" stroke-width="2.5" />

          <!-- Yellow Wise Owl Eyes -->
          <circle cx="37" cy="50" r="7" fill="#fef08a" />
          <circle cx="63" cy="50" r="7" fill="#fef08a" />
          <circle cx="37" cy="50" r="3.5" fill="#0f172a" />
          <circle cx="63" cy="50" r="3.5" fill="#0f172a" />
          <circle cx="35" cy="48" r="1.5" fill="#ffffff" />
          <circle cx="61" cy="48" r="1.5" fill="#ffffff" />

          <!-- Curved Amber Beak -->
          <polygon points="50,54 46,62 50,68 54,62" fill="#d97706" />

          <!-- Archmage Mortarboard / Hat with Golden Star -->
          <polygon points="50,14 84,24 50,30 16,24" fill="#1e40af" stroke="#60a5fa" stroke-width="1.5" />
          <polygon points="50,18 52,22 56,22 53,24 54,28 50,25 46,28 47,24 44,22 48,22" fill="#fbbf24" />
          <!-- Gold Dangling Tassel -->
          <path d="M 50,22 Q 78,24 82,36" fill="none" stroke="#fbbf24" stroke-width="1.8" />
          <circle cx="82" cy="37" r="2.5" fill="#f59e0b" />

          <!-- Curled Ancient Parchment Scroll -->
          <rect x="36" y="80" width="28" height="12" rx="4" fill="#fed7aa" stroke="#d97706" stroke-width="1.2" />
          <line x1="42" y1="84" x2="58" y2="84" stroke="#b45309" stroke-width="1" />
          <line x1="42" y1="88" x2="54" y2="88" stroke="#b45309" stroke-width="1" />
        </svg>
      `;

    case 'boss_librarian':
      return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="char-portrait-svg" aria-label="Madame Libraria">
          <defs>
            <radialGradient id="lib-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#1e3a8a" />
              <stop offset="100%" stop-color="#030712" />
            </radialGradient>
            <linearGradient id="ghost-cyan" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#7dd3fc" />
              <stop offset="60%" stop-color="#38bdf8" />
              <stop offset="100%" stop-color="#0284c7" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#lib-bg)" stroke="#3b82f6" stroke-width="2.5" />

          <!-- Spectral Flowing Ghost Body -->
          <path d="M 50,20 Q 24,20 24,54 Q 24,78 32,84 Q 40,88 48,82 Q 56,88 64,82 Q 72,88 76,78 Q 76,20 50,20 Z" fill="url(#ghost-cyan)" opacity="0.9" />

          <!-- Librarian Spectacles with Chain -->
          <circle cx="40" cy="46" r="7.5" fill="none" stroke="#e0f2fe" stroke-width="2" />
          <circle cx="60" cy="46" r="7.5" fill="none" stroke="#e0f2fe" stroke-width="2" />
          <line x1="47.5" y1="46" x2="52.5" y2="46" stroke="#e0f2fe" stroke-width="2" />
          <path d="M 67.5,46 Q 74,56 70,68" fill="none" stroke="#bae6fd" stroke-width="1" stroke-dasharray="1 1.5" />

          <!-- Ethereal Glowing White Eyes -->
          <circle cx="40" cy="46" r="4" fill="#ffffff" />
          <circle cx="60" cy="46" r="4" fill="#ffffff" />

          <!-- Strict but Elegant Spectral Bun -->
          <circle cx="50" cy="18" r="8" fill="#38bdf8" stroke="#bae6fd" stroke-width="1" />

          <!-- Glowing Antique Open Grimoire -->
          <g transform="translate(26, 62)">
            <path d="M 2,18 Q 24,12 24,2 L 24,20 Q 12,24 2,24 Z" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.2" />
            <path d="M 46,18 Q 24,12 24,2 L 24,20 Q 36,24 46,24 Z" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.2" />
            <path d="M 4,16 Q 24,10 24,3 L 24,19 Q 14,22 4,22 Z" fill="#e0f2fe" />
            <path d="M 44,16 Q 24,10 24,3 L 24,19 Q 34,22 44,22 Z" fill="#e0f2fe" />
            <!-- Runes: — and | -->
            <line x1="10" y1="12" x2="18" y2="12" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round" />
            <line x1="34" y1="8" x2="34" y2="16" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round" />
          </g>
        </svg>
      `;

    case 'boss_chef':
      return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="char-portrait-svg" aria-label="Chef Bouillon">
          <defs>
            <radialGradient id="chef-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#7c2d12" />
              <stop offset="100%" stop-color="#1c0a00" />
            </radialGradient>
            <linearGradient id="ghost-flame" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#fed7aa" />
              <stop offset="40%" stop-color="#fb923c" />
              <stop offset="100%" stop-color="#ea580c" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#chef-bg)" stroke="#f97316" stroke-width="2.5" />

          <!-- Flame Ghost Silhouette -->
          <path d="M 50,32 Q 22,32 22,62 Q 22,86 36,88 Q 44,80 50,88 Q 56,80 64,88 Q 78,86 78,62 Q 78,32 50,32 Z" fill="url(#ghost-flame)" opacity="0.95" />

          <!-- Towering Pleated Chef Toque -->
          <path d="M 32,32 Q 26,14 40,8 Q 50,2 60,8 Q 74,14 68,32 Z" fill="#ffffff" stroke="#fed7aa" stroke-width="1.5" />
          <path d="M 32,32 L 68,32 L 66,37 L 34,37 Z" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1" />

          <!-- Big Jolly Ghost Eyes -->
          <ellipse cx="40" cy="48" rx="5" ry="6" fill="#431407" />
          <ellipse cx="60" cy="48" rx="5" ry="6" fill="#431407" />
          <circle cx="38" cy="46" r="1.8" fill="#ffffff" />
          <circle cx="58" cy="46" r="1.8" fill="#ffffff" />

          <!-- Curling Chef Mustache & Big Grin -->
          <path d="M 50,56 Q 42,52 34,55 Q 30,58 32,62 Q 36,60 42,58 Q 50,62 58,58 Q 64,60 68,62 Q 70,58 66,55 Q 58,52 50,56 Z" fill="#7c2d12" />
          <path d="M 44,63 Q 50,72 56,63" fill="#991b1b" stroke="#7c2d12" stroke-width="1.2" />

          <!-- Giant Iron Cauldron Ladle with Broth -->
          <g transform="translate(70, 52) rotate(24)">
            <line x1="0" y1="0" x2="0" y2="34" stroke="#94a3b8" stroke-width="3" stroke-linecap="round" />
            <ellipse cx="0" cy="34" rx="8" ry="5" fill="#475569" />
            <circle cx="-2" cy="28" r="3" fill="#f97316" />
          </g>
        </svg>
      `;

    case 'boss_planetarium':
      return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="char-portrait-svg" aria-label="Professor Stella">
          <defs>
            <radialGradient id="stella-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#581c87" />
              <stop offset="100%" stop-color="#0f0728" />
            </radialGradient>
            <linearGradient id="cosmic-ghost" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#e9d5ff" />
              <stop offset="50%" stop-color="#c084fc" />
              <stop offset="100%" stop-color="#7e22ce" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#stella-bg)" stroke="#c084fc" stroke-width="2.5" />

          <!-- Planetary Orbit Rings (Behind Body) -->
          <ellipse cx="50" cy="48" rx="42" ry="14" fill="none" stroke="#f472b6" stroke-width="2.5" stroke-dasharray="8 3" transform="rotate(-18 50 48)" opacity="0.6" />

          <!-- Cosmic Starry Ghost Body -->
          <path d="M 50,24 Q 24,24 24,56 Q 24,80 34,86 Q 44,78 50,86 Q 56,78 66,86 Q 76,80 76,56 Q 76,24 50,24 Z" fill="url(#cosmic-ghost)" opacity="0.92" />

          <!-- Planetary Orbit Rings (In Front of Body) -->
          <path d="M 12,56 Q 50,72 88,40" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" />
          <circle cx="82" cy="42" r="4.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1" />
          <circle cx="20" cy="58" r="3" fill="#f43f5e" />

          <!-- Starry Glowing Eyes -->
          <circle cx="40" cy="48" r="4.5" fill="#ffffff" />
          <circle cx="60" cy="48" r="4.5" fill="#ffffff" />
          <polygon points="40,41 42,46 47,48 42,50 40,55 38,50 33,48 38,46" fill="#e0e7ff" transform="scale(0.6) translate(28, 30)" />
          <polygon points="60,41 62,46 67,48 62,50 60,55 58,50 53,48 58,46" fill="#e0e7ff" transform="scale(0.6) translate(40, 30)" />

          <!-- Celestial Orb & Lightning Rune ⚡ -->
          <g transform="translate(50, 74)">
            <circle cx="0" cy="0" r="9" fill="#7e22ce" stroke="#e9d5ff" stroke-width="1.5" />
            <polygon points="-1,-5 3,-5 0,-1 3,-1 -2,5 0,1 -3,1" fill="#fbbf24" />
          </g>
        </svg>
      `;

    case 'boss_coach':
      return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="char-portrait-svg" aria-label="Coach Striker">
          <defs>
            <radialGradient id="coach-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#065f46" />
              <stop offset="100%" stop-color="#022c22" />
            </radialGradient>
            <linearGradient id="athletic-ghost" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#a7f3d0" />
              <stop offset="45%" stop-color="#34d399" />
              <stop offset="100%" stop-color="#059669" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#coach-bg)" stroke="#34d399" stroke-width="2.5" />

          <!-- Broad-Shouldered Muscular Specter -->
          <path d="M 50,22 Q 18,22 18,52 Q 18,74 24,84 Q 38,78 50,86 Q 62,78 76,84 Q 82,74 82,52 Q 82,22 50,22 Z" fill="url(#athletic-ghost)" opacity="0.95" />

          <!-- White Athletic Sweatband with Lightning Logo -->
          <rect x="22" y="32" width="56" height="11" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
          <polygon points="49,34 52,34 50,37 53,37 48,41 49,38 47,38" fill="#10b981" />

          <!-- Fierce Athletic Ghost Eyes with Thick Brows -->
          <path d="M 33,43 L 45,46" stroke="#064e3b" stroke-width="3" stroke-linecap="round" />
          <path d="M 67,43 L 55,46" stroke="#064e3b" stroke-width="3" stroke-linecap="round" />
          <circle cx="39" cy="50" r="4" fill="#064e3b" />
          <circle cx="61" cy="50" r="4" fill="#064e3b" />
          <circle cx="38" cy="48" r="1.5" fill="#ffffff" />
          <circle cx="60" cy="48" r="1.5" fill="#ffffff" />

          <!-- Determined Smirk -->
          <path d="M 44,60 Q 50,64 56,60" fill="none" stroke="#064e3b" stroke-width="2.5" stroke-linecap="round" />

          <!-- Silver Referee Whistle on Red Lanyard -->
          <path d="M 40,64 Q 50,74 50,76 Q 50,74 60,64" fill="none" stroke="#ef4444" stroke-width="2" />
          <rect x="46" y="74" width="8" height="6" rx="2" fill="#e2e8f0" stroke="#64748b" stroke-width="1" />
          <circle cx="48" cy="80" r="3" fill="#cbd5e1" />

          <!-- Speed Wave Sparks -->
          <path d="M 12,40 L 18,48 M 88,40 L 82,48" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" />
        </svg>
      `;

    case 'boss_master':
      return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="char-portrait-svg" aria-label="Lord Umbra">
          <defs>
            <radialGradient id="umbra-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#4c0519" />
              <stop offset="100%" stop-color="#09090b" />
            </radialGradient>
            <linearGradient id="umbra-void" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#2e1065" />
              <stop offset="50%" stop-color="#18052e" />
              <stop offset="100%" stop-color="#09090b" />
            </linearGradient>
            <filter id="crimson-eye-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#umbra-bg)" stroke="#f43f5e" stroke-width="2.5" />

          <!-- Horned Feline Knight Pauldrons -->
          <path d="M 14,78 Q 28,60 36,68 L 30,86 Z" fill="#2e1065" stroke="#f43f5e" stroke-width="1.2" />
          <path d="M 86,78 Q 72,60 64,68 L 70,86 Z" fill="#2e1065" stroke="#f43f5e" stroke-width="1.2" />

          <!-- Obsidian Void Head Shape -->
          <path d="M 50,22 Q 22,22 24,56 Q 24,80 50,84 Q 76,80 76,56 Q 78,22 50,22 Z" fill="url(#umbra-void)" stroke="#7c3aed" stroke-width="1.5" />

          <!-- Ancient Knight Cat Ears -->
          <polygon points="26,38 14,12 40,24" fill="#09090b" stroke="#7c3aed" stroke-width="1.5" />
          <polygon points="74,38 86,12 60,24" fill="#09090b" stroke="#7c3aed" stroke-width="1.5" />
          <polygon points="26,32 18,18 34,24" fill="#4c0519" />
          <polygon points="74,32 82,18 66,24" fill="#4c0519" />

          <!-- Crown of Spiky Violet Crystal Spikes -->
          <polygon points="32,24 36,8 42,22" fill="#9333ea" stroke="#c084fc" stroke-width="1" />
          <polygon points="44,22 50,4 56,22" fill="#c084fc" stroke="#f5d0fe" stroke-width="1" />
          <polygon points="58,22 64,8 68,24" fill="#9333ea" stroke="#c084fc" stroke-width="1" />

          <!-- Dual Piercing Crimson Glowing Eyes with Smoke Trails -->
          <g filter="url(#crimson-eye-glow)">
            <ellipse cx="38" cy="48" rx="7" ry="4" fill="#ef4444" stroke="#f43f5e" stroke-width="1.5" transform="rotate(-8 38 48)" />
            <ellipse cx="62" cy="48" rx="7" ry="4" fill="#ef4444" stroke="#f43f5e" stroke-width="1.5" transform="rotate(8 62 48)" />
            <ellipse cx="38" cy="48" rx="2" ry="3" fill="#ffffff" />
            <ellipse cx="62" cy="48" rx="2" ry="3" fill="#ffffff" />
            <!-- Crimson Smoke Tendrils -->
            <path d="M 32,48 Q 20,44 14,52" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" opacity="0.8" />
            <path d="M 68,48 Q 80,44 86,52" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" opacity="0.8" />
          </g>

          <!-- Ancient Guardian Crest (Subtle Gold Hint of Redemption) -->
          <polygon points="50,68 56,76 50,82 44,76" fill="#fbbf24" stroke="#f59e0b" stroke-width="1" />
          <circle cx="50" cy="76" r="2" fill="#ef4444" />
        </svg>
      `;

    default:
      return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="char-portrait-svg">
          <circle cx="50" cy="50" r="48" fill="#18181b" stroke="#71717a" stroke-width="2" />
          <text x="50" y="58" font-size="32" text-anchor="middle" fill="#ffffff">🐾</text>
        </svg>
      `;
  }
}

/**
 * Get companion visual info by level number (1..5)
 * @param {number} level 
 * @returns {object} Companion info
 */
export function getCompanionForLevel(level) {
  switch (level) {
    case 1:
      return {
        id: 'barnaby',
        name: 'Viện Trưởng Barnaby',
        role: 'Đại Pháp Sư Cú Già',
        color: '#60a5fa',
        actionHint: 'Chỉ dẫn Cổ Ngữ [—] và [|]',
        svg: getCharacterPortraitSvg('barnaby', 34)
      };
    case 2:
      return {
        id: 'oliver',
        name: 'Oliver Cam Cam',
        role: 'Dược Sĩ Bánh Quy',
        color: '#fb923c',
        actionHint: 'Tiếp tế súp hồi máu [❤️]',
        svg: getCharacterPortraitSvg('oliver', 34)
      };
    case 3:
      return {
        id: 'luna',
        name: 'Luna Bạch Miêu',
        role: 'Học Giả Thiên Văn',
        color: '#38bdf8',
        actionHint: 'Phá giáp thiên cầu [⚡]',
        svg: getCharacterPortraitSvg('luna', 34)
      };
    case 4:
      return {
        id: 'nyx',
        name: 'Nyx Tam Thể',
        role: 'Đạo Tặc Tốc Độ',
        color: '#34d399',
        actionHint: 'Cảnh giới siêu tốc [—]',
        svg: getCharacterPortraitSvg('nyx', 34)
      };
    case 5:
    default:
      return {
        id: 'momo',
        name: 'Liên Minh Arcane Paws',
        role: 'Momo & Những Người Bạn',
        color: '#f43f5e',
        actionHint: 'Hợp lực Trăng Máu [🌟]',
        svg: getCharacterPortraitSvg('momo', 34)
      };
  }
}
