/**
 * @file InputHandler.js
 * @description Pointer event listener capturing stroke points, rendering neon glow trail,
 * emitting Magic Sparks along the drawn path, and dispatching recognition to GestureEngine upon release.
 * Built for rock-solid cross-platform mobile/touch support with Retina DPR precision and default gesture blocking.
 */

export class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas 
   * @param {import('../GestureEngine.js').GestureEngine} gestureEngine 
   * @param {import('./ParticleSystem.js').ParticleSystem} particleSystem 
   * @param {Function} onGestureRecognized Callback when gesture is recognized
   * @param {import('./SoundSystem.js').SoundSystem} [soundSystem=null]
   * @param {Function} [getLogicalDimensions=null] Callback returning { width, height }
   */
  constructor(canvas, gestureEngine, particleSystem, onGestureRecognized, soundSystem = null, getLogicalDimensions = null) {
    this.canvas = canvas;
    this.engine = gestureEngine;
    this.particleSystem = particleSystem;
    this.onGestureRecognized = onGestureRecognized;
    this.soundSystem = soundSystem;
    this.getLogicalDimensions = getLogicalDimensions;

    this.currentPoints = [];
    this.lastPoint = null;
    this.isDrawing = false;
    this.isEnabled = false;

    // Fading effect for completed strokes
    this.fadingStrokes = [];

    this._bindEvents();
    this._preventMobileGestures();
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.isDrawing = false;
      this.currentPoints = [];
      this.lastPoint = null;
      if (this.soundSystem && typeof this.soundSystem.stopDraw === 'function') {
        this.soundSystem.stopDraw();
      }
    }
  }

  /**
   * Calculate precise canvas coordinate taking into account devicePixelRatio,
   * CSS letterboxing, responsive scaling, and iframe environments.
   * @param {PointerEvent|MouseEvent|TouchEvent} e 
   * @returns {{x: number, y: number, timestamp: number}}
   */
  _getCanvasPoint(e) {
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

    const scaleX = rect.width > 0 ? logicalW / rect.width : 1;
    const scaleY = rect.height > 0 ? logicalH / rect.height : 1;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      timestamp: performance.now()
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

    // Non-passive touch listeners to guarantee preventDefault succeeds
    this.canvas.addEventListener('touchstart', preventDefaultTouch, { passive: false });
    this.canvas.addEventListener('touchmove', preventDefaultTouch, { passive: false });
    this.canvas.addEventListener('touchend', preventDefaultTouch, { passive: false });
    this.canvas.addEventListener('touchcancel', preventDefaultTouch, { passive: false });

    // Block long-press context menu on canvas
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Block iOS Safari page zoom gestures
    if (typeof document !== 'undefined') {
      document.addEventListener('gesturestart', preventDefaultTouch, { passive: false });
      document.addEventListener('gesturechange', preventDefaultTouch, { passive: false });
      document.addEventListener('gestureend', preventDefaultTouch, { passive: false });
    }
  }

  _bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.isEnabled) return;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        // Fallback for browsers without pointer capture
      }
      this.isDrawing = true;
      const pt = this._getCanvasPoint(e);
      this.currentPoints = [pt];
      this.lastPoint = pt;

      if (this.soundSystem && typeof this.soundSystem.soundDraw === 'function') {
        this.soundSystem.soundDraw(120);
      }

      // Initial spark burst on pen down
      if (this.particleSystem) {
        this.particleSystem.emitMagicSparks(pt.x, pt.y, 5, '#f472b6');
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isEnabled || !this.isDrawing) return;
      const pt = this._getCanvasPoint(e);
      this.currentPoints.push(pt);

      if (this.soundSystem && typeof this.soundSystem.feedDrawCoord === 'function') {
        this.soundSystem.feedDrawCoord(pt.x, pt.y);
      }

      // Emit continuous Magic Sparks along the drawn path with interpolation
      if (this.particleSystem && this.lastPoint) {
        const dx = pt.x - this.lastPoint.x;
        const dy = pt.y - this.lastPoint.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 6) {
          const steps = Math.max(1, Math.min(6, Math.floor(dist / 12)));
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const interpX = this.lastPoint.x + dx * t;
            const interpY = this.lastPoint.y + dy * t;
            this.particleSystem.emitMagicSparks(interpX, interpY, 1, null, dx * 0.4, dy * 0.4);
          }
        }
      }

      this.lastPoint = pt;
    });

    const handlePointerUp = (e) => {
      if (!this.isEnabled || !this.isDrawing) return;
      this.isDrawing = false;

      try {
        if (e.pointerId !== undefined && this.canvas.hasPointerCapture && this.canvas.hasPointerCapture(e.pointerId)) {
          this.canvas.releasePointerCapture(e.pointerId);
        }
      } catch (err) {}

      if (this.soundSystem && typeof this.soundSystem.stopDraw === 'function') {
        this.soundSystem.stopDraw();
      }

      const rawStroke = [...this.currentPoints];

      // Final magic sparkles burst on pen release
      if (this.lastPoint && this.particleSystem) {
        this.particleSystem.emitMagicSparks(this.lastPoint.x, this.lastPoint.y, 4, '#c084fc');
      }
      this.lastPoint = null;

      // Store in fading strokes for smooth visual exit
      if (rawStroke.length > 1) {
        this.fadingStrokes.push({
          points: rawStroke,
          alpha: 1.0
        });
      }

      // Clear active stroke points
      this.currentPoints = [];

      // Recognize gesture via GestureEngine
      if (rawStroke.length >= 2 && this.engine) {
        const result = this.engine.recognize(rawStroke);
        if (this.onGestureRecognized) {
          this.onGestureRecognized(result, rawStroke);
        }
      }
    };

    this.canvas.addEventListener('pointerup', handlePointerUp);
    this.canvas.addEventListener('pointercancel', handlePointerUp);
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
  }

  /**
   * Render active drawing trail with dual-layer neon glow effect
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    // 1. Render fading strokes
    for (let i = 0; i < this.fadingStrokes.length; i++) {
      const stroke = this.fadingStrokes[i];
      this._drawStrokeLine(ctx, stroke.points, '#a855f7', stroke.alpha * 0.75);
    }

    // 2. Render current active stroke with vibrant neon glow
    if (this.currentPoints.length > 1) {
      this._drawStrokeLine(ctx, this.currentPoints, '#e879f9', 1.0);
    }
  }

  /**
   * Draw stroke with multi-layered neon glow and solid white core
   */
  _drawStrokeLine(ctx, points, glowColor, alpha) {
    if (points.length < 2) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Layer 1: Wide Ambient Glow
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 22;
    ctx.lineWidth = 8;
    ctx.strokeStyle = glowColor;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Layer 2: Medium Radiant Glow
    ctx.shadowBlur = 10;
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#f472b6';
    ctx.stroke();

    // Layer 3: Inner bright white hot core
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
  }

  clear() {
    this.currentPoints = [];
    this.lastPoint = null;
    this.fadingStrokes = [];
    this.isDrawing = false;
  }
}
