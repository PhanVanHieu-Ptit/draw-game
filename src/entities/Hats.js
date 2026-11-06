/**
 * @file Hats.js
 * @description Draws the cosmetic hats Momo can wear (see core/Cosmetics.js). Each hat is a small vector
 * drawing in a local space whose origin is the TOP-CENTRE of Momo's head and whose unit is "about a 50px wide
 * head"; drawHat() scales it to the real head width. No shadows are used so hats cost almost nothing.
 */

const TAU = Math.PI * 2;

function star(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

const HAT_DRAWERS = {
  party(ctx, t) {
    ctx.save();
    ctx.rotate(-0.18);
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.moveTo(-15, 4);
    ctx.lineTo(0, -34);
    ctx.lineTo(15, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const y = -4 - i * 10;
      const half = 13 - i * 4.2;
      ctx.beginPath();
      ctx.moveTo(-half, y);
      ctx.lineTo(half, y - 4);
      ctx.stroke();
    }
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, -35 + Math.sin(t * 6) * 0.8, 4.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  bow(ctx) {
    ctx.save();
    ctx.translate(15, 2);
    ctx.rotate(0.25);
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-13, -8);
    ctx.lineTo(-13, 8);
    ctx.closePath();
    ctx.moveTo(0, 0);
    ctx.lineTo(13, -8);
    ctx.lineTo(13, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  wizard(ctx, t) {
    ctx.save();
    ctx.fillStyle = '#4c1d95';
    // Brim
    ctx.beginPath();
    ctx.ellipse(0, 3, 27, 6.5, 0, 0, TAU);
    ctx.fill();
    // Cone with a bent tip
    ctx.beginPath();
    ctx.moveTo(-16, 3);
    ctx.quadraticCurveTo(-8, -20, 10 + Math.sin(t * 2) * 1.5, -36);
    ctx.quadraticCurveTo(13, -18, 16, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(-15, -3, 30, 4);
    star(ctx, 0, -14, 5.5, '#fde047');
    ctx.restore();
  },

  halo(ctx, t) {
    ctx.save();
    const bob = Math.sin(t * 3) * 1.6;
    ctx.translate(0, -15 + bob);
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 5.5, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 5.5, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },

  crown(ctx, t) {
    ctx.save();
    ctx.translate(0, 2);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-17, 0);
    ctx.lineTo(-19, -20);
    ctx.lineTo(-9, -11);
    ctx.lineTo(0, -25);
    ctx.lineTo(9, -11);
    ctx.lineTo(19, -20);
    ctx.lineTo(17, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-17, -4, 34, 4);
    const glint = 0.6 + 0.4 * Math.sin(t * 4);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -10, 3, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = glint;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-0.8, -11, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  horns(ctx) {
    ctx.save();
    ctx.fillStyle = '#dc2626';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 9, 3);
      ctx.quadraticCurveTo(side * 22, -4, side * 15, -19);
      ctx.quadraticCurveTo(side * 12, -5, side * 4, 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
};

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} id hat id from core/Cosmetics.js ('none' draws nothing)
 * @param {{x: number, y: number, w: number}} anchor top-centre of the head and its width, in the caller's space
 * @param {number} t seconds, for the little animations
 */
export function drawHat(ctx, id, anchor, t = 0) {
  const draw = HAT_DRAWERS[id];
  if (!draw || !anchor) return;
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  const k = (anchor.w || 50) / 50;
  ctx.scale(k, k);
  draw(ctx, t);
  ctx.restore();
}
