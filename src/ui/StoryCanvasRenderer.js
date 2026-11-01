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
  // VICTORY CELEBRATION SCENE
  // -------------------------------------------------------------------------
  static _drawVictoryScene(ctx, w, h, t) {
    // Grand celebratory sky
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(0.6, '#431407');
    bg.addColorStop(1, '#170a04');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Big glowing golden moon
    const moonX = w / 2;
    const moonY = h * 0.38;
    const moonGrad = ctx.createRadialGradient(moonX, moonY, 15, moonX, moonY, 90);
    moonGrad.addColorStop(0, '#fef08a');
    moonGrad.addColorStop(0.5, '#f59e0b');
    moonGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 90, 0, Math.PI * 2);
    ctx.fill();

    // Cheering Momo holding recovered spellbook overhead
    const momoX = w / 2;
    const momoY = h * 0.72;
    StoryCanvasRenderer._drawCatHead(ctx, momoX, momoY, 34, false, t);

    // Master Spellbook held high in paws
    const bookY = momoY - 68 + Math.sin(t * 4) * 4;
    ctx.save();
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 18;
    ctx.fillRect(momoX - 28, bookY, 56, 32);
    ctx.strokeRect(momoX - 28, bookY, 56, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨📖✨', momoX, bookY + 20);
    ctx.restore();

    // Floating celebratory heart motes
    const hearts = [
      { x: w * 0.22, y: h * 0.35 + Math.sin(t * 3) * 10, col: '#f43f5e' },
      { x: w * 0.35, y: h * 0.22 + Math.cos(t * 2.5) * 8, col: '#ec4899' },
      { x: w * 0.65, y: h * 0.24 + Math.sin(t * 2.8) * 8, col: '#ec4899' },
      { x: w * 0.78, y: h * 0.38 + Math.cos(t * 3.2) * 10, col: '#f43f5e' }
    ];

    for (const heart of hearts) {
      ctx.fillStyle = heart.col;
      ctx.shadowColor = heart.col;
      ctx.shadowBlur = 10;
      ctx.font = '20px sans-serif';
      ctx.fillText('❤️', heart.x, heart.y);
    }
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
