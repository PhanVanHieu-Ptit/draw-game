/**
 * @file UIManager.js
 * @description Manages HTML5 UI overlays, HUD updates, 5-level stage selection,
 * level transition banners (Ready... Set... Draw!), Story Cutscenes, and Victory screens.
 */

import { GAME_STATES, RUNES, LEVEL_CONFIGS, STORY_SLIDES, STORY_CHAPTERS, STORAGE_KEYS, ACADEMY_CHARACTERS, DIFFICULTY_LEVELS, INTRO_TIMING } from '../core/Constants.js';
import { loreSummary } from '../core/Lore.js';
import { StoryCanvasRenderer } from './StoryCanvasRenderer.js';
import { getCharacterPortraitSvg, CHARACTER_LORE_DATA, getCompanionForLevel } from './CharacterPortraits.js';
import { renderWizardCard, downloadCardImage, copyCardImageToClipboard, getChallengeUrl } from './WizardCardRenderer.js';
import { MetaUI, PAD_ORDER } from './MetaUI.js';
import { buildDailyChallengeUrl } from '../core/Challenge.js';

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
      [GAME_STATES.VICTORY]: document.getElementById('victory-screen'),
      [GAME_STATES.PRACTICE]: document.getElementById('practice-screen')
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
    this.gestureHint = document.getElementById('gesture-hint');

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
    this.tabTutStep = document.getElementById('tab-btn-tut-step');
    this.tabTutSpells = document.getElementById('tab-btn-tut-spells');
    this.tutStepView = document.getElementById('tutorial-step-view');
    this.tutSpellsView = document.getElementById('tutorial-spells-view');

    // Menu Elements
    this.menuHighScore = document.getElementById('menu-high-score');
    this.stageButtons = document.querySelectorAll('.stage-btn');
    this.selectedStage = 1;

    // Difficulty Selection Elements
    this.diffButtons = document.querySelectorAll('.diff-btn');
    this.pauseDiffButtons = document.querySelectorAll('.pause-diff-btn');
    this.diffDescBox = document.getElementById('diff-desc-box');
    this.hudDiffPill = document.getElementById('hud-diff-pill');

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
    this.storyChapterBar = document.getElementById('story-chapter-bar');
    this.storyDialogueCallout = document.getElementById('story-dialogue-callout');
    this.sdcCompIcon = document.getElementById('sdc-comp-icon');
    this.sdcCompName = document.getElementById('sdc-comp-name');
    this.sdcCompQuote = document.getElementById('sdc-comp-quote');
    this.sdcBossIcon = document.getElementById('sdc-boss-icon');
    this.sdcBossName = document.getElementById('sdc-boss-name');
    this.sdcBossQuote = document.getElementById('sdc-boss-quote');
    this.btnStoryPlayLevel = document.getElementById('btn-story-play-level');
    this.storyScreen = this.screens[GAME_STATES.STORY];
    this.storyTruePill = document.getElementById('story-true-pill');
    this.isStoryPreviewMode = false;
    // Endings (victory / true ending) can play as an overlay on top of the Victory screen or the journal
    this._endingOverlay = false;
    this._endingQueue = [];
    this._endingReplay = false;
    this._endingSlide = 0;
    this.currentStoryAct = 'intro'; // 'intro' | 'chapter' | 'victory' | 'trueEnding'
    this.currentChapterIndex = 1;
    this.currentRenderSlideIndex = 0;
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

    // In-Game Dialogue Toast Elements
    this.dialogueToast = document.getElementById('in-game-dialogue-toast');
    this.diagAvatar = document.getElementById('diag-avatar');
    this.diagAvatarWrap = document.getElementById('diag-avatar-wrap');
    this.diagName = document.getElementById('diag-name');
    this.diagRole = document.getElementById('diag-role');
    this.diagText = document.getElementById('diag-text');
    this.diagClose = document.getElementById('diag-close');
    this._dialogueTimeout = null;

    // Companion Badge Elements (Playing HUD)
    this.hudCompanionBadge = document.getElementById('hud-companion-badge');
    this.companionAvatarWrap = document.getElementById('companion-avatar-wrap');
    this.companionName = document.getElementById('companion-name');
    this.companionDesc = document.getElementById('companion-desc');
    this.currentLevelNum = 1;

    // Codex Screen Elements
    this.codexScreen = document.getElementById('codex-screen');
    this.btnOpenCodex = document.getElementById('btn-open-codex');
    this.btnCloseCodex = document.getElementById('btn-close-codex');
    this.codexTabs = document.getElementById('codex-tabs');
    this.codexGrid = document.getElementById('codex-grid');
    this.currentCodexFilter = 'all';

    // Wizard Cat License / Share Card Elements
    this.wizardCardModal = document.getElementById('wizard-card-modal');
    this.wizardCardCanvas = document.getElementById('wizardCardCanvas');
    this.wizardCardToast = document.getElementById('wizard-card-toast');
    this.btnCloseWizardCard = document.getElementById('btn-close-wizard-card');
    this.btnDownloadCard = document.getElementById('btn-download-card');
    this.btnCopyCardImg = document.getElementById('btn-copy-card-img');
    this.btnCopyChallengeLink = document.getElementById('btn-copy-challenge-link');
    this.btnVicWizardCard = document.getElementById('btn-vic-wizard-card');
    this.btnGoWizardCard = document.getElementById('btn-go-wizard-card');
    this.btnMenuWizardCard = document.getElementById('btn-menu-wizard-card');
    this._lastCardData = null;
    this._toastTimeout = null;

    this._bindButtonEvents();
    this._bindKeyboardEvents();
    this._bindStageSelector();

    // Settings, records, daily challenge, companions, upgrade picker, practice HUD, toasts...
    this.meta = new MetaUI(this);
    this._syncMuteButton(this.game.settings.get('muted'));
    this.game.settings.onChange((key, value) => {
      if (key === 'muted') this._syncMuteButton(value);
      if (key === 'altInput') this.meta.applyAltInput();
      if (key === 'assist') this.meta.applyAssistBadge();
    });
  }

  /** Keep the HUD speaker icon in step with the mute setting (it can also be changed in Settings) */
  _syncMuteButton(muted) {
    const btn = document.getElementById('btn-mute');
    if (!btn) return;
    btn.textContent = muted ? '🔇' : '🔊';
    btn.title = muted ? 'Bật âm thanh' : 'Tắt âm thanh';
  }

  _bindButtonEvents() {
    // Menu Buttons
    const btnStartStory = document.getElementById('btn-start-story');
    if (btnStartStory) {
      btnStartStory.addEventListener('click', () => {
        this.game.audioSystem.init();
        this.game.audioSystem.playStart();
        if (typeof this.game.audioSystem.playCatMeow === 'function') {
          setTimeout(() => this.game.audioSystem.playCatMeow('cheerful'), 180);
        }
        // Start from Story Cutscene, then into Selected Level
        this.game.stateMachine.changeState(GAME_STATES.STORY, { startLevel: this.selectedStage });
      });
    }

    const btnStartEndless = document.getElementById('btn-start-endless');
    if (btnStartEndless) {
      btnStartEndless.addEventListener('click', () => {
        this.game.audioSystem.init();
        this.game.audioSystem.playStart();
        if (typeof this.game.audioSystem.playCatMeow === 'function') {
          setTimeout(() => this.game.audioSystem.playCatMeow('cheerful'), 180);
        }
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
        if (this.currentStoryAct === 'intro') {
          const slides = STORY_SLIDES.INTRO;
          if (this.currentStoryIndex < slides.length - 1) {
            this.showStorySlide(this.currentStoryIndex + 1);
          } else if (this.isStoryPreviewMode) {
            // In preview mode, advance into Chapter 1
            this.showStoryChapter(1);
          } else {
            // Finished slides -> Launch Game into Level!
            this.game.audioSystem.playStart();
            this.game.waveSystem.setMode('STORY');
            this.game.stateMachine.changeState(GAME_STATES.PLAYING, {
              resetData: true,
              startLevel: this.selectedStage || 1
            });
          }
        } else if (this.currentStoryAct === 'chapter') {
          if (this.currentChapterIndex < 5) {
            this.showStoryChapter(this.currentChapterIndex + 1);
          } else {
            // After chapter 5, show Victory!
            this.showStoryVictorySlide(0);
          }
        } else if (this.currentStoryAct === 'victory') {
          const vicSlides = STORY_SLIDES.VICTORY;
          if (this.currentStoryIndex < vicSlides.length - 1) {
            this.showStoryVictorySlide(this.currentStoryIndex + 1);
          } else if (this._endingOverlay) {
            this._nextEnding();
          } else {
            this.game.stateMachine.changeState(GAME_STATES.MENU);
          }
        } else if (this.currentStoryAct === 'trueEnding') {
          if (this.currentStoryIndex < STORY_SLIDES.TRUE_ENDING.length - 1) {
            this.showStoryEndingSlide(this.currentStoryIndex + 1);
          } else if (this._endingOverlay) {
            this._nextEnding();
          } else {
            this.game.stateMachine.changeState(GAME_STATES.MENU);
          }
        }
      });
    }

    if (this.btnStoryPrev) {
      this.btnStoryPrev.addEventListener('click', () => {
        if (this.currentStoryAct === 'intro') {
          if (this.currentStoryIndex > 0) {
            this.showStorySlide(this.currentStoryIndex - 1);
          }
        } else if (this.currentStoryAct === 'chapter') {
          if (this.currentChapterIndex > 1) {
            this.showStoryChapter(this.currentChapterIndex - 1);
          } else {
            this.showStorySlide(2);
          }
        } else if (this.currentStoryAct === 'victory') {
          if (this.currentStoryIndex > 0) {
            this.showStoryVictorySlide(this.currentStoryIndex - 1);
          } else if (!this._endingOverlay) {
            this.showStoryChapter(5);
          }
        } else if (this.currentStoryAct === 'trueEnding') {
          if (this.currentStoryIndex > 0) {
            this.showStoryEndingSlide(this.currentStoryIndex - 1);
          } else if (!this._endingOverlay) {
            this.showStoryVictorySlide(STORY_SLIDES.VICTORY.length - 1);
          }
        }
      });
    }

    if (this.btnSkipStory) {
      this.btnSkipStory.addEventListener('click', () => {
        if (this._endingOverlay) {
          this.closeEnding();
        } else if (this.isStoryPreviewMode) {
          this.game.stateMachine.changeState(GAME_STATES.MENU);
        } else {
          this.game.audioSystem.playStart();
          this.game.waveSystem.setMode('STORY');
          this.game.stateMachine.changeState(GAME_STATES.PLAYING, {
            resetData: true,
            startLevel: this.selectedStage || 1
          });
        }
      });
    }

    // Story Chapter Navigation Bar Pills
    if (this.storyChapterBar) {
      const chapBtns = this.storyChapterBar.querySelectorAll('.story-chap-btn');
      chapBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const act = btn.getAttribute('data-act');
          if (act === 'intro') {
            this.showStorySlide(0);
          } else if (act === 'chapter') {
            const chapNum = parseInt(btn.getAttribute('data-chap'), 10) || 1;
            this.showStoryChapter(chapNum);
          } else if (act === 'victory') {
            this.showStoryVictorySlide(0);
          } else if (act === 'trueEnding') {
            this.showStoryEndingSlide(0);
          }
        });
      });
    }

    // Play Level button from story chapter review
    if (this.btnStoryPlayLevel) {
      this.btnStoryPlayLevel.addEventListener('click', () => {
        this.game.audioSystem.playStart();
        this.game.waveSystem.setMode('STORY');
        this.game.stateMachine.changeState(GAME_STATES.PLAYING, {
          resetData: true,
          startLevel: this.currentChapterIndex || 1
        });
      });
    }

    // Victory Screen Buttons
    const btnVicReplay = document.getElementById('btn-vic-replay-story');
    if (btnVicReplay) {
      btnVicReplay.addEventListener('click', () => {
        this.game.audioSystem.playStart();
        if (typeof this.game.audioSystem.playCatMeow === 'function') {
          setTimeout(() => this.game.audioSystem.playCatMeow('cheerful'), 180);
        }
        this.game.bossRush = false; // "replay story" after a Boss Rush must be the real Story
        this.game.waveSystem.setMode('STORY');
        this.game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true, startLevel: 1 });
      });
    }

    const btnVicEndless = document.getElementById('btn-vic-play-endless');
    if (btnVicEndless) {
      btnVicEndless.addEventListener('click', () => {
        this.game.audioSystem.playStart();
        if (typeof this.game.audioSystem.playCatMeow === 'function') {
          setTimeout(() => this.game.audioSystem.playCatMeow('cheerful'), 180);
        }
        this.game.bossRush = false;
        this.game.waveSystem.setMode('ENDLESS');
        this.game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
      });
    }

    // Codex Buttons & Tabs
    if (this.btnOpenCodex) {
      this.btnOpenCodex.addEventListener('click', () => {
        this.openCodex();
      });
    }

    if (this.btnCloseCodex) {
      this.btnCloseCodex.addEventListener('click', () => {
        this.closeCodex();
      });
    }

    if (this.codexTabs) {
      const tabBtns = this.codexTabs.querySelectorAll('.codex-tab-btn');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.getAttribute('data-filter') || 'all';
          this.renderCodex(filter);
        });
      });
    }

    // Dialogue Toast Click to dismiss
    if (this.dialogueToast) {
      this.dialogueToast.addEventListener('click', () => {
        this.hideDialogue();
      });
    }

    if (this.diagClose) {
      this.diagClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideDialogue();
      });
    }

    if (this.hudCompanionBadge) {
      this.hudCompanionBadge.addEventListener('click', () => {
        this._onCompanionClicked();
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
        if (typeof this.game.audioSystem.playCatMeow === 'function') {
          setTimeout(() => this.game.audioSystem.playCatMeow('cheerful'), 180);
        }
        this.game.resetGameData();
        this.game.stateMachine.changeState(GAME_STATES.PLAYING);
      });
    }

    // Wizard Card Share Buttons & Controls
    if (this.btnMenuWizardCard) {
      this.btnMenuWizardCard.addEventListener('click', () => {
        this.showWizardCard({ isHighScorePreview: true });
      });
    }

    if (this.btnVicWizardCard) {
      this.btnVicWizardCard.addEventListener('click', () => {
        this.showWizardCard(this._lastCardData || { isVictory: true });
      });
    }

    if (this.btnGoWizardCard) {
      this.btnGoWizardCard.addEventListener('click', () => {
        this.showWizardCard(this._lastCardData || { isVictory: false });
      });
    }

    if (this.btnCloseWizardCard) {
      this.btnCloseWizardCard.addEventListener('click', () => {
        this.hideWizardCard();
      });
    }

    if (this.btnDownloadCard) {
      this.btnDownloadCard.addEventListener('click', () => {
        const score = this.wizardCardCanvas?.__cardScore || this.game.score || 0;
        downloadCardImage(this.wizardCardCanvas, `the-phap-su-momo-${score}.png`);
        this.showCardToast('📥 Đang tải ảnh Thẻ Pháp Sư về máy...');
      });
    }

    if (this.btnCopyCardImg) {
      this.btnCopyCardImg.addEventListener('click', async () => {
        this.showCardToast('⏳ Đang sao chép ảnh thẻ...');
        const ok = await copyCardImageToClipboard(this.wizardCardCanvas);
        if (ok) {
          this.showCardToast('✅ Đã sao chép ảnh thẻ vào bộ nhớ tạm!');
        } else {
          this.showCardToast('⚠️ Đã sao chép thông điệp thách đấu!');
        }
      });
    }

    if (this.btnCopyChallengeLink) {
      this.btnCopyChallengeLink.addEventListener('click', async () => {
        const score = this.wizardCardCanvas?.__cardScore || this.game.score || 0;
        // A daily-challenge card links to that day's challenge; anything else uses the plain score link
        const dailyKey = this._lastCardData && this._lastCardData.dailyKey;
        const url = dailyKey
          ? buildDailyChallengeUrl(getChallengeUrl(0, 'Momo'), dailyKey, score, 'Momo')
          : getChallengeUrl(score, 'Momo');
        try {
          await navigator.clipboard.writeText(url);
          this.showCardToast('⚔️ Đã sao chép link thách đấu vào bộ nhớ tạm!');
        } catch (e) {
          this.showCardToast(`Link: ${url}`);
        }
      });
    }

    // Tutorial Controls
    if (this.btnSkipTutorial) {
      this.btnSkipTutorial.addEventListener('click', () => {
        this.hideTutorial();
      });
    }

    if (this.tabTutStep && this.tabTutSpells) {
      this.tabTutStep.addEventListener('click', () => {
        this.switchTutorialTab('step');
      });
      this.tabTutSpells.addEventListener('click', () => {
        this.switchTutorialTab('spells');
      });
    }

    if (this.btnTutorialHUD) {
      this.btnTutorialHUD.addEventListener('click', () => {
        const isAdvancedLevel = this.game && this.game.waveSystem && this.game.waveSystem.currentLevelIndex > 1;
        this.showTutorial(1, isAdvancedLevel);
      });
    }

    // Audio Mute toggle
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        // The setting is the single source of truth; its listener updates the audio and the icon
        this.game.settings.set('muted', !this.game.settings.get('muted'));
      });
    }

    // Difficulty Buttons (Menu)
    if (this.diffButtons) {
      this.diffButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const diff = btn.getAttribute('data-diff') || 'NORMAL';
          this.game.setDifficulty(diff);
          if (this.game.audioSystem && typeof this.game.audioSystem.playSpell === 'function') {
            this.game.audioSystem.playSpell('horizontal');
          }
        });
      });
    }

    // Difficulty Buttons (Pause)
    if (this.pauseDiffButtons) {
      this.pauseDiffButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const diff = btn.getAttribute('data-diff') || 'NORMAL';
          this.game.setDifficulty(diff);
          if (this.game.audioSystem && typeof this.game.audioSystem.playSpell === 'function') {
            this.game.audioSystem.playSpell('horizontal');
          }
        });
      });
    }

    this.updateDifficultyUI(this.game.difficulty || 'NORMAL');
  }

  /**
   * Synchronize difficulty selector buttons, description, and HUD badge
   * @param {string} difficulty 
   */
  updateDifficultyUI(difficulty = 'NORMAL') {
    const diffInfo = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.NORMAL;

    if (this.diffButtons) {
      this.diffButtons.forEach(btn => {
        const d = btn.getAttribute('data-diff');
        if (d === difficulty) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    if (this.pauseDiffButtons) {
      this.pauseDiffButtons.forEach(btn => {
        const d = btn.getAttribute('data-diff');
        if (d === difficulty) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    if (this.diffDescBox) {
      this.diffDescBox.textContent = diffInfo.description;
    }

    if (this.hudDiffPill) {
      this.hudDiffPill.textContent = diffInfo.badge;
      this.hudDiffPill.className = `hud-diff-pill diff-${difficulty.toLowerCase()}`;
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
      // Close wizard card popup if open
      if (e.key === 'Escape' && this.wizardCardModal && this.wizardCardModal.classList.contains('active')) {
        this.hideWizardCard();
        return;
      }

      // An ending playing over the Victory screen / journal: Enter goes on, Esc closes it
      if (this._endingOverlay) {
        if (e.key === 'Escape') this.closeEnding();
        else if (e.key === 'Enter' && this.btnStoryNext) this.btnStoryNext.click();
        return;
      }

      // Upgrade picker: keys 1-3 choose a card
      if (this.meta.isUpgradeOpen()) {
        const idx = ['1', '2', '3'].indexOf(e.key);
        if (idx >= 0) this.meta.chooseUpgradeByIndex(idx);
        return;
      }

      // Settings / records / daily / companions / codex: Esc closes the top one, other keys are not for the game
      if (e.key === 'Escape' && this.meta.closeTopOverlay()) return;
      if (this.meta.hasOpenOverlay()) return;

      const stateNow = this.game.stateMachine.getCurrentStateName();

      // Practice Mode: Esc leaves
      if (stateNow === GAME_STATES.PRACTICE) {
        if (e.key.toLowerCase() === 'r') this.game.inputHandler.replayLastStroke();
        if (e.key === 'Escape') this.game.quitToMenu();
        return;
      }

      // Alternative input: keys 1-8 cast a rune for players who cannot draw
      if (stateNow === GAME_STATES.PLAYING && this.game.settings.get('altInput')) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= PAD_ORDER.length) {
          this.game.castRune(PAD_ORDER[n - 1]);
          return;
        }
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        const currentState = this.game.stateMachine.getCurrentStateName();
        if (currentState === GAME_STATES.PLAYING) {
          this.game.stateMachine.changeState(GAME_STATES.PAUSE);
        } else if (currentState === GAME_STATES.PAUSE) {
          this.game.stateMachine.changeState(GAME_STATES.PLAYING);
        }
      }

      if (e.key === 'Enter') {
        const currentState = this.game.stateMachine.getCurrentStateName();
        if (currentState === GAME_STATES.MENU || currentState === GAME_STATES.GAMEOVER) {
          this.game.audioSystem.init();
          this.game.audioSystem.playStart();
          // Enter on the main menu starts the primary mode (Story); after a game over it retries the same mode.
          if (currentState === GAME_STATES.MENU) {
            this.game.waveSystem.setMode('STORY');
          }
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
      this.meta.updateMenu();
      this._stopStoryAnim();
      this._stopVictoryAnim();
    } else if (stateName === GAME_STATES.STORY) {
      this.isStoryPreviewMode = !!payload.previewOnly;
      if (this.storyTruePill && this.storyTruePill.classList) {
        if (loreSummary(this.game.progress).ready) this.storyTruePill.classList.remove('hidden');
        else this.storyTruePill.classList.add('hidden');
      }
      if (this.btnSkipStory) {
        this.btnSkipStory.textContent = this.isStoryPreviewMode ? 'Về Menu ✕' : 'Bỏ qua ➔';
      }
      if (payload.startChapter) {
        this.showStoryChapter(payload.startChapter);
      } else {
        this.currentStoryIndex = 0;
        this.showStorySlide(0);
      }
      this._startStoryAnim();
    } else if (stateName === GAME_STATES.VICTORY) {
      this._stopStoryAnim();
      this._startVictoryAnim();

      this._lastCardData = {
        score: payload.score || this.game.score || 0,
        highScore: payload.highScore || this.game.highScore || 0,
        accuracy: payload.accuracy !== undefined ? payload.accuracy : 100,
        spellsCast: payload.spellsCast || this.game.metrics.spellsCast,
        spellsHit: payload.spellsHit || this.game.metrics.spellsHit,
        damageTaken: payload.damageTaken !== undefined ? payload.damageTaken : this.game.metrics.damageTaken,
        enemiesDefeated: payload.enemiesDefeated || this.game.metrics.enemiesDefeated,
        maxCombo: payload.maxCombo || this.game.metrics.maxCombo || this.game.comboCount || 1,
        elapsedSeconds: payload.elapsedSeconds || 180,
        levelReached: 5,
        isVictory: true,
        difficulty: payload.difficulty || this.game.difficulty || 'NORMAL',
        dailyKey: payload.summary && payload.summary.daily ? payload.summary.daily.key : undefined
      };

      if (this.vicScore) this.vicScore.textContent = (payload.score || 0).toLocaleString();
      if (this.vicHighScore) this.vicHighScore.textContent = (payload.highScore || 0).toLocaleString();
      if (this.vicStages) this.vicStages.textContent = '5/5 (100%)';
      if (this.vicAccuracy) this.vicAccuracy.textContent = `${payload.accuracy || 100}%`;
      if (payload.summary) {
        this.meta.setLastRun(payload.summary);
        this.meta.renderRunSummary('vic-summary', payload.summary);
      }
      this.meta.renderVictoryLore(payload.summary);
    } else if (stateName === GAME_STATES.GAMEOVER) {
      this._stopStoryAnim();
      this._stopVictoryAnim();

      this._lastCardData = {
        score: payload.score || this.game.score || 0,
        highScore: payload.highScore || this.game.highScore || 0,
        accuracy: payload.accuracy !== undefined ? payload.accuracy : 100,
        spellsCast: payload.spellsCast || this.game.metrics.spellsCast,
        spellsHit: payload.spellsHit || this.game.metrics.spellsHit,
        damageTaken: payload.damageTaken !== undefined ? payload.damageTaken : this.game.metrics.damageTaken,
        enemiesDefeated: payload.enemiesDefeated || this.game.metrics.enemiesDefeated,
        maxCombo: payload.maxCombo || this.game.metrics.maxCombo || this.game.comboCount || 1,
        elapsedSeconds: payload.elapsedSeconds || 60,
        levelReached: payload.wave || this.game.waveSystem.currentLevel || 1,
        isVictory: false,
        difficulty: payload.difficulty || this.game.difficulty || 'NORMAL',
        dailyKey: payload.summary && payload.summary.daily ? payload.summary.daily.key : undefined
      };

      if (this.goScore) this.goScore.textContent = (payload.score || 0).toLocaleString();
      if (this.goHighScore) this.goHighScore.textContent = (payload.highScore || 0).toLocaleString();
      if (this.goWave) this.goWave.textContent = payload.wave || 1;
      if (this.goAccuracy) this.goAccuracy.textContent = `${payload.accuracy || 100}%`;
      if (this.goNewRecord) {
        this.goNewRecord.style.display = payload.isNewHighScore ? 'inline-block' : 'none';
      }
      if (payload.summary) {
        this.meta.setLastRun(payload.summary);
        this.meta.renderRunSummary('go-summary', payload.summary);
      }
    } else if (stateName === GAME_STATES.PLAYING) {
      this._stopStoryAnim();
      this._stopVictoryAnim();
      this.meta.applyAltInput();
      this.meta.applyAssistBadge();
      this.meta.renderBuffs(this.game.upgrades);
    } else if (stateName === GAME_STATES.PAUSE) {
      // Endless runs are saved automatically at every wave: tell the player they can leave safely
      const ws = this.game.waveSystem;
      this.meta._hidden('pause-save-note', !(ws.gameMode === 'ENDLESS' && !this.game.challenge));
    } else if (stateName === GAME_STATES.PRACTICE) {
      this._stopStoryAnim();
      this._stopVictoryAnim();
      this.meta.refreshPractice();
    }
  }

  hideScreen(stateName) {
    if (stateName === GAME_STATES.VICTORY) this.closeEnding();
    const target = this.screens[stateName];
    if (target) {
      target.classList.remove('active');
    }
    this.hideDialogue();
    if (stateName === GAME_STATES.STORY) {
      this._stopStoryAnim();
    } else if (stateName === GAME_STATES.VICTORY) {
      this._stopVictoryAnim();
    }
  }

  // =========================================================================
  // STORY CUTSCENE SLIDES & CHAPTER REVIEW
  // =========================================================================
  showStorySlide(index) {
    const slides = STORY_SLIDES.INTRO;
    if (index < 0 || index >= slides.length) return;
    this.currentStoryAct = 'intro';
    this.currentStoryIndex = index;
    this.currentRenderSlideIndex = index;
    const slide = slides[index];

    if (this.storyStepBadge) this.storyStepBadge.textContent = `KHỞI ĐẦU • ${index + 1}/${slides.length}`;
    if (this.storySlideTitle) this.storySlideTitle.textContent = slide.title;
    if (this.storySlideText) this.storySlideText.textContent = slide.text;
    if (this.storySlideEn) this.storySlideEn.textContent = slide.enText;

    if (this.storyDialogueCallout) this.storyDialogueCallout.classList.add('hidden');
    if (this.btnStoryPlayLevel) this.btnStoryPlayLevel.classList.add('hidden');

    if (this.btnStoryNext) {
      if (this.isStoryPreviewMode && index === slides.length - 1) {
        this.btnStoryNext.innerHTML = `<span>Xem Màn 1 ➜</span>`;
      } else {
        this.btnStoryNext.innerHTML = `<span>${slide.actionPrompt || 'Tiếp Tục ➜'}</span>`;
      }
    }
    if (this.btnStoryPrev) {
      this.btnStoryPrev.style.visibility = index === 0 ? 'hidden' : 'visible';
    }

    this._updateStoryPills('intro');

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

  showStoryChapter(chapNum) {
    const chapter = STORY_CHAPTERS.find(c => c.chapter === chapNum) || STORY_CHAPTERS[0];
    if (!chapter) return;
    this.currentStoryAct = 'chapter';
    this.currentChapterIndex = chapNum;
    this.currentRenderSlideIndex = chapter.slideIndex;

    if (this.storyStepBadge) this.storyStepBadge.textContent = chapter.badge;
    if (this.storySlideTitle) this.storySlideTitle.textContent = chapter.title;
    if (this.storySlideText) this.storySlideText.textContent = chapter.text;
    if (this.storySlideEn) this.storySlideEn.textContent = chapter.enText;

    // Show dialogue quotes callout
    if (this.storyDialogueCallout) {
      this.storyDialogueCallout.classList.remove('hidden');
      if (this.sdcCompIcon) this.sdcCompIcon.textContent = chapter.companion.icon;
      if (this.sdcCompName) this.sdcCompName.textContent = `${chapter.companion.name}:`;
      if (this.sdcCompQuote) this.sdcCompQuote.textContent = `“${chapter.quotes.intro}”`;
      if (this.sdcBossIcon) this.sdcBossIcon.textContent = chapter.bossIcon;
      if (this.sdcBossName) this.sdcBossName.textContent = `${chapter.bossName}:`;
      if (this.sdcBossQuote) this.sdcBossQuote.textContent = `“${chapter.quotes.boss}”`;
    }

    if (this.btnStoryPlayLevel) {
      this.btnStoryPlayLevel.classList.remove('hidden');
      this.btnStoryPlayLevel.textContent = `CHƠI MÀN ${chapNum} ⚔️`;
    }

    if (this.btnStoryNext) {
      this.btnStoryNext.innerHTML = `<span>${chapNum < 5 ? `Chương ${chapNum + 1} ➜` : 'Hồi Kết ➜'}</span>`;
    }
    if (this.btnStoryPrev) {
      this.btnStoryPrev.style.visibility = 'visible';
    }

    this._updateStoryPills('chapter', chapNum);

    StoryCanvasRenderer.renderSlide(this.storyCanvas, chapter.slideIndex, performance.now() / 1000);
  }

  showStoryVictorySlide(index) {
    const slides = STORY_SLIDES.VICTORY;
    if (index < 0 || index >= slides.length) return;
    this.currentStoryAct = 'victory';
    this.currentStoryIndex = index;
    this.currentRenderSlideIndex = 'victory';
    const slide = slides[index];

    if (this.storyStepBadge) this.storyStepBadge.textContent = `HỒI KẾT CHIẾN THẮNG • ${index + 1}/${slides.length}`;
    if (this.storySlideTitle) this.storySlideTitle.textContent = slide.title;
    if (this.storySlideText) this.storySlideText.textContent = slide.text;
    if (this.storySlideEn) this.storySlideEn.textContent = slide.enText;

    if (this.storyDialogueCallout) this.storyDialogueCallout.classList.add('hidden');
    if (this.btnStoryPlayLevel) this.btnStoryPlayLevel.classList.add('hidden');

    if (this.btnStoryNext) {
      const last = index >= slides.length - 1;
      this.btnStoryNext.innerHTML = `<span>${last ? this._endingLastLabel('Về Menu 🏠') : 'Tiếp Tục ➜'}</span>`;
    }
    if (this.btnStoryPrev) {
      this.btnStoryPrev.style.visibility = this._endingOverlay && index === 0 ? 'hidden' : 'visible';
    }
    this._setStoryDots(index);

    this._updateStoryPills('victory');

    StoryCanvasRenderer.renderVictory(this.storyCanvas, performance.now() / 1000);
  }

  /** The true ending: three slides, unlocked by keeping every pledge */
  showStoryEndingSlide(index) {
    const slides = STORY_SLIDES.TRUE_ENDING;
    if (index < 0 || index >= slides.length) return;
    this.currentStoryAct = 'trueEnding';
    this.currentStoryIndex = index;
    this.currentRenderSlideIndex = 'ending';
    this._endingSlide = index;
    const slide = slides[index];

    if (this.storyStepBadge) this.storyStepBadge.textContent = `HỒI KẾT THẬT • ${index + 1}/${slides.length}`;
    if (this.storySlideTitle) this.storySlideTitle.textContent = slide.title;
    if (this.storySlideText) this.storySlideText.textContent = slide.text;
    if (this.storySlideEn) this.storySlideEn.textContent = slide.enText;

    if (this.storyDialogueCallout) this.storyDialogueCallout.classList.add('hidden');
    if (this.btnStoryPlayLevel) this.btnStoryPlayLevel.classList.add('hidden');

    if (this.btnStoryNext) {
      const last = index >= slides.length - 1;
      this.btnStoryNext.innerHTML = `<span>${last ? this._endingLastLabel('Về Menu 🏠') : 'Tiếp Tục ➜'}</span>`;
    }
    if (this.btnStoryPrev) {
      this.btnStoryPrev.style.visibility = this._endingOverlay && index === 0 ? 'hidden' : 'visible';
    }
    this._setStoryDots(index);

    this._updateStoryPills('trueEnding');

    StoryCanvasRenderer.renderEnding(this.storyCanvas, index, performance.now() / 1000);
  }

  _setStoryDots(index) {
    if (!this.storyDots) return;
    this.storyDots.querySelectorAll('.story-dot').forEach((d, i) => {
      if (i === index) d.classList.add('active');
      else d.classList.remove('active');
    });
  }

  // =========================================================================
  // ENDINGS PLAYED OVER ANOTHER SCREEN
  // =========================================================================

  /** Label of the button on an ending's last slide: depends on what comes next */
  _endingLastLabel(fallback) {
    if (!this._endingOverlay) return fallback;
    if (this._endingQueue.length > 0) return 'Tiếp Tục ➜';
    return this._endingReplay ? 'Đóng ✕' : 'Xem Kết Quả 🏆';
  }

  /**
   * Play one or more endings over whatever screen is showing: the Victory screen right after a win, or the
   * journal / Victory screen when the player asks to see one again.
   * @param {Array<'normal'|'true'>} queue played in order
   * @param {{replay?: boolean}} [opts] replay: watching again, so it is not counted as seen
   */
  playEnding(queue, opts = {}) {
    if (!this.storyScreen || !Array.isArray(queue) || queue.length === 0) return;
    this._endingQueue = queue.slice();
    this._endingReplay = !!opts.replay;
    this._endingOverlay = true;
    if (this.btnSkipStory) this.btnSkipStory.textContent = this._endingReplay ? 'Đóng ✕' : 'Bỏ qua ➔';
    this.storyScreen.classList.add('active');
    this.storyScreen.classList.add('ending-overlay');
    this._startStoryAnim();
    this._beginEnding(this._endingQueue.shift());
  }

  _beginEnding(kind) {
    if (!this._endingReplay) this.game.markEndingSeen(kind);
    if (kind === 'true') this.showStoryEndingSlide(0);
    else this.showStoryVictorySlide(0);
  }

  _nextEnding() {
    const next = this._endingQueue.shift();
    if (next) this._beginEnding(next);
    else this.closeEnding();
  }

  /** Remove the ending overlay (finished, skipped, or the screen under it is going away) */
  closeEnding() {
    if (!this._endingOverlay) return;
    this._endingOverlay = false;
    this._endingQueue = [];
    this._endingReplay = false;
    if (this.storyScreen) {
      this.storyScreen.classList.remove('active');
      this.storyScreen.classList.remove('ending-overlay');
    }
    this._stopStoryAnim();
    if (this.btnSkipStory) this.btnSkipStory.textContent = this.isStoryPreviewMode ? 'Về Menu ✕' : 'Bỏ qua ➔';
  }

  _updateStoryPills(act, chapNum = 1) {
    if (!this.storyChapterBar) return;
    const btns = this.storyChapterBar.querySelectorAll('.story-chap-btn');
    btns.forEach(btn => {
      const bAct = btn.getAttribute('data-act');
      const bChap = parseInt(btn.getAttribute('data-chap'), 10);
      if (bAct === act && (act !== 'chapter' || bChap === chapNum)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  _startStoryAnim() {
    this._stopStoryAnim();
    const tick = () => {
      const time = performance.now() / 1000;
      if (this.currentRenderSlideIndex === 'victory') {
        StoryCanvasRenderer.renderVictory(this.storyCanvas, time);
      } else if (this.currentRenderSlideIndex === 'ending') {
        StoryCanvasRenderer.renderEnding(this.storyCanvas, this._endingSlide, time);
      } else {
        StoryCanvasRenderer.renderSlide(this.storyCanvas, this.currentRenderSlideIndex, time);
      }
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
    this.hideDialogue(); // the banner takes the dialogue's place at the top of the arena

    if (this.ltbNumber) this.ltbNumber.textContent = `CẤP ĐỘ ${levelNum}`;
    if (this.ltbTitle) this.ltbTitle.textContent = levelData ? levelData.name.toUpperCase() : `ĐỢT ${levelNum}`;
    if (this.ltbEn) this.ltbEn.textContent = levelData ? levelData.enName.toUpperCase() : 'ENDLESS WAVE';

    // Phase 1: Chuẩn bị sẵn sàng! (Get Ready!)
    if (this.ltbPrompt) this.ltbPrompt.textContent = '⚡ CHUẨN BỊ SẴN SÀNG! ⚡';
    this.levelTransitionBanner.className = 'level-transition-banner show phase-ready';

    if (this.game && this.game.player) {
      this.game.player.setDrawing(true);
    }
    if (this.game && this.game.audioSystem) {
      if (typeof this.game.audioSystem.playStart === 'function') {
        this.game.audioSystem.playStart();
      }
    }

    // Phase 2: VẼ! (DRAW!) - explosive action trigger once READY is over
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
    }, INTRO_TIMING.READY_MS);

    // Phase 3: Banner fades out, game actions intensify! (the first ghost spawns after this, see WaveSystem)
    this._ltbTimeout = setTimeout(() => {
      if (this.levelTransitionBanner) {
        this.levelTransitionBanner.className = 'level-transition-banner';
      }
      // If Level 1 and tutorial has not been completed, automatically prompt tutorial
      if (levelNum === 1 && !this._hasCompletedTutorial() && !this.game.bossRush) {
        this.showTutorial(1);
      }
    }, INTRO_TIMING.READY_MS + INTRO_TIMING.DRAW_MS);
  }

  /**
   * "Stage complete" banner.
   * @param {number} levelNum
   * @param {object} [levelData]
   * @param {boolean} [isFinal=false] last Story level: nothing comes after it but the Victory screen
   */
  showLevelComplete(levelNum, levelData, isFinal = false) {
    if (!this.levelTransitionBanner) return;

    clearTimeout(this._ltbTimeout);
    clearTimeout(this._ltbDrawTimeout);
    this.hideDialogue();

    this.levelTransitionBanner.className = 'level-transition-banner show phase-clear';
    if (this.ltbNumber) {
      this.ltbNumber.textContent = isFinal ? `🏆 HOÀN THÀNH CẤP ĐỘ ${levelNum}! 🏆` : `🎉 HOÀN THÀNH CẤP ĐỘ ${levelNum}! 🎉`;
    }
    if (this.ltbTitle) this.ltbTitle.textContent = levelData ? levelData.name.toUpperCase() : 'KHU VỰC ĐÃ GIẢI CỨU';
    if (this.ltbEn) this.ltbEn.textContent = isFinal ? 'ALL STAGES COMPLETED!' : 'STAGE COMPLETED!';
    if (this.ltbPrompt) {
      this.ltbPrompt.textContent = isFinal
        ? '🎊 HỌC VIỆN ĐÃ ĐƯỢC GIẢI CỨU! 🎊'
        : '✨ CHUẨN BỊ TIẾN VÀO KHU VỰC MỚI... ✨';
    }

    this._ltbTimeout = setTimeout(() => {
      if (this.levelTransitionBanner) {
        this.levelTransitionBanner.className = 'level-transition-banner';
      }
    }, 2400);
  }

  showBossWarning(bossName, enName = 'BOSS APPROACHING') {
    if (!this.levelTransitionBanner) return;

    clearTimeout(this._ltbTimeout);
    clearTimeout(this._ltbDrawTimeout);
    this.hideDialogue();

    this.levelTransitionBanner.className = 'level-transition-banner show phase-boss-warning';
    if (this.ltbNumber) this.ltbNumber.textContent = '⚠️ CẢNH BÁO NGUY HIỂM ⚠️';
    if (this.ltbTitle) this.ltbTitle.textContent = bossName ? bossName.toUpperCase() : 'TRÙM ĐANG ĐẾN';
    if (this.ltbEn) this.ltbEn.textContent = enName ? enName.toUpperCase() : 'BOSS APPROACHING';
    if (this.ltbPrompt) this.ltbPrompt.textContent = '💀 TÀ KHÍ DÂNG TRÀO... HÃY CHUẨN BỊ! 💀';

    this._ltbTimeout = setTimeout(() => {
      if (this.levelTransitionBanner) {
        this.levelTransitionBanner.className = 'level-transition-banner';
      }
    }, INTRO_TIMING.BOSS_WARNING_MS); // gone before the boss walks in (Game holds the boss back for 2.2 s)
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

  switchTutorialTab(tab = 'step') {
    if (tab === 'step') {
      if (this.tabTutStep) this.tabTutStep.classList.add('active');
      if (this.tabTutSpells) this.tabTutSpells.classList.remove('active');
      if (this.tutStepView) this.tutStepView.classList.remove('hidden');
      if (this.tutSpellsView) this.tutSpellsView.classList.add('hidden');
    } else {
      if (this.tabTutStep) this.tabTutStep.classList.remove('active');
      if (this.tabTutSpells) this.tabTutSpells.classList.add('active');
      if (this.tutStepView) this.tutStepView.classList.add('hidden');
      if (this.tutSpellsView) this.tutSpellsView.classList.remove('hidden');
    }
  }

  showTutorial(step = 1, forceSpellsTab = false) {
    if (!this.tutorialOverlay) return;
    this.tutorialOverlay.classList.add('show');

    if (forceSpellsTab) {
      this.switchTutorialTab('spells');
    } else {
      this.switchTutorialTab('step');
      if (step === 1) {
        if (this.tutorialStep1) this.tutorialStep1.classList.remove('hidden');
        if (this.tutorialStep2) this.tutorialStep2.classList.add('hidden');
      } else if (step === 2) {
        if (this.tutorialStep1) this.tutorialStep1.classList.add('hidden');
        if (this.tutorialStep2) this.tutorialStep2.classList.remove('hidden');
      }
    }

    if (this.game) {
      this.game.isTutorialActive = !forceSpellsTab;
      this.game.tutorialStep = forceSpellsTab ? 0 : step;
    }
  }

  advanceTutorial(nextStep) {
    if (nextStep >= 3) {
      this.hideTutorial();
    } else {
      this.showTutorial(nextStep, false);
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
    this.currentLevelNum = levelNum;
    if (this.waveBadge) {
      this.waveBadge.textContent = levelData ? `CẤP ${levelNum}: ${levelData.name.toUpperCase()}` : `ĐỢT ${levelNum}`;
    }
    if (this.levelSubBadge) {
      this.levelSubBadge.textContent = levelData ? levelData.enName : 'Vô Tận (Endless)';
    }
    this.updateCompanion(levelNum, levelData);
  }

  updateCompanion(levelNum, levelData) {
    const comp = getCompanionForLevel(levelNum);
    if (!comp || !this.hudCompanionBadge) return;

    if (this.companionAvatarWrap) {
      this.companionAvatarWrap.innerHTML = comp.svg;
      this.companionAvatarWrap.style.setProperty('--companion-color', comp.color);
    }
    if (this.companionName) {
      this.companionName.textContent = comp.name;
      this.companionName.style.color = comp.color;
    }
    if (this.companionDesc) {
      this.companionDesc.textContent = comp.actionHint;
    }
    this.hudCompanionBadge.style.setProperty('--companion-color', comp.color);
  }

  _onCompanionClicked() {
    if (this.game.audioSystem && typeof this.game.audioSystem.playCatMeow === 'function') {
      this.game.audioSystem.playCatMeow('cute');
    }
    const comp = getCompanionForLevel(this.currentLevelNum);
    const quotes = {
      1: 'Momo! Madame Libraria đang bị sương mù u linh làm mờ mắt. Hãy dùng nét vẽ [—] và [|] giải trừ tà khí!',
      2: 'Momo ơi! Tớ đem bánh quy và nồi súp hồi máu [❤️] tiếp tế đây! Hãy cẩn thận các nét [∧] và [∨]!',
      3: 'Các chòm sao đang hỗn loạn! Hãy vẽ Ấn Ký Sét [⚡] để đập tan lớp giáp ma của các hành tinh lạc lối!',
      4: 'Xem ai nhanh hơn nào Momo! Lũ ma siêu tốc lượn lách ghê lắm, vung đũa thật dứt khoát vào nhé!',
      5: 'Oliver, Luna, Nyx và Viện Trưởng Barnaby cùng truyền sức mạnh! Đỉnh tháp trăng máu - trận chiến định mệnh!'
    };
    this.showDialogue({
      name: comp.name,
      role: comp.role,
      characterId: comp.id,
      color: comp.color,
      text: quotes[this.currentLevelNum] || comp.actionHint,
      duration: 4500
    });
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
    if (!this.scoreVal) return;
    // Called every frame while the score counter animates: skip the DOM write when the shown number is unchanged
    const rounded = Math.round(score);
    if (rounded === this._lastScoreShown) return;
    this._lastScoreShown = rounded;
    this.scoreVal.textContent = rounded.toLocaleString();
  }

  updateCombo(count, multiplier, decayProgress) {
    if (!this.comboBadge) return;

    // Called every frame: only touch the DOM (and trigger style recalc) when something visible changed.
    if (count > 0) {
      if (!this._comboActive) {
        this.comboBadge.classList.add('active');
        this._comboActive = true;
      }
      const label = `x${multiplier} (${count} COMBO)`;
      if (this.comboMult && label !== this._comboLabel) {
        this.comboMult.textContent = label;
        this._comboLabel = label;
      }
      if (this.comboBar) {
        // Quantise to whole percent: sub-pixel width changes are invisible but still cost a style recalc
        const pct = Math.max(0, Math.round(decayProgress * 100));
        if (pct !== this._comboPct) {
          this.comboBar.style.width = `${pct}%`;
          this.comboBar.style.backgroundColor = pct <= 25 ? '#f59e0b' : '';
          this.comboBadge.setAttribute('aria-label', `${count} combo, ${pct}% thời gian còn lại`);
          this._comboPct = pct;
        }
      }
    } else if (this._comboActive || this._comboPct !== 0) {
      this.comboBadge.classList.remove('active');
      this._comboActive = false;
      this._comboLabel = '';
      if (this.comboBar) {
        this.comboBar.style.width = '0%';
      }
      this._comboPct = 0;
    }
  }

  /**
   * @param {string|null} gesture recognised gesture id, or null for a miss
   * @param {number} score 0..1
   * @param {boolean} isSuccess
   * @param {string|null} [hint] explains how to fix a missed stroke (shown under the pill)
   */
  showGestureFeedback(gesture, score, isSuccess, hint = null) {
    if (!this.gestureFeedback) return;
    this._showHint(hint);

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
    }, hint ? 2300 : 1200);
  }

  _showHint(hint) {
    if (!this.gestureHint) return;
    clearTimeout(this._hintTimeout);
    if (!hint || !this.game.settings.get('missHints')) {
      this.gestureHint.textContent = '';
      this.gestureHint.classList.remove('show');
      return;
    }
    this.gestureHint.textContent = hint;
    this.gestureHint.classList.add('show');
    this._hintTimeout = setTimeout(() => this.gestureHint.classList.remove('show'), 2300);
  }

  // =========================================================================
  // IN-GAME CHARACTER DIALOGUE & SPEECH TOAST
  // =========================================================================
  showDialogue({ name, role, text, avatar = '🐱', characterId = null, color = '#c084fc', duration = 3800 } = {}) {
    if (!this.dialogueToast) return;
    clearTimeout(this._dialogueTimeout);

    // Resolve characterId if not explicitly provided
    if (!characterId && name) {
      const lower = name.toLowerCase();
      if (lower.includes('momo')) characterId = 'momo';
      else if (lower.includes('oliver') || lower.includes('cam cam')) characterId = 'oliver';
      else if (lower.includes('luna') || lower.includes('bạch miêu')) characterId = 'luna';
      else if (lower.includes('nyx') || lower.includes('tam thể')) characterId = 'nyx';
      else if (lower.includes('barnaby') || lower.includes('cú')) characterId = 'barnaby';
      else if (lower.includes('libraria') || lower.includes('thủ thư')) characterId = 'boss_librarian';
      else if (lower.includes('bouillon') || lower.includes('đầu bếp')) characterId = 'boss_chef';
      else if (lower.includes('stella') || lower.includes('thiên văn')) characterId = 'boss_planetarium';
      else if (lower.includes('striker') || lower.includes('huấn luyện viên')) characterId = 'boss_coach';
      else if (lower.includes('umbra') || lower.includes('chúa tể')) characterId = 'boss_master';
    }

    if (this.diagName) this.diagName.textContent = name || 'Momo';
    if (this.diagRole) {
      this.diagRole.textContent = role || 'Đồng Hành';
      this.diagRole.style.color = color;
      this.diagRole.style.background = `${color}25`;
    }

    if (this.diagAvatarWrap) {
      this.diagAvatarWrap.style.setProperty('--dialogue-accent', color);
      if (characterId) {
        this.diagAvatarWrap.innerHTML = getCharacterPortraitSvg(characterId, 44);
      } else {
        this.diagAvatarWrap.innerHTML = `<span class="dialogue-avatar" id="diag-avatar">${avatar}</span>`;
      }
    }
    if (this.diagText) this.diagText.textContent = text || '';

    this.dialogueToast.style.borderColor = `${color}66`;
    this.dialogueToast.classList.add('show');

    this._dialogueTimeout = setTimeout(() => {
      this.hideDialogue();
    }, duration);
  }

  hideDialogue() {
    clearTimeout(this._dialogueTimeout);
    if (this.dialogueToast) {
      this.dialogueToast.classList.remove('show');
    }
  }

  // =========================================================================
  // ACADEMY CHARACTER CODEX & LORE
  // =========================================================================
  /**
   * @param {string} [filter] 'all' | 'ally' | 'spirit' | 'bestiary' | 'achievements'
   */
  openCodex(filter) {
    if (!this.codexScreen) return;
    const active = filter || this.currentCodexFilter || 'all';
    if (this.codexTabs && this.codexTabs.querySelectorAll) {
      this.codexTabs.querySelectorAll('.codex-tab-btn').forEach((b) => {
        if (b.getAttribute('data-filter') === active) b.classList.add('active');
        else b.classList.remove('active');
      });
    }
    this.meta.updateCodexTabLabels();
    this.renderCodex(active);
    this.codexScreen.classList.add('active');
  }

  closeCodex() {
    if (!this.codexScreen) return;
    this.codexScreen.classList.remove('active');
  }

  renderCodex(filter = 'all') {
    if (!this.codexGrid) return;
    this.currentCodexFilter = filter;
    if (filter === 'bestiary' || filter === 'achievements') {
      this.meta.updateCodexTabLabels();
      this.meta.renderCodexExtra(filter, this.codexGrid);
      return;
    }
    this.codexGrid.innerHTML = '';

    const list = ACADEMY_CHARACTERS.filter(char => {
      if (filter === 'all') return true;
      return char.faction === filter;
    });

    list.forEach(char => {
      const lore = CHARACTER_LORE_DATA[char.id] || {};
      const card = document.createElement('div');
      card.className = 'codex-char-card';
      card.style.setProperty('--card-accent', char.themeColor || '#c084fc');

      const isAlly = char.faction === 'ally';
      const factionLabel = isAlly ? '🐾 ĐỒNG MINH HỌC VIỆN' : '👻 LINH HỒN CỔ XƯA';
      const factionClass = isAlly ? 'faction-ally' : 'faction-spirit';
      const avatarSvg = getCharacterPortraitSvg(char.id, 62);
      const runesList = (lore.runes || []).map(r => `<span class="codex-rune-pill">${r}</span>`).join(' ');

      card.innerHTML = `
        <div class="codex-card-header">
          <div class="codex-card-avatar" style="box-shadow: 0 0 16px ${char.themeColor}35; border-color: ${char.themeColor};">
            ${avatarSvg}
          </div>
          <div class="codex-card-meta">
            <span class="codex-faction-tag ${factionClass}">${factionLabel}</span>
            <div class="codex-card-name">${char.name}</div>
            <div class="codex-card-title">${char.title}</div>
            <div class="codex-card-elem" style="color: ${char.themeColor};">✨ ${char.element}</div>
          </div>
        </div>

        <div class="codex-card-specs">
          <div class="codex-spec-item">
            <span class="codex-spec-label">📍 Xuất Hiện:</span>
            <span class="codex-spec-val">${lore.location || 'Học Viện Arcane'}</span>
          </div>
          <div class="codex-spec-item">
            <span class="codex-spec-label">⚔️ Pháp Bảo:</span>
            <span class="codex-spec-val">${lore.equipment || 'Đũa Phép Thuật'}</span>
          </div>
          ${runesList ? `
          <div class="codex-spec-item">
            <span class="codex-spec-label">🪄 Ấn Ký:</span>
            <div class="codex-runes-wrap">${runesList}</div>
          </div>` : ''}
        </div>

        <div class="codex-card-quote">“${char.quote}”</div>
        <p class="codex-card-bio">${char.bio}</p>

        <button class="codex-story-btn" data-chapter="${lore.chapterIndex || 1}" title="Xem chương cốt truyện của ${char.name}">
          <span>📖 Xem Cốt Truyện</span>
          <span>➔</span>
        </button>
      `;

      // Jump to Story Chapter on click
      const btnJump = card.querySelector('.codex-story-btn');
      if (btnJump) {
        btnJump.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetChapter = parseInt(btnJump.getAttribute('data-chapter'), 10) || 1;
          this.closeCodex();
          this.game.stateMachine.changeState(GAME_STATES.STORY, {
            previewOnly: true,
            startChapter: targetChapter
          });
        });
      }

      this.codexGrid.appendChild(card);
    });
  }

  // =========================================================================
  // WIZARD CAT LICENSE / SHARE CARD METHODS
  // =========================================================================

  /**
   * Render and display the shareable Wizard Cat License modal
   * @param {Object} [customData={}]
   */
  showWizardCard(customData = {}) {
    if (!this.wizardCardModal || !this.wizardCardCanvas) return;

    const game = this.game;
    const isHighScorePreview = !!customData.isHighScorePreview;

    const baseData = isHighScorePreview ? {
      score: game.highScore || 0,
      highScore: game.highScore || 0,
      accuracy: 100,
      spellsCast: 40,
      spellsHit: 40,
      damageTaken: 0,
      enemiesDefeated: 32,
      maxCombo: 8,
      elapsedSeconds: 90,
      levelReached: 5,
      isVictory: true,
      difficulty: game.difficulty || 'NORMAL'
    } : (this._lastCardData || {
      score: game.score || 0,
      highScore: game.highScore || 0,
      accuracy: game.metrics.spellsCast > 0 ? Math.round((game.metrics.spellsHit / game.metrics.spellsCast) * 100) : 100,
      spellsCast: game.metrics.spellsCast,
      spellsHit: game.metrics.spellsHit,
      damageTaken: game.metrics.damageTaken,
      enemiesDefeated: game.metrics.enemiesDefeated,
      maxCombo: game.metrics.maxCombo || game.comboCount || 1,
      elapsedSeconds: game.metrics.startTime ? Math.round((Date.now() - game.metrics.startTime) / 1000) : 60,
      levelReached: game.waveSystem.currentLevel || 1,
      isVictory: false,
      difficulty: game.difficulty || 'NORMAL'
    });

    const fullData = { ...baseData, ...customData };
    this.wizardCardCanvas.__cardScore = fullData.score;

    renderWizardCard(this.wizardCardCanvas, fullData);

    this.wizardCardModal.classList.add('active');

    if (this.game.hapticSystem) {
      this.game.hapticSystem.pulse(20);
    }
  }

  /**
   * Hide the shareable Wizard Cat License modal
   */
  hideWizardCard() {
    if (this.wizardCardModal) {
      this.wizardCardModal.classList.remove('active');
    }
  }

  /**
   * Display toast notification feedback (e.g. copied to clipboard)
   * @param {string} message 
   * @param {number} [duration=2800] 
   */
  showCardToast(message, duration = 2800) {
    if (!this.wizardCardToast) return;
    this.wizardCardToast.textContent = message;
    this.wizardCardToast.classList.remove('hidden');

    if (this._toastTimeout) {
      clearTimeout(this._toastTimeout);
    }
    this._toastTimeout = setTimeout(() => {
      if (this.wizardCardToast) {
        this.wizardCardToast.classList.add('hidden');
      }
    }, duration);
  }
}
