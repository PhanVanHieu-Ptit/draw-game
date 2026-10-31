/**
 * @file UIManager.js
 * @description Manages HTML5 UI overlays, HUD updates (Hearts, Score, Combo, Waves), and Modal Dialogs.
 */

import { GAME_STATES, RUNES } from '../core/Constants.js';

export class UIManager {
  constructor(game) {
    this.game = game;

    // Cache DOM elements
    this.screens = {
      [GAME_STATES.MENU]: document.getElementById('menu-screen'),
      [GAME_STATES.PLAYING]: document.getElementById('hud-playing'),
      [GAME_STATES.PAUSE]: document.getElementById('pause-screen'),
      [GAME_STATES.GAMEOVER]: document.getElementById('gameover-screen')
    };

    // HUD Elements
    this.heartsContainer = document.getElementById('hearts-container');
    this.scoreVal = document.getElementById('score-val');
    this.waveBadge = document.getElementById('wave-badge');
    this.comboBadge = document.getElementById('combo-badge');
    this.comboMult = document.getElementById('combo-mult');
    this.comboBar = document.getElementById('combo-bar');
    this.gestureFeedback = document.getElementById('gesture-feedback');

    // Menu / Gameover Elements
    this.menuHighScore = document.getElementById('menu-high-score');
    this.goScore = document.getElementById('go-score');
    this.goHighScore = document.getElementById('go-high-score');
    this.goWave = document.getElementById('go-wave');
    this.goAccuracy = document.getElementById('go-accuracy');
    this.goNewRecord = document.getElementById('go-new-record');

    this._bindButtonEvents();
    this._bindKeyboardEvents();
  }

  _bindButtonEvents() {
    // Start Game Button
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        this.game.audioSystem.init();
        this.game.audioSystem.playStart();
        this.game.stateMachine.changeState(GAME_STATES.PLAYING);
      });
    }

    // Pause Button in HUD
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        if (this.game.stateMachine.getCurrentStateName() === GAME_STATES.PLAYING) {
          this.game.stateMachine.changeState(GAME_STATES.PAUSE);
        }
      });
    }

    // Resume Button
    const btnResume = document.getElementById('btn-resume');
    if (btnResume) {
      btnResume.addEventListener('click', () => {
        this.game.stateMachine.changeState(GAME_STATES.PLAYING);
      });
    }

    // Restart Button from Pause
    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        this.game.resetGameData();
        this.game.stateMachine.changeState(GAME_STATES.PLAYING);
      });
    }

    // Play Again Button from GameOver
    const btnPlayAgain = document.getElementById('btn-play-again');
    if (btnPlayAgain) {
      btnPlayAgain.addEventListener('click', () => {
        this.game.audioSystem.playStart();
        this.game.resetGameData();
        this.game.stateMachine.changeState(GAME_STATES.PLAYING);
      });
    }

    // Audio Mute toggle button
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        const isMuted = this.game.audioSystem.toggleMute();
        btnMute.textContent = isMuted ? '🔇' : '🔊';
        btnMute.title = isMuted ? 'Bật âm thanh' : 'Tắt âm thanh';
      });
    }
  }

  _bindKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      // Toggle Pause with Escape or P key
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        const currentState = this.game.stateMachine.getCurrentStateName();
        if (currentState === GAME_STATES.PLAYING) {
          this.game.stateMachine.changeState(GAME_STATES.PAUSE);
        } else if (currentState === GAME_STATES.PAUSE) {
          this.game.stateMachine.changeState(GAME_STATES.PLAYING);
        }
      }

      // Enter key starts game from Menu or GameOver
      if (e.key === 'Enter') {
        const currentState = this.game.stateMachine.getCurrentStateName();
        if (currentState === GAME_STATES.MENU || currentState === GAME_STATES.GAMEOVER) {
          this.game.audioSystem.init();
          this.game.audioSystem.playStart();
          this.game.resetGameData();
          this.game.stateMachine.changeState(GAME_STATES.PLAYING);
        }
      }
    });
  }

  showScreen(stateName, payload = {}) {
    // Hide all screens first
    Object.values(this.screens).forEach(screen => {
      if (screen) screen.classList.remove('active');
    });

    const target = this.screens[stateName];
    if (target) {
      target.classList.add('active');
    }

    // Update screen-specific data
    if (stateName === GAME_STATES.MENU) {
      if (this.menuHighScore) {
        this.menuHighScore.textContent = this.game.highScore.toLocaleString();
      }
    } else if (stateName === GAME_STATES.GAMEOVER) {
      if (this.goScore) this.goScore.textContent = (payload.score || 0).toLocaleString();
      if (this.goHighScore) this.goHighScore.textContent = (payload.highScore || 0).toLocaleString();
      if (this.goWave) this.goWave.textContent = payload.wave || 1;
      if (this.goAccuracy) this.goAccuracy.textContent = `${payload.accuracy || 100}%`;
      if (this.goNewRecord) {
        this.goNewRecord.style.display = payload.isNewHighScore ? 'inline-block' : 'none';
      }
    }
  }

  hideScreen(stateName) {
    const target = this.screens[stateName];
    if (target) {
      target.classList.remove('active');
    }
  }

  /**
   * Update heart icons in HUD
   * @param {number} currentHp 
   * @param {number} maxHp 
   */
  updateHearts(currentHp, maxHp) {
    if (!this.heartsContainer) return;
    this.heartsContainer.innerHTML = '';

    for (let i = 0; i < maxHp; i++) {
      const heartEl = document.createElement('span');
      heartEl.className = 'heart-icon';
      if (i < currentHp) {
        heartEl.classList.add('filled');
        heartEl.textContent = '❤️';
      } else {
        heartEl.classList.add('empty');
        heartEl.textContent = '🖤';
      }
      this.heartsContainer.appendChild(heartEl);
    }
  }

  /**
   * Update score counter in HUD
   * @param {number} score 
   */
  updateScore(score) {
    if (this.scoreVal) {
      this.scoreVal.textContent = Math.round(score).toLocaleString();
    }
  }

  /**
   * Update wave badge in HUD
   * @param {number} waveNum 
   */
  updateWave(waveNum) {
    if (this.waveBadge) {
      this.waveBadge.textContent = `WAVE ${waveNum}`;
    }
  }

  /**
   * Update combo count and decay bar
   * @param {number} count 
   * @param {number} multiplier 
   * @param {number} decayProgress 0..1
   */
  updateCombo(count, multiplier, decayProgress) {
    if (!this.comboBadge) return;

    if (count > 1) {
      this.comboBadge.classList.add('active');
      if (this.comboMult) {
        this.comboMult.textContent = `x${multiplier} (${count} COMBO)`;
      }
      if (this.comboBar) {
        this.comboBar.style.width = `${Math.max(0, decayProgress * 100)}%`;
      }
    } else {
      this.comboBadge.classList.remove('active');
      if (this.comboBar) {
        this.comboBar.style.width = '0%';
      }
    }
  }

  /**
   * Flash recognized gesture feedback pill in HUD
   * @param {string | null} gesture 
   * @param {number} score 
   * @param {boolean} isSuccess 
   */
  showGestureFeedback(gesture, score, isSuccess) {
    if (!this.gestureFeedback) return;

    if (gesture && RUNES[gesture]) {
      const rune = RUNES[gesture];
      this.gestureFeedback.textContent = `${rune.symbol} ${rune.name.toUpperCase()} (${(score * 100).toFixed(0)}%)`;
      this.gestureFeedback.className = isSuccess ? 'feedback-success' : 'feedback-miss';
    } else {
      this.gestureFeedback.textContent = 'KHÔNG KHỚP';
      this.gestureFeedback.className = 'feedback-fizzle';
    }

    this.gestureFeedback.classList.add('show');
    clearTimeout(this._feedbackTimeout);
    this._feedbackTimeout = setTimeout(() => {
      this.gestureFeedback.classList.remove('show');
    }, 1200);
  }
}
