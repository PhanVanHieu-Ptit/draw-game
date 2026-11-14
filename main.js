import { loadPublishedStory, setStoryLocale } from './shared/story/runtime.js';
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
  await loadPublishedStory(import.meta.env.VITE_STORY_CONTENT_URL);
  setStoryLocale(import.meta.env.VITE_STORY_LOCALE || 'vi');

  // Live operations (opt-in, see docs/live-operations.md). The cached schedule is applied synchronously and the network
  // refresh is NOT awaited: a slow or unreachable server never delays the menu, it only means the cache (or the built-in
  // daily rotation) is used. Refreshed again when the tab comes back and every few minutes while it stays open.
  if (game.liveOps.configure(import.meta.env.VITE_LIVEOPS_URL, import.meta.env.VITE_LIVEOPS_ENV || import.meta.env.VITE_GAME_CONFIG_ENV)) {
    game.refreshLiveEffects();
  }
  if (game.liveOps.configured) {
    const refresh = () => { game.liveOps.refresh(); };
    refresh();
    setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }
  game.start();

  // Expose to window for debugging if needed
  window.__ARCANE_GAME__ = game;
});
