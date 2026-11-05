/**
 * @file PracticeSession.js
 * @description Practice Mode (Phòng Luyện Vẽ): pick a rune and draw it freely with no ghosts attacking.
 *
 * While the player draws, the accuracy meter follows the stroke in real time; when they lift the pen
 * the stroke is scored against the chosen rune, the result is explained in words, and good attempts
 * count towards mastering that rune.
 *
 * This class only holds practice state and decides what to show. The DOM lives in MetaUI, the canvas
 * overlay (faint template) is drawn by render(), and persistence goes through ProgressStore.
 */

import { RUNES } from '../core/Constants.js';
import { getGuideStroke, getMissHint, GESTURE_TIPS } from '../GestureEngine.js';
import { masteryThreshold, MASTERY_PASSES } from '../core/ProgressStore.js';
import { evaluateAchievements } from '../core/Achievements.js';

/** Order the runes appear in the picker: easy shapes first */
export const PRACTICE_ORDER = ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning', 'heart', 'circle', 'spiral'];

const LIVE_INTERVAL = 0.08; // seconds between live accuracy samples while drawing
const HISTORY_SIZE = 6;

/**
 * Words for a finished attempt.
 * @param {{passed: boolean, accuracy: number, reason: string|null, recognizedAs: string|null}} r
 * @param {string} target rune the player is practising
 * @returns {{text: string, tone: 'great'|'good'|'ok'|'miss'}}
 */
export function describeAttempt(r, target) {
  const pct = Math.round(r.accuracy * 100);
  if (r.passed) {
    if (r.accuracy >= 0.93) return { text: `Tuyệt đối! ${pct}% — nét vẽ gần như hoàn hảo`, tone: 'great' };
    const need = masteryThreshold(target);
    if (r.accuracy >= need) return { text: `Rất tốt! ${pct}% — đạt chuẩn thành thạo`, tone: 'good' };
    return { text: `Đạt (${pct}%) — cần từ ${Math.round(need * 100)}% để tính vào thành thạo`, tone: 'ok' };
  }
  if (r.reason === 'too_short' || r.reason === 'no_input') {
    return { text: getMissHint('too_short') || 'Nét quá ngắn — kéo dài tay ra hơn', tone: 'miss' };
  }
  if (r.reason === 'confused' && r.recognizedAs && RUNES[r.recognizedAs]) {
    const other = RUNES[r.recognizedAs];
    return { text: `Nét của bạn giống ${other.name} (${other.symbol}) hơn — vẽ rõ hình ${RUNES[target].symbol} hơn`, tone: 'miss' };
  }
  const hint = getMissHint(r.reason, target, r.accuracy);
  return { text: `${hint || 'Chưa khớp — thử lại nhé'} (${pct}%)`, tone: 'miss' };
}

export class PracticeSession {
  /**
   * @param {Object} game the Game instance (uses gestureEngine, progress, audio, particles, inputHandler, player)
   */
  constructor(game) {
    this.game = game;
    this.target = PRACTICE_ORDER[0];
    this.active = false;
    /** Accuracy (0..1) of the stroke being drawn right now, or of the last finished stroke */
    this.liveAccuracy = 0;
    /** @type {{accuracy:number, passed:boolean, text:string, tone:string}|null} */
    this.lastResult = null;
    /** @type {Array<{accuracy:number, passed:boolean}>} newest last */
    this.history = [];
    this.showTemplate = true;
    this._age = 0;
    this._liveTimer = 0;
    this._lastLiveLen = -1;
  }

  /** Enter practice. Optionally jump straight to a rune. */
  start(rune) {
    this.active = true;
    if (rune && RUNES[rune]) this.target = rune;
    this._resetAttempt();
    this.history = [];
    this._notify();
  }

  stop() {
    this.active = false;
    this._resetAttempt();
  }

  /** @returns {boolean} whether the rune was changed */
  selectRune(rune) {
    if (!RUNES[rune] || rune === this.target) return false;
    this.target = rune;
    this._resetAttempt();
    this.history = [];
    this._notify();
    return true;
  }

  setShowTemplate(show) {
    this.showTemplate = !!show;
  }

  /** Tip text for the current rune */
  get tip() {
    return GESTURE_TIPS[this.target] || '';
  }

  /** Progress towards mastery of the current rune: { good, needed, mastered, best, attempts } */
  getMastery(rune = this.target) {
    const p = this.game.progress.getPractice(rune);
    return {
      good: Math.min(p.good, MASTERY_PASSES),
      needed: MASTERY_PASSES,
      threshold: masteryThreshold(rune),
      mastered: this.game.progress.isMastered(rune),
      best: p.best,
      attempts: p.attempts
    };
  }

  _resetAttempt() {
    this.liveAccuracy = 0;
    this.lastResult = null;
    this._liveTimer = 0;
    this._lastLiveLen = -1;
  }

  _notify() {
    const meta = this.game.uiManager && this.game.uiManager.meta;
    if (meta && typeof meta.refreshPractice === 'function') meta.refreshPractice();
  }

  /**
   * Per-frame: sample the accuracy of the stroke being drawn.
   * @param {number} dt
   */
  update(dt) {
    this._age += dt;
    const input = this.game.inputHandler;
    if (!input || !input.isDrawing) return;

    this._liveTimer -= dt;
    const pts = input.currentPoints;
    if (this._liveTimer > 0 || !pts || pts.length < 3 || pts.length === this._lastLiveLen) return;
    this._liveTimer = LIVE_INTERVAL;
    this._lastLiveLen = pts.length;

    const r = this.game.gestureEngine.scoreFor(pts, this.target);
    this.liveAccuracy = r.accuracy;
    this.lastResult = null; // a new stroke started: hide the previous verdict
    const meta = this.game.uiManager && this.game.uiManager.meta;
    if (meta && typeof meta.updatePracticeLive === 'function') meta.updatePracticeLive(this.liveAccuracy);
  }

  /**
   * The pen was lifted: score the finished stroke.
   * @param {Array<{x:number, y:number}>} rawStroke
   * @returns {Object|null} the attempt record
   */
  handleStroke(rawStroke) {
    if (!this.active || !rawStroke || rawStroke.length < 2) return null;

    const game = this.game;
    const r = game.gestureEngine.scoreFor(rawStroke, this.target);
    const verdict = describeAttempt(r, this.target);
    const rune = RUNES[this.target];

    this.liveAccuracy = r.accuracy;
    this.lastResult = { accuracy: r.accuracy, passed: r.passed, text: verdict.text, tone: verdict.tone };
    this.history.push({ accuracy: r.accuracy, passed: r.passed });
    if (this.history.length > HISTORY_SIZE) this.history.shift();

    const tooShort = r.reason === 'too_short' || r.reason === 'no_input';
    let becameMastered = false;
    if (!tooShort) {
      const rec = game.progress.recordPractice(this.target, r.accuracy, r.passed);
      becameMastered = rec.becameMastered;
      game.progress.save();
    }

    // Feedback: sound, Momo's wand, sparks, and (on a miss) the correct shape drawn over the stroke
    if (r.passed) {
      game.audioSystem.playSpell(this.target);
      if (game.hapticSystem) game.hapticSystem.cast();
      game.player.castSpell(this.target, null);
      game.particleSystem.emitHitBurst(game.player.x, game.player.y - 30, rune.color, 18);
      game.particleSystem.emitFloatingText(
        `${Math.round(r.accuracy * 100)}%`, game.player.x, game.player.y - 70, rune.color, 24
      );
    } else if (!tooShort) {
      game.audioSystem.playFizzle();
      if (game.inputHandler && typeof game.inputHandler.showGuide === 'function') {
        game.inputHandler.showGuide(this.target, rune.color, rawStroke);
      }
    }

    if (becameMastered) {
      game.particleSystem.emitFloatingText(
        `🎓 THÀNH THẠO ${rune.symbol}!`, game.width / 2, game.height * 0.3, '#fbbf24', 30
      );
      game.audioSystem.playWaveComplete();
      game.hapticSystem && game.hapticSystem.victory();
    }

    const earned = evaluateAchievements(game.progress);
    if (earned.length && typeof game._announceAchievements === 'function') game._announceAchievements(earned);

    this._notify();
    return this.lastResult;
  }

  /**
   * Where the template goes: the free area between the rune picker (top) and the info panel (bottom).
   * @returns {{cx: number, cy: number, size: number}}
   */
  getLayout() {
    const w = this.game.width;
    const h = this.game.height;
    const compact = h < 520 && w > h; // phone held sideways: the panel is slimmer
    const top = compact ? 96 : (w < 420 ? 150 : 112);
    const bottom = compact ? 100 : 170;
    const avail = Math.max(120, h - top - bottom);
    return {
      cx: w / 2,
      cy: top + avail / 2,
      size: Math.max(110, Math.min(300, avail * 0.92, w * 0.7))
    };
  }

  /**
   * Draw the faint template stroke the player is aiming for, with a dot showing the drawing direction.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (!this.active || !this.showTemplate) return;
    const template = getGuideStroke(this.target);
    if (template.length < 2) return;

    const { cx, cy, size } = this.getLayout();
    const color = RUNES[this.target].color;
    const pts = template.map(p => ({ x: cx + ((p.x - 50) / 100) * size, y: cy + ((p.y - 50) / 100) * size }));

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 3;
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([9, 9]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);

    // Start marker + travelling dot (direction)
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 7, 0, Math.PI * 2);
    ctx.fill();

    const dot = pointAlong(pts, (this._age * 0.5) % 1);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Point at fraction t (0..1) of a polyline's length */
function pointAlong(points, t) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  if (total === 0) return points[0];
  let target = t * total;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (target <= seg && seg > 0) {
      const k = target / seg;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * k,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * k
      };
    }
    target -= seg;
  }
  return points[points.length - 1];
}
