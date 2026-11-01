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
   * Sound when projectile impacts an enemy (crisp magical strike / rune break)
   * @param {string} [gesture='default']
   */
  playHit(gesture = 'default') {
    this.soundEnemyHit(gesture);
  }

  /**
   * Sound when a regular enemy is completely eliminated (Google Doodle ghost_vanish wc)
   */
  playEnemyDeath() {
    this.soundGhostVanish();
  }

  /**
   * Sound when a ghost lunges and strikes the player (Google Doodle ghost_attack Tb)
   */
  playEnemyAttack() {
    this.soundGhostAttack();
  }

  /**
   * Terrifying Boss apparition / entrance roar (Google Doodle boss_roar Pb)
   */
  playBossRoar() {
    this.soundBossRoar();
  }

  /**
   * Alias for boss entrance
   */
  playBossIntro() {
    this.soundBossRoar();
  }

  /**
   * Unique Boss defeat roar corresponding to story level (1..5)
   * @param {number} [level=1]
   */
  playBossDeath(level = 1) {
    this.soundBossDefeat(level);
  }

  /**
   * Subtle ethereal formant whoosh when a ghost spawns
   */
  playGhostSpawn() {
    this.soundGhostSpawn();
  }

  /**
   * Player takes damage (Google Doodle cat_hurt tc + concussive thump)
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
   * Game Start fanfare (Google Doodle level_start Bc)
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
   * Stage / Wave Cleared fanfare (Google Doodle level_clear sprite Vb)
   */
  playWaveComplete() {
    this.soundWaveComplete();
  }
}
