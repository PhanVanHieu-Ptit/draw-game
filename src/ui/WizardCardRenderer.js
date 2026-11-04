/**
 * @file WizardCardRenderer.js
 * @description Renders a high-resolution, visually stunning "Wizard Cat License" (Thẻ Căn Cước Pháp Sư Mèo)
 * on an HTML5 Canvas for instant social media sharing, download, and clipboard copy.
 */

/**
 * Calculate player's Wizard Rank based on battle performance
 * @param {Object} data 
 * @returns {Object} Rank metadata
 */
export function calculateWizardRank(data = {}) {
  const score = data.score || 0;
  const isVictory = !!data.isVictory;
  const accuracy = data.accuracy !== undefined ? data.accuracy : 100;

  if (isVictory && score >= 12000 && accuracy >= 88) {
    return {
      grade: 'SSS',
      title: 'ĐẠI PHÁP SƯ TỐI CAO',
      enTitle: 'Grand Archmage',
      color: '#fbbf24',
      glow: '#f59e0b',
      badgeBg: 'rgba(251, 191, 36, 0.22)',
      badgeBorder: '#fbbf24',
      desc: 'Huyền thoại học viện! Nắm giữ toàn bộ 8 bí pháp thần chú tối thượng.'
    };
  }
  if (score >= 8000 || isVictory) {
    return {
      grade: 'SS',
      title: 'PHÁP SƯ THƯỢNG ĐẲNG',
      enTitle: 'Master Wizard',
      color: '#c084fc',
      glow: '#9333ea',
      badgeBg: 'rgba(192, 132, 252, 0.22)',
      badgeBorder: '#c084fc',
      desc: 'Bậc thầy vung đũa phép! Đã thanh tẩy u linh cứu viện học viện.'
    };
  }
  if (score >= 4500) {
    return {
      grade: 'S',
      title: 'PHÁP SƯ TINH ANH',
      enTitle: 'Elite Sorcerer',
      color: '#38bdf8',
      glow: '#0284c7',
      badgeBg: 'rgba(56, 189, 248, 0.22)',
      badgeBorder: '#38bdf8',
      desc: 'Phản xạ thần tốc, đường vẽ dứt khoát đẩy lùi bầy quái vật đông đảo.'
    };
  }
  if (score >= 2200) {
    return {
      grade: 'A',
      title: 'PHÁP SƯ CHÍNH THỨC',
      enTitle: 'Licensed Mage',
      color: '#34d399',
      glow: '#059669',
      badgeBg: 'rgba(52, 211, 153, 0.22)',
      badgeBorder: '#34d399',
      desc: 'Đủ tư cách mang đũa phép cổ ngữ và bảo vệ khuôn viên học viện.'
    };
  }
  if (score >= 1000) {
    return {
      grade: 'B',
      title: 'HỌC VIÊN XUẤT SẮC',
      enTitle: 'Adept Apprentice',
      color: '#f97316',
      glow: '#ea580c',
      badgeBg: 'rgba(249, 115, 22, 0.22)',
      badgeBorder: '#f97316',
      desc: 'Nắm vững các ấn ký cơ bản, tiềm năng phép thuật vô cùng rộng mở.'
    };
  }
  return {
    grade: 'C',
    title: 'PHÙ THỦY TẬP SỰ',
    enTitle: 'Novice Witch',
    color: '#a78bfa',
    glow: '#7c3aed',
    badgeBg: 'rgba(167, 139, 250, 0.22)',
    badgeBorder: '#a78bfa',
    desc: 'Học viên năm nhất mới bước chân vào thánh đường ma pháp Arcane Paws.'
  };
}

/**
 * Format duration in seconds to MM:SS
 * @param {number} totalSeconds 
 * @returns {string}
 */
function formatTime(totalSeconds = 0) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Draw Momo the wizard cat procedurally inside a medallion
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} cx Center X
 * @param {number} cy Center Y
 * @param {number} radius Radius of medallion
 */
function drawMomoMedallion(ctx, cx, cy, radius) {
  ctx.save();

  // Outer glowing aura
  const auraGrad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.3);
  auraGrad.addColorStop(0, 'rgba(147, 51, 234, 0.45)');
  auraGrad.addColorStop(0.6, 'rgba(59, 130, 246, 0.25)');
  auraGrad.addColorStop(1, 'rgba(10, 8, 24, 0)');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Medallion inner circle background
  const innerGrad = ctx.createRadialGradient(cx, cy - radius * 0.2, radius * 0.1, cx, cy, radius);
  innerGrad.addColorStop(0, '#241242');
  innerGrad.addColorStop(0.7, '#130926');
  innerGrad.addColorStop(1, '#090514');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Circular clip for portrait elements
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 3, 0, Math.PI * 2);
  ctx.clip();

  // Subtle starry sparkles in portrait backdrop
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  const starOffsets = [
    [-35, -45], [42, -50], [-55, 10], [50, 20], [-25, 55], [35, 60]
  ];
  starOffsets.forEach(([ox, oy]) => {
    ctx.fillRect(cx + ox, cy + oy, 2, 2);
  });

  // --- Momo Character Illustration ---
  const catScale = radius / 75;
  const headY = cy + 5 * catScale;

  // Momo Body (Black Cat)
  ctx.fillStyle = '#171324';
  ctx.beginPath();
  ctx.ellipse(cx, headY + 38 * catScale, 32 * catScale, 26 * catScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crimson Scarf
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.ellipse(cx, headY + 22 * catScale, 24 * catScale, 10 * catScale, 0, 0, Math.PI * 2);
  ctx.fill();
  // Scarf tails
  ctx.beginPath();
  ctx.moveTo(cx - 8 * catScale, headY + 24 * catScale);
  ctx.lineTo(cx - 16 * catScale, headY + 50 * catScale);
  ctx.lineTo(cx - 3 * catScale, headY + 48 * catScale);
  ctx.closePath();
  ctx.fill();

  // Cat Head
  ctx.fillStyle = '#120f1c';
  ctx.beginPath();
  ctx.ellipse(cx, headY, 28 * catScale, 24 * catScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  // Left ear
  ctx.beginPath();
  ctx.moveTo(cx - 24 * catScale, headY - 10 * catScale);
  ctx.lineTo(cx - 28 * catScale, headY - 32 * catScale);
  ctx.lineTo(cx - 8 * catScale, headY - 18 * catScale);
  ctx.closePath();
  ctx.fillStyle = '#120f1c';
  ctx.fill();
  // Left inner ear (pink)
  ctx.beginPath();
  ctx.moveTo(cx - 22 * catScale, headY - 12 * catScale);
  ctx.lineTo(cx - 25 * catScale, headY - 27 * catScale);
  ctx.lineTo(cx - 11 * catScale, headY - 17 * catScale);
  ctx.closePath();
  ctx.fillStyle = '#f472b6';
  ctx.fill();

  // Right ear
  ctx.beginPath();
  ctx.moveTo(cx + 8 * catScale, headY - 18 * catScale);
  ctx.lineTo(cx + 28 * catScale, headY - 32 * catScale);
  ctx.lineTo(cx + 24 * catScale, headY - 10 * catScale);
  ctx.closePath();
  ctx.fillStyle = '#120f1c';
  ctx.fill();
  // Right inner ear
  ctx.beginPath();
  ctx.moveTo(cx + 11 * catScale, headY - 17 * catScale);
  ctx.lineTo(cx + 25 * catScale, headY - 27 * catScale);
  ctx.lineTo(cx + 22 * catScale, headY - 12 * catScale);
  ctx.closePath();
  ctx.fillStyle = '#f472b6';
  ctx.fill();

  // Wizard Hat (Violet-Indigo with Golden Buckle)
  ctx.fillStyle = '#4c1d95';
  ctx.beginPath();
  // Hat brim
  ctx.ellipse(cx, headY - 15 * catScale, 36 * catScale, 11 * catScale, -0.05, 0, Math.PI * 2);
  ctx.fill();
  // Hat cone
  ctx.beginPath();
  ctx.moveTo(cx - 24 * catScale, headY - 16 * catScale);
  ctx.quadraticCurveTo(cx - 15 * catScale, headY - 45 * catScale, cx + 18 * catScale, headY - 58 * catScale);
  ctx.quadraticCurveTo(cx + 5 * catScale, headY - 42 * catScale, cx + 22 * catScale, headY - 15 * catScale);
  ctx.closePath();
  ctx.fill();
  // Hat golden band
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(cx, headY - 17 * catScale, 20 * catScale, 5 * catScale, -0.05, 0, Math.PI * 2);
  ctx.fill();
  // Golden star brooch
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(cx - 2 * catScale, headY - 17 * catScale, 4.5 * catScale, 0, Math.PI * 2);
  ctx.fill();

  // Glowing Emerald Eyes (Cat Almond shape)
  ctx.fillStyle = '#10b981';
  ctx.shadowColor = '#34d399';
  ctx.shadowBlur = 10;
  // Left eye
  ctx.beginPath();
  ctx.ellipse(cx - 10 * catScale, headY - 1 * catScale, 5.5 * catScale, 8 * catScale, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Right eye
  ctx.beginPath();
  ctx.ellipse(cx + 10 * catScale, headY - 1 * catScale, 5.5 * catScale, 8 * catScale, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Cat Eye Pupils (slits)
  ctx.fillStyle = '#064e3b';
  ctx.beginPath();
  ctx.ellipse(cx - 10 * catScale, headY - 1 * catScale, 2 * catScale, 7 * catScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 10 * catScale, headY - 1 * catScale, 2 * catScale, 7 * catScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlights (spark of magic)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 11.5 * catScale, headY - 3 * catScale, 1.8 * catScale, 0, Math.PI * 2);
  ctx.arc(cx + 8.5 * catScale, headY - 3 * catScale, 1.8 * catScale, 0, Math.PI * 2);
  ctx.fill();

  // Pink Nose
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.moveTo(cx - 2.5 * catScale, headY + 5 * catScale);
  ctx.lineTo(cx + 2.5 * catScale, headY + 5 * catScale);
  ctx.lineTo(cx, headY + 8 * catScale);
  ctx.closePath();
  ctx.fill();

  // Whiskers
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 1.2;
  // Left whiskers
  ctx.beginPath();
  ctx.moveTo(cx - 14 * catScale, headY + 5 * catScale);
  ctx.lineTo(cx - 32 * catScale, headY + 2 * catScale);
  ctx.moveTo(cx - 14 * catScale, headY + 8 * catScale);
  ctx.lineTo(cx - 30 * catScale, headY + 9 * catScale);
  // Right whiskers
  ctx.moveTo(cx + 14 * catScale, headY + 5 * catScale);
  ctx.lineTo(cx + 32 * catScale, headY + 2 * catScale);
  ctx.moveTo(cx + 14 * catScale, headY + 8 * catScale);
  ctx.lineTo(cx + 30 * catScale, headY + 9 * catScale);
  ctx.stroke();

  // Wand held in right paw with star sparkle
  const wandX = cx + 28 * catScale;
  const wandY = headY + 12 * catScale;
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2.5 * catScale;
  ctx.beginPath();
  ctx.moveTo(wandX - 8 * catScale, wandY + 18 * catScale);
  ctx.lineTo(wandX + 8 * catScale, wandY - 14 * catScale);
  ctx.stroke();

  // Wand Tip Star Sparkle
  const tipX = wandX + 8 * catScale;
  const tipY = wandY - 14 * catScale;
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(tipX, tipY, 4 * catScale, 0, Math.PI * 2);
  ctx.fill();
  // 4-pointed radiant rays
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tipX - 7 * catScale, tipY);
  ctx.lineTo(tipX + 7 * catScale, tipY);
  ctx.moveTo(tipX, tipY - 7 * catScale);
  ctx.lineTo(tipX, tipY + 7 * catScale);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore(); // Restore clip

  // Double golden metallic border on medallion
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Render the full Wizard Card onto a high-resolution Canvas (840 x 520)
 * @param {HTMLCanvasElement} canvas 
 * @param {Object} data 
 */
export function renderWizardCard(canvas, data = {}) {
  if (!canvas) return;

  const width = 840;
  const height = 520;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rank = calculateWizardRank(data);
  const score = data.score || 0;
  const highScore = Math.max(score, data.highScore || 0);
  const accuracy = data.accuracy !== undefined ? data.accuracy : 100;
  const maxCombo = data.maxCombo || 1;
  const enemiesDefeated = data.enemiesDefeated || 0;
  const spellsCast = data.spellsCast || 0;
  const elapsedSeconds = data.elapsedSeconds || 0;
  const difficulty = (data.difficulty || 'NORMAL').toUpperCase();
  const isVictory = !!data.isVictory;
  const levelReached = data.levelReached || (isVictory ? 5 : 1);
  const today = data.date || new Date().toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const apm = spellsCast > 0 && elapsedSeconds > 0
    ? Math.round(spellsCast / (elapsedSeconds / 60))
    : Math.max(28, Math.min(120, spellsCast * 4));

  const certNumber = `#AP-${Math.abs((score * 31 + 4096) ^ 0xABCD).toString(16).toUpperCase().padStart(6, '0')}`;

  // =========================================================================
  // 1. BASE BACKGROUND & CELESTIAL ATMOSPHERE
  // =========================================================================
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#060714');
  bgGrad.addColorStop(0.35, '#0e122c');
  bgGrad.addColorStop(0.7, '#140c24');
  bgGrad.addColorStop(1, '#05040a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle Arcane Radial Glows
  const glowL = ctx.createRadialGradient(200, 200, 20, 200, 200, 320);
  glowL.addColorStop(0, 'rgba(147, 51, 234, 0.22)');
  glowL.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowL;
  ctx.fillRect(0, 0, width, height);

  const glowR = ctx.createRadialGradient(640, 320, 20, 640, 320, 340);
  glowR.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
  glowR.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowR;
  ctx.fillRect(0, 0, width, height);

  // Background Sacred Geometry & Arcane Circle Watermark
  ctx.save();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.08)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(630, 260, 210, 0, Math.PI * 2);
  ctx.arc(630, 260, 160, 0, Math.PI * 2);
  ctx.arc(630, 260, 95, 0, Math.PI * 2);
  ctx.stroke();

  // Watermark Runes around circle
  ctx.font = '22px sans-serif';
  ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const runeSymbols = ['⚡', '❄️', '🌀', '❤️', '∧', '∨', '—', '|'];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const rx = 630 + Math.cos(angle) * 160;
    const ry = 260 + Math.sin(angle) * 160;
    ctx.fillText(runeSymbols[i], rx, ry);
  }
  ctx.restore();

  // =========================================================================
  // 2. LUXURIOUS GILDED RUNIC BORDER & CORNER SEALS
  // =========================================================================
  const pad = 16;
  const bW = width - pad * 2;
  const bH = height - pad * 2;

  // Outer Gold Line
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(pad, pad, bW, bH);

  // Inner Fine Gold Line
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + 6, pad + 6, bW - 12, bH - 12);

  // 4 Corner Medallion Runic Emblems
  const cornerRadius = 18;
  const corners = [
    { x: pad + 8, y: pad + 8, rune: '—', col: '#fbbf24' },
    { x: width - pad - 8, y: pad + 8, rune: '|', col: '#38bdf8' },
    { x: pad + 8, y: height - pad - 8, rune: '∧', col: '#f97316' },
    { x: width - pad - 8, y: height - pad - 8, rune: '∨', col: '#c084fc' }
  ];

  corners.forEach(c => {
    ctx.fillStyle = '#17112b';
    ctx.beginPath();
    ctx.arc(c.x, c.y, cornerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = c.col;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = c.col;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.rune, c.x, c.y);
  });

  // =========================================================================
  // 3. TOP HEADER BAR: ACADEMY BANNER & TITLE
  // =========================================================================
  const headerY = 48;

  // Header Academy Badge Ribbon
  ctx.font = '700 11.5px Outfit, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '2px';
  ctx.fillText('✨ HỌC VIỆN MA PHÁP ARCANE PAWS • MAGIC CAT ACADEMY ✨', width / 2, headerY - 14);

  // Main Card Heading
  ctx.font = '900 27px Cinzel, Outfit, serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(245, 158, 11, 0.55)';
  ctx.shadowBlur = 10;
  ctx.fillText('CHỨNG NHẬN PHÁP SƯ MÈO', width / 2, headerY + 16);
  ctx.shadowBlur = 0;

  // Subtitle / License Metadata Bar
  ctx.font = '600 11.5px Outfit, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`SỐ HIỆU: ${certNumber}   •   NGÀY CẤP: ${today}   •   WIZARD CAT LICENSE`, width / 2, headerY + 36);

  // Decorative Horizontal Gold Divider
  const divGrad = ctx.createLinearGradient(width / 2 - 280, 0, width / 2 + 280, 0);
  divGrad.addColorStop(0, 'rgba(217, 119, 6, 0)');
  divGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.85)');
  divGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 280, headerY + 48);
  ctx.lineTo(width / 2 + 280, headerY + 48);
  ctx.stroke();

  // =========================================================================
  // 4. LEFT COLUMN: HERO PORTRAIT & IDENTITY & RANK
  // =========================================================================
  const col1X = 145;
  const portraitY = 192;
  const portraitRadius = 68;

  // Draw Momo Portrait in glowing medallion
  drawMomoMedallion(ctx, col1X, portraitY, portraitRadius);

  // Hero Name Tag
  ctx.font = '800 17px Outfit, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('PHÁP SƯ MOMO 🐾', col1X, portraitY + portraitRadius + 24);

  // Role subtitle
  ctx.font = '600 11.5px Outfit, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Chiến Binh Cổ Ngữ Học Viện', col1X, portraitY + portraitRadius + 40);

  // Rank Badge (Crest)
  const rankBoxY = portraitY + portraitRadius + 52;
  const rankBoxW = 200;
  const rankBoxH = 58;

  ctx.fillStyle = rank.badgeBg;
  ctx.strokeStyle = rank.badgeBorder;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(col1X - rankBoxW / 2, rankBoxY, rankBoxW, rankBoxH, 12);
  ctx.fill();
  ctx.stroke();

  // Grade Letter (SSS, SS, S, etc.)
  ctx.font = '900 32px Outfit, sans-serif';
  ctx.fillStyle = rank.color;
  ctx.shadowColor = rank.glow;
  ctx.shadowBlur = 12;
  ctx.textAlign = 'left';
  ctx.fillText(rank.grade, col1X - rankBoxW / 2 + 16, rankBoxY + 38);
  ctx.shadowBlur = 0;

  // Grade Title Text
  ctx.textAlign = 'left';
  ctx.font = '800 13px Outfit, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(rank.title, col1X - rankBoxW / 2 + 76, rankBoxY + 26);

  ctx.font = '600 10.5px Outfit, sans-serif';
  ctx.fillStyle = rank.color;
  ctx.fillText(rank.enTitle.toUpperCase(), col1X - rankBoxW / 2 + 76, rankBoxY + 44);

  // Difficulty & Stage Badge Pills under portrait
  const pillY = rankBoxY + rankBoxH + 14;
  const pillText = isVictory
    ? '🏆 TOÀN THẮNG 5/5 KHU VỰC'
    : `CHINH PHỤC: MÀN ${levelReached}/5`;

  ctx.font = '700 11px Outfit, sans-serif';
  ctx.fillStyle = isVictory ? '#34d399' : '#38bdf8';
  ctx.textAlign = 'center';
  ctx.fillText(pillText, col1X, pillY);

  const diffLabel = difficulty === 'INFERNO' ? '⚡ ĐỘ KHÓ: ĐỊA NGỤC' :
                    difficulty === 'HARDCORE' ? '💀 ĐỘ KHÓ: ÁC MỘNG' :
                    '🔥 ĐỘ KHÓ: TIÊU CHUẨN';
  ctx.font = '600 10.5px Outfit, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(diffLabel, col1X, pillY + 16);

  // =========================================================================
  // 5. RIGHT COLUMN: BATTLE GRIMOIRE & STATS PANEL
  // =========================================================================
  const panelX = 285;
  const panelY = 122;
  const panelW = 505;
  const panelH = 325;

  // Panel Background (Frosted Glass with Antique Gold Border)
  ctx.fillStyle = 'rgba(16, 12, 32, 0.78)';
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.42)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 14);
  ctx.fill();
  ctx.stroke();

  // Score Showcase Box (Top of Right Panel)
  const scoreBoxH = 74;
  const scoreBoxGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
  scoreBoxGrad.addColorStop(0, 'rgba(251, 191, 36, 0.12)');
  scoreBoxGrad.addColorStop(0.5, 'rgba(147, 51, 234, 0.18)');
  scoreBoxGrad.addColorStop(1, 'rgba(56, 189, 248, 0.12)');
  ctx.fillStyle = scoreBoxGrad;
  ctx.beginPath();
  ctx.roundRect(panelX + 10, panelY + 10, panelW - 20, scoreBoxH, 10);
  ctx.fill();

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Score Labels
  ctx.textAlign = 'left';
  ctx.font = '700 11px Outfit, sans-serif';
  ctx.fillStyle = '#fef08a';
  ctx.letterSpacing = '1px';
  ctx.fillText('🏆 TỔNG ĐIỂM MA PHÁP (FINAL SCORE)', panelX + 24, panelY + 34);

  // Score Value (Big Golden Digits)
  ctx.font = '900 36px Outfit, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 14;
  ctx.fillText(score.toLocaleString(), panelX + 24, panelY + 70);
  ctx.shadowBlur = 0;

  // High Score Tag (Right of Score Box)
  ctx.textAlign = 'right';
  ctx.font = '600 11.5px Outfit, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('KỶ LỤC HỌC VIỆN:', panelX + panelW - 24, panelY + 36);

  ctx.font = '800 19px Outfit, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(highScore.toLocaleString(), panelX + panelW - 24, panelY + 62);

  // 6 Battle Metric Grid Boxes (2 rows x 3 columns)
  const gridY = panelY + scoreBoxH + 20;
  const gridW = panelW - 20;
  const colW = (gridW - 16) / 3;
  const rowH = 92;

  const stats = [
    {
      label: 'ĐỘ CHÍNH XÁC',
      value: `${accuracy}%`,
      sub: `${data.spellsHit || 0}/${spellsCast} Nét Trúng`,
      icon: '🎯',
      color: '#38bdf8'
    },
    {
      label: 'TỐC ĐỘ VẼ (APM)',
      value: `${apm}`,
      sub: 'Phép Mỗi Phút',
      icon: '⚡',
      color: '#fbbf24'
    },
    {
      label: 'COMBO CỰC ĐẠI',
      value: `x${maxCombo}`,
      sub: 'Chuỗi Ấn Ký',
      icon: '🔥',
      color: '#f97316'
    },
    {
      label: 'U LINH ĐÃ TRỪ',
      value: `${enemiesDefeated}`,
      sub: 'Hồn Ma Thanh Tẩy',
      icon: '👻',
      color: '#ec4899'
    },
    {
      label: 'THỜI GIAN',
      value: formatTime(elapsedSeconds),
      sub: 'Thời Gian Tham Chiến',
      icon: '⏱️',
      color: '#34d399'
    },
    {
      label: 'TIẾN TRÌNH',
      value: isVictory ? '5/5 CẤP' : `${levelReached}/5 CẤP`,
      sub: isVictory ? 'Hoàn Toàn Thắng' : 'Đang Tiếp Bước',
      icon: '🏰',
      color: '#c084fc'
    }
  ];

  stats.forEach((stat, idx) => {
    const colIdx = idx % 3;
    const rowIdx = Math.floor(idx / 3);
    const boxX = panelX + 10 + colIdx * (colW + 8);
    const boxY = gridY + rowIdx * (rowH + 10);

    // Mini box background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, colW, rowH, 8);
    ctx.fill();
    ctx.stroke();

    // Icon + Label
    ctx.textAlign = 'left';
    ctx.font = '700 9.5px Outfit, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${stat.icon} ${stat.label}`, boxX + 12, boxY + 22);

    // Value
    ctx.font = '800 21px Outfit, sans-serif';
    ctx.fillStyle = stat.color;
    ctx.fillText(stat.value, boxX + 12, boxY + 52);

    // Subtext
    ctx.font = '500 10px Outfit, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(stat.sub, boxX + 12, boxY + 74);
  });

  // Rank Description summary quote inside panel bottom
  const quoteY = gridY + rowH * 2 + 18;
  ctx.textAlign = 'center';
  ctx.font = 'italic 11px Outfit, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`"${rank.desc}"`, panelX + panelW / 2, quoteY);

  // =========================================================================
  // 6. FOOTER BAR: MOTTO & SEAL WATERMARK
  // =========================================================================
  const footerY = height - 26;

  // Academy Seal Stamp on bottom left
  ctx.font = '600 10.5px Outfit, sans-serif';
  ctx.fillStyle = 'rgba(251, 191, 36, 0.7)';
  ctx.textAlign = 'left';
  ctx.fillText('🐾 DẤU MỘC HỌC VIỆN: ĐÃ KIỂM ĐỊNH • ARCANE ACADEMY SEAL', pad + 38, footerY);

  // Link watermark on bottom right
  ctx.textAlign = 'right';
  ctx.font = '700 10.5px Outfit, sans-serif';
  ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
  ctx.fillText('CHƠI NGAY: ARCANE PAWS • WEB GESTURE DEFENSE ⚔️', width - pad - 38, footerY);
}

/**
 * Trigger download of the canvas card as a PNG image
 * @param {HTMLCanvasElement} canvas 
 * @param {string} [filename] 
 */
export function downloadCardImage(canvas, filename = 'the-phap-su-momo.png') {
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Copy canvas card image directly to system clipboard
 * @param {HTMLCanvasElement} canvas 
 * @returns {Promise<boolean>} Success status
 */
export async function copyCardImageToClipboard(canvas) {
  if (!canvas) return false;

  // Try modern Clipboard API with image/png blob
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        return true;
      }
    } catch (e) {
      console.warn('Direct image clipboard copy not supported by browser, falling back to text copy:', e);
    }
  }

  // Fallback: Copy challenge text with score to clipboard
  try {
    const score = canvas.__cardScore || 0;
    const challengeUrl = getChallengeUrl(score);
    await navigator.clipboard.writeText(
      `🐾 Tôi vừa đạt ${score.toLocaleString()} điểm trong Arcane Paws (Magic Cat Academy)! Bạn có dám vượt kỷ lục của tôi không? Chơi ngay tại: ${challengeUrl}`
    );
    return true;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}

/**
 * Generate shareable challenge URL with score
 * @param {number} score 
 * @param {string} [playerName='Momo']
 * @param {string} [baseUrl]
 * @returns {string}
 */
export function getChallengeUrl(score = 0, playerName = 'Momo', baseUrl) {
  let base = baseUrl;
  if (!base) {
    if (typeof window !== 'undefined' && window.location && window.location.href) {
      base = window.location.href;
    } else if (typeof globalThis !== 'undefined' && globalThis.location && globalThis.location.href) {
      base = globalThis.location.href;
    } else {
      base = 'https://arcane-paws.game/';
    }
  }
  const url = new URL(base);
  url.searchParams.set('challenge', 'true');
  url.searchParams.set('score', String(score));
  url.searchParams.set('from', playerName);
  return url.toString();
}

