import { RUNES } from '../core/Constants.js';

/** One message per surface. Lower-priority events are consumed, never queued into stale advice. */
export class FeedbackChannel {
  constructor() { this.clear(); }
  clear() { this.current = null; }
  post(text, { priority = 1, duration = 1.6, kind = 'info', color } = {}) {
    if (this.current && (this.current.priority > priority || this.current.text === text)) return false;
    this.current = { text, priority, remaining: duration, kind, color };
    return true;
  }
  tick(dt) {
    if (this.current) {
      this.current.remaining -= Math.max(0, dt);
      if (this.current.remaining <= 0) this.clear();
    }
  }
}

export function enemyIdentity(enemy) {
  if (enemy.isBoss) return '♛ TRÙM';
  if (enemy.isHeartGhost) return '♥ HỒI MÁU';
  if (enemy.isGolden) return '✦ THƯỞNG';
  if (enemy.type === 'SPEEDSTER' || enemy.eliteModifier === 'swift') return '» TỐC ĐỘ';
  if (enemy.type === 'ARMORED' || enemy.eliteModifier === 'armored') return '⬟ GIÁP';
  if (enemy.isFreezeGhost) return '❄ BĂNG';
  if (enemy.isBlastGhost) return '◎ GIÓ';
  return '◇ U LINH';
}

/** Time to collision, rather than spawn order or hue, selects the one urgent target. */
export function selectThreat(enemies, player, width, height) {
  let best = null;
  let bestETA = Infinity;
  for (const enemy of enemies) {
    if (enemy.isDead || enemy.isHeartGhost || enemy.isGolden || enemy.isFrozen || enemy.isRetreating || enemy.isMinionRetreating) continue;
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    const gap = Math.max(0, distance - (enemy.radius || 24) - (player.radius || 24));
    const speed = (enemy.speed || 0) * (enemy.combatSpeedScale ?? 1) *
      (enemy.slowTimer > 0 ? (enemy.slowFactor ?? 1) : 1) *
      (enemy.sprintTimer > 0 ? (enemy.gimmick?.speed ?? 1) : 1);
    const eta = speed > 0 ? gap / speed : Infinity;
    if (eta < bestETA) { best = enemy; bestETA = eta; }
  }
  if (!best) return null;
  const dx = best.x - player.x;
  const dy = best.y - player.y;
  const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '→' : '←') : (dy > 0 ? '↓' : '↑');
  const outside = best.x < 0 || best.y < 0 || best.x > width || best.y > height;
  return { enemy: best, eta: bestETA, urgent: bestETA <= 2.2, direction, outside,
    rune: best.symbolsHidden ? null : RUNES[best.symbolQueue?.[0]] };
}

/** Boss lives are phases, not equal HP: show actual rune depletion within the current phase. */
export function bossProgress(boss) {
  const max = Math.max(1, boss.maxBossLives || 1);
  const lives = Math.max(0, boss.bossLives ?? 1);
  const phase = Math.max(0, Math.min(max - 1, max - lives));
  const queue = boss.symbolQueue?.length || 0;
  const total = boss.bossPhases?.[boss.currentPhaseIndex || 0]?.length || Math.max(1, queue);
  const transition = !!boss.isRetreating;
  const fraction = lives === 0 ? 0 : transition && boss.phaseClearedOnRetreat
    ? lives / max : ((lives - 1) + Math.min(1, queue / total)) / max;
  return { max, lives, phase: phase + 1, queue, total, transition, fraction: Math.max(0, fraction) };
}

/** Presentation only. Every value comes from the running simulation; this never writes combat state. */
export class GameplayHUD {
  constructor(game) {
    this.game = game;
    this.nodes = new Map();
    this.cache = new Map();
    this.cooldowns = new Map();
  }
  node(id) {
    if (!this.nodes.has(id)) this.nodes.set(id, document.getElementById(id));
    return this.nodes.get(id);
  }
  text(id, text) {
    if (this.cache.get(id) === text) return;
    this.cache.set(id, text);
    const el = this.node(id);
    if (el) el.textContent = text;
  }
  attr(id, key, value) {
    const token = `${id}:${key}`;
    if (this.cache.get(token) === value) return;
    this.cache.set(token, value);
    this.node(id)?.setAttribute?.(key, String(value));
  }
  update() {
    const g = this.game;
    const player = g.player;
    if (!player) return;
    this.text('health-value', `HP ${player.hp}/${player.maxHp}`);
    this.attr('hearts-container', 'data-critical', player.hp === 1);
    this.text('player-protection', player.isInvulnerable ? `🛡 ${Math.max(0, player.invulnerableTimer).toFixed(1)}s` : '');
    this.attr('player-protection', 'aria-label', player.isInvulnerable ? `Bảo vệ tạm thời: ${Math.ceil(player.invulnerableTimer)} giây` : 'Có thể nhận sát thương');

    const enemies = g.enemies || [];
    const ws = g.waveSystem;
    const boss = enemies.find(e => e.isBoss && !e.isDead);
    const hostile = enemies.filter(e => !e.isDead && !e.isHeartGhost && !e.isGolden).length;
    if (ws) {
      const total = Math.max(0, ws.totalEnemiesInWave || 0);
      const unspawned = Math.max(0, total - (ws.enemiesSpawnedInWave || 0));
      this.text('wave-progress', boss ? '♛ TRẬN ĐẤU TRÙM' : `ĐỢT ${ws.currentWave || 1} · CÒN ${unspawned + hostile}`);
    }
    this.attr('boss-status', 'data-visible', !!boss);
    if (boss) {
      const b = bossProgress(boss);
      this.text('boss-label', `♛ ${b.transition ? 'CHUYỂN PHA' : `PHA ${b.phase}/${b.max}`} · ${b.lives}/${b.max} ♥ · ${b.queue} ấn ký`);
      this.attr('boss-meter', 'aria-valuenow', Math.round(b.fraction * 100));
      this.attr('boss-meter', 'aria-valuetext', `${b.lives} mạng, ${b.queue} ấn ký còn lại${b.transition ? ', đang lùi lại' : ''}`);
      const pct = Math.round(b.fraction * 100);
      if (this.cache.get('boss-width') !== pct) {
        this.cache.set('boss-width', pct);
        const fill = this.node('boss-fill');
        if (fill) fill.style.width = `${pct}%`;
      }
    }

    const threat = selectThreat(enemies, player, g.width, g.height);
    // Only the selected threat gets an additional warning marker in the arena.
    for (const enemy of enemies) {
      enemy.feedbackUrgent = enemy === threat?.enemy && threat.urgent;
      enemy.feedbackCompact = enemies.length >= 8 || g.width < 500;
    }
    const urgent = !!threat?.urgent;
    this.attr('combat-readout', 'data-urgent', urgent);
    this.attr('game-notices', 'data-urgent', urgent);
    this.attr('threat-cue', 'data-urgent', urgent);
    const cue = threat ? `${urgent ? '! SẮP ĐÁNH' : 'VẼ TIẾP'} ${threat.direction} ${threat.rune?.symbol || '?'} · ${threat.enemy.symbolsHidden ? 'ẤN KÝ BỊ CHE' : enemyIdentity(threat.enemy)}` : '◇ SẴN SÀNG VẼ';
    this.text('threat-cue', cue);
    // Announce threat identity changes only; never a per-frame timer in a live region.
    this.text('combat-alert', urgent ? `Sắp bị tấn công ${threat.direction}. ${threat.rune ? `Vẽ ${threat.rune.symbol}, ${threat.rune.name}` : 'Ấn ký đang bị che'}.` : '');

    const cooldown = g.runConfiguration?.values.spells.cooldownSeconds || 0;
    const enabled = cooldown > 0;
    this.attr('spell-cooldowns', 'data-visible', enabled);
    if (enabled) {
      const loadout = g.combat?.rules.flags.spellLoadout ? g.combat.rules.loadout : Object.keys(RUNES);
      const key = loadout.join(',');
      if (this.cache.get('loadout') !== key) {
        this.cache.set('loadout', key);
        this.cooldowns.clear();
        const row = this.node('spell-cooldowns');
        if (row) {
          row.textContent = '';
          for (const id of loadout) {
            if (!RUNES[id]) continue;
            const chip = document.createElement('span');
            chip.className = 'cooldown-chip';
            row.appendChild(chip);
            this.cooldowns.set(id, chip);
          }
        }
      }
      for (const [id, chip] of this.cooldowns) {
        const left = Math.max(0, (g._spellReadyAt?.[id] || 0) - (g._configurationTime || 0));
        const text = `${RUNES[id].symbol} ${left > 0 ? `${left.toFixed(1)}s` : '✓'}`;
        if (chip.textContent !== text) {
          chip.textContent = text;
          chip.setAttribute('data-ready', String(left <= 0));
          chip.setAttribute('aria-label', `${RUNES[id].name}: ${left > 0 ? `hồi chiêu ${left.toFixed(1)} giây` : 'sẵn sàng'}`);
        }
      }
    }
  }
}
