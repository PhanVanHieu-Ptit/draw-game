/**
 * @file BackgroundRenderer.js
 * @description Renders atmospheric, animated 2D Canvas environments matching the 5 levels of
 * Google Doodle Halloween 2016 (Magic Cat Academy):
 * - Level 1: The Library (Thư viện cổ kính)
 * - Level 2: The Cafeteria (Phòng ăn & Nhà bếp ma thuật)
 * - Level 3: The Classroom (Lớp học thiên văn & phòng thí nghiệm)
 * - Level 4: The Gymnasium (Nhà thi đấu thể thao trường học)
 * - Level 5: The Rooftop (Sân thượng lâu đài dưới trăng máu)
 */

export class BackgroundRenderer {
  constructor() {
    this.particles = [];
    this._initParticles(50);
    this.lightningFlash = 0;
  }

  _initParticles(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * 2000,
        y: Math.random() * 1200,
        radius: Math.random() * 2 + 0.8,
        vx: (Math.random() - 0.5) * 15,
        vy: -Math.random() * 18 - 6,
        alpha: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
        color: '#e0e7ff'
      });
    }
  }

  update(dt) {
    if (this.lightningFlash > 0) {
      this.lightningFlash -= dt;
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.y < -20) {
        p.y = 1200;
        p.x = Math.random() * 2000;
      }
      if (p.x < -20) p.x = 2000;
      if (p.x > 2000) p.x = 0;
    }
  }

  triggerLightning(duration = 0.2) {
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

    // Render level-tailored floating ambient motes
    this._renderAmbientMotes(ctx, width, height, levelIndex, time);

    ctx.restore();
  }

  // =========================================================================
  // LEVEL 1: THE LIBRARY (Thư viện cổ kính)
  // =========================================================================
  _renderLibrary(ctx, w, h, t) {
    // 1. Base Wall: Deep midnight mahogany / purple stone
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
    wallGrad.addColorStop(0, '#100c22');
    wallGrad.addColorStop(0.65, '#181232');
    wallGrad.addColorStop(1, '#0e0b1e');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Tall Gothic Arched Window at Center with Moonlight Beam
    const winW = Math.min(220, w * 0.28);
    const winH = h * 0.48;
    const winX = w / 2 - winW / 2;
    const winY = h * 0.05;

    ctx.save();
    // Moonlight Beam
    const moonGrad = ctx.createRadialGradient(w / 2, winY + winH * 0.35, 10, w / 2, winY + winH * 0.8, winW * 1.5);
    moonGrad.addColorStop(0, 'rgba(147, 197, 253, 0.22)');
    moonGrad.addColorStop(0.5, 'rgba(96, 165, 250, 0.08)');
    moonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.moveTo(w / 2 - winW * 0.4, winY + 20);
    ctx.lineTo(w / 2 + winW * 0.4, winY + 20);
    ctx.lineTo(w / 2 + winW * 1.6, h * 0.9);
    ctx.lineTo(w / 2 - winW * 1.6, h * 0.9);
    ctx.closePath();
    ctx.fill();

    // Window frame
    ctx.fillStyle = '#090714';
    ctx.strokeStyle = '#272046';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(w / 2, winY + winW / 2, winW / 2, Math.PI, 0, false);
    ctx.lineTo(winX + winW, winY + winH);
    ctx.lineTo(winX, winY + winH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Window paning
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w / 2, winY);
    ctx.lineTo(w / 2, winY + winH);
    ctx.moveTo(winX, winY + winH * 0.5);
    ctx.lineTo(winX + winW, winY + winH * 0.5);
    ctx.moveTo(winX, winY + winH * 0.75);
    ctx.lineTo(winX + winW, winY + winH * 0.75);
    ctx.stroke();
    ctx.restore();

    // 3. Huge Wooden Bookshelves on Left & Right (responsive width for mobile screens)
    const shelfWidth = Math.min(Math.max(65, w * 0.16), 220);
    this._drawBookshelf(ctx, 0, h * 0.12, shelfWidth, h * 0.78, t, false);
    this._drawBookshelf(ctx, w - shelfWidth, h * 0.12, shelfWidth, h * 0.78, t, true);

    // 4. Parquet Wooden Floorboards
    const floorY = h * 0.84;
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, h);
    floorGrad.addColorStop(0, '#1a1325');
    floorGrad.addColorStop(1, '#0b0812');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 0 + floorY, w, h - floorY);

    ctx.strokeStyle = 'rgba(88, 64, 115, 0.2)';
    ctx.lineWidth = 2;
    for (let x = -w * 0.2; x < w * 1.4; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, floorY);
      ctx.lineTo(x + (x - w / 2) * 0.6, h);
      ctx.stroke();
    }

    // 5. Floating Enchanted Spellbook in upper library
    const bookY = h * 0.26 + Math.sin(t * 2) * 12;
    const bookX = w * 0.32 + Math.cos(t * 1.5) * 8;
    this._drawFloatingSpellbook(ctx, bookX, bookY, t, '#f59e0b', '#3b82f6');

    const book2Y = h * 0.34 + Math.cos(t * 1.8) * 10;
    const book2X = w * 0.68 + Math.sin(t * 1.4) * 8;
    this._drawFloatingSpellbook(ctx, book2X, book2Y, t + 1.5, '#ec4899', '#8b5cf6');
  }

  _drawBookshelf(ctx, x, y, width, height, t, isFlipped) {
    ctx.save();
    // Shelf outer cabinet
    ctx.fillStyle = '#1c142b';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#38284f';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, width, height);

    // Horizontal shelf dividers
    const shelfCount = 4;
    const shelfH = height / shelfCount;
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#e2e8f0'];

    for (let s = 0; s < shelfCount; s++) {
      const sy = y + s * shelfH;
      ctx.fillStyle = '#120d1c';
      ctx.fillRect(x + 6, sy + 6, width - 12, shelfH - 12);

      // Shelf wood board
      ctx.fillStyle = '#2f2142';
      ctx.fillRect(x + 2, sy + shelfH - 10, width - 4, 10);

      // Books rows
      let curX = x + 14;
      let bookIdx = (s * 5);
      while (curX < x + width - 24) {
        const bookW = 10 + (bookIdx % 4) * 3;
        const bookH = shelfH * 0.65 + (bookIdx % 3) * 6;
        const color = colors[bookIdx % colors.length];

        ctx.fillStyle = color;
        ctx.fillRect(curX, sy + shelfH - 10 - bookH, bookW, bookH);

        // Gold spine accent
        ctx.fillStyle = 'rgba(253, 224, 71, 0.45)';
        ctx.fillRect(curX + 2, sy + shelfH - 10 - bookH + 4, bookW - 4, 3);
        ctx.fillRect(curX + 2, sy + shelfH - 10 - 8, bookW - 4, 3);

        curX += bookW + 3;
        bookIdx++;
      }

      // Small candle on first shelf
      if (s === 1) {
        const candleX = isFlipped ? x + 24 : x + width - 36;
        const candleY = sy + shelfH - 26;
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(candleX, candleY, 8, 16);

        // Flickering candle flame
        const flameBob = Math.sin(t * 12 + s) * 2;
        const flameGrad = ctx.createRadialGradient(candleX + 4, candleY - 6, 2, candleX + 4, candleY - 6, 18);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.3, '#fbbf24');
        flameGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.arc(candleX + 4, candleY - 6 + flameBob, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _drawFloatingSpellbook(ctx, x, y, t, glowColor, coverColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 1.5) * 0.12);

    // Book magical aura
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
    glow.addColorStop(0, `${glowColor}55`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();

    // Open book pages (Wings)
    const flap = Math.sin(t * 3) * 3;
    // Left page
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-18, -12 - flap, -28, -6);
    ctx.lineTo(-26, 14);
    ctx.quadraticCurveTo(-16, 8, 0, 10);
    ctx.closePath();
    ctx.fill();

    // Right page
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(18, -12 - flap, 28, -6);
    ctx.lineTo(26, 14);
    ctx.quadraticCurveTo(16, 8, 0, 10);
    ctx.closePath();
    ctx.fill();

    // Hardcover rim
    ctx.strokeStyle = coverColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-30, -5);
    ctx.lineTo(-28, 17);
    ctx.quadraticCurveTo(-14, 10, 0, 12);
    ctx.quadraticCurveTo(14, 10, 28, 17);
    ctx.lineTo(30, -5);
    ctx.stroke();

    // Arcane glyph on page
    ctx.fillStyle = glowColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨', 0, 4);

    ctx.restore();
  }

  // =========================================================================
  // LEVEL 2: THE CAFETERIA & KITCHEN (Nhà ăn & Bếp ma)
  // =========================================================================
  _renderCafeteria(ctx, w, h, t) {
    // 1. Kitchen Wall: Warm terracotta brick & dark hearth
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
    wallGrad.addColorStop(0, '#241006');
    wallGrad.addColorStop(0.55, '#35180c');
    wallGrad.addColorStop(1, '#180a04');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    // Stone arches in background
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.35)';
    ctx.lineWidth = 14;
    for (let ax = w * 0.15; ax <= w * 0.85; ax += w * 0.35) {
      ctx.beginPath();
      ctx.arc(ax, h * 0.3, w * 0.14, Math.PI, 0, false);
      ctx.lineTo(ax + w * 0.14, h * 0.75);
      ctx.stroke();
    }

    // 2. Long Dining Banquet Table with Purple Tablecloth
    const tableY = h * 0.78;
    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.moveTo(w * 0.08, tableY);
    ctx.lineTo(w * 0.92, tableY);
    ctx.lineTo(w * 0.96, h);
    ctx.lineTo(w * 0.04, h);
    ctx.closePath();
    ctx.fill();

    // Golden table border trim
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, tableY);
    ctx.lineTo(w * 0.92, tableY);
    ctx.stroke();

    // 3. Left & Right Bubbling Witch Cauldrons (Vạc ma thuật sôi)
    this._drawCauldron(ctx, w * 0.14, h * 0.65, t, '#10b981', '#34d399');
    this._drawCauldron(ctx, w * 0.86, h * 0.65, t + 1.2, '#a855f7', '#c084fc');

    // 4. Floating Kitchenware (Muỗng, nĩa ma quái)
    this._drawFloatingCutlery(ctx, w * 0.36, h * 0.38 + Math.sin(t * 2.5) * 10, t);
    this._drawFloatingCutlery(ctx, w * 0.64, h * 0.42 + Math.cos(t * 2.2) * 12, t + 1);

    // 5. Carved Halloween Pumpkins (Bí ngô ma thuật) on table edges
    this._drawPumpkin(ctx, w * 0.22, tableY - 14, t);
    this._drawPumpkin(ctx, w * 0.78, tableY - 14, t + 2);
  }

  _drawCauldron(ctx, x, y, t, soupColor, steamColor) {
    ctx.save();
    ctx.translate(x, y);

    // Cauldron cast iron pot
    ctx.fillStyle = '#1c1917';
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI, false);
    ctx.lineTo(-38, 0);
    ctx.lineTo(-32, -8);
    ctx.lineTo(32, -8);
    ctx.lineTo(38, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bubbling soup surface
    ctx.fillStyle = soupColor;
    ctx.beginPath();
    ctx.ellipse(0, -6, 30, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing soup light
    const glow = ctx.createRadialGradient(0, -6, 4, 0, -20, 45);
    glow.addColorStop(0, `${soupColor}88`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -15, 45, 0, Math.PI * 2);
    ctx.fill();

    // Steam bubbles popping
    for (let b = 0; b < 4; b++) {
      const bTime = (t * 2 + b * 1.4) % 3;
      const bx = Math.sin(b * 3 + t) * 18;
      const by = -12 - bTime * 18;
      const bAlpha = Math.max(0, 1 - bTime / 3);
      const bRad = 3 + (b % 3) * 2;

      ctx.fillStyle = steamColor;
      ctx.globalAlpha = bAlpha * 0.7;
      ctx.beginPath();
      ctx.arc(bx, by, bRad, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawFloatingCutlery(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 2) * 0.25);

    // Glowing ghost fork & spoon
    ctx.strokeStyle = '#67e8f9';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.5;

    // Spoon
    ctx.beginPath();
    ctx.ellipse(-10, -12, 5, 8, 0, 0, Math.PI * 2);
    ctx.moveTo(-10, -4);
    ctx.lineTo(-10, 16);
    ctx.stroke();

    // Fork
    ctx.beginPath();
    ctx.moveTo(10, -16); ctx.lineTo(10, 16);
    ctx.moveTo(6, -16); ctx.lineTo(6, -8); ctx.lineTo(14, -8); ctx.lineTo(14, -16);
    ctx.stroke();

    ctx.restore();
  }

  _drawPumpkin(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);

    // Pumpkin orange body
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.ellipse(-10, 0, 12, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(10, 0, 12, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Green stalk
    ctx.fillStyle = '#15803d';
    ctx.fillRect(-2.5, -22, 5, 8);

    // Glowing yellow eyes and toothy grin
    const flicker = Math.sin(t * 8) * 0.2 + 0.8;
    ctx.fillStyle = `rgba(253, 224, 71, ${flicker})`;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12;

    // Eyes
    ctx.beginPath();
    ctx.moveTo(-9, -4); ctx.lineTo(-4, -4); ctx.lineTo(-6.5, -9); ctx.closePath();
    ctx.moveTo(9, -4); ctx.lineTo(4, -4); ctx.lineTo(6.5, -9); ctx.closePath();
    ctx.fill();

    // Mouth
    ctx.beginPath();
    ctx.arc(0, 2, 9, 0.2, Math.PI - 0.2);
    ctx.lineTo(0, 7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // =========================================================================
  // LEVEL 3: THE CLASSROOM / ASTRONOMY LAB (Lớp học & Thiên văn)
  // =========================================================================
  _renderClassroom(ctx, w, h, t) {
    // 1. Dark Indigo Wall
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
    wallGrad.addColorStop(0, '#110726');
    wallGrad.addColorStop(0.6, '#1d0c3d');
    wallGrad.addColorStop(1, '#0e051d');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Giant Spell Blackboard in Center
    const boardW = Math.min(520, w * 0.58);
    const boardH = h * 0.38;
    const boardX = w / 2 - boardW / 2;
    const boardY = h * 0.08;

    ctx.save();
    // Wooden frame
    ctx.fillStyle = '#451a03';
    ctx.fillRect(boardX - 8, boardY - 8, boardW + 16, boardH + 16);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(boardX, boardY, boardW, boardH);

    // Blackboard chalk drawings (Magic runes & alchemy diagrams)
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 4]);

    // Magic Circle on blackboard
    const bcX = w / 2;
    const bcY = boardY + boardH * 0.48;
    ctx.beginPath();
    ctx.arc(bcX, bcY, 44, 0, Math.PI * 2);
    ctx.arc(bcX, bcY, 26, 0, Math.PI * 2);
    ctx.stroke();

    // Pentagram / Hexagram lines
    ctx.beginPath();
    ctx.moveTo(bcX, bcY - 44); ctx.lineTo(bcX + 38, bcY + 22);
    ctx.lineTo(bcX - 38, bcY + 22); ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Chalk equations
    ctx.fillStyle = 'rgba(147, 197, 253, 0.6)';
    ctx.font = '12px monospace';
    ctx.fillText('E = mc² + ⚡', boardX + 18, boardY + 28);
    ctx.fillText('∧ + ∨ = 💥', boardX + 18, boardY + 48);
    ctx.fillText('MOMO = 🧙‍♂️🐱', boardX + boardW - 100, boardY + 28);

    ctx.restore();

    // 3. Rotating Solar System Orrery (Mô hình thiên văn) on left
    this._drawOrrery(ctx, w * 0.16, h * 0.35, t);

    // 4. Shelves with Glowing Potions (Bình thuốc phát quang) on right
    this._drawPotionShelves(ctx, w * 0.84, h * 0.28, t);

    // 5. Wooden Student Desks in foreground
    const floorY = h * 0.82;
    ctx.fillStyle = '#1e1430';
    ctx.fillRect(0, floorY, w, h - floorY);
  }

  _drawOrrery(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);

    // Glowing Central Sun / Crystal
    const sunGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.3, '#f59e0b');
    sunGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();

    // Orbital rings & planets
    const orbits = [
      { r: 40, speed: 1.2, color: '#38bdf8', size: 4 },
      { r: 62, speed: 0.8, color: '#ec4899', size: 5.5 },
      { r: 84, speed: 0.5, color: '#a855f7', size: 6 }
    ];

    ctx.strokeStyle = 'rgba(167, 139, 250, 0.25)';
    ctx.lineWidth = 1.5;

    for (const orb of orbits) {
      ctx.beginPath();
      ctx.ellipse(0, 0, orb.r, orb.r * 0.45, 0.2, 0, Math.PI * 2);
      ctx.stroke();

      const angle = t * orb.speed;
      const px = Math.cos(angle) * orb.r;
      const py = Math.sin(angle) * (orb.r * 0.45);

      ctx.fillStyle = orb.color;
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px, py, orb.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  _drawPotionShelves(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);

    // Wooden rack
    ctx.fillStyle = '#311b0b';
    ctx.fillRect(-60, 0, 120, 10);
    ctx.fillRect(-60, 60, 120, 10);

    // Glowing bottles
    const potions = [
      { x: -40, y: -2, col: '#34d399', shape: 'flask' },
      { x: -12, y: -2, col: '#f43f5e', shape: 'round' },
      { x: 16, y: -2, col: '#38bdf8', shape: 'tube' },
      { x: 42, y: -2, col: '#fbbf24', shape: 'flask' }
    ];

    for (const pot of potions) {
      ctx.fillStyle = pot.col;
      ctx.shadowColor = pot.col;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      if (pot.shape === 'round') {
        ctx.arc(pot.x, pot.y - 10, 9, 0, Math.PI * 2);
      } else if (pot.shape === 'flask') {
        ctx.moveTo(pot.x - 8, pot.y);
        ctx.lineTo(pot.x + 8, pot.y);
        ctx.lineTo(pot.x + 3, pot.y - 18);
        ctx.lineTo(pot.x - 3, pot.y - 18);
        ctx.closePath();
      } else {
        ctx.rect(pot.x - 4, pot.y - 22, 8, 22);
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // =========================================================================
  // LEVEL 4: THE GYMNASIUM (Nhà thi đấu thể thao)
  // =========================================================================
  _renderGymnasium(ctx, w, h, t) {
    // 1. Dark Emerald / Industrial Wall
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
    wallGrad.addColorStop(0, '#041c14');
    wallGrad.addColorStop(0.65, '#09291e');
    wallGrad.addColorStop(1, '#03140e');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. High Ceiling Gym Rafters & Hanging Climbing Ropes
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.08); ctx.lineTo(w, h * 0.08);
    ctx.moveTo(0, h * 0.14); ctx.lineTo(w, h * 0.14);
    ctx.stroke();

    // Ropes swinging gently
    for (let rx = w * 0.18; rx <= w * 0.82; rx += w * 0.22) {
      const sway = Math.sin(t * 1.5 + rx) * 8;
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(rx, h * 0.08);
      ctx.quadraticCurveTo(rx + sway * 0.5, h * 0.35, rx + sway, h * 0.62);
      ctx.stroke();

      // Rope knot
      ctx.fillStyle = '#a16207';
      ctx.beginPath();
      ctx.arc(rx + sway, h * 0.62, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Glowing Ghost Basketball Hoops
    this._drawHoop(ctx, w * 0.1, h * 0.28, false, t);
    this._drawHoop(ctx, w * 0.9, h * 0.28, true, t);

    // 4. Shiny Varnished Hardwood Gym Floor with Court Lines
    const floorY = h * 0.76;
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, h);
    floorGrad.addColorStop(0, '#78350f');
    floorGrad.addColorStop(0.3, '#92400e');
    floorGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, w, h - floorY);

    // Court paint lines (Basketball key & center circle)
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(w / 2, floorY + (h - floorY) * 0.45, w * 0.22, (h - floorY) * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, floorY + (h - floorY) * 0.45);
    ctx.lineTo(w, floorY + (h - floorY) * 0.45);
    ctx.stroke();

    // 5. School Pride Banners hanging in background
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 80, h * 0.14);
    ctx.lineTo(w / 2 + 80, h * 0.14);
    ctx.lineTo(w / 2, h * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MAGIC CAT GYM', w / 2, h * 0.19);
  }

  _drawHoop(ctx, x, y, isFlipped, t) {
    ctx.save();
    ctx.translate(x, y);
    if (isFlipped) ctx.scale(-1, 1);

    // Backboard
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.fillRect(0, -25, 12, 50);
    ctx.strokeRect(0, -25, 12, 50);

    // Orange Rim
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(12, 5);
    ctx.lineTo(36, 5);
    ctx.stroke();

    // Spooky tattered net glowing
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, 5); ctx.lineTo(20, 26); ctx.lineTo(28, 26); ctx.lineTo(34, 5);
    ctx.moveTo(22, 5); ctx.lineTo(24, 26);
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // LEVEL 5: THE ROOFTOP (Sân thượng lâu đài - Final Boss Showdown)
  // =========================================================================
  _renderRooftop(ctx, w, h, t) {
    // 1. Epic Crimson & Midnight Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#1a040b');
    skyGrad.addColorStop(0.45, '#3b0818');
    skyGrad.addColorStop(1, '#150308');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Colossal Eerie Blood Harvest Moon at Center
    const moonR = Math.min(110, w * 0.16);
    const moonX = w / 2;
    const moonY = h * 0.28;

    // Outer moon corona
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 2.2);
    moonGlow.addColorStop(0, 'rgba(244, 63, 94, 0.45)');
    moonGlow.addColorStop(0.6, 'rgba(225, 29, 72, 0.18)');
    moonGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Moon disc
    const moonDisc = ctx.createRadialGradient(moonX - moonR * 0.2, moonY - moonR * 0.2, 5, moonX, moonY, moonR);
    moonDisc.addColorStop(0, '#ffe4e6');
    moonDisc.addColorStop(0.5, '#fb7185');
    moonDisc.addColorStop(1, '#be123c');
    ctx.fillStyle = moonDisc;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();

    // Moon craters
    ctx.fillStyle = 'rgba(159, 18, 57, 0.25)';
    ctx.beginPath();
    ctx.arc(moonX - 25, moonY - 15, 18, 0, Math.PI * 2);
    ctx.arc(moonX + 30, moonY + 20, 24, 0, Math.PI * 2);
    ctx.arc(moonX - 10, moonY + 35, 14, 0, Math.PI * 2);
    ctx.fill();

    // 3. Fast-moving Spooky Storm Clouds drifting across Moon
    this._drawClouds(ctx, w, h, t);

    // 4. Gothic Castle Spires & Towers Silhouette on sides
    this._drawCastleSpire(ctx, w * 0.08, h * 0.65, 70, h * 0.4);
    this._drawCastleSpire(ctx, w * 0.92, h * 0.65, 70, h * 0.4);

    // 5. Stone Battlements / Gothic Balustrade on Rooftop
    const roofY = h * 0.82;
    ctx.fillStyle = '#18070d';
    ctx.fillRect(0, roofY, w, h - roofY);

    // Battlements crenellations
    const crenW = 34;
    const crenH = 20;
    const crenGap = 28;
    ctx.fillStyle = '#260a15';
    for (let cx = 10; cx < w; cx += (crenW + crenGap)) {
      ctx.fillRect(cx, roofY - crenH, crenW, crenH);
      // Small spike on crenel
      ctx.beginPath();
      ctx.moveTo(cx, roofY - crenH);
      ctx.lineTo(cx + crenW / 2, roofY - crenH - 8);
      ctx.lineTo(cx + crenW, roofY - crenH);
      ctx.closePath();
      ctx.fill();
    }

    // 6. Searing Lightning Sky Flash
    if (this.lightningFlash > 0 || Math.random() < 0.003) {
      ctx.save();
      ctx.fillStyle = 'rgba(254, 205, 211, 0.35)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  _drawClouds(ctx, w, h, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(26, 6, 14, 0.55)';
    const speed = t * 24;

    for (let i = 0; i < 4; i++) {
      const cx = ((i * w * 0.35 + speed) % (w * 1.5)) - w * 0.25;
      const cy = h * 0.18 + (i % 3) * 35;
      const cr = 45 + (i % 2) * 25;

      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.arc(cx + 40, cy - 10, cr * 1.2, 0, Math.PI * 2);
      ctx.arc(cx + 85, cy, cr * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawCastleSpire(ctx, x, y, width, height) {
    ctx.save();
    ctx.translate(x, y);

    // Tower base
    ctx.fillStyle = '#140409';
    ctx.fillRect(-width / 2, 0, width, height);

    // Conical roof
    ctx.fillStyle = '#260713';
    ctx.beginPath();
    ctx.moveTo(-width / 2 - 6, 0);
    ctx.lineTo(0, -height * 0.6);
    ctx.lineTo(width / 2 + 6, 0);
    ctx.closePath();
    ctx.fill();

    // Spire finial / weather vane
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -height * 0.6);
    ctx.lineTo(0, -height * 0.6 - 22);
    ctx.stroke();

    ctx.restore();
  }

  _renderAmbientMotes(ctx, w, h, levelIndex, t) {
    const palette = {
      1: '#93c5fd', // blue dust for library
      2: '#fbbf24', // warm embers for cafeteria
      3: '#c084fc', // purple mana for classroom
      4: '#34d399', // emerald motes for gym
      5: '#f43f5e'  // blood sparks for rooftop
    };
    const col = palette[levelIndex] || '#e0e7ff';

    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const pulse = Math.sin(t * 3 + p.phase) * 0.3 + 0.7;
      ctx.fillStyle = col;
      ctx.globalAlpha = p.alpha * pulse * 0.55;
      ctx.beginPath();
      ctx.arc(p.x % w, p.y % h, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
