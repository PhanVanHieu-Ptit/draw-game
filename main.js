/**
 * @file main.js
 * @description Entry point for Arcane Paws: Spellscribe game.
 */

import { SettingsStore } from './src/core/Settings.js';
import { RemoteConfiguration } from './src/core/RemoteConfiguration.js';
import { Game } from './src/core/Game.js';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('Canvas element #gameCanvas not found!');
    return;
  }

  const game = new Game(canvas);
  game.remoteConfiguration = new RemoteConfiguration();
  // Opt-in deployment settings; file:// standalone never needs a server.
  await game.remoteConfiguration.load(import.meta.env.VITE_GAME_CONFIG_URL, import.meta.env.VITE_GAME_CONFIG_ENV);
  if (game.remoteConfiguration.published) {
    const { visuals, accessibility } = game.remoteConfiguration.published.values;
    game.settings = new SettingsStore(undefined, { ...visuals, ...accessibility });
    game.settings.onChange((key, value) => game._applySetting(key, value));
    game._applyAllSettings();
  }
  game.start();

  // Expose to window for debugging if needed
  window.__ARCANE_GAME__ = game;
});
