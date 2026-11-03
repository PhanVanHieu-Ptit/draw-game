/**
 * @file BackgroundRenderer.js
 * @description Renders deeply atmospheric, eerie, and ancient 2D Canvas environments (Ma mị & Cổ kính)
 * matching the 5 levels of Google Doodle Halloween 2016 (Magic Cat Academy) with ancient grimoire framing,
 * low-lying ethereal mist, spectral will-o'-the-wisps (linh hỏa ma trơi), and glowing ancient stone runes:
 * - Level 1: The Haunted Ancient Library (Thư viện cổ kính & Cổ thư ma thuật)
 * - Level 2: The Witch Kitchen & Alchemical Crypt (Nhà ăn & Hầm độc dược ma quái)
 * - Level 3: The Astral Observatory & Occult Lab (Đài thiên văn cổ & Tháp bí thuật)
 * - Level 4: The Gothic Arena & Colosseum Hall (Đấu trường ma thuật cổ kính)
 * - Level 5: Castle Spires Under Blood Harvest Moon (Đỉnh tháp pháo đài dưới trăng máu)
 */

export class BackgroundRenderer {
  constructor() {
    this.particles = [];
    this.mistParticles = [];
    this.wisps = [];
    this.lightningFlash = 0;

    this._initParticles(45);
    this._initMist(18);
    this._initWisps(5);
  }

  _initParticles(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * 2000,
        y: Math.random() * 1200,
        radius: Math.random() * 2.2 + 0.6,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 16 - 5,
        alpha: Math.random() * 0.65 + 0.2,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  _initMist(count) {
    this.mistParticles = [];
    for (let i = 0; i < count; i++) {
      this.mistParticles.push({
        x: Math.random() * 2200,
        yOffset: Math.random() * 160,
        rx: Math.random() * 90 + 70,
        ry: Math.random() * 30 + 20,
        vx: (Math.random() * 0.5 + 0.3) * 22,
        baseAlpha: Math.random() * 0.18 + 0.08,
        pulseSpeed: Math.random() * 1.5 + 0.8,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  _initWisps(count) {
    this.wisps = [];
    for (let i = 0; i < count; i++) {
      this.wisps.push({
        baseX: (i + 0.5) * (2000 / count),
        baseY: 250 + (i % 3) * 160,
        driftSpeedX: 0.6 + (i % 3) * 0.4,
        driftSpeedY: 0.8 + (i % 2) * 0.5,
        rangeX: 80 + i * 20,
        rangeY: 50 + i * 15,
        radius: 5 + (i % 3) * 2,
        phase: i * 1.3
      });
    }
  }

  update(dt) {
    if (this.lightningFlash > 0) {
      this.lightningFlash -= dt;
    }

    // 1. Update ambient motes
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.y < -30) {
        p.y = 1250;
        p.x = Math.random() * 2000;
      }
      if (p.x < -30) p.x = 2000;
      if (p.x > 2000) p.x = 0;
    }

    // 2. Update rolling ground mist
    for (let i = 0; i < this.mistParticles.length; i++) {
      const m = this.mistParticles[i];
      m.x += m.vx * dt;
      if (m.x > 2200) {
        m.x = -150;
      }
    }
  }

  triggerLightning(duration = 0.25) {
    this.lightningFlash = duration;
  }

  /**
   * Main render dispatch based on active level (1..5)
   * @param {CanvasRenderingContext2D} ctx 
   * @param {number} width 
   * @param {number} height 
   * @param {number} levelIndex 1-based index (1..5)
   * @param {number} time In seconds
   */
  render(ctx, width, height, levelIndex = 1, time = 0) {
    ctx.save();

    // 1. Render specific ancient gothic scene
    switch (levelIndex) {
      case 1:
        this._renderLibrary(ctx, width, height, time);
        break;
      case 2:
        this._renderCafeteria(ctx, width, height, time);
        break;
      case 3:
        this._renderClassroom(ctx, width, height, time);
        break;
      case 4:
        this._renderGymnasium(ctx, width, height, time);
        break;
      case 5:
      default:
        this._renderRooftop(ctx, width, height, time);
        break;
    }

    // 2. Render ancient carved floor seal beneath player
    this._renderAncientFloorSeal(ctx, width, height, levelIndex, time);

    // 3. Render low-lying eerie ground mist (sương mù ma mị)
    this._renderEerieMist(ctx, width, height, levelIndex, time);

    // 4. Render hovering Will-o'-the-Wisps (Linh hỏa ma trơi)
    this._renderSpectralWisps(ctx, width, height, levelIndex, time);

    // 5. Render floating ancient mana dust & embers
    this._renderAmbientMotes(ctx, width, height, levelIndex, time);

    // 6. Render Antique Grimoire Weathered Frame & Corner Filigree
    this._renderAncientGrimoireFrame(ctx, width, height, levelIndex, time);

    ctx.restore();
  }

  // =========================================================================
  // LEVEL 1: THE HAUNTED ANCIENT LIBRARY (Thư viện cổ kính)
  // =========================================================================
  _renderLibrary(ctx, w, h, t) {
    const isMobile = w < 768;

    // 1. Ancient Stone Masonry Wall (deep shadowy indigo & weathered obsidian)
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
    wallGrad.addColorStop(0, '#090616');
    wallGrad.addColorStop(0.5, '#120d24');
    wallGrad.addColorStop(0.85, '#0c0818');
    wallGrad.addColorStop(1, '#05030b');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle stone block masonry texture
    ctx.strokeStyle = 'rgba(76, 53, 117, 0.12)';
    ctx.lineWidth = 1.2;
    const stoneH = 36;
    const stoneW = 80;
    for (let y = 0; y < h * 0.85; y += stoneH) {
      const offset = (Math.floor(y / stoneH) % 2) * (stoneW / 2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      for (let x = -offset; x < w; x += stoneW) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + stoneH);
        ctx.stroke();
      }
    }

    // 2. Grand Gothic Rose & Pointed Stained-Glass Arch Window
    const winW = Math.min(260, w * (isMobile ? 0.38 : 0.28));
    const winH = h * 0.52;
    const winX = w / 2 - winW / 2;
    const winY = h * 0.04;

    ctx.save();
    // Misty Moonbeam cutting through cathedral dust
    const moonGrad = ctx.createRadialGradient(w / 2, winY + winH * 0.3, 15, w / 2, winY + winH * 0.9, winW * 1.8);
    moonGrad.addColorStop(0, 'rgba(165, 180, 252, 0.26)');
    moonGrad.addColorStop(0.4, 'rgba(129, 140, 248, 0.12)');
    moonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.moveTo(w / 2 - winW * 0.45, winY + 20);
    ctx.lineTo(w / 2 + winW * 0.45, winY + 20);
    ctx.lineTo(w / 2 + winW * 1.8, h * 0.92);
    ctx.lineTo(w / 2 - winW * 1.8, h * 0.92);
    ctx.closePath();
    ctx.fill();

    // Weathered Stone Arch & Stained Glass Frame
    ctx.fillStyle = '#06040e';
    ctx.strokeStyle = '#2d224e';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(w / 2, winY + winW / 2, winW / 2, Math.PI, 0, false);
    ctx.lineTo(winX + winW, winY + winH);
    ctx.lineTo(winX, winY + winH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stained glass delicate lead tracery & gothic clover
    ctx.strokeStyle = 'rgba(199, 210, 254, 0.3)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // Central vertical division
    ctx.moveTo(w / 2, winY);
    ctx.lineTo(w / 2, winY + winH);
    // Transom bars
    ctx.moveTo(winX, winY + winH * 0.45);
    ctx.lineTo(winX + winW, winY + winH * 0.45);
    ctx.moveTo(winX, winY + winH * 0.72);
    ctx.lineTo(winX + winW, winY + winH * 0.72);
    // Rose clover ring
    ctx.arc(w / 2, winY + winW * 0.42, winW * 0.24, 0, Math.PI * 2);
    ctx.stroke();

    // Pale moon silhouette through glass
    ctx.fillStyle = 'rgba(238, 242, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(w / 2 + 15, winY + winW * 0.42 - 10, winW * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Antique Carved Oak Bookshelves with Ornate Gothic Details
    const shelfWidth = Math.min(Math.max(70, w * (isMobile ? 0.18 : 0.17)), 230);
    this._drawAntiqueBookshelf(ctx, 0, h * 0.1, shelfWidth, h * 0.76, t, false);
    this._drawAntiqueBookshelf(ctx, w - shelfWidth, h * 0.1, shelfWidth, h * 0.76, t, true);

    // 4. Antique Cobblestone / Parquet Floor with Aged Grout
    const floorY = h * 0.83;
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, h);
    floorGrad.addColorStop(0, '#130d1d');
    floorGrad.addColorStop(0.5, '#0b0712');
    floorGrad.addColorStop(1, '#040206');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, w, h - floorY);

    // Floor perspective seams
    ctx.strokeStyle = 'rgba(109, 78, 143, 0.18)';
    ctx.lineWidth = 2;
    for (let x = -w * 0.25; x < w * 1.4; x += (isMobile ? 70 : 95)) {
      ctx.beginPath();
      ctx.moveTo(x, floorY);
      ctx.lineTo(x + (x - w / 2) * 0.65, h);
      ctx.stroke();
    }

    // 5. Floating Ancient Grimoires Flapping in Haunted Shadows
    const book1Y = h * 0.28 + Math.sin(t * 1.8) * 12;
    const book1X = w * (isMobile ? 0.26 : 0.31) + Math.cos(t * 1.4) * 8;
    this._drawFloatingSpellbook(ctx, book1X, book11Safe(book1Y), t, '#fbbf24', '#7c3aed');

    const book2Y = h * 0.35 + Math.cos(t * 1.6) * 11;
    const book2X = w * (isMobile ? 0.74 : 0.69) + Math.sin(t * 1.3) * 8;
    this._drawFloatingSpellbook(ctx, book2X, book11Safe(book2Y), t + 1.8, '#ec4899', '#3b82f6');

    // 6. Cobwebs in upper ceiling corners
    this._drawCobweb(ctx, 0, 0, 80);
    this._drawCobweb(ctx, w, 0, 80, true);
  }

  _drawAntiqueBookshelf(ctx, x, y, width, height, t, isFlipped) {
    ctx.save();
    // Heavy Antique Mahogany Wood cabinet
    const woodGrad = ctx.createLinearGradient(x, y, x + width, y);
    woodGrad.addColorStop(0, isFlipped ? '#2c1e40' : '#1a1127');
    woodGrad.addColorStop(0.5, '#221634');
    woodGrad.addColorStop(1, isFlipped ? '#1a1127' : '#2c1e40');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(x, y, width, height);

    // Antique Carved Cornice Header
    ctx.fillStyle = '#2f2048';
    ctx.fillRect(x, y - 8, width, 12);
    ctx.strokeStyle = '#eab30840';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);

    // Shelves with ancient leather-bound grimoires
    const shelfCount = 4;
    const shelfH = height / shelfCount;
    const bookColors = ['#991b1b', '#1e40af', '#065f46', '#854d0e', '#581c87', '#831843', '#374151', '#701a75'];

    for (let s = 0; s < shelfCount; s++) {
      const sy = y + s * shelfH;
      // Shelf recess shadow
      ctx.fillStyle = '#0d0816';
      ctx.fillRect(x + 6, sy + 6, width - 12, shelfH - 12);

      // Shelf wood plank with brass trim
      ctx.fillStyle = '#3b2958';
      ctx.fillRect(x + 2, sy + shelfH - 10, width - 4, 10);
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 2, sy + shelfH - 9);
      ctx.lineTo(x + width - 2, sy + shelfH - 9);
      ctx.stroke();

      // Books rows with gold-embossed spines & arcane symbols
      let curX = x + 12;
      let bookIdx = s * 7;
      while (curX < x + width - 20) {
        const bookW = 9 + (bookIdx % 4) * 3;
        const bookH = shelfH * 0.62 + (bookIdx % 3) * 8;
        const color = bookColors[bookIdx % bookColors.length];

        ctx.fillStyle = color;
        ctx.fillRect(curX, sy + shelfH - 10 - bookH, bookW, bookH);

        // Gold embossed ancient spine ribs
        ctx.fillStyle = 'rgba(253, 224, 71, 0.55)';
        ctx.fillRect(curX + 2, sy + shelfH - 10 - bookH + 4, bookW - 4, 2.5);
        ctx.fillRect(curX + 2, sy + shelfH - 10 - bookH + 11, bookW - 4, 2);
        ctx.fillRect(curX + 2, sy + shelfH - 10 - 7, bookW - 4, 2.5);

        curX += bookW + 3;
        bookIdx++;
      }

      // Antique melting skull candle on first shelf
      if (s === 1) {
        const candleX = isFlipped ? x + 20 : x + width - 34;
        const candleY = sy + shelfH - 24;

        // Wax base
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(candleX, candleY, 9, 14);
        // Dripping wax droplets
        ctx.fillRect(candleX - 2, candleY + 6, 3, 7);

        // Flickering spooky green/amber candle flame
        const flicker = Math.sin(t * 11 + s) * 2;
        const flameGrad = ctx.createRadialGradient(candleX + 4.5, candleY - 6, 2, candleX + 4.5, candleY - 6, 22);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.3, '#34d399');
        flameGrad.addColorStop(0.7, '#059669');
        flameGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.arc(candleX + 4.5, candleY - 6 + flicker, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _drawFloatingSpellbook(ctx, x, y, t, glowColor, coverColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 1.4) * 0.14);

    // Eerie magical aura
    const glow = ctx.createRadialGradient(0, 0, 5, 0, 0, 48);
    glow.addColorStop(0, `${glowColor}66`);
    glow.addColorStop(0.6, `${glowColor}20`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();

    // Fluttering parchment pages (Wand wings)
    const flap = Math.sin(t * 2.8) * 4;
    // Left parchment page
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-18, -14 - flap, -30, -7);
    ctx.lineTo(-28, 15);
    ctx.quadraticCurveTo(-16, 9, 0, 11);
    ctx.closePath();
    ctx.fill();

    // Right parchment page
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(18, -14 - flap, 30, -7);
    ctx.lineTo(28, 15);
    ctx.quadraticCurveTo(16, 9, 0, 11);
    ctx.closePath();
    ctx.fill();

    // Ornate antique leather hardcover rim
    ctx.strokeStyle = coverColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-32, -6);
    ctx.lineTo(-29, 18);
    ctx.quadraticCurveTo(-15, 11, 0, 13);
    ctx.quadraticCurveTo(15, 11, 29, 18);
    ctx.lineTo(32, -6);
    ctx.stroke();

    // Glowing ancient rune on page
    ctx.fillStyle = glowColor;
    ctx.font = '12px serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', 0, 5);

    ctx.restore();
  }

  // =========================================================================
  // LEVEL 2: THE WITCH KITCHEN & ALCHEMICAL CRYPT (Nhà ăn & Bếp ma cổ)
  // =========================================================================
  _renderCafeteria(ctx, w, h, t) {
    const isMobile = w < 768;

    // 1. Dark Alchemical Crypt Wall (deep charred umber & mossy slate)
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
    wallGrad.addColorStop(0, '#170902');
    wallGrad.addColorStop(0.55, '#241006');
    wallGrad.addColorStop(1, '#0e0502');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    // Weathered Gothic Crypt Vault Arches
    ctx.strokeStyle = 'rgba(180, 83, 9, 0.22)';
    ctx.lineWidth = 14;
    for (let ax = w * 0.16; ax <= w * 0.86; ax += w * (isMobile ? 0.36 : 0.32)) {
      ctx.beginPath();
      ctx.arc(ax, h * 0.28, w * (isMobile ? 0.16 : 0.13), Math.PI, 0, false);
      ctx.lineTo(ax + w * (isMobile ? 0.16 : 0.13), h * 0.76);
      ctx.stroke();
    }

    // Iron Wall Sconces with flickering green witchfire
    this._drawWitchfireSconce(ctx, w * 0.12, h * 0.34, t);
    this._drawWitchfireSconce(ctx, w * 0.88, h * 0.34, t + 1.2);

    // 2. Weathered Antique Feast Table with Torn Purple Velvet Cloth
    const tableY = h * 0.77;
    ctx.fillStyle = '#3b0764';
    ctx.beginPath();
    ctx.moveTo(w * 0.06, tableY);
    ctx.lineTo(w * 0.94, tableY);
    ctx.lineTo(w * 0.98, h);
    ctx.lineTo(w * 0.02, h);
    ctx.closePath();
    ctx.fill();

    // Tarnished Gold Table Border Trim
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.06, tableY);
    ctx.lineTo(w * 0.94, tableY);
    ctx.stroke();

    // 3. Left & Right Bubbling Giant Witch Cauldrons with Swirling Steam
    const cauldronX1 = w * (isMobile ? 0.14 : 0.13);
    const cauldronX2 = w * (isMobile ? 0.86 : 0.87);
    this._drawAntiqueCauldron(ctx, cauldronX1, h * 0.65, t, '#10b981', '#34d399');
    this._drawAntiqueCauldron(ctx, cauldronX2, h * 0.65, t + 1.5, '#a855f7', '#f472b6');

    // 4. Floating Spectral Antique Cutlery (Dao nĩa bạc ma thuật)
    this._drawSpectralCutlery(ctx, w * 0.34, h * 0.38 + Math.sin(t * 2.2) * 10, t);
    this._drawSpectralCutlery(ctx, w * 0.66, h * 0.41 + Math.cos(t * 1.9) * 12, t + 1.2);

    // 5. Carved Ancient Halloween Pumpkins on Table Edges
    this._drawAntiquePumpkin(ctx, w * 0.22, tableY - 14, t);
    this._drawAntiquePumpkin(ctx, w * 0.78, tableY - 14, t + 2.1);
  }

  _drawWitchfireSconce(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);

    // Wrought Iron wall bracket
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(0, -6);
    ctx.lineTo(14, -14);
    ctx.stroke();

    // Torch head bowl
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.arc(14, -14, 8, 0, Math.PI);
    ctx.fill();

    // Flickering Emerald Witchfire
    const flicker = Math.sin(t * 12 + x) * 2;
    const flameGrad = ctx.createRadialGradient(14, -20 + flicker, 2, 14, -20, 26);
    flameGrad.addColorStop(0, '#ffffff');
    flameGrad.addColorStop(0.3, '#34d399');
    flameGrad.addColorStop(0.7, '#059669');
    flameGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.arc(14, -20 + flicker, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawAntiqueCauldron(ctx, x, y, t, soupColor, steamColor) {
    ctx.save();
    ctx.translate(x, y);

    // Cast iron pot body with rivets
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI, false);
    ctx.lineTo(-40, 0);
    ctx.lineTo(-34, -10);
    ctx.lineTo(34, -10);
    ctx.lineTo(40, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rivets
    ctx.fillStyle = '#71717a';
    ctx.beginPath();
    ctx.arc(-22, 16, 2.5, 0, Math.PI * 2);
    ctx.arc(0, 24, 2.5, 0, Math.PI * 2);
    ctx.arc(22, 16, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Bubbling toxic potion surface
    ctx.fillStyle = soupColor;
    ctx.beginPath();
    ctx.ellipse(0, -8, 32, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing alchemical light
    const glow = ctx.createRadialGradient(0, -8, 4, 0, -24, 55);
    glow.addColorStop(0, `${soupColor}99`);
    glow.addColorStop(0.6, `${soupColor}33`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -18, 55, 0, Math.PI * 2);
    ctx.fill();

    // Rising mystic bubbles
    for (let b = 0; b < 5; b++) {
      const bTime = (t * 2.2 + b * 1.3) % 3;
      const bx = Math.sin(b * 3.1 + t * 2) * 20;
      const by = -14 - bTime * 22;
      const bAlpha = Math.max(0, 1 - bTime / 3);
      const bRad = 3.5 + (b % 3) * 2;

      ctx.fillStyle = steamColor;
      ctx.globalAlpha = bAlpha * 0.75;
      ctx.beginPath();
      ctx.arc(bx, by, bRad, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawSpectralCutlery(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 2) * 0.3);

    // Ethereal cyan glow
    ctx.strokeStyle = '#67e8f9';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.8;

    // Antique Spoon
    ctx.beginPath();
    ctx.ellipse(-11, -12, 6, 9, 0, 0, Math.PI * 2);
    ctx.moveTo(-11, -3);
    ctx.lineTo(-11, 18);
    ctx.stroke();

    // Antique Trident Fork
    ctx.beginPath();
    ctx.moveTo(11, -18); ctx.lineTo(11, 18);
    ctx.moveTo(6, -18); ctx.lineTo(6, -8); ctx.lineTo(16, -8); ctx.lineTo(16, -18);
    ctx.stroke();

    ctx.restore();
  }

  _drawAntiquePumpkin(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);

    // Weathered dark orange pumpkin rind
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9a3412';
    ctx.beginPath();
    ctx.ellipse(-11, 0, 13, 17, 0, 0, Math.PI * 2);
    ctx.ellipse(11, 0, 13, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    // Twisted stalk
    ctx.fillStyle = '#166534';
    ctx.fillRect(-3, -24, 6, 9);

    // Spooky glowing yellow/green eyes and toothy grin
    const flicker = Math.sin(t * 9) * 0.25 + 0.75;
    ctx.fillStyle = `rgba(253, 224, 71, ${flicker})`;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 14;

    // Triangular eyes
    ctx.beginPath();
    ctx.moveTo(-10, -5); ctx.lineTo(-4, -5); ctx.lineTo(-7, -11); ctx.closePath();
    ctx.moveTo(10, -5); ctx.lineTo(4, -5); ctx.lineTo(7, -11); ctx.closePath();
    ctx.fill();

    // Jagged grin
    ctx.beginPath();
    ctx.moveTo(-12, 3);
    ctx.lineTo(-6, 8);
    ctx.lineTo(0, 3);
    ctx.lineTo(6, 8);
    ctx.lineTo(12, 3);
    ctx.lineTo(8, 10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // =========================================================================
  // LEVEL 3: THE ASTRAL OBSERVATORY & OCCULT LAB (Đài thiên văn & Lớp học cổ)
  // =========================================================================
  _renderClassroom(ctx, w, h, t) {
    const isMobile = w < 768;

    // 1. Cosmic Void & Stone Observatory Wall
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
    wallGrad.addColorStop(0, '#090317');
    wallGrad.addColorStop(0.55, '#170932');
    wallGrad.addColorStop(1, '#0b0318');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    // Swirling Occult Nebula in upper observatory dome
    ctx.save();
    const nebGrad = ctx.createRadialGradient(w * 0.5, h * 0.18, 20, w * 0.5, h * 0.18, w * 0.45);
    nebGrad.addColorStop(0, 'rgba(168, 85, 247, 0.28)');
    nebGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.15)');
    nebGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = nebGrad;
    ctx.fillRect(0, 0, w, h * 0.6);
    ctx.restore();

    // 2. Colossal Ancient Slate Blackboard in Center with Occult Geometry
    const boardW = Math.min(540, w * (isMobile ? 0.72 : 0.58));
    const boardH = h * 0.4;
    const boardX = w / 2 - boardW / 2;
    const boardY = h * 0.07;

    ctx.save();
    // Heavy Antique Carved Wood frame
    ctx.fillStyle = '#2e1065';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.fillRect(boardX - 9, boardY - 9, boardW + 18, boardH + 18);
    ctx.strokeRect(boardX - 9, boardY - 9, boardW + 18, boardH + 18);

    // Dark Slate chalkboard with worn texture
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(boardX, boardY, boardW, boardH);

    // Chalk occult seals and celestial equations
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.5)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);

    const bcX = w / 2;
    const bcY = boardY + boardH * 0.5;
    ctx.beginPath();
    ctx.arc(bcX, bcY, 48, 0, Math.PI * 2);
    ctx.arc(bcX, bcY, 28, 0, Math.PI * 2);
    ctx.stroke();

    // Alchemical hexagram lines
    ctx.beginPath();
    ctx.moveTo(bcX, bcY - 48); ctx.lineTo(bcX + 41, bcY + 24);
    ctx.lineTo(bcX - 41, bcY + 24); ctx.closePath();
    ctx.moveTo(bcX, bcY + 48); ctx.lineTo(bcX + 41, bcY - 24);
    ctx.lineTo(bcX - 41, bcY - 24); ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Chalk esoteric notes
    ctx.fillStyle = 'rgba(147, 197, 253, 0.65)';
    ctx.font = '12px serif';
    ctx.fillText('☉ ☾ ♄ ♃ ♅', boardX + 16, boardY + 28);
    ctx.fillText('E = mc² + ⚡', boardX + 16, boardY + 50);
    ctx.fillText('MOMO ∴ 🐱✨', boardX + boardW - 110, boardY + 28);
    ctx.restore();

    // 3. Antique Brass Armillary Sphere / Orrery on Left
    this._drawAntiqueOrrery(ctx, w * (isMobile ? 0.16 : 0.15), h * 0.36, t);

    // 4. Antique Apothecary Potion Rack on Right
    this._drawApothecaryShelves(ctx, w * (isMobile ? 0.84 : 0.85), h * 0.30, t);

    // 5. Dark Flagstone Floor
    const floorY = h * 0.82;
    ctx.fillStyle = '#110724';
    ctx.fillRect(0, floorY, w, h - floorY);
  }

  _drawAntiqueOrrery(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);

    // Central Mystic Star Core
    const sunGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, 26);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.3, '#f59e0b');
    sunGrad.addColorStop(0.8, '#b45309');
    sunGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();

    // Antique Brass Orbital Rings & Planets
    const orbits = [
      { r: 38, speed: 1.1, color: '#38bdf8', size: 4 },
      { r: 60, speed: 0.7, color: '#ec4899', size: 5 },
      { r: 82, speed: 0.45, color: '#a855f7', size: 6 }
    ];

    ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
    ctx.lineWidth = 1.6;

    for (const orb of orbits) {
      ctx.beginPath();
      ctx.ellipse(0, 0, orb.r, orb.r * 0.48, 0.25, 0, Math.PI * 2);
      ctx.stroke();

      const angle = t * orb.speed;
      const px = Math.cos(angle) * orb.r;
      const py = Math.sin(angle) * (orb.r * 0.48);

      ctx.fillStyle = orb.color;
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, orb.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  _drawApothecaryShelves(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);

    // Antique wood rack
    ctx.fillStyle = '#2e1065';
    ctx.fillRect(-55, 0, 110, 8);
    ctx.fillRect(-55, 55, 110, 8);

    // Glowing alchemical vials & flasks
    const potions = [
      { x: -36, y: -2, col: '#34d399', shape: 'flask' },
      { x: -10, y: -2, col: '#f43f5e', shape: 'round' },
      { x: 14, y: -2, col: '#38bdf8', shape: 'tube' },
      { x: 38, y: -2, col: '#fbbf24', shape: 'flask' }
    ];

    for (const pot of potions) {
      ctx.fillStyle = pot.col;
      ctx.shadowColor = pot.col;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      if (pot.shape === 'round') {
        ctx.arc(pot.x, pot.y - 10, 8, 0, Math.PI * 2);
      } else if (pot.shape === 'flask') {
        ctx.moveTo(pot.x - 7, pot.y);
        ctx.lineTo(pot.x + 7, pot.y);
        ctx.lineTo(pot.x + 3, pot.y - 16);
        ctx.lineTo(pot.x - 3, pot.y - 16);
        ctx.closePath();
      } else {
        ctx.rect(pot.x - 4, pot.y - 20, 8, 20);
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // =========================================================================
  // LEVEL 4: THE GOTHIC ARENA & COLOSSEUM HALL (Đấu trường ma thuật cổ)
  // =========================================================================
  _renderGymnasium(ctx, w, h, t) {
    const isMobile = w < 768;

    // 1. Dark Ancient Emerald & Shadowed Slate Wall
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
    wallGrad.addColorStop(0, '#03140d');
    wallGrad.addColorStop(0.6, '#06251b');
    wallGrad.addColorStop(1, '#020f09');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Colossal Gothic Stone Pillars with Ivy & Weathering
    const pillarW = Math.min(65, w * 0.1);
    this._drawGothicPillar(ctx, w * 0.08, 0, pillarW, h * 0.78);
    this._drawGothicPillar(ctx, w * 0.92 - pillarW, 0, pillarW, h * 0.78);

    // Hanging Iron Chains & Spiked Braziers burning with green witchfire
    for (let rx = w * 0.24; rx <= w * 0.76; rx += w * (isMobile ? 0.32 : 0.26)) {
      const sway = Math.sin(t * 1.6 + rx) * 7;
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.quadraticCurveTo(rx + sway * 0.4, h * 0.28, rx + sway, h * 0.52);
      ctx.stroke();

      // Hanging Iron Brazier
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.arc(rx + sway, h * 0.54, 11, 0, Math.PI);
      ctx.fill();

      // Spectral green brazier flame
      const bFlame = Math.sin(t * 10 + rx) * 2;
      const bGrad = ctx.createRadialGradient(rx + sway, h * 0.52 + bFlame, 2, rx + sway, h * 0.52, 22);
      bGrad.addColorStop(0, '#ffffff');
      bGrad.addColorStop(0.3, '#34d399');
      bGrad.addColorStop(0.8, '#059669');
      bGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(rx + sway, h * 0.52 + bFlame, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Antique Ghost Arena Basketball Hoops / Rings with spectral ectoplasm
    this._drawAntiqueArenaRing(ctx, w * 0.12, h * 0.32, false, t);
    this._drawAntiqueArenaRing(ctx, w * 0.88, h * 0.32, true, t);

    // 4. Polished Aged Hardwood / Stone Arena Floor with Arcane Boundary Rings
    const floorY = h * 0.76;
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, h);
    floorGrad.addColorStop(0, '#451a03');
    floorGrad.addColorStop(0.4, '#78350f');
    floorGrad.addColorStop(1, '#270e02');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, w, h - floorY);

    // Ancient Arena concentric battle runes
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(w / 2, floorY + (h - floorY) * 0.45, w * 0.24, (h - floorY) * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Antique Academy Battle Banner hanging from high ceiling
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 75, 0);
    ctx.lineTo(w / 2 + 75, 0);
    ctx.lineTo(w / 2 + 60, h * 0.22);
    ctx.lineTo(w / 2, h * 0.28);
    ctx.lineTo(w / 2 - 60, h * 0.22);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12px serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ ARCANE ARENA ⚡', w / 2, h * 0.14);
  }

  _drawGothicPillar(ctx, x, y, width, height) {
    ctx.save();
    // Pillar shaft
    ctx.fillStyle = '#142a22';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#22543d';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, width, height);

    // Fluted pillar lines
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.15)';
    ctx.lineWidth = 1.5;
    for (let px = x + 8; px < x + width - 6; px += 8) {
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + height);
      ctx.stroke();
    }

    // Capital & Base
    ctx.fillStyle = '#22543d';
    ctx.fillRect(x - 5, y + height - 16, width + 10, 16);
    ctx.fillRect(x - 5, y, width + 10, 16);
    ctx.restore();
  }

  _drawAntiqueArenaRing(ctx, x, y, isFlipped, t) {
    ctx.save();
    ctx.translate(x, y);
    if (isFlipped) ctx.scale(-1, 1);

    // Weathered Gothic Backboard
    ctx.fillStyle = 'rgba(24, 24, 27, 0.85)';
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 3;
    ctx.fillRect(0, -28, 14, 56);
    ctx.strokeRect(0, -28, 14, 56);

    // Wrought Iron Rim
    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(14, 6);
    ctx.lineTo(38, 6);
    ctx.stroke();

    // Glowing spectral tattered net
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(16, 6); ctx.lineTo(22, 28); ctx.lineTo(30, 28); ctx.lineTo(36, 6);
    ctx.moveTo(24, 6); ctx.lineTo(26, 28);
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // LEVEL 5: CASTLE SPIRES UNDER BLOOD HARVEST MOON (Đỉnh tháp trăng máu)
  // =========================================================================
  _renderRooftop(ctx, w, h, t) {
    const isMobile = w < 768;

    // 1. Apocalyptic Blood Sky (crimson eclipse, abyssal maroon, dark nebula)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#150207');
    skyGrad.addColorStop(0.35, '#3b0614');
    skyGrad.addColorStop(0.75, '#20030c');
    skyGrad.addColorStop(1, '#0e0105');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Colossal Eerie Blood Harvest Moon at Center
    const moonR = Math.min(115, w * (isMobile ? 0.22 : 0.16));
    const moonX = w / 2;
    const moonY = h * (isMobile ? 0.26 : 0.28);

    // Outer sinister lunar corona & occult blood mist
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.4, moonX, moonY, moonR * 2.4);
    moonGlow.addColorStop(0, 'rgba(244, 63, 94, 0.55)');
    moonGlow.addColorStop(0.5, 'rgba(225, 29, 72, 0.22)');
    moonGlow.addColorStop(0.85, 'rgba(159, 18, 57, 0.08)');
    moonGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Textured Blood Moon Disc
    const moonDisc = ctx.createRadialGradient(moonX - moonR * 0.2, moonY - moonR * 0.2, 5, moonX, moonY, moonR);
    moonDisc.addColorStop(0, '#ffe4e6');
    moonDisc.addColorStop(0.4, '#fb7185');
    moonDisc.addColorStop(0.8, '#be123c');
    moonDisc.addColorStop(1, '#881337');
    ctx.fillStyle = moonDisc;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();

    // Occult lunar craters
    ctx.fillStyle = 'rgba(136, 19, 55, 0.35)';
    ctx.beginPath();
    ctx.arc(moonX - 26, moonY - 16, 20, 0, Math.PI * 2);
    ctx.arc(moonX + 32, moonY + 22, 26, 0, Math.PI * 2);
    ctx.arc(moonX - 12, moonY + 38, 16, 0, Math.PI * 2);
    ctx.arc(moonX + 18, moonY - 32, 14, 0, Math.PI * 2);
    ctx.fill();

    // 3. Fast-churning Storm Clouds across Moon
    this._drawStormClouds(ctx, w, h, t);

    // 4. Gothic Castle Spires & Menacing Stone Gargoyles
    this._drawCastleSpire(ctx, w * 0.07, h * 0.65, 75, h * 0.42);
    this._drawCastleSpire(ctx, w * 0.93, h * 0.65, 75, h * 0.42);

    // 5. Weathered Stone Parapet & Gothic Battlements
    const roofY = h * 0.81;
    ctx.fillStyle = '#140308';
    ctx.fillRect(0, roofY, w, h - roofY);

    // Battlements crenellations with spiked iron finials
    const crenW = isMobile ? 26 : 34;
    const crenH = 22;
    const crenGap = isMobile ? 20 : 28;
    ctx.fillStyle = '#260713';
    ctx.strokeStyle = '#4c0519';
    ctx.lineWidth = 2;

    for (let cx = 10; cx < w; cx += (crenW + crenGap)) {
      ctx.fillRect(cx, roofY - crenH, crenW, crenH);
      ctx.strokeRect(cx, roofY - crenH, crenW, crenH);
      // Spike on crenel
      ctx.beginPath();
      ctx.moveTo(cx, roofY - crenH);
      ctx.lineTo(cx + crenW / 2, roofY - crenH - 10);
      ctx.lineTo(cx + crenW, roofY - crenH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 6. Searing Lightning Sky Flash
    if (this.lightningFlash > 0 || Math.random() < 0.0035) {
      ctx.save();
      ctx.fillStyle = 'rgba(254, 205, 211, 0.38)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  _drawStormClouds(ctx, w, h, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(24, 4, 12, 0.58)';
    const speed = t * 26;

    for (let i = 0; i < 4; i++) {
      const cx = ((i * w * 0.35 + speed) % (w * 1.5)) - w * 0.25;
      const cy = h * 0.17 + (i % 3) * 36;
      const cr = 46 + (i % 2) * 26;

      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.arc(cx + 42, cy - 12, cr * 1.25, 0, Math.PI * 2);
      ctx.arc(cx + 88, cy, cr * 0.95, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawCastleSpire(ctx, x, y, width, height) {
    ctx.save();
    ctx.translate(x, y);

    // Tower stone base
    ctx.fillStyle = '#130307';
    ctx.fillRect(-width / 2, 0, width, height);

    // Weathered conical gothic roof
    ctx.fillStyle = '#260712';
    ctx.beginPath();
    ctx.moveTo(-width / 2 - 7, 0);
    ctx.lineTo(0, -height * 0.62);
    ctx.lineTo(width / 2 + 7, 0);
    ctx.closePath();
    ctx.fill();

    // Spire finial / weather vane
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -height * 0.62);
    ctx.lineTo(0, -height * 0.62 - 25);
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // ATMOSPHERIC SYSTEM: ANCIENT FLOOR RUNIC SEAL
  // =========================================================================
  _renderAncientFloorSeal(ctx, w, h, levelIndex, t) {
    const isMobile = w < 768;
    const isFinalBoss = levelIndex === 5;

    // In Level 5, Momo is stationed on the left
    const sealX = isFinalBoss ? w * (isMobile ? 0.20 : 0.22) : w / 2;
    const sealY = isFinalBoss ? h * (isMobile ? 0.65 : 0.70) : h / 2;
    const sealRadius = Math.min(w, h) * (isMobile ? 0.26 : 0.22);

    const colors = {
      1: '#818cf8', // ancient sapphire
      2: '#10b981', // witch emerald
      3: '#c084fc', // astral amethyst
      4: '#34d399', // arena jade
      5: '#f43f5e'  // blood ruby
    };
    const sealColor = colors[levelIndex] || '#c084fc';

    ctx.save();
    ctx.translate(sealX, sealY);

    // Perspective flat oval on the ground
    const breath = Math.sin(t * 1.8) * 0.15 + 0.85;
    ctx.scale(1, 0.42);

    // 1. Outer Runed Ring
    ctx.strokeStyle = sealColor;
    ctx.globalAlpha = 0.22 * breath;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, sealRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Inner Sacred Ring
    ctx.beginPath();
    ctx.arc(0, 0, sealRadius * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Rotating Sacred Geometry Points
    ctx.rotate(t * 0.15);
    ctx.lineWidth = 1.5;
    const points = 8;
    ctx.beginPath();
    for (let p = 0; p < points; p++) {
      const angle = (p / points) * Math.PI * 2;
      const x1 = Math.cos(angle) * sealRadius;
      const y1 = Math.sin(angle) * sealRadius;
      const x2 = Math.cos(angle + Math.PI * 0.75) * (sealRadius * 0.72);
      const y2 = Math.sin(angle + Math.PI * 0.75) * (sealRadius * 0.72);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // ATMOSPHERIC SYSTEM: LOW-LYING EERIE MIST (Sương mù ma mị)
  // =========================================================================
  _renderEerieMist(ctx, w, h, levelIndex, t) {
    const mistY = h * 0.82;
    const colors = {
      1: 'rgba(129, 140, 248, ',
      2: 'rgba(52, 211, 153, ',
      3: 'rgba(192, 132, 252, ',
      4: 'rgba(45, 212, 191, ',
      5: 'rgba(244, 63, 94, '
    };
    const colPrefix = colors[levelIndex] || 'rgba(167, 139, 250, ';

    ctx.save();
    for (let i = 0; i < this.mistParticles.length; i++) {
      const m = this.mistParticles[i];
      const pulse = Math.sin(t * m.pulseSpeed + m.phase) * 0.08 + m.baseAlpha;
      const x = m.x % (w + 300) - 150;
      const y = mistY + Math.sin(t * 1.2 + i) * 12 + (m.yOffset % (h - mistY));

      const grad = ctx.createRadialGradient(x, y, 4, x, y, m.rx);
      grad.addColorStop(0, `${colPrefix}${pulse})`);
      grad.addColorStop(0.5, `${colPrefix}${pulse * 0.45})`);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, m.rx, m.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // =========================================================================
  // ATMOSPHERIC SYSTEM: SPECTRAL WILL-O'-THE-WISPS (Linh hỏa ma trơi)
  // =========================================================================
  _renderSpectralWisps(ctx, w, h, levelIndex, t) {
    const isMobile = w < 768;
    const wispColors = {
      1: { core: '#67e8f9', halo: '#0284c7' }, // eerie cyan library wisps
      2: { core: '#34d399', halo: '#059669' }, // toxic witch wisps
      3: { core: '#c084fc', halo: '#7c3aed' }, // astral purple wisps
      4: { core: '#6ee7b7', halo: '#047857' }, // colosseum spirit wisps
      5: { core: '#fb7185', halo: '#be123c' }  // blood moon soul wisps
    };
    const col = wispColors[levelIndex] || wispColors[1];

    ctx.save();
    for (let i = 0; i < this.wisps.length; i++) {
      const wisp = this.wisps[i];
      const wx = (wisp.baseX + Math.sin(t * wisp.driftSpeedX + wisp.phase) * wisp.rangeX) % w;
      const wy = (wisp.baseY + Math.cos(t * wisp.driftSpeedY + wisp.phase) * wisp.rangeY) % (h * 0.85);

      const flicker = Math.sin(t * 7 + i) * 0.2 + 0.8;
      const r = wisp.radius * (isMobile ? 0.85 : 1.0);

      // Outer ethereal halo
      const haloGrad = ctx.createRadialGradient(wx, wy, 2, wx, wy, r * 4.2);
      haloGrad.addColorStop(0, `${col.halo}55`);
      haloGrad.addColorStop(0.5, `${col.halo}1a`);
      haloGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(wx, wy, r * 4.2, 0, Math.PI * 2);
      ctx.fill();

      // Glowing bright core
      ctx.fillStyle = col.core;
      ctx.globalAlpha = flicker;
      ctx.beginPath();
      ctx.arc(wx, wy, r, 0, Math.PI * 2);
      ctx.fill();

      // Trailing spirit tail
      ctx.strokeStyle = col.core;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = flicker * 0.4;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx - 8, wy + 12, wx - 4, wy + 24);
      ctx.stroke();
    }
    ctx.restore();
  }

  // =========================================================================
  // ATMOSPHERIC SYSTEM: AMBIENT MOTES & EMBERS
  // =========================================================================
  _renderAmbientMotes(ctx, w, h, levelIndex, t) {
    const palette = {
      1: '#93c5fd', // library dust & lunar sparks
      2: '#fbbf24', // kitchen embers
      3: '#c084fc', // purple mana crystals
      4: '#34d399', // emerald motes
      5: '#f43f5e'  // blood sparks
    };
    const col = palette[levelIndex] || '#e0e7ff';

    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const pulse = Math.sin(t * 3 + p.phase) * 0.35 + 0.65;
      ctx.fillStyle = col;
      ctx.globalAlpha = p.alpha * pulse * 0.6;
      ctx.beginPath();
      ctx.arc(p.x % w, p.y % h, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // =========================================================================
  // ATMOSPHERIC SYSTEM: ANTIQUE GRIMOIRE FRAME & CORNER FILIGREE
  // =========================================================================
  _renderAncientGrimoireFrame(ctx, w, h, levelIndex, t) {
    const cornerSize = Math.min(50, w * 0.08);

    ctx.save();
    // 1. Heavy Antiqued Edge Vignette (Parchment & Stone Darkening)
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.72);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.65, 'rgba(4, 2, 8, 0.42)');
    vignette.addColorStop(1, 'rgba(2, 1, 5, 0.88)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // 2. Tarnished Brass / Gold Corner Ornaments
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
    ctx.lineWidth = 2;

    // Top-Left Corner
    ctx.beginPath();
    ctx.moveTo(14, 14 + cornerSize);
    ctx.lineTo(14, 14);
    ctx.lineTo(14 + cornerSize, 14);
    ctx.moveTo(22, 22 + cornerSize * 0.6);
    ctx.lineTo(22, 22);
    ctx.lineTo(22 + cornerSize * 0.6, 22);
    ctx.stroke();

    // Top-Right Corner
    ctx.beginPath();
    ctx.moveTo(w - 14, 14 + cornerSize);
    ctx.lineTo(w - 14, 14);
    ctx.lineTo(w - 14 - cornerSize, 14);
    ctx.moveTo(w - 22, 22 + cornerSize * 0.6);
    ctx.lineTo(w - 22, 22);
    ctx.lineTo(w - 22 - cornerSize * 0.6, 22);
    ctx.stroke();

    // Bottom-Left Corner
    ctx.beginPath();
    ctx.moveTo(14, h - 14 - cornerSize);
    ctx.lineTo(14, h - 14);
    ctx.lineTo(14 + cornerSize, h - 14);
    ctx.moveTo(22, h - 22 - cornerSize * 0.6);
    ctx.lineTo(22, h - 22);
    ctx.lineTo(22 + cornerSize * 0.6, h - 22);
    ctx.stroke();

    // Bottom-Right Corner
    ctx.beginPath();
    ctx.moveTo(w - 14, h - 14 - cornerSize);
    ctx.lineTo(w - 14, h - 14);
    ctx.lineTo(w - 14 - cornerSize, h - 14);
    ctx.moveTo(w - 22, h - 22 - cornerSize * 0.6);
    ctx.lineTo(w - 22, h - 22);
    ctx.lineTo(w - 22 - cornerSize * 0.6, h - 22);
    ctx.stroke();

    ctx.restore();
  }

  _drawCobweb(ctx, x, y, size, isFlipped = false) {
    ctx.save();
    ctx.translate(x, y);
    if (isFlipped) ctx.scale(-1, 1);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;

    // Radial spokes
    const angles = [0, 0.26, 0.52, 0.78, 1.04, 1.3, 1.57];
    for (const a of angles) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
      ctx.stroke();
    }

    // Concentric web arcs
    for (let r = 20; r <= size; r += 18) {
      ctx.beginPath();
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i];
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}

function book11Safe(val) {
  return Number.isFinite(val) ? val : 100;
}
