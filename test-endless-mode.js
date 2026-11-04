/**
 * @file test-endless-mode.js
 * @description Regression test: Endless Mode must really be Endless.
 *  - setMode('ENDLESS') survives reset() (Game.resetGameData() calls it on every run start)
 *  - waves keep coming: finishing a wave starts the next, with more ghosts per wave
 *  - a stationary Heart ghost left on screen never blocks the next wave from starting
 *  - Story Mode is unaffected (still finite minions + boss)
 */

import { WaveSystem } from './src/systems/WaveSystem.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

/**
 * Drive the WaveSystem like Game.updatePlaying() does. Hostile ghosts die `lifetime` seconds
 * after spawning (player kills them / they reach Momo); Heart ghosts (speed 0) never leave.
 */
function simulate(ws, seconds, { lifetime = 4, keepHeart = false } = {}) {
  const dt = 1 / 60;
  let enemies = [];
  let t = 0;
  let spawned = 0;
  let bossSpawned = false;
  const waveStarts = [];
  ws.onWaveStart = (w, total) => waveStarts.push({ wave: w, total, t });

  if (keepHeart) enemies.push({ born: 0, heart: true });

  for (let i = 0; i < seconds * 60; i++) {
    t += dt;
    enemies = enemies.filter(e => e.heart || t - e.born <= lifetime);
    const living = enemies.length;
    const hostile = enemies.filter(e => !e.heart).length;
    const result = ws.update(dt, 5, living, hostile);
    if (result) {
      const configs = Array.isArray(result) ? result : [result];
      for (const c of configs) {
        if (c.isBoss) bossSpawned = true;
        enemies.push({ born: t, heart: Boolean(c.isHeartGhost) });
        spawned++;
      }
    }
  }
  return { spawned, waveStarts, bossSpawned };
}

console.log('\n=== Endless Mode keeps its mode ===');
{
  const ws = new WaveSystem();
  ws.setMode('ENDLESS');
  assert(ws.gameMode === 'ENDLESS', "setMode('ENDLESS') sets gameMode to ENDLESS");
  ws.reset();
  assert(ws.gameMode === 'ENDLESS', 'reset() (called by resetGameData on every run) keeps ENDLESS');
  assert(ws.levelData === null, 'Endless has no story level data / boss');
  assert(ws.totalEnemiesInWave === 15, `Endless wave 1 has 15 ghosts (got ${ws.totalEnemiesInWave})`);

  ws.setMode('STORY');
  assert(ws.gameMode === 'STORY', "setMode('STORY') switches back to STORY");
  assert(ws.totalEnemiesInWave === 12, `Story level 1 has 12 minions (got ${ws.totalEnemiesInWave})`);
}

console.log('\n=== Endless waves keep spawning ===');
{
  const ws = new WaveSystem();
  ws.setMode('ENDLESS');
  const { spawned, waveStarts, bossSpawned } = simulate(ws, 180);
  assert(!bossSpawned, 'Endless never spawns a story boss');
  assert(waveStarts.length >= 4, `at least 4 waves started in 3 minutes (got ${waveStarts.length})`);
  assert(spawned > 60, `ghosts keep coming: ${spawned} spawned in 3 minutes`);
  const totals = waveStarts.map(w => w.total);
  assert(totals.every((n, i) => i === 0 || n >= totals[i - 1]), `wave sizes never shrink (${totals.join(', ')})`);
}

console.log('\n=== A lingering Heart ghost does not block the next wave ===');
{
  const ws = new WaveSystem();
  ws.setMode('ENDLESS');
  const { waveStarts } = simulate(ws, 180, { keepHeart: true });
  assert(waveStarts.length >= 4, `next waves still start with a Heart ghost on screen (got ${waveStarts.length})`);
}

console.log('\n=== Story Mode is unchanged ===');
{
  const ws = new WaveSystem();
  ws.setMode('STORY');
  const { spawned, bossSpawned } = simulate(ws, 60);
  assert(bossSpawned, 'Story level 1 still ends with its boss');
  assert(spawned >= 12, `Story level 1 spawns its minions first (got ${spawned})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
