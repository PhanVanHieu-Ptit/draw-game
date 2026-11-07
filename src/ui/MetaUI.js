/**
 * @file MetaUI.js
 * @description Screens and widgets around the core game loop: settings, records, daily challenge,
 * companions, the upgrade picker, buffs HUD, toasts, Practice Mode HUD, the resume countdown, the
 * alternative-input rune pad and the end-of-run summary. Owned by UIManager as `uiManager.meta`.
 *
 * Markup lives in index.html; this class only fills it in and wires events. Lists are rendered with
 * innerHTML from constants and numbers only. The one piece of externally supplied text (a friend's
 * name from a challenge link) is always set through textContent.
 *
 * Everything touching the DOM is guarded: the node-based tests drive Game with a minimal fake document.
 */

import { RUNES, ACADEMY_CHARACTERS, DIFFICULTY_LEVELS } from '../core/Constants.js';
import { SENSITIVITY_LEVELS } from '../GestureEngine.js';
import { ACHIEVEMENTS, BESTIARY, achievementProgress } from '../core/Achievements.js';
import { UPGRADES } from '../core/Upgrades.js';
import { MODES, DIFFICULTIES } from '../core/ProgressStore.js';
import { COMPANIONS, COMPANION_ORDER, isCompanionUnlocked } from '../core/Companions.js';
import { PRACTICE_ORDER } from '../systems/PracticeSession.js';
import { SPELL_PHRASES, PHRASE_WINDOW } from '../core/Spells.js';
import { TRAILS, HATS, STREAK_MILESTONES, isCosmeticUnlocked } from '../core/Cosmetics.js';
import { dateKey, shiftDateKey, parseDailyChallengeParams, getDailyChallenge } from '../core/Challenge.js';
import { getCharacterPortraitSvg } from './CharacterPortraits.js';

const MAX_TOASTS = 3;
const TOAST_MS = 4200;

/** Gesture order used by the alternative-input pad and the 1-8 keys */
export const PAD_ORDER = ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning', 'heart', 'circle', 'spiral'];

const QUALITY_NAMES = { high: 'Cao', medium: 'Vừa', low: 'Thấp' };
const SENSITIVITY_TEXT = {
  easy: 'Dễ: chấp nhận cả nét vẽ lệch một chút.',
  normal: 'Chuẩn: cân bằng giữa dễ vẽ và chính xác.',
  strict: 'Chặt: nét vẽ phải gọn và rõ hình mới được nhận.'
};

function fmt(n) {
  return Math.round(Number(n) || 0).toLocaleString();
}

function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
}

export class MetaUI {
  /**
   * @param {import('./UIManager.js').UIManager} ui
   */
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;

    this._toastTimers = [];
    this._pickHandler = null;
    this._lastRun = null; // summary of the last finished run, used for "new record" badges
    this._padBuilt = false;
    this._countdownShown = 0;
    this._clip = null;
    this._clipUrl = null;
    this._clipPausedBGM = false; // we paused the music while the clip plays, so we give it back on close
    this._wardrobeNew = false;
    this._chainTimer = null;

    // A shared daily-challenge link (?daily=...&score=...&from=...)
    this.friendChallenge = null;
    try {
      if (typeof window !== 'undefined' && window.location) {
        this.friendChallenge = parseDailyChallengeParams(window.location.search);
      }
    } catch (e) { /* ignore */ }

    this._bind();
  }

  // ------------------------------------------------------------------ helpers

  $(id) {
    return typeof document !== 'undefined' && document.getElementById ? document.getElementById(id) : null;
  }

  _on(id, evt, fn) {
    const el = this.$(id);
    if (el && el.addEventListener) el.addEventListener(evt, fn);
  }

  _open(id) {
    const el = this.$(id);
    if (el && el.classList) el.classList.add('active');
  }

  _close(id) {
    const el = this.$(id);
    if (el && el.classList) el.classList.remove('active');
  }

  _isOpen(id) {
    const el = this.$(id);
    return !!(el && el.classList && el.classList.contains('active'));
  }

  _text(id, text) {
    const el = this.$(id);
    if (el) el.textContent = text;
  }

  _html(id, html) {
    const el = this.$(id);
    if (el) el.innerHTML = html;
  }

  _hidden(id, hidden) {
    const el = this.$(id);
    if (!el || !el.classList) return;
    if (hidden) el.classList.add('hidden');
    else el.classList.remove('hidden');
  }

  /** Walk up from an event target to the nearest element carrying `attr` */
  _closestAttr(target, attr) {
    let node = target;
    while (node && node.getAttribute) {
      if (node.getAttribute(attr) !== null && node.getAttribute(attr) !== undefined) return node;
      node = node.parentElement;
    }
    return null;
  }

  _tap() {
    const g = this.game;
    if (g.audioSystem && typeof g.audioSystem.playSpell === 'function') g.audioSystem.playSpell('horizontal');
  }

  // ------------------------------------------------------------------ event wiring

  _bind() {
    const g = this.game;

    // Menu tiles
    this._on('btn-open-settings', 'click', () => { this._tap(); this.openSettings(); });
    this._on('btn-open-records', 'click', () => { this._tap(); this.openRecords(); });
    this._on('btn-open-daily', 'click', () => { this._tap(); this.openDaily(); });
    this._on('btn-open-companions', 'click', () => { this._tap(); this.openCompanions(); });
    this._on('btn-open-spellbook', 'click', () => { this._tap(); this.openSpellbook(); });
    this._on('btn-open-wardrobe', 'click', () => { this._tap(); this.openWardrobe(); });
    this._on('btn-start-rush', 'click', () => {
      g.audioSystem.init();
      g.audioSystem.playStart();
      if (typeof g.audioSystem.playCatMeow === 'function') setTimeout(() => g.audioSystem.playCatMeow('cheerful'), 180);
      g.startBossRush();
    });
    this._on('btn-open-achievements', 'click', () => { this._tap(); this.ui.openCodex('achievements'); });
    this._on('btn-open-practice', 'click', () => { g.audioSystem.init(); this._tap(); g.startPractice(); });
    this._on('btn-resume-endless', 'click', () => {
      g.audioSystem.init();
      g.audioSystem.playStart();
      g.resumeEndless();
    });

    // Pause extras
    this._on('btn-pause-settings', 'click', () => this.openSettings());
    this._on('btn-pause-menu', 'click', () => this._confirmQuit());

    // Close buttons
    this._on('btn-close-settings', 'click', () => this.closeSettings());
    this._on('btn-close-records', 'click', () => this.closeRecords());
    this._on('btn-close-daily', 'click', () => this.closeDaily());
    this._on('btn-close-companions', 'click', () => this.closeCompanions());
    this._on('btn-close-spellbook', 'click', () => this._close('spellbook-screen'));
    this._on('btn-close-wardrobe', 'click', () => this._close('wardrobe-screen'));

    // Wardrobe: equip a trail or a hat
    const wardrobe = this.$('wardrobe-screen');
    if (wardrobe && wardrobe.addEventListener) {
      wardrobe.addEventListener('click', (e) => {
        const item = this._closestAttr(e.target, 'data-cosmetic');
        if (!item) return;
        const kind = item.getAttribute('data-kind');
        const id = item.getAttribute('data-cosmetic');
        if (g.setCosmetic(kind, id)) {
          this._tap();
          this.renderWardrobe();
        } else {
          this.showToast('🔒 Phần thưởng này chưa mở khóa', 'info');
        }
      });
    }

    // Best-moment clip
    this._on('btn-go-clip', 'click', () => this.openClip());
    this._on('btn-vic-clip', 'click', () => this.openClip());
    this._on('btn-close-clip', 'click', () => this.closeClip());
    this._on('btn-clip-share', 'click', () => this.shareClip());
    this._on('btn-clip-download', 'click', () => this.downloadClip());

    // Settings (event delegation: one listener per event type)
    const settingsRoot = this.$('settings-screen');
    if (settingsRoot && settingsRoot.addEventListener) {
      settingsRoot.addEventListener('input', (e) => this._onSettingInput(e));
      settingsRoot.addEventListener('change', (e) => this._onSettingChange(e));
      settingsRoot.addEventListener('click', (e) => this._onSettingClick(e));
    }
    this._on('btn-reset-settings', 'click', () => {
      g.settings.reset();
      this.syncSettings();
    });

    // Daily challenge
    this._on('btn-start-daily', 'click', () => {
      g.audioSystem.init();
      g.audioSystem.playStart();
      this._close('daily-screen');
      g.startDaily(this._dailyKeyToPlay());
    });
    this._on('btn-share-daily', 'click', () => this._shareDaily());
    const friend = this.$('daily-friend');
    if (friend && friend.addEventListener) {
      friend.addEventListener('click', (e) => {
        const btn = this._closestAttr(e.target, 'data-play-key');
        if (!btn) return;
        this._playFriendDay = btn.getAttribute('data-play-key');
        this._close('daily-screen');
        g.audioSystem.init();
        g.audioSystem.playStart();
        g.startDaily(this._playFriendDay);
      });
    }

    // Companions
    const grid = this.$('companion-grid');
    if (grid && grid.addEventListener) {
      grid.addEventListener('click', (e) => {
        const item = this._closestAttr(e.target, 'data-companion');
        if (!item) return;
        const id = item.getAttribute('data-companion');
        if (g.setCompanion(id)) {
          this._tap();
          if (g.audioSystem.playCatMeow) g.audioSystem.playCatMeow('cute');
          this.renderCompanions();
        } else {
          this.showToast('🔒 Đồng hành này chưa mở khóa', 'info');
        }
      });
    }

    // Upgrade picker
    const choices = this.$('upgrade-choices');
    if (choices && choices.addEventListener) {
      choices.addEventListener('click', (e) => {
        const card = this._closestAttr(e.target, 'data-upgrade');
        if (card) this.chooseUpgrade(card.getAttribute('data-upgrade'));
      });
    }

    // Practice
    this._on('btn-practice-replay', 'click', () => g.inputHandler.replayLastStroke());
    this._on('btn-practice-exit', 'click', () => g.quitToMenu());
    this._on('btn-practice-template', 'click', () => {
      g.practice.setShowTemplate(!g.practice.showTemplate);
      this.refreshPractice();
    });
    const runes = this.$('practice-runes');
    if (runes && runes.addEventListener) {
      runes.addEventListener('click', (e) => {
        const chip = this._closestAttr(e.target, 'data-rune');
        if (chip && g.practice.selectRune(chip.getAttribute('data-rune'))) this._tap();
      });
    }

    // Alternative input pad
    const pad = this.$('rune-pad');
    if (pad && pad.addEventListener) {
      pad.addEventListener('pointerdown', (e) => {
        const btn = this._closestAttr(e.target, 'data-cast');
        if (!btn) return;
        if (e.preventDefault) e.preventDefault();
        g.castRune(btn.getAttribute('data-cast'));
      });
    }
  }

  /** "Về Menu" from the pause screen asks for a second tap so a stray touch cannot throw a run away */
  _confirmQuit() {
    const btn = this.$('btn-pause-menu');
    if (this._quitArmed) {
      clearTimeout(this._quitTimer);
      this._quitArmed = false;
      if (btn) btn.textContent = '🏠 Về Menu';
      this.game.quitToMenu();
      return;
    }
    this._quitArmed = true;
    if (btn) btn.textContent = 'Chạm lần nữa để thoát';
    this._quitTimer = setTimeout(() => {
      this._quitArmed = false;
      if (btn) btn.textContent = '🏠 Về Menu';
    }, 3000);
  }

  /** Close the top-most overlay. @returns {boolean} true if something was closed */
  closeTopOverlay() {
    for (const id of ['clip-modal', 'settings-screen', 'records-screen', 'daily-screen', 'companion-screen', 'spellbook-screen', 'wardrobe-screen']) {
      if (this._isOpen(id)) {
        if (id === 'clip-modal') this.closeClip();
        else this._close(id);
        return true;
      }
    }
    if (this.ui.codexScreen && this.ui.codexScreen.classList && this.ui.codexScreen.classList.contains('active')) {
      this.ui.closeCodex();
      return true;
    }
    return false;
  }

  /** @returns {boolean} whether any meta overlay (not the upgrade picker) is open */
  hasOpenOverlay() {
    return ['settings-screen', 'records-screen', 'daily-screen', 'companion-screen', 'spellbook-screen', 'wardrobe-screen', 'clip-modal']
      .some(id => this._isOpen(id));
  }

  // ------------------------------------------------------------------ settings

  openSettings() {
    this.syncSettings();
    this._open('settings-screen');
  }

  closeSettings() {
    this._close('settings-screen');
  }

  /** Reflect the stored settings in the controls */
  syncSettings() {
    const root = this.$('settings-screen');
    if (!root || !root.querySelectorAll) return;
    const s = this.game.settings;

    root.querySelectorAll('[data-setting]').forEach((node) => {
      const key = node.getAttribute('data-setting');
      const value = s.get(key);
      if (node.classList && node.classList.contains('seg')) {
        node.querySelectorAll('button').forEach((b) => {
          const on = String(b.getAttribute('data-value')) === String(value);
          if (on) b.classList.add('active');
          else b.classList.remove('active');
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      } else if (node.type === 'checkbox') {
        node.checked = !!value;
      } else if (node.type === 'range') {
        node.value = String(value);
        this._setOutput(root, key, value);
      }
    });

    this._text('sensitivity-note', `${SENSITIVITY_TEXT[s.get('sensitivity')] || ''} (ngưỡng nhận diện ${Math.round((SENSITIVITY_LEVELS[s.get('sensitivity')] || 0.65) * 100)}%)`);
    const q = this.game.quality;
    const tierName = q && QUALITY_NAMES[q.tier] ? QUALITY_NAMES[q.tier] : '';
    this._text('quality-note', s.get('quality') === 'auto'
      ? `Tự động theo thiết bị — hiện đang dùng mức ${tierName}. Game sẽ hạ mức nếu máy bị giật.`
      : `Cố định mức ${QUALITY_NAMES[s.get('quality')] || ''}, game sẽ không tự hạ chất lượng.`);
  }

  _setOutput(root, key, value) {
    const out = root.querySelector(`[data-out="${key}"]`);
    if (out) out.textContent = `${value}%`;
  }

  _onSettingInput(e) {
    const t = e.target;
    const key = t && t.getAttribute ? t.getAttribute('data-setting') : null;
    if (!key || t.type !== 'range') return;
    this.game.settings.set(key, Number(t.value));
    const root = this.$('settings-screen');
    if (root && root.querySelector) this._setOutput(root, key, this.game.settings.get(key));
  }

  _onSettingChange(e) {
    const t = e.target;
    const key = t && t.getAttribute ? t.getAttribute('data-setting') : null;
    if (!key) return;
    const g = this.game;
    if (t.type === 'checkbox') {
      g.settings.set(key, !!t.checked);
      if (key === 'haptics' && t.checked && g.hapticSystem) g.hapticSystem.pulse(20);
    } else if (t.type === 'range') {
      // Let go of a slider: play a sample of what it controls
      if (key === 'catVolume') g.audioSystem.playCatMeow('cute');
      else if (key === 'sfxVolume' || key === 'masterVolume') g.audioSystem.playSpell('lightning');
    }
  }

  _onSettingClick(e) {
    const btn = this._closestAttr(e.target, 'data-value');
    if (!btn || !btn.parentElement) return;
    const key = btn.parentElement.getAttribute('data-setting');
    if (!key) return;
    this.game.settings.set(key, btn.getAttribute('data-value'));
    this.syncSettings();
    this._tap();
  }

  // ------------------------------------------------------------------ records

  openRecords() {
    this.renderRecords();
    this._open('records-screen');
  }

  closeRecords() {
    this._close('records-screen');
  }

  /** Remember the finished run so its entries get a "new record" badge in the records screen */
  setLastRun(summary) {
    this._lastRun = summary;
  }

  renderRecords() {
    const g = this.game;
    const p = g.progress;
    const last = this._lastRun;
    let html = '';

    for (const mode of MODES) {
      const isStory = mode === 'STORY';
      html += `<section class="records-mode"><h3 class="records-mode-title">${isStory ? '📖 Cốt Truyện' : '⚡ Vô Tận'}</h3>`;
      for (const diff of DIFFICULTIES) {
        const rec = p.getRecord(mode, diff);
        const info = DIFFICULTY_LEVELS[diff];
        const fresh = last && !last.bossRush && last.mode === mode && last.difficulty === diff && !last.assisted;
        const pill = (flag) => (fresh && flag ? '<span class="new-pill">KỶ LỤC MỚI</span>' : '');
        const level = rec.level > 0 ? (isStory ? `Màn ${rec.level}/5` : `Đợt ${rec.level}`) : '—';
        html += `
          <div class="records-row${rec.plays ? '' : ' empty'}">
            <div class="records-diff">${info.badge}</div>
            <div class="records-cells">
              <div class="records-cell"><span class="records-label">Điểm cao</span><span class="records-val">${rec.plays ? fmt(rec.score) : '—'}${pill(last && last.isNewHighScore)}</span></div>
              <div class="records-cell"><span class="records-label">${isStory ? 'Màn xa nhất' : 'Đợt cao nhất'}</span><span class="records-val">${level}${pill(last && last.isNewLevel)}</span></div>
              <div class="records-cell"><span class="records-label">Combo cao nhất</span><span class="records-val">${rec.combo > 0 ? rec.combo : '—'}${pill(last && last.isNewCombo)}</span></div>
              <div class="records-cell"><span class="records-label">Chính xác</span><span class="records-val">${rec.plays ? rec.accuracy + '%' : '—'}</span></div>
            </div>
            <div class="records-plays">${rec.plays ? `${rec.plays} lượt${isStory && rec.wins ? ` • ${rec.wins} lần thắng` : ''}` : 'Chưa chơi'}</div>
          </div>`;
      }
      html += '</section>';
    }

    const rush = p.getRush();
    html += `<section class="records-mode"><h3 class="records-mode-title">💀 Boss Rush</h3>
      <div class="records-row${rush.plays ? '' : ' empty'}">
        <div class="records-cells">
          <div class="records-cell"><span class="records-label">Điểm cao</span><span class="records-val">${rush.plays ? fmt(rush.score) : '—'}</span></div>
          <div class="records-cell"><span class="records-label">Trùm xa nhất</span><span class="records-val">${rush.level > 0 ? `${rush.level}/5` : '—'}</span></div>
          <div class="records-cell"><span class="records-label">Clear nhanh nhất</span><span class="records-val">${rush.seconds > 0 ? this._clock(rush.seconds) : '—'}</span></div>
          <div class="records-cell"><span class="records-label">Lần clear</span><span class="records-val">${rush.clears}</span></div>
        </div>
      </div></section>`;

    const st = p.data.stats;
    html += `<section class="records-mode"><h3 class="records-mode-title">📊 Thống kê</h3>
      <div class="records-lifetime">
        <span>👻 <b>${fmt(st.kills)}</b> u linh</span>
        <span>🪄 <b>${fmt(st.spells)}</b> nét vẽ</span>
        <span>🎮 <b>${fmt(st.runs)}</b> lượt</span>
        <span>⏱️ <b>${formatDuration(st.playSeconds)}</b></span>
      </div>
      ${g.legacyHighScore > 0 ? `<p class="setting-note">Điểm cao cũ (trước khi tách theo chế độ & độ khó): <b>${fmt(g.legacyHighScore)}</b></p>` : ''}
    </section>`;

    this._html('records-body', html);
  }

  /** 125 -> '2:05' */
  _clock(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ------------------------------------------------------------------ menu summary

  /** Refresh the dynamic parts of the main menu */
  updateMenu() {
    const g = this.game;
    const p = g.progress;
    const diff = g.difficulty || 'NORMAL';
    const story = p.getRecord('STORY', diff).score;
    const endless = p.getRecord('ENDLESS', diff).score;
    this._text('menu-high-score', fmt(story));
    this._text('menu-high-score-sub', `Cốt Truyện • Vô Tận: ${fmt(endless)} (${DIFFICULTY_LEVELS[diff].name})`);

    // Continue an Endless run
    const save = g.runSave ? g.runSave.load() : null;
    if (save) {
      this._text('resume-endless-label', `▶ TIẾP TỤC VÔ TẬN — ĐỢT ${save.wave} • ${fmt(save.score)} ĐIỂM`);
    }
    this._hidden('btn-resume-endless', !save);

    // Daily badge
    const key = dateKey();
    const today = p.getDaily(key);
    const streak = p.dailyStreak(key);
    this._text('daily-menu-badge', today ? (streak > 1 ? `🔥${streak}` : '✓') : 'MỚI');

    // Spellbook progress, Boss Rush clear mark and the "new in wardrobe" flag
    this._text('spellbook-menu-badge', `${p.discoveredPhraseCount()}/${SPELL_PHRASES.length}`);
    const rush = p.getRush();
    this._text('rush-menu-badge', rush.clears > 0 ? '✓' : '');
    this._hidden('rush-menu-badge', rush.clears === 0);
    this._hidden('wardrobe-menu-badge', !this._wardrobeNew);
  }

  // ------------------------------------------------------------------ daily challenge

  _dailyKeyToPlay() {
    return dateKey();
  }

  openDaily() {
    this.renderDaily();
    this._open('daily-screen');
  }

  closeDaily() {
    this._close('daily-screen');
  }

  renderDaily() {
    const g = this.game;
    const p = g.progress;
    const key = dateKey();
    const ch = getDailyChallenge(key);
    const mod = ch.modifier;
    const today = p.getDaily(key);

    this._html('daily-modifier', `
      <div class="daily-mod-icon">${mod.icon}</div>
      <div class="daily-mod-text">
        <div class="daily-mod-date">${key}</div>
        <div class="daily-mod-name">${mod.name}</div>
        <div class="daily-mod-desc">${mod.desc}</div>
      </div>`);

    const streak = p.dailyStreak(key);
    this._html('daily-stats', `
      <div class="stat-box"><span class="stat-label">Điểm tốt nhất hôm nay</span><span class="stat-value">${today ? fmt(today.score) : '—'}</span></div>
      <div class="stat-box"><span class="stat-label">Chuỗi ngày chơi</span><span class="stat-value">${streak > 0 ? streak + ' 🔥' : '—'}</span></div>`);

    // Rewards for a long streak (the best streak counts, so a broken one does not take them away)
    const best = Math.max(streak, p.data.stats.bestDailyStreak);
    const rewards = STREAK_MILESTONES.map((days) => {
      const prizes = [...TRAILS, ...HATS].filter(c => c.unlock && c.unlock.streak === days);
      const done = best >= days;
      return `<div class="streak-reward${done ? ' done' : ''}"><b>${done ? '✓ ' : ''}${days} ngày</b>${prizes.map(c => `${c.icon} ${c.name}`).join('<br>')}</div>`;
    }).join('');
    this._html('daily-rewards', rewards);

    // History of the last 7 days
    let hist = '';
    for (let i = 6; i >= 0; i--) {
      const k = shiftDateKey(key, -i);
      const d = p.getDaily(k);
      hist += `<div class="daily-day${d ? ' done' : ''}${i === 0 ? ' today' : ''}"><span>${k.slice(5)}</span><b>${d ? fmt(d.score) : '—'}</b></div>`;
    }
    this._html('daily-history', hist);

    // Friend's challenge link
    const friendEl = this.$('daily-friend');
    const fc = this.friendChallenge;
    if (friendEl && fc) {
      friendEl.classList.remove('hidden');
      friendEl.innerHTML = '';
      const line = document.createElement('div');
      line.className = 'daily-friend-line';
      // The name comes from the URL: never put it through innerHTML
      line.textContent = fc.score > 0
        ? `⚔️ ${fc.from} thách bạn vượt ${fmt(fc.score)} điểm!`
        : `⚔️ ${fc.from} mời bạn chơi thử thách này!`;
      friendEl.appendChild(line);
      if (fc.key !== key) {
        const note = document.createElement('div');
        note.className = 'daily-friend-note';
        note.textContent = `Đó là thử thách ngày ${fc.key} (không tính chuỗi ngày).`;
        friendEl.appendChild(note);
        const btn = document.createElement('button');
        btn.className = 'btn-subtle';
        btn.textContent = `Chơi thử thách ngày ${fc.key}`;
        btn.setAttribute('data-play-key', fc.key);
        friendEl.appendChild(btn);
      }
    } else if (friendEl) {
      friendEl.classList.add('hidden');
    }
  }

  async _shareDaily() {
    const g = this.game;
    const url = g.getDailyShareUrl();
    const today = g.progress.getDaily(dateKey());
    const text = today
      ? `📅 Thử Thách Hằng Ngày Arcane Paws: tôi đạt ${fmt(today.score)} điểm! Bạn có vượt được không? ${url}`
      : `📅 Thử Thách Hằng Ngày Arcane Paws — thử sức nhé! ${url}`;
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('🔗 Đã sao chép link thách đấu!', 'info');
    } catch (e) {
      this.showToast(`Link: ${url}`, 'info');
    }
  }

  // ------------------------------------------------------------------ companions

  openCompanions() {
    this.renderCompanions();
    this._open('companion-screen');
  }

  closeCompanions() {
    this._close('companion-screen');
  }

  renderCompanions() {
    const p = this.game.progress;
    const active = p.getCompanion();
    const html = COMPANION_ORDER.map((id) => {
      const def = COMPANIONS[id];
      const char = ACADEMY_CHARACTERS.find(c => c.id === id) || { name: id, themeColor: '#c084fc' };
      const unlocked = isCompanionUnlocked(id, p);
      const isActive = active === id && unlocked;
      return `
        <button type="button" class="companion-item${unlocked ? '' : ' locked'}${isActive ? ' active' : ''}" data-companion="${id}" style="--card-accent:${char.themeColor}">
          <div class="companion-portrait">${unlocked ? getCharacterPortraitSvg(id, 56) : '<span class="lock-icon">🔒</span>'}</div>
          <div class="companion-info">
            <div class="companion-item-name">${unlocked ? char.name : '???'}</div>
            <div class="companion-passive">${unlocked ? '✨ ' + def.passive : 'Kỹ năng bị ẩn'}</div>
            <div class="companion-desc">${unlocked ? def.desc : `Qua Màn ${def.unlockLevel} ở chế độ Cốt Truyện để mở khóa.`}</div>
          </div>
          <span class="companion-state">${isActive ? '✔ ĐANG DÙNG' : (unlocked ? 'CHỌN' : '')}</span>
        </button>`;
    }).join('');
    this._html('companion-grid', html);
  }

  // ------------------------------------------------------------------ spellbook

  openSpellbook() {
    this.renderSpellbook();
    this._open('spellbook-screen');
  }

  renderSpellbook() {
    const p = this.game.progress;
    const html = SPELL_PHRASES.map((ph) => {
      const known = p.isPhraseDiscovered(ph.id);
      const recipe = known
        ? ph.runes.map(r => `<span>${RUNES[r].symbol}</span>`).join('')
        : '<span>?</span><span>?</span><span>?</span>';
      return `
        <div class="companion-item spell-item${known ? '' : ' locked'}" style="--card-accent:#fde047">
          <div class="companion-portrait"><span class="spell-icon">${known ? ph.icon : '❓'}</span></div>
          <div class="companion-info">
            <div class="companion-item-name">${known ? ph.name : '???'}</div>
            <div class="spell-recipe">${recipe}</div>
            <div class="companion-desc">${known ? '✨ ' + ph.desc : '💡 ' + ph.hint}</div>
          </div>
          <span class="companion-state">${known ? `×${p.getPhraseCount(ph.id)}` : ''}</span>
        </div>`;
    }).join('');
    this._html('spellbook-grid', html);
    this._text('spellbook-sub', `Đã khám phá ${p.discoveredPhraseCount()}/${SPELL_PHRASES.length}. Vẽ đúng 3 nét liên tiếp theo thứ tự — mỗi nét phải trúng u linh và cách nhau dưới ${String(PHRASE_WINDOW).replace('.', ',')} giây. Vẽ trượt sẽ làm đứt chuỗi.`);
  }

  // ------------------------------------------------------------------ wardrobe

  /** Flag the menu tile: something new was unlocked since the wardrobe was last opened */
  markWardrobeNew() {
    this._wardrobeNew = true;
    this._hidden('wardrobe-menu-badge', false);
  }

  openWardrobe() {
    this._wardrobeNew = false;
    this._hidden('wardrobe-menu-badge', true);
    this.renderWardrobe();
    this._open('wardrobe-screen');
  }

  renderWardrobe() {
    const p = this.game.progress;
    const card = (kind, def) => {
      const unlocked = isCosmeticUnlocked(def, p);
      const active = unlocked && p.getEquipped(kind) === def.id;
      let swatch = '';
      if (kind === 'trail') {
        const bg = def.rainbow
          ? 'linear-gradient(90deg,#f43f5e,#fbbf24,#34d399,#38bdf8,#c084fc)'
          : `linear-gradient(90deg,${def.colors.glow},${def.colors.active},${def.colors.mid})`;
        swatch = `<span class="wi-swatch" style="background:${bg}"></span>`;
      }
      const note = active ? '✔ Đang dùng' : (unlocked ? 'Chọn' : def.hint);
      return `
        <button type="button" class="wardrobe-item${unlocked ? '' : ' locked'}${active ? ' active' : ''}" data-kind="${kind}" data-cosmetic="${def.id}">
          <span class="wi-icon">${unlocked ? def.icon : '🔒'}</span>
          <span class="wi-name">${unlocked ? def.name : '???'}</span>
          ${swatch}
          <span class="wi-hint">${note}</span>
        </button>`;
    };
    this._html('wardrobe-trails', TRAILS.map(t => card('trail', t)).join(''));
    this._html('wardrobe-hats', HATS.map(h => card('hat', h)).join(''));
  }

  // ------------------------------------------------------------------ in-run widgets: phrase chain, score boost

  /**
   * Show the strokes of the Spell Phrase in progress (empty list hides it); `phrase` flashes its name when cast.
   * @param {string[]} runes
   * @param {Object|null} [phrase]
   */
  renderPhraseChain(runes, phrase = null) {
    const el = this.$('phrase-chain');
    if (!el || !el.classList) return;
    clearTimeout(this._chainTimer);
    if (phrase) {
      el.classList.remove('hidden');
      el.innerHTML = `<span class="pc-done">${phrase.icon} ${phrase.name}</span>`;
      this._chainTimer = setTimeout(() => el.classList.add('hidden'), 1400);
      return;
    }
    if (!runes || runes.length === 0) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    let html = '✦ ';
    for (let i = 0; i < 3; i++) {
      const r = runes[i];
      html += r && RUNES[r] ? `<span class="pc-slot">${RUNES[r].symbol}</span>` : '<span class="pc-slot empty">·</span>';
    }
    el.classList.remove('hidden');
    el.innerHTML = html;
  }

  /** @param {number} mult score multiplier in effect @param {number} seconds whole seconds left (0 = none) */
  setBoost(mult, seconds) {
    const el = this.$('boost-pill');
    if (!el || !el.classList) return;
    if (!(seconds > 0)) {
      el.classList.add('hidden');
      return;
    }
    el.textContent = `✨ ĐIỂM x${mult} • ${seconds}s`;
    el.classList.remove('hidden');
  }

  // ------------------------------------------------------------------ best-moment clip

  /** @param {{blob: Blob, mimeType: string, ext: string, peak: number, seconds: number}|null} clip */
  setClip(clip) {
    this._clip = clip || null;
    this._revokeClipUrl();
    this._hidden('btn-go-clip', !clip);
    this._hidden('btn-vic-clip', !clip);
  }

  _revokeClipUrl() {
    if (this._clipUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(this._clipUrl); } catch (e) { /* ignore */ }
    }
    this._clipUrl = null;
  }

  openClip() {
    const clip = this._clip;
    const video = this.$('clip-video');
    if (!clip || !video || typeof URL === 'undefined' || !URL.createObjectURL) return;
    this._revokeClipUrl();
    this._clipUrl = URL.createObjectURL(clip.blob);
    video.src = this._clipUrl;
    this._text('clip-title', `COMBO x${clip.peak} • ${clip.seconds}s`);
    this._open('clip-modal');
    this._quietGameAudio();
    if (video.play) {
      const played = video.play();
      if (played && played.catch) played.catch(() => { /* autoplay blocked: the controls are there */ });
    }
  }

  closeClip() {
    const video = this.$('clip-video');
    if (video && video.pause) video.pause();
    this._close('clip-modal');
    this._restoreGameAudio();
  }

  /** The clip has its own sound: hush the music and any fanfare still ringing so they do not talk over it */
  _quietGameAudio() {
    const audio = this.game && this.game.audioSystem;
    if (!audio) return;
    if (typeof audio.stopOneShots === 'function') audio.stopOneShots();
    if (this._clipPausedBGM || typeof audio.pauseBGM !== 'function') return;
    if (audio.isBGMPlaying && !audio.isBGMPaused) {
      audio.pauseBGM();
      this._clipPausedBGM = true;
    }
  }

  _restoreGameAudio() {
    if (!this._clipPausedBGM) return;
    this._clipPausedBGM = false;
    const audio = this.game && this.game.audioSystem;
    if (audio && typeof audio.resumeBGM === 'function') audio.resumeBGM();
  }

  _clipFileName() {
    const c = this._clip;
    return `arcane-paws-combo-x${c ? c.peak : 0}.${c ? c.ext : 'webm'}`;
  }

  downloadClip() {
    const clip = this._clip;
    if (!clip || typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return;
    const url = URL.createObjectURL(clip.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this._clipFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /** Share the clip file with the system share sheet; falls back to a download where that is not possible */
  async shareClip() {
    const clip = this._clip;
    if (!clip) return;
    try {
      const file = new File([clip.blob], this._clipFileName(), { type: clip.mimeType });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Arcane Paws',
          text: `Combo x${clip.peak} trong Arcane Paws! Bạn có vượt được không?`
        });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // the player closed the share sheet
    }
    this.downloadClip();
    this.showToast('📥 Thiết bị không chia sẻ trực tiếp được — đã tải clip về máy.', 'info');
  }

  // ------------------------------------------------------------------ codex extras (collection + achievements)

  /** Update the counters on the two extra Codex tabs */
  updateCodexTabLabels() {
    const p = this.game.progress;
    const seen = BESTIARY.filter(b => p.isSeen(b.id)).length;
    this._text('codex-tab-bestiary', `📚 Sưu Tầm U Linh (${seen}/${BESTIARY.length})`);
    this._text('codex-tab-achievements', `🏅 Thành Tựu (${p.unlockedCount()}/${ACHIEVEMENTS.length})`);
  }

  /**
   * @param {'bestiary'|'achievements'} filter
   * @param {HTMLElement} container the Codex grid
   */
  renderCodexExtra(filter, container) {
    if (!container) return;
    container.innerHTML = filter === 'bestiary' ? this._bestiaryHtml() : this._achievementsHtml();
  }

  _bestiaryHtml() {
    const p = this.game.progress;
    const seen = BESTIARY.filter(b => p.isSeen(b.id)).length;
    let html = `<div class="collection-head">Đã gặp <b>${seen}/${BESTIARY.length}</b> loại u linh — những con chưa gặp hiện bóng đen "???".</div>`;
    for (const b of BESTIARY) {
      const known = p.isSeen(b.id);
      const kills = p.getKills(b.id);
      const portraitId = b.id.startsWith('BOSS_') ? b.id.toLowerCase() : null;
      const art = portraitId ? getCharacterPortraitSvg(portraitId, 56) : `<span class="bestiary-emoji">${b.icon}</span>`;
      html += `
        <div class="bestiary-card${known ? '' : ' unknown'}${b.boss ? ' boss' : ''}">
          <div class="bestiary-art">${art}</div>
          <div class="bestiary-info">
            <div class="bestiary-name">${known ? b.name : '???'}</div>
            <div class="bestiary-desc">${known ? b.desc : 'Chưa từng chạm trán. Hãy tiếp tục chiến đấu để khám phá!'}</div>
            ${known ? `<div class="bestiary-kills">Đã thanh tẩy: <b>${fmt(kills)}</b></div>` : ''}
          </div>
        </div>`;
    }
    return html;
  }

  _achievementsHtml() {
    const p = this.game.progress;
    let html = `<div class="collection-head">Đã đạt <b>${p.unlockedCount()}/${ACHIEVEMENTS.length}</b> thành tựu</div>`;
    const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(p.isUnlocked(b.id)) - Number(p.isUnlocked(a.id)));
    for (const def of sorted) {
      const done = p.isUnlocked(def.id);
      const [cur, target] = achievementProgress(p, def);
      const pct = Math.max(0, Math.min(100, Math.round((cur / target) * 100)));
      html += `
        <div class="ach-card${done ? ' done' : ''}">
          <div class="ach-icon">${done ? def.icon : '🔒'}</div>
          <div class="ach-info">
            <div class="ach-name">${def.name}</div>
            <div class="ach-desc">${def.desc}</div>
            <div class="ach-bar"><i style="width:${done ? 100 : pct}%"></i></div>
            <div class="ach-count">${done ? '✔ Đã đạt' : `${fmt(cur)} / ${fmt(target)}`}</div>
          </div>
        </div>`;
    }
    return html;
  }

  // ------------------------------------------------------------------ upgrade picker & buffs

  /**
   * @param {Array<{id:string, icon:string, name:string, desc:string}>} choices
   * @param {(id: string) => boolean} onPick returns true if the pick was accepted
   */
  showUpgradePicker(choices, onPick) {
    const g = this.game;
    this._pickHandler = onPick;
    this._currentChoices = choices;

    const html = choices.map((def, i) => {
      const owned = g.upgrades.count(def.id);
      return `
        <button type="button" class="upgrade-option" data-upgrade="${def.id}">
          <span class="upgrade-key">${i + 1}</span>
          <span class="upgrade-icon">${def.icon}</span>
          <span class="upgrade-name">${def.name}</span>
          <span class="upgrade-desc">${def.desc}</span>
          ${owned ? `<span class="upgrade-stack">Đang có x${owned}</span>` : ''}
        </button>`;
    }).join('');
    this._html('upgrade-choices', html);

    const ws = g.waveSystem;
    this._text('upgrade-subtitle', ws.gameMode === 'ENDLESS'
      ? `Bạn đã vượt qua Đợt ${ws.currentWave}! Chỉ có hiệu lực trong lượt chơi này.`
      : `Đã giải cứu Màn ${ws.currentLevelIndex}! Chỉ có hiệu lực trong lượt chơi này.`);

    const owned = Object.entries(g.upgrades.stacks)
      .map(([id, n]) => `<span class="buff-chip" title="${this._upgradeTitle(id)}">${this._upgradeIcon(id)}<sub>x${n}</sub></span>`)
      .join('');
    this._html('upgrade-owned', owned ? `<span class="upgrade-owned-label">Đang có:</span>${owned}` : '');

    this._open('upgrade-screen');
  }

  _upgradeIcon(id) {
    return UPGRADES[id] ? UPGRADES[id].icon : '✨';
  }

  _upgradeTitle(id) {
    const def = UPGRADES[id];
    return def ? `${def.name}: ${def.desc}` : id;
  }

  /** Pick by 1-based key (1-3). @returns {boolean} whether a choice was made */
  chooseUpgradeByIndex(index) {
    const def = this._currentChoices && this._currentChoices[index];
    if (!def || !this.isUpgradeOpen()) return false;
    return this.chooseUpgrade(def.id);
  }

  chooseUpgrade(id) {
    if (!this._pickHandler) return false;
    const ok = this._pickHandler(id);
    if (ok) this.hideUpgradePicker();
    return !!ok;
  }

  hideUpgradePicker() {
    this._pickHandler = null;
    this._currentChoices = null;
    this._close('upgrade-screen');
  }

  isUpgradeOpen() {
    return this._isOpen('upgrade-screen');
  }

  /**
   * Small icon row under the hearts: the equipped companion, the combo shield and every upgrade this run.
   * @param {import('../core/Upgrades.js').UpgradeState} upgrades
   */
  renderBuffs(upgrades) {
    const el = this.$('buff-row');
    if (!el) return;
    const g = this.game;
    const parts = [];

    const compId = g.progress ? g.progress.getCompanion() : null;
    const comp = compId ? COMPANIONS[compId] : null;
    if (comp) {
      const char = ACADEMY_CHARACTERS.find(c => c.id === compId);
      parts.push(`<span class="buff-chip companion" title="${comp.passive}: ${comp.desc}">${char ? char.icon.slice(0, 2) : '🐱'}</span>`);
    }
    if (upgrades.shieldLimit > 0) {
      parts.push(`<span class="buff-chip shield${upgrades.shieldCharges > 0 ? '' : ' spent'}" title="Lá chắn combo: bỏ qua nét vẽ sai">🛡️<sub>${upgrades.shieldCharges}/${upgrades.shieldLimit}</sub></span>`);
    }
    for (const [id, n] of Object.entries(upgrades.stacks)) {
      if (id === 'combo_shield') continue;
      parts.push(`<span class="buff-chip" title="${this._upgradeTitle(id)}">${this._upgradeIcon(id)}${n > 1 ? `<sub>x${n}</sub>` : ''}</span>`);
    }
    el.innerHTML = parts.join('');
  }

  // ------------------------------------------------------------------ toasts

  /**
   * @param {string} html markup built from constants only
   * @param {string} [kind] 'achievement' | 'info' | 'unlock'
   */
  showToast(html, kind = 'info') {
    const stack = this.$('toast-stack');
    if (!stack || typeof document === 'undefined' || !document.createElement) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${kind}`;
    toast.innerHTML = html;
    stack.appendChild(toast);

    // Keep the stack short: drop the oldest first
    while (stack.children && stack.children.length > MAX_TOASTS && stack.removeChild) {
      stack.removeChild(stack.children[0]);
    }

    const timer = setTimeout(() => {
      if (toast.remove) toast.remove();
    }, TOAST_MS);
    this._toastTimers.push(timer);
  }

  showAchievementToast(def) {
    this.showToast(
      `<span class="toast-icon">${def.icon}</span><span class="toast-body"><b>Thành tựu mới!</b><br>${def.name}</span>`,
      'achievement'
    );
  }

  // ------------------------------------------------------------------ resume countdown

  /** @param {number} n seconds left (3, 2, 1); 0 hides the overlay */
  setCountdown(n) {
    const overlay = this.$('countdown-overlay');
    if (!overlay || !overlay.classList) return;
    if (n <= 0) {
      overlay.classList.remove('show');
      this._countdownShown = 0;
      return;
    }
    if (n !== this._countdownShown) {
      this._countdownShown = n;
      this._text('countdown-num', String(n));
      // Restart the pop animation for every digit
      overlay.classList.remove('show');
      if (overlay.offsetWidth !== undefined) void overlay.offsetWidth;
      overlay.classList.add('show');
    }
  }

  // ------------------------------------------------------------------ accessibility widgets

  /** Show the on-screen rune pad when alternative input is enabled */
  applyAltInput() {
    const enabled = !!this.game.settings.get('altInput');
    const pad = this.$('rune-pad');
    if (pad && !this._padBuilt) {
      pad.innerHTML = PAD_ORDER.map((id, i) => {
        const r = RUNES[id];
        return `<button type="button" class="rune-pad-btn" data-cast="${id}" style="--rune-color:${r.color}" aria-label="${r.description}"><span class="rune-pad-key">${i + 1}</span><span class="rune-pad-sym">${r.symbol}</span></button>`;
      }).join('');
      this._padBuilt = true;
    }
    this._hidden('rune-pad', !enabled);
  }

  /** Show the "not ranked" badge while an assist option is on */
  applyAssistBadge() {
    this._hidden('assist-badge', !this.game.isAssisted());
  }

  // ------------------------------------------------------------------ practice HUD

  renderPracticeRunes() {
    const g = this.game;
    const html = PRACTICE_ORDER.map((id) => {
      const r = RUNES[id];
      const m = g.practice.getMastery(id);
      const classes = ['practice-rune'];
      if (g.practice.target === id) classes.push('active');
      if (m.mastered) classes.push('mastered');
      return `<button type="button" class="${classes.join(' ')}" data-rune="${id}" style="--rune-color:${r.color}" title="${r.name}">
        <span class="practice-rune-symbol">${r.symbol}</span>
        <span class="practice-rune-prog">${m.mastered ? '★' : m.good + '/' + m.needed}</span>
      </button>`;
    }).join('');
    this._html('practice-runes', html);
  }

  /** Redraw every part of the practice HUD from the PracticeSession */
  refreshPractice() {
    const pr = this.game.practice;
    if (!pr) return;
    this.renderPracticeRunes();
    const r = RUNES[pr.target];
    const m = pr.getMastery();

    this._text('practice-tip', `${r.symbol} ${r.name}: ${pr.tip}`);

    const markEl = this.$('practice-meter-mark');
    if (markEl && markEl.style) markEl.style.left = `${Math.round(m.threshold * 100)}%`;

    const dots = Array.from({ length: m.needed }, (_, i) => (i < m.good ? '●' : '○')).join(' ');
    this._text('practice-mastery', m.mastered
      ? `🎓 Đã thành thạo ${r.symbol} (tốt nhất ${Math.round(m.best * 100)}%)`
      : `Thành thạo: ${dots}  — cần ${m.needed} nét từ ${Math.round(m.threshold * 100)}%`);

    const hist = pr.history
      .map(h => `<i class="${h.passed ? (h.accuracy >= m.threshold ? 'great' : 'ok') : 'miss'}" title="${Math.round(h.accuracy * 100)}%"></i>`)
      .join('');
    this._html('practice-history', hist);

    const verdict = this.$('practice-verdict');
    if (verdict) {
      if (pr.lastResult) {
        verdict.textContent = pr.lastResult.text;
        verdict.className = `practice-verdict tone-${pr.lastResult.tone}`;
      } else {
        verdict.textContent = 'Vẽ ấn ký bất kỳ lúc nào — không có u linh nào tấn công.';
        verdict.className = 'practice-verdict';
      }
    }

    this.updatePracticeLive(pr.lastResult ? pr.lastResult.accuracy : 0);
    const tpl = this.$('btn-practice-template');
    if (tpl && tpl.classList) {
      if (pr.showTemplate) tpl.classList.remove('off');
      else tpl.classList.add('off');
    }
  }

  /** Move the accuracy meter */
  updatePracticeLive(accuracy) {
    const pct = Math.max(0, Math.min(100, Math.round(accuracy * 100)));
    const fill = this.$('practice-meter-fill');
    const threshold = this.game.practice.getMastery().threshold * 100;
    if (fill && fill.style) {
      fill.style.width = `${pct}%`;
      fill.className = `practice-meter-fill ${pct >= threshold ? 'high' : (pct >= 55 ? 'mid' : 'low')}`;
    }
    this._text('practice-meter-pct', `${pct}%`);
  }

  // ------------------------------------------------------------------ end-of-run summary

  /**
   * Fill the "recap" panel on the Game Over / Victory screen.
   * @param {string} containerId 'go-summary' | 'vic-summary'
   * @param {Object} s the object returned by Game.getRunSummary()
   */
  renderRunSummary(containerId, s) {
    const unit = s.bossRush ? 'Trùm' : (s.mode === 'STORY' ? 'Màn' : 'Đợt');
    const pill = (flag) => (flag ? '<span class="new-pill">KỶ LỤC MỚI</span>' : '');
    const tracked = !s.assisted;

    const modeName = s.bossRush ? '💀 Boss Rush' : (s.mode === 'STORY' ? '📖 Cốt Truyện' : (s.daily ? '📅 Thử Thách Ngày' : '⚡ Vô Tận'));
    let html = `<div class="rs-modeline">${modeName} • ${DIFFICULTY_LEVELS[s.difficulty] ? DIFFICULTY_LEVELS[s.difficulty].badge : ''}</div>`;

    if (tracked) {
      // A daily run is compared with that day's best, not with the regular records
      const dRec = s.daily && s.daily.record;
      const rRec = s.rush && s.rush.record;
      const bestLevel = s.bossRush ? (rRec ? rRec.level : s.level) : (s.daily ? (dRec ? dRec.wave : s.level) : (s.record ? s.record.level : s.level));
      const bestCombo = s.bossRush ? s.maxCombo : (s.daily ? (dRec ? dRec.combo : s.maxCombo) : (s.record ? s.record.combo : s.maxCombo));
      const bestWord = s.daily ? 'Tốt nhất hôm nay' : 'Kỷ lục';
      html += `<div class="rs-grid">
        <div class="rs-item"><span class="rs-label">Điểm</span><span class="rs-val">${fmt(s.score)}${pill(s.isNewHighScore)}</span><span class="rs-sub">${bestWord}: ${fmt(s.highScore)}</span></div>
        <div class="rs-item"><span class="rs-label">${unit} đạt được</span><span class="rs-val">${s.level}${pill(s.isNewLevel)}</span><span class="rs-sub">${bestWord}: ${bestLevel}</span></div>
        <div class="rs-item"><span class="rs-label">Combo cao nhất</span><span class="rs-val">${s.maxCombo}${pill(s.isNewCombo)}</span><span class="rs-sub">${bestWord}: ${bestCombo}</span></div>
      </div>`;
      if (!s.isNewHighScore && s.scoreGap > 0 && s.scoreGap < Math.max(500, s.highScore * 0.25)) {
        html += `<div class="rs-near">🔥 Chỉ thiếu <b>${fmt(s.scoreGap)}</b> điểm nữa là phá kỷ lục!</div>`;
      }
    } else {
      html += `<div class="rs-assisted">♿ Lượt chơi có bật trợ năng — kết quả không được ghi vào bảng điểm.</div>`;
    }

    if (s.bossRush && s.rush) {
      const r = s.rush;
      html += `<div class="rs-rush">💀 Boss Rush: ${s.victory ? 'đã hạ cả <b>5</b> trùm' : `đến trùm <b>${s.level}/5</b>`} trong <b>${this._clock(r.seconds)}</b>${r.isNewTime ? ' <span class="new-pill">NHANH NHẤT</span>' : ''}${r.record && r.record.seconds > 0 ? ` • Nhanh nhất: ${this._clock(r.record.seconds)}` : ''}</div>`;
    }

    if (s.daily) {
      html += `<div class="rs-daily">📅 Thử thách ${s.daily.key}: <b>${fmt(s.score)}</b> điểm${s.daily.streak > 1 ? ` • Chuỗi <b>${s.daily.streak}</b> ngày 🔥` : ''}</div>`;
    }

    const rp = s.replay;
    if (rp) {
      const items = [];
      if (rp.topRune) {
        const r = RUNES[rp.topRune];
        items.push(`<div class="rs-fact"><span class="rs-fact-icon">${r.symbol}</span><span>Ấn ký hay dùng nhất<br><b>${r.name}</b> (${rp.topRuneCount} lần)</span></div>`);
      }
      if (rp.bestAccuracy > 0) {
        const r = RUNES[rp.bestAccuracyRune];
        items.push(`<div class="rs-fact"><span class="rs-fact-icon">🎯</span><span>Nét chính xác nhất<br><b>${rp.bestAccuracy}%</b>${r ? ` (${r.symbol})` : ''}</span></div>`);
      }
      if (rp.weakestRune) {
        const r = RUNES[rp.weakestRune];
        items.push(`<div class="rs-fact"><span class="rs-fact-icon">📉</span><span>Cần luyện thêm<br><b>${r.symbol} ${r.name}</b> (${rp.weakestMissRate}% trượt)</span></div>`);
      }
      if (items.length) html += `<div class="rs-facts">${items.join('')}</div>`;
    }

    if (s.achievements && s.achievements.length) {
      html += `<div class="rs-ach"><b>🏅 Thành tựu mới:</b> ${s.achievements.map(a => `${a.icon} ${a.name}`).join(' • ')}</div>`;
    }
    if (s.cosmetics && s.cosmetics.length) {
      html += `<div class="rs-cos"><b>🎨 Phần thưởng mới trong Tủ Đồ:</b> ${s.cosmetics.map(c => `${c.icon} ${c.name}`).join(' • ')}</div>`;
    }
    if (s.unlockedCompanions && s.unlockedCompanions.length) {
      html += `<div class="rs-ach"><b>🐾 Mở khóa đồng hành:</b> ${s.unlockedCompanions.join(' • ')}</div>`;
    }

    this._html(containerId, html);
  }
}
