/**
 * @file InputHandler.js
 * @description Pointer event listener capturing stroke points, rendering neon glow trail,
 * emitting Magic Sparks along the drawn path, and dispatching recognition to GestureEngine upon release.
 * Built for rock-solid cross-platform mobile/touch support with Retina DPR precision and default gesture blocking.
 */

import { getGuideStroke } from '../GestureEngine.js';
import { GestureRecognition } from './GestureRecognition.js';
import { trailColors } from '../core/Cosmetics.js';

const DEFAULT_TRAIL_COLORS = { glow: '#a855f7', active: '#e879f9', mid: '#f472b6' };
const GUIDE_LIFE = 1.7; // seconds the "correct shape" overlay stays on screen after a missed stroke

/** Total travelled length of a polyline */
function strokeLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/** Ramer–Douglas–Peucker for ink only: <=0.75 logical pixels of deviation, exact endpoints/corners. */
function simplifyInk(points, tolerance = 0.75) {
  if (points.length <= 64) return points;
  const keep = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  keep[0] = keep[points.length - 1] = 1;
  while (stack.length) {
    const [start, end] = stack.pop();
    const a = points[start], b = points[end];
    const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
    let maxDistance = tolerance * tolerance, farthest = -1;
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2)) : 0;
      const distance = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
      if (distance > maxDistance) { maxDistance = distance; farthest = i; }
    }
    if (farthest >= 0) { keep[farthest] = 1; stack.push([start, farthest], [farthest, end]); }
  }
  return points.filter((_, i) => keep[i]);
}

export class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas 
   * @param {import('../GestureEngine.js').GestureEngine} gestureEngine 
   * @param {import('./ParticleSystem.js').ParticleSystem} particleSystem 
   * @param {Function} onGestureRecognized Callback when gesture is recognized
   * @param {import('./SoundSystem.js').SoundSystem} [soundSystem=null]
   * @param {Function} [getLogicalDimensions=null] Callback returning { width, height }
   * @param {Function} [onTap=null] Callback when a quick tap / click occurs without dragging
   */
  constructor(canvas, gestureEngine, particleSystem, onGestureRecognized, soundSystem = null, getLogicalDimensions = null, onTap = null) {
    this.canvas = canvas;
    this.engine = gestureEngine;
    this.particleSystem = particleSystem;
    this.onGestureRecognized = onGestureRecognized;
    this.soundSystem = soundSystem;
    this.getLogicalDimensions = getLogicalDimensions;
    this.onTap = onTap;

    this.currentPoints = [];
    this.lastPoint = null;
    this.activePointerId = null;
    this.isDrawing = false;
    this.isEnabled = false;
    this._cleanups = [];
    this._generation = 0;
    this.recognition = typeof Worker === 'function' ? new GestureRecognition(gestureEngine) : null;
    this.visualPoints = [];
    this.trailMode = 'full';
    this.reducedEffects = false;
    this._mapping = null; // cached client->logical mapping, valid for the duration of one stroke

    // Fading effect for completed strokes
    this.fadingStrokes = [];

    // Evaluated once: this used to be recomputed on every stroke draw (every frame, per stroke).
    this.strokeScale = (typeof window !== 'undefined' && (
      window.innerWidth <= 768 || ('ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    )) ? 1.25 : 1.0;

    // When false the neon trail is drawn with stacked translucent strokes instead of shadowBlur
    this.glow = true;
    // Equipped ink trail (cosmetic); null = the default purple
    this.trailStyle = null;

    // Optional hook so the settings screen can switch the touch buzz on pen-down off
    this.canVibrate = () => true;

    // "Correct shape" overlay shown after a missed stroke: { points, color, age, life }
    this.guide = null;

    // Only the arena owns touch gestures; menus keep native scrolling and zoom.
    if (canvas.style) { canvas.style.touchAction = 'none'; canvas.style.overscrollBehavior = 'none'; }
    this._bindEvents();
    this._preventMobileGestures();
  }

  /**
   * Toggle shadow-based neon glow on the drawing trail (driven by QualityManager)
   * @param {boolean} enabled
   */
  setGlow(enabled) {
    this.glow = !!enabled;
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) this.cancelStroke();
  }

  /** Discard an interrupted stroke without casting, including any held pointer capture. */
  cancelStroke() {
    this._generation++;
    const id = this.activePointerId;
    this.activePointerId = null;
    this.isDrawing = false;
    this._mapping = null;
    this.currentPoints = [];
    this.visualPoints = [];
    this.lastPoint = null;
    try {
      if (id != null && this.canvas.hasPointerCapture?.(id)) this.canvas.releasePointerCapture(id);
    } catch (e) { /* Pointer may already have been released by the browser. */ }
    this.soundSystem?.stopDraw?.();
  }

  /**
   * Calculate precise canvas coordinate taking into account devicePixelRatio,
   * CSS letterboxing, responsive scaling, and iframe environments.
   * @param {PointerEvent|MouseEvent|TouchEvent} e 
   * @returns {{x: number, y: number, timestamp: number}}
   */
  _getCanvasPoint(e) {
    // During a stroke the mapping is cached (set on pointerdown): the canvas is fixed full-screen, and
    // calling getBoundingClientRect() on every pointermove (60-120 Hz on phones) forces a layout read each time.
    const m = this._mapping || this._computeMapping();
    return {
      x: (e.clientX - m.left) * m.scaleX,
      y: (e.clientY - m.top) * m.scaleY,
      timestamp: Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now()
    };
  }

  /**
   * Client-space -> logical-space mapping for the canvas (see _getCanvasPoint)
   * @returns {{left: number, top: number, scaleX: number, scaleY: number}}
   */
  _computeMapping() {
    const rect = this.canvas.getBoundingClientRect();
    let logicalW = rect.width || window.innerWidth;
    let logicalH = rect.height || window.innerHeight;

    if (this.getLogicalDimensions) {
      const dims = this.getLogicalDimensions();
      if (dims && dims.width && dims.height) {
        logicalW = dims.width;
        logicalH = dims.height;
      }
    }

    return {
      left: rect.left,
      top: rect.top,
      scaleX: rect.width > 0 ? logicalW / rect.width : 1,
      scaleY: rect.height > 0 ? logicalH / rect.height : 1
    };
  }

  /**
   * Block default touch gestures (pull-to-refresh, swipe-nav, pinch zoom) on mobile browsers
   */
  _preventMobileGestures() {
    const preventDefaultTouch = (e) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    // Modern browsers arbitrate scrolling from touch-action before dispatch. Avoid redundant
    // scroll-blocking touch listeners: they delay input delivery on the compositor path.
    if (typeof window === 'undefined' || !window.PointerEvent) {
      for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
        this._listen(this.canvas, type, preventDefaultTouch, { passive: false });
      }
    }

    // Block long-press context menu on canvas
    this._listen(this.canvas, 'contextmenu', (e) => e.preventDefault());

    // Block iOS Safari page zoom gestures
    this._listen(this.canvas, 'gesturestart', preventDefaultTouch, { passive: false });
    this._listen(this.canvas, 'gesturechange', preventDefaultTouch, { passive: false });
    this._listen(this.canvas, 'gestureend', preventDefaultTouch, { passive: false });
  }

  _listen(target, type, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    this._cleanups.push(() => target.removeEventListener?.(type, handler, options));
  }

  setTrailOptions(mode = 'full', reduced = false) {
    this.trailMode = ['full', 'simple', 'minimal'].includes(mode) ? mode : 'full';
    this.reducedEffects = !!reduced;
    if (reduced || mode === 'minimal') this.fadingStrokes = [];
  }

  /** Never smooth, interpolate or decimate recognition input. Reject pathological long input instead. */
  _appendPoint(e) {
    const pt = this._getCanvasPoint(e);
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
    const last = this.currentPoints[this.currentPoints.length - 1];
    if (last && pt.timestamp < last.timestamp) return;
    if (last && pt.x === last.x && pt.y === last.y && pt.timestamp === last.timestamp) return;
    if (this.currentPoints.length <= (this.engine?.maxInputPoints ?? 8192)) this.currentPoints.push(pt);
    this.lastPoint = pt;
    // Spatial visual sampling bounds rendering cost without cutting corners by sample index.
    const visualLast = this.visualPoints[this.visualPoints.length - 1];
    if (!visualLast || Math.hypot(pt.x - visualLast.x, pt.y - visualLast.y) >= 1.5) this.visualPoints.push(pt);
    if (this.visualPoints.length > 2048) this.visualPoints = this.visualPoints.filter((_, i) => i % 2 === 0);
  }

  _collectSamples(e) {
    let samples = [];
    try { samples = e.getCoalescedEvents?.() || []; } catch { /* unsupported context */ }
    for (const sample of samples) this._appendPoint(sample);
    this._appendPoint(e); // deduplicates the final coalesced sample when it equals the event
  }

  _bindEvents() {
    const cancel = () => this.cancelStroke();
    if (typeof window !== 'undefined') {
      this._listen(window, 'blur', cancel);
      this._listen(window, 'pagehide', cancel);
      this._listen(window, 'resize', cancel);
      this._listen(window, 'orientationchange', cancel);
      this._listen(window, 'scroll', cancel, true);
      this._listen(window.visualViewport, 'resize', cancel);
      this._listen(window.visualViewport, 'scroll', cancel);
      // Release outside the canvas also works if pointer capture is unavailable.
      this._listen(window, 'pointermove', e => {
        if (e.target !== this.canvas && !this.canvas.hasPointerCapture?.(e.pointerId)) this._moveStroke(e);
      });
      this._listen(window, 'pointerup', e => this._finishStroke(e));
      this._listen(window, 'pointercancel', e => {
        if (e.pointerId === this.activePointerId) cancel();
      });
    }
    if (typeof document !== 'undefined') this._listen(document, 'visibilitychange', () => {
      if (document.hidden) cancel();
    });
    this._listen(this.canvas, 'pointerdown', (e) => {
      if (!this.isEnabled || this.isDrawing || e.isPrimary === false || (e.button !== undefined && e.button !== 0)) return;
      // First primary contact owns the entire stroke. Other fingers/palms never join or cast.
      if (e.cancelable) e.preventDefault();
      this.activePointerId = e.pointerId;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        // Fallback for browsers without pointer capture
      }
      this.isDrawing = true;
      this._mapping = this._computeMapping();
      const pt = this._getCanvasPoint(e);
      this.currentPoints = [pt];
      this.lastPoint = pt;
      this.visualPoints = [pt];

      if (this.soundSystem && typeof this.soundSystem.soundDraw === 'function') {
        this.soundSystem.soundDraw(120);
      }

      // Initial spark burst on pen down
      if (this.particleSystem && !this.reducedEffects && this.trailMode === 'full') {
        this.particleSystem.emitMagicSparks(pt.x, pt.y, 5, '#f472b6');
      }

      // Subtle mobile touch haptic on wand ignition
      if (typeof navigator !== 'undefined' && navigator.vibrate && this.canVibrate()) {
        try { navigator.vibrate(6); } catch (err) {}
      }
    });

    this._moveStroke = (e) => {
      if (!this.isEnabled || !this.isDrawing || e.pointerId !== this.activePointerId) return;
      if (e.cancelable) e.preventDefault();
      const previous = this.lastPoint;
      this._collectSamples(e);
      const pt = this.lastPoint;
      if (!pt) return;

      if (this.soundSystem && typeof this.soundSystem.feedDrawCoord === 'function') {
        this.soundSystem.feedDrawCoord(pt.x, pt.y);
      }

      // Emit continuous Magic Sparks along the drawn path with interpolation
      if (this.particleSystem && previous && !this.reducedEffects && this.trailMode === 'full') {
        const dx = pt.x - previous.x;
        const dy = pt.y - previous.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 6) {
          const steps = Math.max(1, Math.min(6, Math.floor(dist / 12)));
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const interpX = previous.x + dx * t;
            const interpY = previous.y + dy * t;
            this.particleSystem.emitMagicSparks(interpX, interpY, 1, null, dx * 0.4, dy * 0.4);
          }
        }
      }

      this.lastPoint = pt;
    };
    this._listen(this.canvas, 'pointermove', this._moveStroke);

    const handlePointerUp = (e) => {
      if (!this.isEnabled || !this.isDrawing || e.pointerId !== this.activePointerId) return;
      this.isDrawing = false;
      this.activePointerId = null;
      if (e.type !== 'pointercancel' && e.type !== 'lostpointercapture') this._collectSamples(e);
      this._mapping = null;

      try {
        if (e.pointerId !== undefined && this.canvas.hasPointerCapture && this.canvas.hasPointerCapture(e.pointerId)) {
          this.canvas.releasePointerCapture(e.pointerId);
        }
      } catch (err) {}

      if (this.soundSystem && typeof this.soundSystem.stopDraw === 'function') {
        this.soundSystem.stopDraw();
      }

      if (e.type === 'pointercancel' || e.type === 'lostpointercapture') {
        this.cancelStroke();
        return;
      }
      const rawStroke = [...this.currentPoints];
      this.lastStroke = rawStroke;

      // Final magic sparkles burst on pen release
      if (this.lastPoint && this.particleSystem && !this.reducedEffects && this.trailMode === 'full') {
        this.particleSystem.emitMagicSparks(this.lastPoint.x, this.lastPoint.y, 4, '#c084fc');
      }
      this.lastPoint = null;

      // Check for tap / click: a stroke that barely travelled. Judged by the distance actually drawn,
      // NOT by how far the end is from the start: a closed shape (heart, circle) ends where it began,
      // and used to be swallowed as a "tap on Momo" whenever it was drawn around the cat.
      const isTap = rawStroke.length >= 1 && (
        strokeLength(rawStroke) < 25
      );

      if (isTap && typeof this.onTap === 'function') {
        const handled = this.onTap(rawStroke[0]);
        if (handled) {
          this.currentPoints = [];
          this.visualPoints = [];
          return;
        }
      }

      // Store in fading strokes for smooth visual exit
      if (rawStroke.length > 1 && !this.reducedEffects && this.trailMode !== 'minimal') {
        this.fadingStrokes.push({
          points: [...this.visualPoints, rawStroke[rawStroke.length - 1]],
          alpha: 1.0
        });
      }

      // Clear active stroke points
      this.currentPoints = [];
      this.visualPoints = [];

      // Recognize gesture via GestureEngine
      if (rawStroke.length >= 2 && this.engine) {
        const generation = this._generation;
        const deliver = result => {
          if (result && this.isEnabled && generation === this._generation) this.onGestureRecognized?.(result, rawStroke);
        };
        if (this.recognition) this.recognition.recognize(rawStroke).then(deliver);
        else deliver(this.engine.recognize(rawStroke));
      }
    };

    this._finishStroke = handlePointerUp;
    this._listen(this.canvas, 'pointerup', handlePointerUp);
    this._listen(this.canvas, 'pointercancel', handlePointerUp);
    this._listen(this.canvas, 'lostpointercapture', handlePointerUp);
  }

  /**
   * Update fading stroke animations with deltaTime
   * @param {number} dt 
   */
  update(dt) {
    for (let i = this.fadingStrokes.length - 1; i >= 0; i--) {
      const stroke = this.fadingStrokes[i];
      stroke.alpha -= dt * 4.2;
      if (stroke.alpha <= 0) {
        this.fadingStrokes.splice(i, 1);
      }
    }

    if (this.guide) {
      this.guide.age += dt;
      if (this.guide.age >= this.guide.life) this.guide = null;
    }
  }

  /**
   * Show the shape the player was (probably) aiming for, dashed and fading, sized and centred on the
   * stroke they just drew, with a dot that travels along it to show the drawing direction.
   * @param {string} gesture Rune/gesture id (see getGuideStroke)
   * @param {string} color CSS colour for the overlay
   * @param {Array<{x: number, y: number}>} stroke The stroke that missed
   */
  showGuide(gesture, color, stroke) {
    const template = getGuideStroke(gesture);
    if (template.length < 2 || !stroke || stroke.length < 2) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < stroke.length; i++) {
      const p = stroke[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const dims = this.getLogicalDimensions ? this.getLogicalDimensions() : null;
    const screenW = dims && dims.width ? dims.width : 800;
    const screenH = dims && dims.height ? dims.height : 600;

    const size = Math.max(130, Math.min(260, Math.max(maxX - minX, maxY - minY), Math.min(screenW, screenH) * 0.6));
    const half = size / 2;
    const cx = Math.max(half + 10, Math.min(screenW - half - 10, (minX + maxX) / 2));
    const cy = Math.max(half + 10, Math.min(screenH - half - 10, (minY + maxY) / 2));

    this.guide = {
      points: template.map(p => ({ x: cx + ((p.x - 50) / 100) * size, y: cy + ((p.y - 50) / 100) * size })),
      color: color || '#fbbf24',
      age: 0,
      life: GUIDE_LIFE
    };
  }

  /** Optional replay of the last captured stroke, using the existing guide renderer. */
  replayLastStroke(color = '#ffffff') {
    if (!this.lastStroke || this.lastStroke.length < 2) return false;
    this.guide = { points: this.lastStroke, color, age: 0, life: GUIDE_LIFE, replay: true };
    return true;
  }

  /** Remove any visible guide overlay (e.g. when the state changes) */
  clearGuide() {
    this.guide = null;
  }

  /** Point at fraction t (0..1) of the polyline's total length */
  _pointAlong(points, t) {
    const total = strokeLength(points);
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

  _drawGuide(ctx) {
    const g = this.guide;
    if (!g) return;

    // Quick fade-in, hold, then fade-out over the last 40% of its life
    const t = g.age / g.life;
    const alpha = Math.min(1, t * 8) * (t > 0.6 ? Math.max(0, (1 - t) / 0.4) : 1);
    if (alpha <= 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 3.5 * this.strokeScale;
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([10, 9]);

    ctx.beginPath();
    ctx.moveTo(g.points[0].x, g.points[0].y);
    const progress = this.reducedEffects ? 1 : Math.min(1, g.age / (g.life * 0.7));
    const count = g.replay ? Math.max(1, Math.ceil(progress * g.points.length)) : g.points.length;
    for (let i = 1; i < count; i++) {
      ctx.lineTo(g.points[i].x, g.points[i].y);
    }
    ctx.stroke();
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);

    // Start marker
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.arc(g.points[0].x, g.points[0].y, 6 * this.strokeScale, 0, Math.PI * 2);
    ctx.fill();

    // Travelling dot: shows the direction to draw
    const dot = this.reducedEffects ? g.points[0] : this._pointAlong(g.points, (g.age * 0.9) % 1);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 5 * this.strokeScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Render active drawing trail with dual-layer neon glow effect
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    // 0. "Correct shape" overlay after a miss
    this._drawGuide(ctx);

    // Equipped ink colour (the rainbow trail asks for new colours every frame)
    const colors = this._trailColors();

    // 1. Render fading strokes
    for (let i = 0; i < this.fadingStrokes.length; i++) {
      const stroke = this.fadingStrokes[i];
      this._drawStrokeLine(ctx, stroke.points, colors.glow, stroke.alpha * 0.75, colors.mid);
    }

    // 2. Render current active stroke with vibrant neon glow
    if (this.currentPoints.length > 0) {
      const points = this.lastPoint ? [...this.visualPoints, this.lastPoint] : this.visualPoints;
      this._drawStrokeLine(ctx, points, colors.active, 1.0, colors.mid);
    }
  }

  /**
   * Choose the ink colour of the neon trail (a cosmetic, see core/Cosmetics.js).
   * @param {Object|null} trail a TRAILS entry, or null for the default purple
   */
  setTrailStyle(trail) {
    this.trailStyle = trail || null;
  }

  _trailColors() {
    const t = this.trailStyle;
    if (!t) return DEFAULT_TRAIL_COLORS;
    if (t.rainbow) {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() / 1000 : 0;
      return trailColors(t, now);
    }
    return t.colors || DEFAULT_TRAIL_COLORS;
  }

  /**
   * Draw stroke with smooth quadratic curve interpolation, multi-layered neon glow, and solid white core
   */
  _drawStrokeLine(ctx, points, glowColor, alpha, midColor = '#f472b6') {
    if (!points.length) return;
    points = simplifyInk(points);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const strokeScale = this.strokeScale;

    // Spatially sampled visual points are independent from the raw recognition stroke.
    const n = points.length;
    const stride = 1;
    const lastIdx = n - 1;

    // Helper to trace smoothed path with quadratic mid-points
    const traceSmoothPath = () => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      if (n <= 2) {
        ctx.lineTo(points[n - 1].x + (points[0].x === points[n - 1].x ? 0.01 : 0), points[n - 1].y);
        return;
      }
      for (let i = stride; i < lastIdx; i += stride) {
        const cur = points[i];
        const next = points[Math.min(i + stride, lastIdx)];
        const xc = (cur.x + next.x) / 2;
        const yc = (cur.y + next.y) / 2;
        const prev = points[i - stride];
        const ax = cur.x - prev.x, ay = cur.y - prev.y;
        const bx = next.x - cur.x, by = next.y - cur.y;
        const cosine = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);
        // Keep intentional corners (V, caret, bolt); smooth only gentle direction changes.
        if (cosine < 0.6) ctx.lineTo(cur.x, cur.y);
        else ctx.quadraticCurveTo(cur.x, cur.y, xc, yc);
      }
      ctx.lineTo(points[lastIdx].x, points[lastIdx].y);
    };

    traceSmoothPath();
    if (this.reducedEffects || this.trailMode === 'minimal') {
      ctx.lineWidth = 4.8 * strokeScale;
      ctx.strokeStyle = midColor;
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (this.glow && !this.reducedEffects && this.trailMode === 'full') {
      // Layer 1: Wide Ambient Glow
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 22 * strokeScale;
      ctx.lineWidth = 8.5 * strokeScale;
      ctx.strokeStyle = glowColor;
      ctx.stroke();

      // Layer 2: Medium Radiant Glow
      ctx.shadowBlur = 10 * strokeScale;
      ctx.lineWidth = 4.8 * strokeScale;
      ctx.strokeStyle = midColor;
      ctx.stroke();

      // Layer 3: Inner bright white hot core
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.4 * strokeScale;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    } else {
      // Shadow-free neon: stacked translucent strokes fake the glow at a fraction of the cost.
      // The path is traced once and stroked repeatedly.
      ctx.globalAlpha = alpha * 0.22;
      ctx.lineWidth = 17 * strokeScale;
      ctx.strokeStyle = glowColor;
      ctx.stroke();

      ctx.globalAlpha = alpha * 0.5;
      ctx.lineWidth = 9 * strokeScale;
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.lineWidth = 4.8 * strokeScale;
      ctx.strokeStyle = midColor;
      ctx.stroke();

      ctx.lineWidth = 2.4 * strokeScale;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ctx.restore();
  }

  destroy() {
    this.setEnabled(false);
    for (const cleanup of this._cleanups.splice(0)) cleanup();
    this.recognition?.destroy();
    this.clear();
  }

  clear() {
    this.cancelStroke();
    this.lastStroke = null;
    this.activePointerId = null;
    this.lastPoint = null;
    this.fadingStrokes = [];
    this.guide = null;
    this.isDrawing = false;
    this._mapping = null;
  }
}
