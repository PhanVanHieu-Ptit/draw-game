/**
 * @file UIManager.js
 * @description Manages HTML5 UI overlays, HUD updates, 5-level stage selection,
 * level transition banners (Ready... Set... Draw!), Story Cutscenes, and Victory screens.
 */

import { GAME_STATES, RUNES, LEVEL_CONFIGS, STORY_SLIDES, STORAGE_KEYS } from '../core/Constants.js';
import { StoryCanvasRenderer } from './StoryCanvasRenderer.js';

export class UIManager {
  constructor(game) {
    this.game = game;

    // Cache DOM screens
    this.screens = {
      [GAME_STATES.MENU]: document.getElementById('menu-screen'),
      [GAME_STATES.STORY]: document.getElementById('story-screen'),
      [GAME_STATES.PLAYING]: document.getElementById('hud-playing'),
      [GAME_STATES.PAUSE]: document.getElementById('pause-screen'),
      [GAME_STATES.GAMEOVER]: document.getElementById('gameover-screen'),
      [GAME_STATES.VICTORY]: document.getElementById('victory-screen')
    };

    // HUD Elements
    this.heartsContainer = document.getElementById('hearts-container');
    this.scoreVal = document.getElementById('score-val');
    this.waveBadge = document.getElementById('wave-badge');
    this.levelSubBadge = document.getElementById('level-sub-badge');
    this.comboBadge = document.getElementById('combo-badge');
    this.comboMult = document.getElementById('combo-mult');
    this.comboBar = document.getElementById('combo-bar');
    this.gestureFeedback = document.getElementById('gesture-feedback');

    // Level Transition Banner Elements
    this.levelTransitionBanner = document.getElementById('level-transition-banner');
    this.ltbNumber = document.getElementById('ltb-number');
    this.ltbTitle = document.getElementById('ltb-title');
    this.ltbEn = document.getElementById('ltb-en');
    this.ltbPrompt = document.getElementById('ltb-prompt');
    this._ltbTimeout = null;
    this._ltbDrawTimeout = null;

    // Tutorial Overlay Elements
    this.tutorialOverlay = document.getElementById('tutorial-overlay');
    this.tutorialStep1 = document.getElementById('tutorial-step-1');
    this.tutorialStep2 = document.getElementById('tutorial-step-2');
    this.btnSkipTutorial = document.getElementById('btn-skip-tutorial');
    this.btnTutorialHUD = document.getElementById('btn-tutorial');

    // Menu Elements
    this.menuHighScore = document.getElementById('menu-high-score');
    this.stageButtons = document.querySelectorAll('.stage-btn');
    this.selectedStage = 1;

    // Story Cutscene Elements
    this.storyCanvas = document.getElementById('storyCanvas');
    this.storyStepBadge = document.getElementById('story-step-badge');
    this.storySlideTitle = document.getElementById('story-slide-title');
    this.storySlideText = document.getElementById('story-slide-text');
    this.storySlideEn = document.getElementById('story-slide-en');
    this.storyDots = document.getElementById('story-dots');
    this.btnStoryNext = document.getElementById('btn-story-next');
    this.btnStoryPrev = document.getElementById('btn-story-prev');
    this.btnSkipStory = document.getElementById('btn-skip-story');
    this.currentStoryIndex = 0;
    this.storyAnimTimer = 0;
    this._storyAnimHandle = null;

    // Victory Elements
    this.victoryCanvas = document.getElementById('victoryCanvas');
    this.vicScore = document.getElementById('vic-score');
    this.vicHighScore = document.getElementById('vic-high-score');
    this.vicStages = document.getElementById('vic-stages');
    this.vicAccuracy = document.getElementById('vic-accuracy');
    this._victoryAnimHandle = null;

    // GameOver Elements
    this.goScore = document.getElementById('go-score');
    this.goHighScore = document.getElementById('go-high-score');
    this.goWave = document.getElementById('go-wave');
    this.goAccuracy = document.getElementById('go-accuracy');
    this.goNewRecord = document.getElementById('go-new-record');

    this._bindButtonEvents();
    this._bindKeyboardEvents();
    this._bindStageSelector();
  }

  _bindButtonEvents() {
    // Menu Buttons
    const btnStartStory = document.getElementById('btn-start-story');
    if (btnStartStory) {
      btnStartStory.addEventListener('click', () => {
        this.game.audioSystem.init();
        this.game.audioSystem.playStart();
        // Start from Story Cutscene, then into Selected Level
        this.game.stateMachine.changeState(GAME_STATES.STORY, { startLevel: this.selectedStage });
      });
    }

    const btnStartEndless = document.getElementById('btn-start-endless');
    if (btnStartEndless) {
      btnStartEndless.addEventListener('click', () => {
        this.game.audioSystem.init();
        this.game.audioSystem.playStart();
        this.game.waveSystem.setMode('ENDLESS');
        this.game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
      });
    }

    const btnViewStory = document.getElementById('btn-view-story');
    if (btnViewStory) {
      btnViewStory.addEventListener('click', () => {
        this.game.audioSystem.init();
        this.game.stateMachine.changeState(GAME_STATES.STORY, { previewOnly: true });
      });
    }

    // Story Cutscene Controls
    if (this.btnStoryNext) {
      this.btnStoryNext.addEventListener('click', () => {
        const slides = STORY_SLIDES.INTRO;
        if (this.currentStoryIndex < slides.length - 1) {
          this.showStorySlide(this.currentStoryIndex + 1);
        } else {
          // Finished slides -> Launch Game into Level!
          this.game.audioSystem.playStart();
          this.game.waveSystem.setMode('STORY');
          this.game.stateMachine.changeState(GAME_STATES.PLAYING, {
            resetData: true,
            startLevel: this.selectedStage || 1
          });
        }
      });
    }

    if (this.btnStoryPrev) {
      this.btnStoryPrev.addEventListener('click', () => {
        if (this.currentStoryIndex > 0) {
          this.showStorySlide(this.currentStoryIndex - 1);
        }
      });
    }

    if (this.btnSkipStory) {
      this.btnSkipStory.addEventListener('click', () => {
        this.game.audioSystem.playStart();
        this.game.waveSystem.setMode('STORY');
        this.game.stateMachine.changeState(GAME_STATES.PLAYING, {
          resetData: true,
          startLevel: this.selectedStage || 1
        });
      });
    }

    // Victory Screen Buttons
    const btnVicReplay = document.getElementById('btn-vic-replay-story');
    if (btnVicReplay) {
      btnVicReplay.addEventListener('click', () => {
        this.game.audioSystem.playStart();
        this.game.waveSystem.setMode('STORY');
        this.game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true, startLevel: 1 });
      });
    }

    const btnVicEndless = document.getElementById('btn-vic-play-endless');
    if (btnVicEndless) {
      btnVicEndless.addEventListener('click', () => {
        this.game.audioSystem.playStart();
        this.game.waveSystem.setMode('ENDLESS');
        this.game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
      });
    }

    // HUD Pause
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        if (this.game.stateMachine.getCurrentStateName() === GAME_STATES.PLAYING) {
          this.game.stateMachine.changeState(GAME_STATES.PAUSE);
        }
      });
    }

    // Pause Resume
    const btnResume = document.getElementById('btn-resume');
    if (btnResume) {
      btnResume.addEventListener('click', () => {
        this.game.stateMachine.changeState(GAME_STATES.PLAYING);
      });
    }

    // Pause Restart
    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        this.game.resetGameData();
        this.game.stateMachine.changeState(GAME_STATES.PLAYING);
      });
    }

    // GameOver Play Again
    const btnPlayAgain = document.getElementById('btn-play-again');
    if (btnPlayAgain) {
      btnPlayAgain.addEventListener('click', () => {
        this.game.audioSystem.playStart();
        this.game.resetGameData();
        this.game.stateMachine.changeState(GAME_STATES.PLAYING);
      });
    }

    // Tutorial Controls
    if (this.btnSkipTutorial) {
      this.btnSkipTutorial.addEventListener('click', () => {
        this.hideTutorial();
      });
    }

    if (this.btnTutorialHUD) {
      this.btnTutorialHUD.addEventListener('click', () => {
        this.showTutorial(1);
      });
    }

    // Audio Mute toggle
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        const isMuted = this.game.audioSystem.toggleMute();
        btnMute.textContent = isMuted ? '🔇' : '🔊';
        btnMute.title = isMuted ? 'Bật âm thanh' : 'Tắt âm thanh';
      });
    }
  }

  _bindStageSelector() {
    this.stageButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const stage = parseInt(btn.getAttribute('data-stage'), 10) || 1;
        this.selectedStage = stage;
        this.stageButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  _bindKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        const currentState = this.game.stateMachine.getCurrentStateName();
        if (currentState === GAME_STATES.PLAYING) {
          this.game.stateMachine.changeState(GAME_STATES.PAUSE);
        } else if (currentState === GAME_STATES.PAUSE) {
          this.game.stateMachine.changeState(GAME_STATES.PLAYING);
        }
      }

      if (e.key === 'v' || e.key === 'V') {
        this.game.stateMachine.changeState(GAME_STATES.VICTORY);
      }

      if (e.key === '5') {
        if (this.game.waveSystem) {
          this.game.waveSystem.initLevel(5);
        }
      }

      if (e.key === 'g' || e.key === 'G') {
        if (this.game.player) {
          this.game.player.hp = 999;
          this.game.player.maxHp = 999;
          this.updateHearts(999, 999);
        }
      }

      if (e.key === 'Enter') {
        const currentState = this.game.stateMachine.getCurrentStateName();
        if (currentState === GAME_STATES.MENU || currentState === GAME_STATES.GAMEOVER) {
          this.game.audioSystem.init();
          this.game.audioSystem.playStart();
          this.game.resetGameData();
          this.game.stateMachine.changeState(GAME_STATES.PLAYING);
        } else if (currentState === GAME_STATES.STORY) {
          if (this.btnStoryNext) this.btnStoryNext.click();
        }
      }
    });
  }

  showScreen(stateName, payload = {}) {
    Object.values(this.screens).forEach(screen => {
      if (screen) screen.classList.remove('active');
    });

    const target = this.screens[stateName];
    if (target) {
      target.classList.add('active');
    }

    if (stateName === GAME_STATES.MENU) {
      if (this.menuHighScore) {
        this.menuHighScore.textContent = this.game.highScore.toLocaleString();
      }
      this._stopStoryAnim();
      this._stopVictoryAnim();
    } else if (stateName === GAME_STATES.STORY) {
      this.currentStoryIndex = 0;
      this.showStorySlide(0);
      this._startStoryAnim();
    } else if (stateName === GAME_STATES.VICTORY) {
      this._stopStoryAnim();
      this._startVictoryAnim();

      if (this.vicScore) this.vicScore.textContent = (payload.score || 0).toLocaleString();
      if (this.vicHighScore) this.vicHighScore.textContent = (payload.highScore || 0).toLocaleString();
      if (this.vicStages) this.vicStages.textContent = '5/5 (100%)';
      if (this.vicAccuracy) this.vicAccuracy.textContent = `${payload.accuracy || 100}%`;
    } else if (stateName === GAME_STATES.GAMEOVER) {
      this._stopStoryAnim();
      this._stopVictoryAnim();
      if (this.goScore) this.goScore.textContent = (payload.score || 0).toLocaleString();
      if (this.goHighScore) this.goHighScore.textContent = (payload.highScore || 0).toLocaleString();
      if (this.goWave) this.goWave.textContent = payload.wave || 1;
      if (this.goAccuracy) this.goAccuracy.textContent = `${payload.accuracy || 100}%`;
      if (this.goNewRecord) {
        this.goNewRecord.style.display = payload.isNewHighScore ? 'inline-block' : 'none';
      }
    } else if (stateName === GAME_STATES.PLAYING) {
      this._stopStoryAnim();
      this._stopVictoryAnim();
    }
  }

  hideScreen(stateName) {
    const target = this.screens[stateName];
    if (target) {
      target.classList.remove('active');
    }
    if (stateName === GAME_STATES.STORY) {
      this._stopStoryAnim();
    } else if (stateName === GAME_STATES.VICTORY) {
      this._stopVictoryAnim();
    }
  }

  // =========================================================================
  // STORY CUTSCENE SLIDES
  // =========================================================================
  showStorySlide(index) {
    const slides = STORY_SLIDES.INTRO;
    if (index < 0 || index >= slides.length) return;
    this.currentStoryIndex = index;
    const slide = slides[index];

    if (this.storyStepBadge) this.storyStepBadge.textContent = `CỐT TRUYỆN • ${index + 1}/${slides.length}`;
    if (this.storySlideTitle) this.storySlideTitle.textContent = slide.title;
    if (this.storySlideText) this.storySlideText.textContent = slide.text;
    if (this.storySlideEn) this.storySlideEn.textContent = slide.enText;

    if (this.btnStoryNext) {
      this.btnStoryNext.innerHTML = `<span>${slide.actionPrompt || 'Tiếp Tục ➜'}</span>`;
    }
    if (this.btnStoryPrev) {
      this.btnStoryPrev.style.visibility = index === 0 ? 'hidden' : 'visible';
    }

    // Update dots
    if (this.storyDots) {
      const dots = this.storyDots.querySelectorAll('.story-dot');
      dots.forEach((d, i) => {
        if (i === index) d.classList.add('active');
        else d.classList.remove('active');
      });
    }

    StoryCanvasRenderer.renderSlide(this.storyCanvas, index, performance.now() / 1000);
  }

  _startStoryAnim() {
    this._stopStoryAnim();
    const tick = () => {
      const time = performance.now() / 1000;
      StoryCanvasRenderer.renderSlide(this.storyCanvas, this.currentStoryIndex, time);
      this._storyAnimHandle = requestAnimationFrame(tick);
    };
    this._storyAnimHandle = requestAnimationFrame(tick);
  }

  _stopStoryAnim() {
    if (this._storyAnimHandle) {
      cancelAnimationFrame(this._storyAnimHandle);
      this._storyAnimHandle = null;
    }
  }

  // =========================================================================
  // VICTORY CUTSCENE
  // =========================================================================
  _startVictoryAnim() {
    this._stopVictoryAnim();
    const tick = () => {
      const time = performance.now() / 1000;
      StoryCanvasRenderer.renderVictory(this.victoryCanvas, time);
      this._victoryAnimHandle = requestAnimationFrame(tick);
    };
    this._victoryAnimHandle = requestAnimationFrame(tick);
  }

  _stopVictoryAnim() {
    if (this._victoryAnimHandle) {
      cancelAnimationFrame(this._victoryAnimHandle);
      this._victoryAnimHandle = null;
    }
  }

  // =========================================================================
  // LEVEL TRANSITION BANNER (CHUẨN BỊ SẴN SÀNG... VẼ!)
  // =========================================================================
  showLevelTransition(levelNum, levelData) {
    if (!this.levelTransitionBanner) return;

    clearTimeout(this._ltbTimeout);
    clearTimeout(this._ltbDrawTimeout);

    if (this.ltbNumber) this.ltbNumber.textContent = `CẤP ĐỘ ${levelNum}`;
    if (this.ltbTitle) this.ltbTitle.textContent = levelData ? levelData.name.toUpperCase() : `ĐỢT ${levelNum}`;
    if (this.ltbEn) this.ltbEn.textContent = levelData ? levelData.enName.toUpperCase() : 'ENDLESS WAVE';

    // Phase 1: Chuẩn bị sẵn sàng! (Get Ready!)
    if (this.ltbPrompt) {
      this.ltbPrompt.textContent = (levelNum === 5)
        ? '🧹 MOMO CƯỠI CHỔI THẦN! ⚡'
        : '⚡ CHUẨN BỊ SẴN SÀNG! ⚡';
    }
    this.levelTransitionBanner.className = 'level-transition-banner show phase-ready';

    if (this.game && this.game.player) {
      this.game.player.setDrawing(true);
    }
    if (this.game && this.game.audioSystem) {
      if (typeof this.game.audioSystem.playStart === 'function') {
        this.game.audioSystem.playStart();
      }
    }

    // Phase 2: VẼ! (DRAW!) - explosive action trigger at 1000ms
    this._ltbDrawTimeout = setTimeout(() => {
      if (!this.levelTransitionBanner) return;
      this.levelTransitionBanner.className = 'level-transition-banner show phase-draw';
      if (this.ltbPrompt) this.ltbPrompt.textContent = '🔥 VẼ! 🔥';

      if (this.game) {
        this.game.triggerShake(12, 0.4);
        if (this.game.particleSystem) {
          this.game.particleSystem.emitHitBurst(this.game.width / 2, this.game.height * 0.4, '#fbbf24', 28);
        }
        if (this.game.audioSystem) {
          if (typeof this.game.audioSystem.playSpell === 'function') {
            this.game.audioSystem.playSpell('horizontal');
          }
        }
        if (this.game.player) {
          this.game.player.setDrawing(false);
        }
      }
    }, 1000);

    // Phase 3: Banner fades out, game actions intensify!
    this._ltbTimeout = setTimeout(() => {
      if (this.levelTransitionBanner) {
        this.levelTransitionBanner.className = 'level-transition-banner';
      }
      // If Level 1 and tutorial has not been completed, automatically prompt tutorial
      if (levelNum === 1 && !this._hasCompletedTutorial()) {
        this.showTutorial(1);
      }
    }, 2100);
  }

  showLevelComplete(levelNum, levelData) {
    if (!this.levelTransitionBanner) return;

    clearTimeout(this._ltbTimeout);
    clearTimeout(this._ltbDrawTimeout);

    this.levelTransitionBanner.className = 'level-transition-banner show phase-clear';
    if (this.ltbNumber) this.ltbNumber.textContent = `🎉 HOÀN THÀNH CẤP ĐỘ ${levelNum}! 🎉`;
    if (this.ltbTitle) this.ltbTitle.textContent = levelData ? levelData.name.toUpperCase() : 'KHU VỰC ĐÃ GIẢI CỨU';
    if (this.ltbEn) this.ltbEn.textContent = 'STAGE COMPLETED!';
    if (this.ltbPrompt) this.ltbPrompt.textContent = '✨ CHUẨN BỊ TIẾN VÀO KHU VỰC MỚI... ✨';

    this._ltbTimeout = setTimeout(() => {
      if (this.levelTransitionBanner) {
        this.levelTransitionBanner.className = 'level-transition-banner';
      }
    }, 2400);
  }

  // =========================================================================
  // LEVEL 1 TUTORIAL GUIDE MANAGEMENT
  // =========================================================================
  _hasCompletedTutorial() {
    try {
      return localStorage.getItem(STORAGE_KEYS.TUTORIAL_COMPLETED) === 'true';
    } catch (e) {
      return false;
    }
  }

  showTutorial(step = 1) {
    if (!this.tutorialOverlay) return;
    this.tutorialOverlay.classList.add('show');

    if (step === 1) {
      if (this.tutorialStep1) this.tutorialStep1.classList.remove('hidden');
      if (this.tutorialStep2) this.tutorialStep2.classList.add('hidden');
    } else if (step === 2) {
      if (this.tutorialStep1) this.tutorialStep1.classList.add('hidden');
      if (this.tutorialStep2) this.tutorialStep2.classList.remove('hidden');
    }

    if (this.game) {
      this.game.isTutorialActive = true;
      this.game.tutorialStep = step;
    }
  }

  advanceTutorial(nextStep) {
    if (nextStep >= 3) {
      this.hideTutorial();
    } else {
      this.showTutorial(nextStep);
    }
  }

  hideTutorial() {
    if (this.tutorialOverlay) {
      this.tutorialOverlay.classList.remove('show');
    }
    if (this.game) {
      this.game.isTutorialActive = false;
      this.game.tutorialStep = 0;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.TUTORIAL_COMPLETED, 'true');
    } catch (e) {}
  }

  // =========================================================================
  // HUD UPDATES
  // =========================================================================
  updateLevel(levelNum, levelData) {
    if (this.waveBadge) {
      this.waveBadge.textContent = levelData ? `CẤP ${levelNum}: ${levelData.name.toUpperCase()}` : `ĐỢT ${levelNum}`;
    }
    if (this.levelSubBadge) {
      this.levelSubBadge.textContent = levelData ? levelData.enName : 'Vô Tận (Endless)';
    }
  }

  updateWave(waveNum) {
    if (this.waveBadge && !this.game.waveSystem.levelData) {
      this.waveBadge.textContent = `WAVE ${waveNum}`;
    }
  }

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

  updateScore(score) {
    if (this.scoreVal) {
      this.scoreVal.textContent = Math.round(score).toLocaleString();
    }
  }

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
