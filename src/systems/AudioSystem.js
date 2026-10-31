/**
 * @file AudioSystem.js
 * @description Procedural Web Audio API sound synthesizer for arcade spells, hits, and feedback.
 * Completely zero-dependency with no external audio files required.
 */

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
  }

  /**
   * Lazily initialize or resume AudioContext upon first user interaction
   */
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Play spell sound corresponding to gesture
   * @param {string} gesture 
   */
  playSpell(gesture) {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    switch (gesture) {
      case 'horizontal': {
        // Whoosh / Slash
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }

      case 'vertical': {
        // Piercing laser bolt
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.22);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      }

      case 'caret': {
        // High crystal chime
        this._playTone(523.25, 0.25, 'sine', 0.2); // C5
        setTimeout(() => this._playTone(659.25, 0.25, 'sine', 0.2), 40); // E5
        break;
      }

      case 'v_shape': {
        // Deep arcane resonant boom
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
        break;
      }

      case 'lightning': {
        // Thunder crackle (sawtooth + noise frequency modulation)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.linearRampToValueAtTime(90, now + 0.08);
        osc.frequency.linearRampToValueAtTime(180, now + 0.16);
        osc.frequency.linearRampToValueAtTime(40, now + 0.35);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
        break;
      }

      case 'heart': {
        // Fairy healing chord (C-E-G-C major arpeggio)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          setTimeout(() => {
            this._playTone(freq, 0.3, 'sine', 0.18);
          }, idx * 60);
        });
        break;
      }

      default:
        this._playTone(440, 0.15, 'sine', 0.15);
    }
  }

  /**
   * Sound when projectile impacts an enemy
   */
  playHit() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Sound when an enemy is completely eliminated
   */
  playEnemyDeath() {
    if (this.isMuted || !this.ctx) return;
    this._playTone(600, 0.12, 'triangle', 0.2);
    setTimeout(() => {
      this._playTone(850, 0.18, 'sine', 0.22);
    }, 50);
  }

  /**
   * Dynamic ascending combo chime
   * @param {number} comboCount 
   */
  playCombo(comboCount) {
    if (this.isMuted || !this.ctx) return;
    const baseFreq = 440;
    const semitones = Math.min(18, comboCount);
    const freq = baseFreq * Math.pow(2, semitones / 12);
    this._playTone(freq, 0.18, 'sine', 0.16);
  }

  /**
   * Player takes damage
   */
  playHurt() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Game Over melancholic chime
   */
  playGameOver() {
    if (this.isMuted || !this.ctx) return;
    const sequence = [440, 392, 349.23, 293.66];
    sequence.forEach((freq, idx) => {
      setTimeout(() => {
        this._playTone(freq, 0.45, 'sine', 0.25);
      }, idx * 180);
    });
  }

  /**
   * Game Start fanfare
   */
  playStart() {
    if (this.isMuted || !this.ctx) return;
    const sequence = [392, 523.25, 659.25, 783.99];
    sequence.forEach((freq, idx) => {
      setTimeout(() => {
        this._playTone(freq, 0.25, 'triangle', 0.2);
      }, idx * 90);
    });
  }

  /**
   * Fizzle sound when gesture didn't match any enemy
   */
  playFizzle() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  _playTone(freq, duration, type = 'sine', volume = 0.2) {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
}
