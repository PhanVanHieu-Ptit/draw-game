/**
 * @file RunePatterns.js
 * @description Colour-blind friendly rune badges.
 *
 * Every rune already has its own symbol, but its colour is what players read first, and several
 * pairs (orange / red, green / blue-green) are hard to tell apart without colour vision. In
 * colour-blind mode each rune badge also gets a distinct border dash style and a distinct hatch
 * pattern, so a rune can be recognised by texture alone.
 */

/** Border dash pattern per rune ([] = solid) */
export const RUNE_DASH = {
  horizontal: [],
  vertical: [7, 3],
  caret: [2, 3],
  v_shape: [],
  lightning: [9, 2, 2, 2],
  heart: [],
  circle: [3, 3],
  spiral: [11, 3]
};

/** Hatch pattern per rune, see drawRunePattern() */
export const RUNE_HATCH = {
  horizontal: 'horizontal',
  vertical: 'vertical',
  caret: 'diagonal-up',
  v_shape: 'diagonal-down',
  lightning: 'cross',
  heart: 'dots',
  circle: 'ring',
  spiral: 'double'
};

/**
 * Set the dash pattern for the badge border (call before stroke()). Restores to solid via resetBorderPattern.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} runeId
 */
export function applyBorderPattern(ctx, runeId) {
  const dash = RUNE_DASH[runeId];
  if (dash && dash.length && typeof ctx.setLineDash === 'function') {
    ctx.setLineDash(dash);
  }
}

export function resetBorderPattern(ctx) {
  if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
}

/**
 * Draw the hatch inside a badge centred on the origin.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} runeId
 * @param {number} w badge width
 * @param {number} h badge height
 * @param {string} color
 */
export function drawRunePattern(ctx, runeId, w, h, color) {
  const kind = RUNE_HATCH[runeId];
  if (!kind) return;
  const hw = w / 2;
  const hh = h / 2;

  ctx.save();
  if (typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
    ctx.beginPath();
    ctx.rect(-hw, -hh, w, h);
    ctx.clip();
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.2;
  ctx.beginPath();

  const step = 5;
  switch (kind) {
    case 'horizontal':
      for (let y = -hh + step; y < hh; y += step) { ctx.moveTo(-hw, y); ctx.lineTo(hw, y); }
      break;
    case 'vertical':
      for (let x = -hw + step; x < hw; x += step) { ctx.moveTo(x, -hh); ctx.lineTo(x, hh); }
      break;
    case 'diagonal-up':
      for (let k = -h; k < w; k += step) { ctx.moveTo(-hw + k, hh); ctx.lineTo(-hw + k + h, -hh); }
      break;
    case 'diagonal-down':
      for (let k = -h; k < w; k += step) { ctx.moveTo(-hw + k, -hh); ctx.lineTo(-hw + k + h, hh); }
      break;
    case 'cross':
      for (let k = -h; k < w; k += step * 1.4) {
        ctx.moveTo(-hw + k, hh); ctx.lineTo(-hw + k + h, -hh);
        ctx.moveTo(-hw + k, -hh); ctx.lineTo(-hw + k + h, hh);
      }
      break;
    case 'dots':
      for (let y = -hh + 4; y < hh; y += 6) {
        for (let x = -hw + 4; x < hw; x += 6) { ctx.moveTo(x + 1.2, y); ctx.arc(x, y, 1.2, 0, Math.PI * 2); }
      }
      break;
    case 'ring':
      ctx.arc(0, 0, Math.min(hw, hh) * 0.82, 0, Math.PI * 2);
      break;
    case 'double':
      ctx.rect(-hw + 3, -hh + 3, w - 6, h - 6);
      break;
    default:
      break;
  }
  ctx.stroke();
  ctx.restore();
}
