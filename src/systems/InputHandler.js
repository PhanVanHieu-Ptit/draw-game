/**
 * @file InputHandler.js
 * @description Pointer event listener capturing stroke points, rendering neon glow trail,
 * emitting Magic Sparks along the drawn path, and dispatching recognition to GestureEngine upon release.
 */

export class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas 
   * @param {import('../GestureEngine.js').GestureEngine} gestureEngine 
   * @param {import('./ParticleSystem.js').ParticleSystem} particleSystem 
   * @param {Function} onGestureRecognized Callback when gesture is recognized
   * @param {import('./SoundSystem.js').SoundSystem} [soundSystem=null]
   */
  constructor(canvas, gestureEngine, particleSystem, onGestureRecognized, soundSystem = null) {
    this.canvas = canvas;
    this.engine = gestureEngine;
    this.particleSystem = particleSystem;
    this.onGestureRecognized = onGestureRecognized;
    this.soundSystem = soundSystem;

    this.currentPoints = [];
    this.lastPoint = null;
    this.isDrawing = false;
    this.isEnabled = false;

    // Fading effect for completed strokes
    this.fadingStrokes = [];

    this._bindEvents();
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

  _getCanvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      timestamp: performance.now()
    };
  }

  _bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.isEnabled) return;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        // Fallback if not supported
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
            // Emit sparkling fairy dust particles along line
            this.particleSystem.emitMagicSparks(interpX, interpY, 1, null, dx * 0.4, dy * 0.4);
          }
        }
      }

      this.lastPoint = pt;
    });

    const handlePointerUp = (e) => {
      if (!this.isEnabled || !this.isDrawing) return;
      this.isDrawing = false;

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
   * Update fading stroke animations
   * @param {number} dt 
   */
  update(dt) {
    for (let i = this.fadingStrokes.length - 1; i >= 0; i--) {
      const stroke = this.fadingStrokes[i];
      stroke.alpha -= dt * 4.2; // Quick, smooth fadeout
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
