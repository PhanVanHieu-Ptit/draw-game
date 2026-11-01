/**
 * @file main.js
 * @description Entry point for Arcane Paws: Spellscribe game.
 */

import { Game } from './src/core/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('Canvas element #gameCanvas not found!');
    return;
  }

  const game = new Game(canvas);
  game.start();

  // Expose to window for debugging if needed
  window.__ARCANE_GAME__ = game;
  window.game = game;
});
