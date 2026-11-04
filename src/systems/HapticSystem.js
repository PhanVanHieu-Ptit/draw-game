/**
 * @file HapticSystem.js
 * @description Tactile mobile feedback system utilizing the Web Vibration API (navigator.vibrate).
 * Provides distinct haptic signatures for gesture casting, combo milestones, damage concussions,
 * healing heart pulses, elemental magic, and boss encounters.
 */

export class HapticSystem {
  /**
   * @param {Object} [options={}]
   * @param {boolean} [options.enabled=true]
   */
  constructor(options = {}) {
    this.enabled = options.enabled !== undefined ? options.enabled : true;

    // Load persisted user preference if available
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('arcane_paws_haptic');
        if (saved !== null) {
          this.enabled = saved === 'true';
        }
      }
    } catch (e) {
      // localStorage may be restricted in sandboxed iframes
    }
  }

  /**
   * Check if Web Vibration API is supported in current environment
   * @returns {boolean}
   */
  isSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  /**
   * Toggle haptic vibration on/off
   * @returns {boolean} New state
   */
  toggle() {
    this.enabled = !this.enabled;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('arcane_paws_haptic', String(this.enabled));
      }
    } catch (e) {}

    if (this.enabled) {
      this.pulse(15);
    }
    return this.enabled;
  }

  /**
   * Set explicit enabled state
   * @param {boolean} state 
   */
  setEnabled(state) {
    this.enabled = !!state;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('arcane_paws_haptic', String(this.enabled));
      }
    } catch (e) {}
  }

  /**
   * Safely invoke vibration pattern
   * @param {number|number[]} pattern Duration in ms or [vibrate, pause, vibrate...]
   * @returns {boolean} Whether vibration call succeeded
   */
  pulse(pattern) {
    if (!this.enabled || !this.isSupported()) return false;
    try {
      return navigator.vibrate(pattern);
    } catch (e) {
      return false;
    }
  }

  /**
   * Crisp tactile tick on successful rune gesture recognition
   */
  cast() {
    return this.pulse(14);
  }

  /**
   * Ascending tactile burst for combo momentum
   * @param {number} count Current combo count
   */
  combo(count = 1) {
    if (count >= 15) {
      return this.pulse([15, 25, 20, 25, 30]);
    } else if (count >= 10) {
      return this.pulse([15, 20, 20]);
    } else if (count >= 5) {
      return this.pulse(18);
    }
    return this.pulse(12);
  }

  /**
   * Warm double-heartbeat tactile pulse for Heart ❤️ healing
   */
  heal() {
    return this.pulse([35, 55, 45]);
  }

  /**
   * Crystalline stutter pulse for Frost Nova ❄️
   */
  freeze() {
    return this.pulse([16, 25, 16, 25, 20]);
  }

  /**
   * Propulsive shockwave pulse for Gale Shockwave 🌀
   */
  blast() {
    return this.pulse([40, 20, 55]);
  }

  /**
   * Sharp lightning sizzle pulse for Overload Chain ⚡
   */
  lightning() {
    return this.pulse([25, 15, 35]);
  }

  /**
   * Heavy concussive alert buzz when player takes damage
   */
  damage() {
    return this.pulse([65, 35, 80]);
  }

  /**
   * Recoil shudder when hitting/breaking a multi-phase Boss shield
   */
  bossHit() {
    return this.pulse([45, 30, 45]);
  }

  /**
   * Massive shudder upon defeating a Boss
   */
  bossDefeat() {
    return this.pulse([60, 40, 60, 40, 110]);
  }

  /**
   * Melancholic descending pulses on Game Over
   */
  gameover() {
    return this.pulse([80, 50, 120]);
  }

  /**
   * Grand celebratory rhythmic fanfare on Victory
   */
  victory() {
    return this.pulse([40, 40, 50, 40, 80, 40, 140]);
  }
}
