/**
 * @file InputHandler.js
 * @description Pointer event listener capturing stroke points, rendering neon glow trail,
 * and dispatching recognition to GestureEngine upon stroke release.
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

      if (this.soundSystem && typeof this.soundSystem.soundDraw === 'function') {
        this.soundSystem.soundDraw(120);
      }

      if (this.particleSystem) {
        this.particleSystem.emitSparkle(pt.x, pt.y, '#f472b6', 3);
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isEnabled || !this.isDrawing) return;
      const pt = this._getCanvasPoint(e);
      this.currentPoints.push(pt);

      if (this.soundSystem && typeof this.soundSystem.feedDrawCoord === 'function') {
        this.soundSystem.feedDrawCoord(pt.x, pt.y);
      }

      if (this.particleSystem && Math.random() < 0.75) {
        this.particleSystem.emitSparkle(pt.x, pt.y, '#e879f9', 2);
      }
    });

    const handlePointerUp = (e) => {
      if (!this.isEnabled || !this.isDrawing) return;
      this.isDrawing = false;

      if (this.soundSystem && typeof this.soundSystem.stopDraw === 'function') {
        this.soundSystem.stopDraw();
      }

      const rawStroke = [...this.currentPoints];

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
      stroke.alpha -= dt * 4.5; // Quick fadeout
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
      this._drawStrokeLine(ctx, stroke.points, '#a855f7', stroke.alpha * 0.7);
    }

    // 2. Render current active stroke
    if (this.currentPoints.length > 1) {
      this._drawStrokeLine(ctx, this.currentPoints, '#e879f9', 1.0);
    }
  }

  /**
   * Draw stroke with neon glow and core
   */
  _drawStrokeLine(ctx, points, glowColor, alpha) {
    if (points.length < 2) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer glow pass
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 6;
    ctx.strokeStyle = glowColor;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Inner bright white core pass
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
  }

  clear() {
    this.currentPoints = [];
    this.fadingStrokes = [];
    this.isDrawing = false;
  }
}
