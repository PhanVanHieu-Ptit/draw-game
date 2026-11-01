/**
 * @file AudioSystem.js
 * @description Facade and integration wrapper for the procedural SoundSystem.
 * Extends SoundSystem with backward-compatible method signatures.
 */

import { SoundSystem } from './SoundSystem.js';

export class AudioSystem extends SoundSystem {
  constructor(options = {}) {
    super(options);
  }

  /**
   * Play spell sound corresponding to gesture (maps to soundSpellSuccess)
   * @param {string} gesture 
   */
  playSpell(gesture) {
    this.soundSpellSuccess(gesture);
  }

  /**
   * Sound when projectile impacts an enemy
   */
  playHit() {
    this.soundGhostVanish();
  }

  /**
   * Sound when an enemy is completely eliminated
   */
  playEnemyDeath() {
    this.soundGhostVanish();
  }

  /**
   * Player takes damage (maps to soundDamage)
   */
  playHurt() {
    this.soundDamage();
  }

  /**
   * Dynamic ascending combo chime
   * @param {number} comboCount 
   */
  playCombo(comboCount) {
    this.soundCombo(comboCount);
  }

  /**
   * Fizzle sound when gesture didn't match any enemy
   */
  playFizzle() {
    this.soundFizzle();
  }

  /**
   * Game Over melancholic chime
   */
  playGameOver() {
    this.soundGameOver();
  }

  /**
   * Game Start fanfare
   */
  playStart() {
    this.soundStart();
  }

  /**
   * Victory fanfare (Google Doodle victory.mp3 / chime)
   */
  playVictory() {
    this.soundVictory();
  }

  /**
   * Stage / Wave Cleared fanfare (Google Doodle level_clear sprite)
   */
  playWaveComplete() {
    this.soundWaveComplete();
  }
}
