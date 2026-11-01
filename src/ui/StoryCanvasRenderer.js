/**
 * @file StoryCanvasRenderer.js
 * @description Procedural 2D Canvas comic illustration renderer for Magic Cat Academy cutscenes:
 * - Slide 0: Momo studying in the library under candlelight with the Master Spellbook.
 * - Slide 1: Sneaky ghost grabs the spellbook and flees through the window into the night.
 * - Slide 2: Momo raises the magic wand heroically, surrounded by glowing elemental runes.
 * - Victory: Momo joyfully recovers the spellbook as fireworks and hearts fill the sky.
 */

export class StoryCanvasRenderer {
  /**
   * Render an intro story slide onto the target canvas
   * @param {HTMLCanvasElement} canvas 
   * @param {number} slideIndex 0..2
   * @param {number} time In seconds
   */
  static renderSlide(canvas, slideIndex, time = 0) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    switch (slideIndex) {
      case 0:
        StoryCanvasRenderer._drawSlideLibraryReading(ctx, w, h, time);
        break;
      case 1:
        StoryCanvasRenderer._drawSlideGhostTheft(ctx, w, h, time);
        break;
      case 2:
      default:
        StoryCanvasRenderer._drawSlideWandReady(ctx, w, h, time);
        break;
    }

    ctx.restore();
  }

  /**
   * Render the grand victory celebration scene
   * @param {HTMLCanvasElement} canvas 
   * @param {number} time In seconds
   */
  static renderVictory(canvas, time = 0) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    StoryCanvasRenderer._drawVictoryScene(ctx, w, h, time);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // SLIDE 0: MOMO STUDYING IN LIBRARY
  // -------------------------------------------------------------------------
  static _drawSlideLibraryReading(ctx, w, h, t) {
    // Background: Warm cozy library corner
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#130d24');
    bg.addColorStop(1, '#080512');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Bookshelf backdrop
    ctx.fillStyle = '#1c1430';
    ctx.fillRect(20, 20, w - 40, h * 0.45);
    ctx.strokeStyle = '#322254';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, w - 40, h * 0.45);

    // Shelf books
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#c084fc'];
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = colors[i % colors.length];
      const bw = 12;
      const bh = 34 + (i % 3) * 8;
      ctx.fillRect(36 + i * 16, 20 + h * 0.45 - bh, bw, bh);
    }

    // Wooden desk
    const deskY = h * 0.62;
    ctx.fillStyle = '#451a03';
    ctx.fillRect(0, deskY, w, h - deskY);
    ctx.fillStyle = '#291002';
    ctx.fillRect(0, deskY, w, 8);

    // Large glowing candle
    const candX = w * 0.22;
    const candY = deskY - 14;
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(candX, candY, 14, 28);

    // Candle flame glow
    const flicker = Math.sin(t * 8) * 3;
    const flameGlow = ctx.createRadialGradient(candX + 7, candY - 8, 3, candX + 7, candY - 8, 60);
    flameGlow.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
    flameGlow.addColorStop(0.3, 'rgba(251, 191, 36, 0.45)');
    flameGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = flameGlow;
    ctx.beginPath();
    ctx.arc(candX + 7, candY - 8 + flicker, 60, 0, Math.PI * 2);
    ctx.fill();

    // The Master Spellbook on the desk
    const bookX = w * 0.46;
    const bookY = deskY - 16;
    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 14;
    ctx.fillRect(bookX - 44, bookY, 88, 22);

    // Open golden parchment pages
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(bookX, bookY);
    ctx.quadraticCurveTo(bookX - 22, bookY - 10, bookX - 42, bookY - 4);
    ctx.lineTo(bookX - 40, bookY + 16);
    ctx.quadraticCurveTo(bookX - 20, bookY + 12, bookX, bookY + 18);
    ctx.quadraticCurveTo(bookX + 20, bookY + 12, bookX + 40, bookY + 16);
    ctx.lineTo(bookX + 42, bookY - 4);
    ctx.quadraticCurveTo(bookX + 22, bookY - 10, bookX, bookY);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Glowing mystic eye / rune on spellbook
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨ ⚡ ✨', bookX, bookY + 8);

    // Momo sitting behind desk, reading
    const momoX = w * 0.76;
    const momoY = deskY + 6;
    StoryCanvasRenderer._drawCatHead(ctx, momoX, momoY - 52, 28, false, t);
    // Cat paw on desk
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(bookX + 38, deskY - 4, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // -------------------------------------------------------------------------
  // SLIDE 1: GHOST SNATCHES SPELLBOOK
  // -------------------------------------------------------------------------
  static _drawSlideGhostTheft(ctx, w, h, t) {
    // Night background through broken window
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0f051d');
    bg.addColorStop(1, '#05020a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Tall Gothic Window with moonlight
    const winX = w * 0.68;
    const winY = h * 0.08;
    const winW = 120;
    const winH = h * 0.75;

    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(winX + winW / 2, winY + winW / 2, winW / 2, Math.PI, 0);
    ctx.lineTo(winX + winW, winY + winH);
    ctx.lineTo(winX, winY + winH);
    ctx.closePath();
    ctx.fill();

    // Full moon outside window
    ctx.fillStyle = '#e0f2fe';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(winX + winW * 0.5, winY + winW * 0.5, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Sneaky Ghost flying out window holding the book!
    const ghostX = winX + winW * 0.4 + Math.sin(t * 3) * 8;
    const ghostY = winY + winH * 0.42 + Math.cos(t * 2.5) * 8;

    // Ghost body
    ctx.save();
    ctx.fillStyle = '#f1f5f9';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(ghostX, ghostY, 26, Math.PI, 0);
    ctx.quadraticCurveTo(ghostX + 26, ghostY + 36, ghostX, ghostY + 40);
    ctx.quadraticCurveTo(ghostX - 26, ghostY + 36, ghostX - 26, ghostY);
    ctx.fill();

    // Ghost sneaky laughing sinister eyes, eyebrows & fanged grin
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // Sinister angled eyebrows (\ /)
    ctx.moveTo(ghostX - 14, ghostY - 5); ctx.lineTo(ghostX - 4, ghostY);
    ctx.moveTo(ghostX + 14, ghostY - 5); ctx.lineTo(ghostX + 4, ghostY);
    // Slanted eyes
    ctx.moveTo(ghostX - 12, ghostY + 3); ctx.lineTo(ghostX - 5, ghostY + 6);
    ctx.moveTo(ghostX + 12, ghostY + 3); ctx.lineTo(ghostX + 5, ghostY + 6);
    ctx.stroke();

    // Dark sinister mouth with pointy white fangs
    ctx.fillStyle = '#0a0614';
    ctx.beginPath();
    ctx.moveTo(ghostX - 10, ghostY + 11);
    ctx.quadraticCurveTo(ghostX, ghostY + 13, ghostX + 10, ghostY + 11);
    ctx.quadraticCurveTo(ghostX + 6, ghostY + 19, ghostX, ghostY + 19);
    ctx.quadraticCurveTo(ghostX - 6, ghostY + 19, ghostX - 10, ghostY + 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sharp white vampire fangs
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(ghostX - 7, ghostY + 12); ctx.lineTo(ghostX - 4, ghostY + 12); ctx.lineTo(ghostX - 5.5, ghostY + 16.5); ctx.closePath();
    ctx.moveTo(ghostX + 4, ghostY + 12); ctx.lineTo(ghostX + 7, ghostY + 12); ctx.lineTo(ghostX + 5.5, ghostY + 16.5); ctx.closePath();
    ctx.fill();

    // Stolen book clutched in ghost's tail
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12;
    ctx.fillRect(ghostX - 16, ghostY + 24, 32, 20);
    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GRIMOIRE', ghostX, ghostY + 37);
    ctx.restore();

    // Momo on left looking SHOCKED / ALARMED!
    const momoX = w * 0.25;
    const momoY = h * 0.65;
    StoryCanvasRenderer._drawCatHead(ctx, momoX, momoY, 32, true, t);

    // Shock / Alert lines above Momo
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(momoX - 22, momoY - 55); ctx.lineTo(momoX - 32, momoY - 70);
    ctx.moveTo(momoX, momoY - 60); ctx.lineTo(momoX, momoY - 78);
    ctx.moveTo(momoX + 22, momoY - 55); ctx.lineTo(momoX + 32, momoY - 70);
    ctx.stroke();
  }

  // -------------------------------------------------------------------------
  // SLIDE 2: MOMO READY FOR BATTLE WITH WAND
  // -------------------------------------------------------------------------
  static _drawSlideWandReady(ctx, w, h, t) {
    // Dynamic purple & dark teal gradient
    const bg = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.6);
    bg.addColorStop(0, '#2e1065');
    bg.addColorStop(0.7, '#130424');
    bg.addColorStop(1, '#05010a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Heroic central Momo
    const momoX = w / 2;
    const momoY = h * 0.68;
    StoryCanvasRenderer._drawCatHead(ctx, momoX, momoY, 36, false, t);

    // Wand held high pointing up
    const wandAngle = -Math.PI / 2 + Math.sin(t * 4) * 0.08;
    const wandBaseX = momoX + 32;
    const wandBaseY = momoY + 10;
    const wandTipX = wandBaseX + Math.cos(wandAngle) * 65;
    const wandTipY = wandBaseY + Math.sin(wandAngle) * 65;

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(wandBaseX, wandBaseY);
    ctx.lineTo(wandTipX, wandTipY);
    ctx.stroke();

    // Wand crystal tip blazing with lightning
    const flare = ctx.createRadialGradient(wandTipX, wandTipY, 4, wandTipX, wandTipY, 45);
    flare.addColorStop(0, '#ffffff');
    flare.addColorStop(0.4, '#38bdf8');
    flare.addColorStop(1, 'transparent');
    ctx.fillStyle = flare;
    ctx.beginPath();
    ctx.arc(wandTipX, wandTipY, 45, 0, Math.PI * 2);
    ctx.fill();

    // Six Orbiting Magic Runes (—, |, ∧, ∨, ⚡, ❤️)
    const runes = [
      { sym: '—', col: '#fbbf24' },
      { sym: '|', col: '#38bdf8' },
      { sym: '∧', col: '#f97316' },
      { sym: '∨', col: '#c084fc' },
      { sym: '⚡', col: '#34d399' },
      { sym: '❤️', col: '#f43f5e' }
    ];

    const orbitR = 95;
    for (let i = 0; i < runes.length; i++) {
      const angle = t * 2 + (i * Math.PI * 2) / runes.length;
      const rx = wandTipX + Math.cos(angle) * orbitR;
      const ry = wandTipY + Math.sin(angle) * (orbitR * 0.55);

      ctx.save();
      ctx.fillStyle = 'rgba(15, 12, 34, 0.85)';
      ctx.strokeStyle = runes[i].col;
      ctx.lineWidth = 2;
      ctx.shadowColor = runes[i].col;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(rx, ry, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = runes[i].col;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(runes[i].sym, rx, ry + 1);
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------------
  // VICTORY CELEBRATION SCENE (Momo lands at castle, book recovered, friends toss Momo up!)
  // -------------------------------------------------------------------------
  static _drawVictoryScene(ctx, w, h, t) {
    // 1. Midnight Castle Sky with warm celebration glow
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#100826');
    bg.addColorStop(0.55, '#2e1045');
    bg.addColorStop(1, '#1a0b06');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 2. Glowing Full Moon of Peace & Restoration
    const moonX = w / 2;
    const moonY = h * 0.26;
    const moonR = Math.min(50, w * 0.12);
    const moonGrad = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, moonR * 1.8);
    moonGrad.addColorStop(0, '#fef08a');
    moonGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.45)');
    moonGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();

    // 3. Castle Towers & Spires on Left and Right
    ctx.fillStyle = '#160924';
    // Left tower
    ctx.fillRect(0, h * 0.38, w * 0.18, h * 0.62);
    ctx.beginPath();
    ctx.moveTo(-10, h * 0.38);
    ctx.lineTo(w * 0.09, h * 0.16);
    ctx.lineTo(w * 0.18 + 10, h * 0.38);
    ctx.closePath();
    ctx.fill();

    // Right tower
    ctx.fillRect(w * 0.82, h * 0.38, w * 0.18, h * 0.62);
    ctx.beginPath();
    ctx.moveTo(w * 0.82 - 10, h * 0.38);
    ctx.lineTo(w * 0.91, h * 0.16);
    ctx.lineTo(w + 10, h * 0.38);
    ctx.closePath();
    ctx.fill();

    // Glowing arched windows on towers
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 8;
    ctx.fillRect(w * 0.06, h * 0.45, 14, 22);
    ctx.fillRect(w * 0.88, h * 0.45, 14, 22);
    ctx.shadowBlur = 0;

    // 4. Celebration Bunting / Pennant Flags strung between towers
    const buntingY = h * 0.36;
    const buntingColors = ['#f43f5e', '#38bdf8', '#fbbf24', '#34d399', '#c084fc', '#f97316'];
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.18, buntingY);
    ctx.quadraticCurveTo(w * 0.5, buntingY + 22, w * 0.82, buntingY);
    ctx.stroke();

    for (let f = 0; f < 10; f++) {
      const u = (f + 1) / 11;
      const fx = w * 0.18 + u * (w * 0.64);
      const fy = buntingY + Math.sin(u * Math.PI) * 22;
      ctx.fillStyle = buntingColors[f % buntingColors.length];
      ctx.beginPath();
      ctx.moveTo(fx - 7, fy);
      ctx.lineTo(fx + 7, fy);
      ctx.lineTo(fx, fy + 12);
      ctx.closePath();
      ctx.fill();
    }

    // 5. Cobblestone Courtyard Ground
    const groundY = h * 0.74;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
    groundGrad.addColorStop(0, '#2b1408');
    groundGrad.addColorStop(0.2, '#1a0b06');
    groundGrad.addColorStop(1, '#0d0503');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Stone courtyard edge
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();

    // 6. Magic Flying Broomstick resting proudly on the left cobblestones
    ctx.save();
    ctx.translate(w * 0.18, groundY + 12);
    ctx.rotate(-0.18);
    // Broom handle
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-35, 10);
    ctx.lineTo(38, -6);
    ctx.stroke();
    // Gold ferrule
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-20, 4, 6, 9);
    // Bristles
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(-18, 4);
    ctx.lineTo(-46, 0);
    ctx.lineTo(-44, 18);
    ctx.lineTo(-18, 12);
    ctx.closePath();
    ctx.fill();
    // Golden sparks around broom
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(-25, -2 + Math.sin(t * 4) * 2, 2, 0, Math.PI * 2);
    ctx.arc(36, -10 + Math.cos(t * 3) * 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 7. TOSSING PHYSICS & FRIENDS HEAVING MOMO INTO THE AIR ("tung hô")
    const tossCycle = (t * 3.0) % (Math.PI * 2);
    const tossHeight = Math.pow(Math.max(0, Math.sin(tossCycle)), 1.4) * 58;
    const heaveY = Math.max(0, -Math.cos(tossCycle)) * 6; // Friends crouch slightly before tossing

    // Cat Friends standing in the courtyard around Momo tossing Momo up
    const friends = [
      { x: w * 0.33, y: groundY - 4 + heaveY, type: 'ginger', name: 'Ginger' },
      { x: w * 0.42, y: groundY - 2 + heaveY, type: 'calico', name: 'Calico' },
      { x: w * 0.58, y: groundY - 2 + heaveY, type: 'gray', name: 'Gray' },
      { x: w * 0.67, y: groundY - 4 + heaveY, type: 'white', name: 'Snowy' }
    ];

    for (const fr of friends) {
      StoryCanvasRenderer._drawCheeringFriend(ctx, fr.x, fr.y, fr.type, t);
    }

    // 8. MOMO SOARING IN MID-AIR WITH THE ANCIENT MASTER SPELLBOOK!
    const momoBaseY = groundY - 32;
    const momoY = momoBaseY - tossHeight;
    const momoX = w / 2;

    ctx.save();
    ctx.translate(momoX, momoY);

    // Momo's joyful black cat body
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.ellipse(0, 10, 18, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Happy tail waving in the air
    const tailWave = Math.sin(t * 8) * 0.4;
    ctx.save();
    ctx.translate(-12, 14);
    ctx.rotate(tailWave);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-14, -8, -18, -20);
    ctx.stroke();
    ctx.restore();

    // Momo's Cute Cat Head
    StoryCanvasRenderer._drawCatHead(ctx, 0, -10, 26, false, t);

    // Outstretched paws holding the Ancient Master Spellbook high overhead!
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.ellipse(-14, -28, 5, 10, -0.3, 0, Math.PI * 2);
    ctx.ellipse(14, -28, 5, 10, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // THE RECOVERED ANCIENT MASTER SPELLBOOK (Quyển Sách Cổ)
    const bookY = -48;
    // Radiant golden god rays emanating from the book
    const rayPulse = Math.sin(t * 6) * 4;
    const rayGrad = ctx.createRadialGradient(0, bookY + 12, 5, 0, bookY + 12, 45 + rayPulse);
    rayGrad.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
    rayGrad.addColorStop(0.4, 'rgba(251, 191, 36, 0.4)');
    rayGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.arc(0, bookY + 12, 45 + rayPulse, 0, Math.PI * 2);
    ctx.fill();

    // Ancient Tome leather cover
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 16;
    ctx.fillRect(-24, bookY, 48, 28);
    ctx.strokeRect(-24, bookY, 48, 28);

    // Golden corner clasps
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-24, bookY, 6, 6);
    ctx.fillRect(18, bookY, 6, 6);
    ctx.fillRect(-24, bookY + 22, 6, 6);
    ctx.fillRect(18, bookY + 22, 6, 6);

    // Golden eye / mystic symbol on cover
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(0, bookY + 14, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.arc(0, bookY + 14, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Sparkles radiating above book
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨📖✨', 0, bookY - 6);

    ctx.restore();

    // 9. Confetti & Celebration Fireworks Shower
    for (let c = 0; c < 28; c++) {
      const cx = (c * 37 + Math.sin(t * 2.5 + c) * 30) % w;
      const cy = (t * 60 + c * 23) % (h * 0.95);
      const cColor = buntingColors[c % buntingColors.length];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 3 + c);
      ctx.fillStyle = cColor;
      ctx.fillRect(-3, -2, 7, 4);
      ctx.restore();
    }

    // Celebratory fireworks bursts in night sky
    const fwAlpha1 = (Math.sin(t * 3) + 1) * 0.5;
    ctx.fillStyle = `rgba(244, 63, 94, ${fwAlpha1 * 0.6})`;
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(w * 0.25, h * 0.22, 16, 0, Math.PI * 2);
    ctx.fill();

    const fwAlpha2 = (Math.cos(t * 2.7) + 1) * 0.5;
    ctx.fillStyle = `rgba(56, 189, 248, ${fwAlpha2 * 0.6})`;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(w * 0.75, h * 0.20, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Floating celebratory hearts around the cheering friends
    const hearts = [
      { x: w * 0.28, y: groundY - 55 + Math.sin(t * 3) * 8, col: '#f43f5e' },
      { x: w * 0.72, y: groundY - 55 + Math.cos(t * 2.8) * 8, col: '#ec4899' },
      { x: w * 0.50, y: groundY - 75 + Math.sin(t * 3.5) * 6, col: '#fde047' }
    ];
    for (const hrt of hearts) {
      ctx.fillStyle = hrt.col;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hrt.col === '#fde047' ? '✨' : '❤️', hrt.x, hrt.y);
    }
  }

  /**
   * Helper to draw Momo's student cat classmates cheering and tossing
   * @param {CanvasRenderingContext2D} ctx 
   * @param {number} x 
   * @param {number} y 
   * @param {string} type 'ginger' | 'calico' | 'gray' | 'white'
   * @param {number} t Time in seconds
   */
  static _drawCheeringFriend(ctx, x, y, type, t) {
    ctx.save();
    ctx.translate(x, y);

    let bodyColor = '#ea580c';
    let eyeColor = '#22c55e';
    let detailColor = '#9a3412';

    if (type === 'calico') {
      bodyColor = '#f8fafc';
      eyeColor = '#f59e0b';
      detailColor = '#ea580c';
    } else if (type === 'gray') {
      bodyColor = '#64748b';
      eyeColor = '#38bdf8';
      detailColor = '#334155';
    } else if (type === 'white') {
      bodyColor = '#ffffff';
      eyeColor = '#38bdf8';
      detailColor = '#f472b6';
    }

    // Bobbing excitement
    const bounce = Math.sin(t * 6 + x) * 2;
    ctx.translate(0, bounce);

    // Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Calico or ginger coat patches
    if (type === 'calico') {
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(-5, -4, 6, 8, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.ellipse(6, 4, 6, 7, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'ginger') {
      ctx.strokeStyle = detailColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-8, -4); ctx.lineTo(-2, -2);
      ctx.moveTo(-8, 2); ctx.lineTo(-2, 4);
      ctx.moveTo(8, -4); ctx.lineTo(2, -2);
      ctx.moveTo(8, 2); ctx.lineTo(2, 4);
      ctx.stroke();
    }

    // Head
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(0, -16, 13, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.beginPath();
    ctx.moveTo(-11, -22); ctx.lineTo(-14, -34); ctx.lineTo(-3, -27); ctx.closePath();
    ctx.moveTo(11, -22); ctx.lineTo(14, -34); ctx.lineTo(3, -27); ctx.closePath();
    ctx.fill();

    // Pink ear interior
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(-10, -23); ctx.lineTo(-12, -31); ctx.lineTo(-4, -26); ctx.closePath();
    ctx.moveTo(10, -23); ctx.lineTo(12, -31); ctx.lineTo(4, -26); ctx.closePath();
    ctx.fill();

    // White cat pink ribbon bow
    if (type === 'white') {
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.ellipse(-10, -30, 4, 2.5, -0.4, 0, Math.PI * 2);
      ctx.ellipse(-4, -30, 4, 2.5, 0.4, 0, Math.PI * 2);
      ctx.arc(-7, -30, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Big happy cheering eyes
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(-5, -16, 3, 0, Math.PI * 2);
    ctx.arc(5, -16, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(-5, -16, 1.5, 0, Math.PI * 2);
    ctx.arc(5, -16, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Cheering smiling mouth
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(0, -11, 3.5, 0, Math.PI);
    ctx.fill();

    // Raised cheering paws heaving towards Momo!
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(-10, -26, 4, 8, -0.3, 0, Math.PI * 2);
    ctx.ellipse(10, -26, 4, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Helper to draw Momo's head and witch hat
   */
  static _drawCatHead(ctx, x, y, radius, isShocked = false, t = 0) {
    ctx.save();
    ctx.translate(x, y);

    // Black Cat Head
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.beginPath();
    ctx.moveTo(-radius * 0.8, -radius * 0.4);
    ctx.lineTo(-radius * 1.3, -radius * 1.4);
    ctx.lineTo(-radius * 0.2, -radius * 0.8);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(radius * 0.8, -radius * 0.4);
    ctx.lineTo(radius * 1.3, -radius * 1.4);
    ctx.lineTo(radius * 0.2, -radius * 0.8);
    ctx.closePath();
    ctx.fill();

    // Inner pink ears
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.7, -radius * 0.5);
    ctx.lineTo(-radius * 1.1, -radius * 1.25);
    ctx.lineTo(-radius * 0.3, -radius * 0.75);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(radius * 0.7, -radius * 0.5);
    ctx.lineTo(radius * 1.1, -radius * 1.25);
    ctx.lineTo(radius * 0.3, -radius * 0.75);
    ctx.closePath();
    ctx.fill();

    // Momo is an authentic black cat with pointed ears (no witch hat, true to Google Doodle)

    // Eyes
    if (isShocked) {
      // Wide open shocked white eyes with tiny pupils
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.36, -radius * 0.1, radius * 0.28, radius * 0.34, 0, 0, Math.PI * 2);
      ctx.ellipse(radius * 0.36, -radius * 0.1, radius * 0.28, radius * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-radius * 0.36, -radius * 0.1, 3, 0, Math.PI * 2);
      ctx.arc(radius * 0.36, -radius * 0.1, 3, 0, Math.PI * 2);
      ctx.fill();

      // Shocked small open mouth 'O'
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(0, radius * 0.42, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Big luminous amber/golden eyes (Google Doodle Halloween 2016 Momo)
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(-radius * 0.36, -radius * 0.08, radius * 0.24, radius * 0.32, -0.05, 0, Math.PI * 2);
      ctx.ellipse(radius * 0.36, -radius * 0.08, radius * 0.24, radius * 0.32, 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Dark cat pupils
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.34, -radius * 0.08, radius * 0.12, radius * 0.22, 0, 0, Math.PI * 2);
      ctx.ellipse(radius * 0.38, -radius * 0.08, radius * 0.12, radius * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-radius * 0.38, -radius * 0.18, 2.5, 0, Math.PI * 2);
      ctx.arc(radius * 0.34, -radius * 0.18, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Cute smile
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-3, radius * 0.3, 3, 0.2, Math.PI - 0.2);
      ctx.arc(3, radius * 0.3, 3, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // Whiskers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.6, radius * 0.15); ctx.lineTo(-radius * 1.2, radius * 0.05);
    ctx.moveTo(-radius * 0.6, radius * 0.3); ctx.lineTo(-radius * 1.2, radius * 0.35);
    ctx.moveTo(radius * 0.6, radius * 0.15); ctx.lineTo(radius * 1.2, radius * 0.05);
    ctx.moveTo(radius * 0.6, radius * 0.3); ctx.lineTo(radius * 1.2, radius * 0.35);
    ctx.stroke();

    ctx.restore();
  }
}
