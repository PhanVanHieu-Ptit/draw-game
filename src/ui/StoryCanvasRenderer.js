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
        StoryCanvasRenderer._drawSlideWandReady(ctx, w, h, time);
        break;
      case 3:
        StoryCanvasRenderer._drawChapter1Scene(ctx, w, h, time);
        break;
      case 4:
        StoryCanvasRenderer._drawChapter2Scene(ctx, w, h, time);
        break;
      case 5:
        StoryCanvasRenderer._drawChapter3Scene(ctx, w, h, time);
        break;
      case 6:
        StoryCanvasRenderer._drawChapter4Scene(ctx, w, h, time);
        break;
      case 7:
        StoryCanvasRenderer._drawChapter5Scene(ctx, w, h, time);
        break;
      case 8:
      case 'victory':
        StoryCanvasRenderer._drawVictoryScene(ctx, w, h, time);
        break;
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

    // Oliver the ginger cat sleeping comfortably on the left side of desk
    const oliverX = w * 0.40;
    const oliverY = deskY - 14;
    const breathe = Math.sin(t * 3) * 1.5;

    // Small plate with cookies
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(oliverX - 32, deskY - 2, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(oliverX - 35, deskY - 5, 4, 0, Math.PI * 2);
    ctx.arc(oliverX - 29, deskY - 5, 4, 0, Math.PI * 2);
    ctx.arc(oliverX - 32, deskY - 8, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Chubby curled body
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.ellipse(oliverX, oliverY + breathe, 22, 16, -0.1, 0, Math.PI * 2);
    ctx.fill();
    // Sleeping ears
    ctx.beginPath();
    ctx.moveTo(oliverX + 8, oliverY - 12 + breathe);
    ctx.lineTo(oliverX + 16, oliverY - 22 + breathe);
    ctx.lineTo(oliverX + 18, oliverY - 8 + breathe);
    ctx.fill();
    // Sleeping cute closed eyes (^ ^)
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(oliverX + 10, oliverY - 2 + breathe, 3.5, Math.PI, 0);
    ctx.arc(oliverX + 17, oliverY - 2 + breathe, 3.5, Math.PI, 0);
    ctx.stroke();
    // Soft snoozing Zzz
    ctx.fillStyle = '#fed7aa';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('z Z z', oliverX + 26, oliverY - 16 + Math.sin(t * 2) * 3);

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

    // Companion Allies rallying in the background (Oliver, Luna, Nyx)
    // Oliver on the left
    const oliX = w * 0.22;
    const oliY = h * 0.72;
    ctx.save();
    ctx.fillStyle = '#ea580c';
    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(oliX, oliY, 22, 0, Math.PI * 2);
    ctx.fill();
    // Oliver ears
    ctx.beginPath();
    ctx.moveTo(oliX - 16, oliY - 12); ctx.lineTo(oliX - 22, oliY - 26); ctx.lineTo(oliX - 6, oliY - 18);
    ctx.moveTo(oliX + 16, oliY - 12); ctx.lineTo(oliX + 22, oliY - 26); ctx.lineTo(oliX + 6, oliY - 18);
    ctx.fill();
    ctx.fillStyle = '#fed7aa';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OLIVER', oliX, oliY + 34);
    ctx.restore();

    // Luna on the right
    const lunaX = w * 0.78;
    const lunaY = h * 0.72;
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(lunaX, lunaY, 22, 0, Math.PI * 2);
    ctx.fill();
    // Luna ears
    ctx.beginPath();
    ctx.moveTo(lunaX - 16, lunaY - 12); ctx.lineTo(lunaX - 22, lunaY - 26); ctx.lineTo(lunaX - 6, lunaY - 18);
    ctx.moveTo(lunaX + 16, lunaY - 12); ctx.lineTo(lunaX + 22, lunaY - 26); ctx.lineTo(lunaX + 6, lunaY - 18);
    ctx.fill();
    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LUNA', lunaX, lunaY + 34);
    ctx.restore();

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

    // Redeemed Spirit of Lord Umbra smiling peacefully in the moon glow
    const umbraY = moonY - 10 + Math.sin(t * 2.5) * 4;
    ctx.save();
    ctx.fillStyle = 'rgba(240, 249, 255, 0.85)';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(moonX, umbraY, 20, 0, Math.PI * 2);
    ctx.fill();
    // Knight Spirit ears
    ctx.beginPath();
    ctx.moveTo(moonX - 14, umbraY - 10); ctx.lineTo(moonX - 20, umbraY - 24); ctx.lineTo(moonX - 5, umbraY - 16);
    ctx.moveTo(moonX + 14, umbraY - 10); ctx.lineTo(moonX + 20, umbraY - 24); ctx.lineTo(moonX + 5, umbraY - 16);
    ctx.fill();
    // Peaceful curved closed eyes (^ ^)
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(moonX - 7, umbraY - 2, 3.5, Math.PI, 0);
    ctx.arc(moonX + 7, umbraY - 2, 3.5, Math.PI, 0);
    ctx.stroke();
    // Halo / Crown
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(moonX, umbraY - 24, 14, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Cheering Momo holding recovered spellbook overhead
    const momoX = w / 2;
    const momoY = h * 0.72;
    StoryCanvasRenderer._drawCatHead(ctx, momoX, momoY, 34, false, t);

    // Oliver the ginger cat cheering on left
    const oliVicX = w * 0.24;
    const oliVicY = h * 0.75 + Math.sin(t * 4) * 3;
    ctx.save();
    ctx.fillStyle = '#f97316';
    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(oliVicX, oliVicY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(oliVicX - 16, oliVicY - 14); ctx.lineTo(oliVicX - 24, oliVicY - 28); ctx.lineTo(oliVicX - 7, oliVicY - 18);
    ctx.moveTo(oliVicX + 16, oliVicY - 14); ctx.lineTo(oliVicX + 24, oliVicY - 28); ctx.lineTo(oliVicX + 7, oliVicY - 18);
    ctx.fill();
    // Big smiling face
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(oliVicX - 7, oliVicY - 4, 2.5, 0, Math.PI * 2);
    ctx.arc(oliVicX + 7, oliVicY - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Cookie in paw
    ctx.fillStyle = '#d97706';
    ctx.font = '16px sans-serif';
    ctx.fillText('🍪', oliVicX + 14, oliVicY - 12);
    ctx.restore();

    // Luna the white cat celebrating on right
    const lunaVicX = w * 0.76;
    const lunaVicY = h * 0.75 + Math.cos(t * 4) * 3;
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(lunaVicX, lunaVicY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(lunaVicX - 16, lunaVicY - 14); ctx.lineTo(lunaVicX - 24, lunaVicY - 28); ctx.lineTo(lunaVicX - 7, lunaVicY - 18);
    ctx.moveTo(lunaVicX + 16, lunaVicY - 14); ctx.lineTo(lunaVicX + 24, lunaVicY - 28); ctx.lineTo(lunaVicX + 7, lunaVicY - 18);
    ctx.fill();
    // Heterochromia eyes (blue & gold)
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(lunaVicX - 7, lunaVicY - 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(lunaVicX + 7, lunaVicY - 4, 3, 0, Math.PI * 2); ctx.fill();
    // Magic sparkles
    ctx.fillStyle = '#e0f2fe';
    ctx.font = '16px sans-serif';
    ctx.fillText('✨', lunaVicX - 16, lunaVicY - 14);
    ctx.restore();

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

  // -------------------------------------------------------------------------
  // CHAPTER 1 SCENE: THE LIBRARY & MADAME LIBRARIA
  // -------------------------------------------------------------------------
  static _drawChapter1Scene(ctx, w, h, t) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#0b091f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Archmage Barnaby Owl on left
    const owlX = w * 0.18;
    const owlY = h * 0.55 + Math.sin(t * 3) * 3;
    ctx.save();
    ctx.fillStyle = '#60a5fa';
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 14;
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🦉', owlX, owlY);
    ctx.fillStyle = '#bfdbfe';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Viện Trưởng Barnaby', owlX, owlY + 22);
    ctx.restore();

    // Central Momo
    StoryCanvasRenderer._drawCatHead(ctx, w * 0.48, h * 0.65, 30, false, t);

    // Madame Libraria on right
    const bossX = w * 0.80;
    const bossY = h * 0.48 + Math.cos(t * 2.5) * 6;
    StoryCanvasRenderer._drawMadameLibrariaFigure(ctx, bossX, bossY, 32, t);
    ctx.save();
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Madame Libraria', bossX, bossY + 44);
    ctx.restore();

    // Floating Books & Runes [—] and [|]
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('—  |  —  |', w * 0.48, h * 0.35 + Math.sin(t * 4) * 4);
  }

  // -------------------------------------------------------------------------
  // CHAPTER 2 SCENE: THE CAFETERIA & CHEF BOUILLON
  // -------------------------------------------------------------------------
  static _drawChapter2Scene(ctx, w, h, t) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#3f1a08');
    bg.addColorStop(1, '#180702');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Oliver with cookies on left
    const oliX = w * 0.18;
    const oliY = h * 0.58 + Math.sin(t * 3.5) * 3;
    ctx.save();
    ctx.fillStyle = '#fb923c';
    ctx.shadowColor = '#ea580c';
    ctx.shadowBlur = 14;
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐱🥐', oliX, oliY);
    ctx.fillStyle = '#fed7aa';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Oliver Cam Cam', oliX, oliY + 22);
    ctx.restore();

    // Bubbling Cauldron in middle
    const cauldX = w * 0.48;
    const cauldY = h * 0.65;
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(cauldX, cauldY, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('❤️ ∧ ∨ ❤️', cauldX, cauldY - 38 + Math.sin(t * 4) * 4);

    // Chef Bouillon on right
    const chefX = w * 0.80;
    const chefY = h * 0.48 + Math.cos(t * 3) * 5;
    StoryCanvasRenderer._drawChefBouillonFigure(ctx, chefX, chefY, 32, t);
    ctx.save();
    ctx.fillStyle = '#fdba74';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Chef Bouillon', chefX, chefY + 44);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // CHAPTER 3 SCENE: THE CLASSROOM & PROFESSOR STELLA
  // -------------------------------------------------------------------------
  static _drawChapter3Scene(ctx, w, h, t) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2e1065');
    bg.addColorStop(1, '#0e0324');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Luna with Starlight on left
    const lunaX = w * 0.18;
    const lunaY = h * 0.58 + Math.cos(t * 3) * 3;
    ctx.save();
    ctx.fillStyle = '#c084fc';
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 14;
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐱✨', lunaX, lunaY);
    ctx.fillStyle = '#e9d5ff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Luna Bạch Miêu', lunaX, lunaY + 22);
    ctx.restore();

    // Central Momo channeling lightning
    StoryCanvasRenderer._drawCatHead(ctx, w * 0.48, h * 0.65, 30, false, t);
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ ⚡ ⚡', w * 0.48, h * 0.35 + Math.sin(t * 5) * 5);

    // Professor Stella on right with orbit
    const stellaX = w * 0.80;
    const stellaY = h * 0.48 + Math.sin(t * 2.8) * 6;
    StoryCanvasRenderer._drawProfessorStellaFigure(ctx, stellaX, stellaY, 32, t);
    ctx.save();
    ctx.fillStyle = '#f0abfc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Professor Stella', stellaX, stellaY + 44);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // CHAPTER 4 SCENE: THE GYMNASIUM & COACH STRIKER
  // -------------------------------------------------------------------------
  static _drawChapter4Scene(ctx, w, h, t) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#064e3b');
    bg.addColorStop(1, '#021e17');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Nyx on left
    const nyxX = w * 0.18;
    const nyxY = h * 0.58 + Math.sin(t * 5) * 4;
    ctx.save();
    ctx.fillStyle = '#34d399';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 14;
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐱⚡', nyxX, nyxY);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Nyx Tam Thể', nyxX, nyxY + 22);
    ctx.restore();

    // Central Momo dodging & drawing
    StoryCanvasRenderer._drawCatHead(ctx, w * 0.48, h * 0.65, 30, false, t);

    // Coach Striker with whistle on right
    const coachX = w * 0.80;
    const coachY = h * 0.48 + Math.cos(t * 3.5) * 5;
    StoryCanvasRenderer._drawCoachStrikerFigure(ctx, coachX, coachY, 32, t);
    ctx.save();
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Coach Striker', coachX, coachY + 44);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // CHAPTER 5 SCENE: THE ROOFTOP & LORD UMBRA
  // -------------------------------------------------------------------------
  static _drawChapter5Scene(ctx, w, h, t) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#450a0a');
    bg.addColorStop(1, '#1a0307');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Giant blood moon
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.35, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Momo on left facing right
    StoryCanvasRenderer._drawCatHead(ctx, w * 0.25, h * 0.68, 32, false, t);

    // Colossal Lord Umbra on right
    const umbraX = w * 0.76;
    const umbraY = h * 0.50 + Math.sin(t * 2) * 5;
    StoryCanvasRenderer._drawLordUmbraFigure(ctx, umbraX, umbraY, 44, t);
    ctx.save();
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Lord Umbra', umbraX, umbraY + 52);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // PROCEDURAL SPIRIT BOSS FIGURES FOR STORY SCENES
  // -------------------------------------------------------------------------
  static _drawMadameLibrariaFigure(ctx, x, y, r, t) {
    ctx.save();
    // Spectral blue aura
    const grad = ctx.createRadialGradient(x, y, 5, x, y, r * 1.4);
    grad.addColorStop(0, '#67e8f9');
    grad.addColorStop(0.7, '#0284c7');
    grad.addColorStop(1, 'rgba(2, 132, 199, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Ghost body
    ctx.fillStyle = '#0ea5e9';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 0.7, Math.PI, 0, false);
    ctx.quadraticCurveTo(x + r * 0.7, y + r * 0.8, x + r * 0.35, y + r * 0.7 + Math.sin(t * 3) * 3);
    ctx.quadraticCurveTo(x, y + r * 0.9, x - r * 0.35, y + r * 0.7 + Math.cos(t * 3) * 3);
    ctx.quadraticCurveTo(x - r * 0.7, y + r * 0.8, x - r * 0.7, y - r * 0.2);
    ctx.closePath();
    ctx.fill();

    // Scholar bun on head with quill
    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.85, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, y - r * 0.75);
    ctx.lineTo(x + r * 0.35, y - r * 1.05);
    ctx.stroke();

    // Spectacles with chain
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + r * 0.25, y - r * 0.25, r * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.09, y - r * 0.25);
    ctx.lineTo(x + r * 0.09, y - r * 0.25);
    ctx.stroke();

    // Glowing cyan eyes
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.08, 0, Math.PI * 2);
    ctx.arc(x + r * 0.25, y - r * 0.25, r * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Open Ancient Grimoire in front
    const bookY = y + r * 0.35 + Math.sin(t * 4) * 2;
    ctx.fillStyle = '#451a03';
    ctx.fillRect(x - r * 0.7, bookY - r * 0.25, r * 1.4, r * 0.45);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(x - r * 0.65, bookY - r * 0.22, r * 0.62, r * 0.4);
    ctx.fillRect(x + r * 0.03, bookY - r * 0.22, r * 0.62, r * 0.4);

    // Glowing runes on pages
    ctx.fillStyle = '#0284c7';
    ctx.font = `bold ${Math.round(r * 0.32)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('—', x - r * 0.34, bookY + r * 0.06);
    ctx.fillText('|', x + r * 0.34, bookY + r * 0.06);
    ctx.restore();
  }

  static _drawChefBouillonFigure(ctx, x, y, r, t) {
    ctx.save();
    // Fiery aura
    const grad = ctx.createRadialGradient(x, y, 5, x, y, r * 1.4);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(0.7, '#ea580c');
    grad.addColorStop(1, 'rgba(234, 88, 12, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Round plump fiery ghost body
    ctx.fillStyle = '#c2410c';
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.15, r * 0.75, Math.PI, 0, false);
    ctx.quadraticCurveTo(x + r * 0.8, y + r * 0.8, x + r * 0.4, y + r * 0.7 + Math.sin(t * 3.5) * 3);
    ctx.quadraticCurveTo(x, y + r * 0.95, x - r * 0.4, y + r * 0.7 + Math.cos(t * 3.5) * 3);
    ctx.quadraticCurveTo(x - r * 0.8, y + r * 0.8, x - r * 0.75, y - r * 0.15);
    ctx.closePath();
    ctx.fill();

    // Pleated Chef Toque
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.9, r * 0.26, 0, Math.PI * 2);
    ctx.arc(x, y - r * 1.05, r * 0.32, 0, Math.PI * 2);
    ctx.arc(x + r * 0.3, y - r * 0.9, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(x - r * 0.45, y - r * 0.75, r * 0.9, r * 0.22);
    // Golden hat band
    ctx.fillStyle = '#eab308';
    ctx.fillRect(x - r * 0.45, y - r * 0.62, r * 0.9, r * 0.08);

    // Glowing eyes
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.09, 0, Math.PI * 2);
    ctx.arc(x + r * 0.25, y - r * 0.25, r * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Signature curling mustache
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.06);
    ctx.quadraticCurveTo(x - r * 0.35, y - r * 0.12, x - r * 0.55, y - r * 0.28);
    ctx.moveTo(x, y - r * 0.06);
    ctx.quadraticCurveTo(x + r * 0.35, y - r * 0.12, x + r * 0.55, y - r * 0.28);
    ctx.stroke();

    // Big iron soup ladle
    const ladleX = x + r * 0.65;
    const ladleY = y + r * 0.1 + Math.sin(t * 4) * 3;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.2, y + r * 0.4);
    ctx.lineTo(ladleX, ladleY - r * 0.4);
    ctx.stroke();
    // Ladle bowl with simmering soup
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(ladleX, ladleY - r * 0.4, r * 0.24, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(ladleX, ladleY - r * 0.4, r * 0.18, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }

  static _drawProfessorStellaFigure(ctx, x, y, r, t) {
    ctx.save();
    // Galaxy nebula aura
    const grad = ctx.createRadialGradient(x, y, 5, x, y, r * 1.5);
    grad.addColorStop(0, '#c084fc');
    grad.addColorStop(0.7, '#7e22ce');
    grad.addColorStop(1, 'rgba(126, 34, 206, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // Celestial ghost body
    ctx.fillStyle = '#6b21a8';
    ctx.shadowColor = '#d8b4fe';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.15, r * 0.72, Math.PI, 0, false);
    ctx.quadraticCurveTo(x + r * 0.75, y + r * 0.8, x + r * 0.35, y + r * 0.7 + Math.sin(t * 3) * 3);
    ctx.quadraticCurveTo(x, y + r * 0.9, x - r * 0.35, y + r * 0.7 + Math.cos(t * 3) * 3);
    ctx.quadraticCurveTo(x - r * 0.75, y + r * 0.8, x - r * 0.72, y - r * 0.15);
    ctx.closePath();
    ctx.fill();

    // Star-shaped twinkling eyes
    ctx.fillStyle = '#fef08a';
    ctx.font = `bold ${Math.round(r * 0.4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('✦', x - r * 0.25, y - r * 0.15);
    ctx.fillText('✦', x + r * 0.25, y - r * 0.15);

    // Saturn planetary rings
    ctx.save();
    ctx.translate(x, y + r * 0.05);
    ctx.rotate(0.35);
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.35, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3 Orbiting mini planets
    const p1 = t * 2.2;
    const p1x = Math.cos(p1) * r * 1.35;
    const p1y = Math.sin(p1) * r * 0.4;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(p1x, p1y, 4, 0, Math.PI * 2);
    ctx.fill();

    const p2 = t * 2.2 + 2.1;
    const p2x = Math.cos(p2) * r * 1.35;
    const p2y = Math.sin(p2) * r * 0.4;
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(p2x, p2y, 4, 0, Math.PI * 2);
    ctx.fill();

    const p3 = t * 2.2 + 4.2;
    const p3x = Math.cos(p3) * r * 1.35;
    const p3y = Math.sin(p3) * r * 0.4;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(p3x, p3y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Floating celestial wand / lightning rune
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.85, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.font = `bold ${Math.round(r * 0.3)}px sans-serif`;
    ctx.fillText('⚡', x, y - r * 0.75);
    ctx.restore();
  }

  static _drawCoachStrikerFigure(ctx, x, y, r, t) {
    ctx.save();
    // Athletic jade aura
    const grad = ctx.createRadialGradient(x, y, 5, x, y, r * 1.4);
    grad.addColorStop(0, '#34d399');
    grad.addColorStop(0.7, '#059669');
    grad.addColorStop(1, 'rgba(5, 150, 105, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Athletic muscular broad ghost body
    ctx.fillStyle = '#065f46';
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 0.8, Math.PI, 0, false);
    ctx.quadraticCurveTo(x + r * 0.85, y + r * 0.7, x + r * 0.4, y + r * 0.7 + Math.sin(t * 4) * 3);
    ctx.quadraticCurveTo(x, y + r * 0.95, x - r * 0.4, y + r * 0.7 + Math.cos(t * 4) * 3);
    ctx.quadraticCurveTo(x - r * 0.85, y + r * 0.7, x - r * 0.8, y - r * 0.2);
    ctx.closePath();
    ctx.fill();

    // Sport headband with lightning
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - r * 0.7, y - r * 0.65, r * 1.4, r * 0.24);
    ctx.fillStyle = '#10b981';
    ctx.font = `bold ${Math.round(r * 0.26)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚡', x, y - r * 0.46);

    // Glowing focused eyes
    ctx.fillStyle = '#6ee7b7';
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.2, r * 0.1, 0, Math.PI * 2);
    ctx.arc(x + r * 0.28, y - r * 0.2, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Referee striped collar / jersey
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - r * 0.35, y + r * 0.1, r * 0.14, r * 0.4);
    ctx.fillRect(x - r * 0.07, y + r * 0.1, r * 0.14, r * 0.4);
    ctx.fillRect(x + r * 0.21, y + r * 0.1, r * 0.14, r * 0.4);

    // Silver whistle on red neck lanyard
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.2, y + r * 0.1);
    ctx.quadraticCurveTo(x, y + r * 0.4, x + r * 0.2, y + r * 0.1);
    ctx.stroke();
    // Whistle body
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.42, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - r * 0.05, y + r * 0.36, r * 0.24, r * 0.1);
    ctx.restore();
  }

  static _drawLordUmbraFigure(ctx, x, y, r, t) {
    ctx.save();
    // Colossal Void & Crimson Aura
    const grad = ctx.createRadialGradient(x, y, 10, x, y, r * 1.6);
    grad.addColorStop(0, '#f43f5e');
    grad.addColorStop(0.5, '#881337');
    grad.addColorStop(0.85, '#0f051d');
    grad.addColorStop(1, 'rgba(15, 5, 29, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Heavy Corrupted Ancient Knight Cat Body
    ctx.fillStyle = '#1c0717';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 0.85, Math.PI, 0, false);
    ctx.quadraticCurveTo(x + r * 0.95, y + r * 0.85, x + r * 0.45, y + r * 0.8 + Math.sin(t * 2.5) * 4);
    ctx.quadraticCurveTo(x, y + r * 1.05, x - r * 0.45, y + r * 0.8 + Math.cos(t * 2.5) * 4);
    ctx.quadraticCurveTo(x - r * 0.95, y + r * 0.85, x - r * 0.85, y - r * 0.2);
    ctx.closePath();
    ctx.fill();

    // Feline Knight Pauldrons
    ctx.fillStyle = '#31102b';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x - r * 0.75, y + r * 0.05, r * 0.28, 0, Math.PI * 2);
    ctx.arc(x + r * 0.75, y + r * 0.05, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // ANCIENT KNIGHT CAT EARS (Replacing demon horns with feline armor ears)
    // Left feline ear
    ctx.fillStyle = '#0f051d';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.65, y - r * 0.45);
    ctx.lineTo(x - r * 0.45, y - r * 1.15);
    ctx.lineTo(x - r * 0.15, y - r * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Left ear ruby inner core
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.58, y - r * 0.55);
    ctx.lineTo(x - r * 0.45, y - r * 1.02);
    ctx.lineTo(x - r * 0.25, y - r * 0.7);
    ctx.closePath();
    ctx.fill();

    // Right feline ear
    ctx.fillStyle = '#0f051d';
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(x + r * 0.65, y - r * 0.45);
    ctx.lineTo(x + r * 0.45, y - r * 1.15);
    ctx.lineTo(x + r * 0.15, y - r * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Right ear ruby inner core
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(x + r * 0.58, y - r * 0.55);
    ctx.lineTo(x + r * 0.45, y - r * 1.02);
    ctx.lineTo(x + r * 0.25, y - r * 0.7);
    ctx.closePath();
    ctx.fill();

    // ANCIENT GUARDIAN CAT CREST ON CHEST (Emblem of the 300-year-old guardian)
    const crestY = y + r * 0.32;
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    // Shield badge
    ctx.beginPath();
    ctx.moveTo(x - r * 0.28, crestY - r * 0.18);
    ctx.lineTo(x + r * 0.28, crestY - r * 0.18);
    ctx.lineTo(x + r * 0.2, crestY + r * 0.2);
    ctx.lineTo(x, crestY + r * 0.32);
    ctx.lineTo(x - r * 0.2, crestY + r * 0.2);
    ctx.closePath();
    ctx.fill();
    // Cat silhouette on crest
    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.arc(x, crestY + r * 0.05, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.08, crestY - r * 0.02);
    ctx.lineTo(x - r * 0.08, crestY - r * 0.12);
    ctx.lineTo(x - r * 0.01, crestY - r * 0.05);
    ctx.lineTo(x + r * 0.01, crestY - r * 0.05);
    ctx.lineTo(x + r * 0.08, crestY - r * 0.12);
    ctx.lineTo(x + r * 0.08, crestY - r * 0.02);
    ctx.closePath();
    ctx.fill();

    // Piercing Crimson Eyes with Smoke Tendrils
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.2, r * 0.13, 0, Math.PI * 2);
    ctx.arc(x + r * 0.32, y - r * 0.2, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.2, r * 0.04, 0, Math.PI * 2);
    ctx.arc(x + r * 0.32, y - r * 0.2, r * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Eye smoke tendrils
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.32, y - r * 0.2);
    ctx.quadraticCurveTo(x - r * 0.6, y - r * 0.45, x - r * 0.85, y - r * 0.3 + Math.sin(t * 5) * 4);
    ctx.moveTo(x + r * 0.32, y - r * 0.2);
    ctx.quadraticCurveTo(x + r * 0.6, y - r * 0.45, x + r * 0.85, y - r * 0.3 + Math.cos(t * 5) * 4);
    ctx.stroke();
    ctx.restore();
  }
}

