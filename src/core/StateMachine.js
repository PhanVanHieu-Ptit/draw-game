/**
 * @file StateMachine.js
 * @description Finite State Machine managing MENU, STORY, PLAYING, PAUSE, GAMEOVER, VICTORY and PRACTICE states.
 */

import { GAME_STATES } from './Constants.js';

export class State {
  constructor(name, game) {
    this.name = name;
    this.game = game;
  }

  enter(previousState, payload = {}) {}
  exit(nextState) {}
  update(dt) {}
  render(ctx) {}
}

export class MenuState extends State {
  constructor(game) {
    super(GAME_STATES.MENU, game);
  }

  enter() {
    this.game.inputHandler.setEnabled(false);
    // Back at the menu: the next run is an ordinary one unless a daily challenge is started again
    this.game.challenge = null;
    this.game.bossRush = false;
    this.game.uiManager.showScreen(GAME_STATES.MENU);
  }

  exit() {
    this.game.uiManager.hideScreen(GAME_STATES.MENU);
  }

  update(dt) {
    this.game.particleSystem.update(dt);
  }

  render(ctx) {
    this.game.player.render(ctx);
    this.game.particleSystem.render(ctx);
  }
}

export class StoryState extends State {
  constructor(game) {
    super(GAME_STATES.STORY, game);
  }

  enter(previousState, payload = {}) {
    this.game.inputHandler.setEnabled(false);
    this.game.uiManager.showScreen(GAME_STATES.STORY, payload);
  }

  exit() {
    this.game.uiManager.hideScreen(GAME_STATES.STORY);
  }

  update(dt) {
    this.game.particleSystem.update(dt);
  }

  render(ctx) {
    this.game.player.render(ctx);
    this.game.particleSystem.render(ctx);
  }
}

export class PlayingState extends State {
  constructor(game) {
    super(GAME_STATES.PLAYING, game);
  }

  enter(previousState, payload = {}) {
    this.game.inputHandler.setEnabled(true);
    this.game.uiManager.showScreen(GAME_STATES.PLAYING);

    // If starting fresh (not resuming from pause)
    if (previousState !== GAME_STATES.PAUSE) {
      if (payload.resetData !== false) {
        this.game.resetGameData();
      }
      if (payload.startLevel) {
        this.game.waveSystem.initLevel(payload.startLevel);
      }
      if (this.game.audioSystem && typeof this.game.audioSystem.resumeBGM === 'function') {
        this.game.audioSystem.resumeBGM();
      }
    } else {
      // Coming back from pause: give the player a 3-2-1 to get their hand ready. The music resumes with it.
      this.game.beginResumeCountdown();
    }
  }

  exit(nextState) {
    this.game.inputHandler.setEnabled(false);
    this.game.cancelResumeCountdown();
    if (nextState !== GAME_STATES.PAUSE) {
      this.game.uiManager.hideScreen(GAME_STATES.PLAYING);
      if (this.game.audioSystem && typeof this.game.audioSystem.stopBGM === 'function') {
        this.game.audioSystem.stopBGM();
      }
    } else {
      if (this.game.audioSystem && typeof this.game.audioSystem.pauseBGM === 'function') {
        this.game.audioSystem.pauseBGM();
      }
      // The best-moment recorder does not film the pause screen
      if (this.game.highlight) this.game.highlight.pause();
    }
  }

  update(dt) {
    // 3-2-1 after resuming: the world is frozen
    if (this.game.tickResumeCountdown(dt)) return;
    // Slow-motion moments and per-frame cues (heartbeat, danger arrows)
    this.game.updatePlaying(this.game.advanceEffects(dt));
  }

  render(ctx) {
    this.game.renderPlaying(ctx);
  }
}

export class PauseState extends State {
  constructor(game) {
    super(GAME_STATES.PAUSE, game);
  }

  enter() {
    this.game.inputHandler.setEnabled(false);
    this.game.uiManager.showScreen(GAME_STATES.PAUSE);
    if (this.game.audioSystem && typeof this.game.audioSystem.pauseBGM === 'function') {
      this.game.audioSystem.pauseBGM();
    }
  }

  exit(nextState) {
    this.game.uiManager.hideScreen(GAME_STATES.PAUSE);
    // The music comes back when the 3-2-1 countdown ends (see Game.beginResumeCountdown)
  }

  update(dt) {
    // Game physics paused
  }

  render(ctx) {
    this.game.renderPlaying(ctx);

    ctx.save();
    ctx.fillStyle = 'rgba(10, 8, 24, 0.65)';
    ctx.fillRect(0, 0, this.game.width, this.game.height);
    ctx.restore();
  }
}

export class GameOverState extends State {
  constructor(game) {
    super(GAME_STATES.GAMEOVER, game);
  }

  enter(previousState, payload = {}) {
    this.game.inputHandler.setEnabled(false);
    if (this.game.audioSystem && typeof this.game.audioSystem.stopBGM === 'function') {
      this.game.audioSystem.stopBGM();
    }
    this.game.audioSystem.playGameOver();

    // Save the run: per mode x difficulty records, lifetime stats, achievements
    const summary = this.game.finishRun(false);

    // Haptic feedback for game over
    if (this.game.hapticSystem) {
      this.game.hapticSystem.gameover();
    }

    this.game.uiManager.showScreen(GAME_STATES.GAMEOVER, {
      score: summary.score,
      highScore: summary.highScore,
      isNewHighScore: summary.isNewHighScore,
      wave: this.game.waveSystem.currentWave,
      spellsCast: this.game.metrics.spellsCast,
      spellsHit: this.game.metrics.spellsHit,
      damageTaken: this.game.metrics.damageTaken,
      enemiesDefeated: this.game.metrics.enemiesDefeated,
      maxCombo: this.game.metrics.maxCombo || this.game.comboCount || 1,
      elapsedSeconds: summary.seconds || 60,
      difficulty: summary.difficulty,
      accuracy: summary.accuracy,
      summary
    });
  }

  exit() {
    this.game.uiManager.hideScreen(GAME_STATES.GAMEOVER);
  }

  update(dt) {
    this.game.particleSystem.update(dt);
  }

  render(ctx) {
    this.game.renderPlaying(ctx);

    ctx.save();
    ctx.fillStyle = 'rgba(15, 10, 30, 0.75)';
    ctx.fillRect(0, 0, this.game.width, this.game.height);
    ctx.restore();

    this.game.particleSystem.render(ctx);
  }
}

export class VictoryState extends State {
  constructor(game) {
    super(GAME_STATES.VICTORY, game);
  }

  enter(previousState, payload = {}) {
    this.game.inputHandler.setEnabled(false);
    if (typeof this.game.audioSystem.playVictory === 'function') {
      this.game.audioSystem.playVictory();
    } else {
      this.game.audioSystem.playStart();
    }

    // Triumphant cat vocalization & celebratory haptic
    if (this.game.audioSystem && typeof this.game.audioSystem.playCatMeow === 'function') {
      setTimeout(() => {
        this.game.audioSystem.playCatMeow('triumphant');
      }, 700);
    }
    if (this.game.hapticSystem) {
      this.game.hapticSystem.victory();
    }

    const summary = this.game.finishRun(true);

    this.game.uiManager.showScreen(GAME_STATES.VICTORY, {
      score: summary.score,
      highScore: summary.highScore,
      isNewHighScore: summary.isNewHighScore,
      spellsCast: this.game.metrics.spellsCast,
      spellsHit: this.game.metrics.spellsHit,
      damageTaken: this.game.metrics.damageTaken,
      enemiesDefeated: this.game.metrics.enemiesDefeated,
      maxCombo: this.game.metrics.maxCombo || this.game.comboCount || 1,
      elapsedSeconds: summary.seconds || 180,
      difficulty: summary.difficulty,
      accuracy: summary.accuracy,
      summary
    });
  }

  exit() {
    this.game.uiManager.hideScreen(GAME_STATES.VICTORY);
  }

  update(dt) {
    this.game.particleSystem.update(dt);
  }

  render(ctx) {
    this.game.renderPlaying(ctx);

    ctx.save();
    ctx.fillStyle = 'rgba(15, 8, 30, 0.65)';
    ctx.fillRect(0, 0, this.game.width, this.game.height);
    ctx.restore();

    this.game.particleSystem.render(ctx);
  }
}

export class PracticeState extends State {
  constructor(game) {
    super(GAME_STATES.PRACTICE, game);
  }

  enter() {
    const g = this.game;
    g.preparePracticeScene();
    g.inputHandler.setEnabled(true);
    g.uiManager.showScreen(GAME_STATES.PRACTICE);
    g.practice.start();
  }

  exit() {
    const g = this.game;
    g.inputHandler.setEnabled(false);
    g.inputHandler.clear();
    g.practice.stop();
    g.uiManager.hideScreen(GAME_STATES.PRACTICE);
  }

  update(dt) {
    const g = this.game;
    g.player.setDrawing(g.inputHandler.isDrawing, g.inputHandler.lastPoint);
    g.player.update(dt, []);
    g.particleSystem.update(dt);
    g.inputHandler.update(dt);
    g.practice.update(dt);
  }

  render(ctx) {
    const g = this.game;
    g.player.render(ctx);
    g.particleSystem.render(ctx);
    // No darkness overlay here: the template and the player's stroke must stay easy to see
    g.practice.render(ctx);
    g.inputHandler.render(ctx);
  }
}

export class StateMachine {
  constructor(game) {
    this.game = game;
    this.states = new Map();
    this.currentState = null;

    // Register all states
    this.registerState(new MenuState(game));
    this.registerState(new StoryState(game));
    this.registerState(new PlayingState(game));
    this.registerState(new PauseState(game));
    this.registerState(new GameOverState(game));
    this.registerState(new VictoryState(game));
    this.registerState(new PracticeState(game));
  }

  registerState(stateInstance) {
    this.states.set(stateInstance.name, stateInstance);
  }

  changeState(stateName, payload = {}) {
    const nextState = this.states.get(stateName);
    if (!nextState) {
      console.error(`State "${stateName}" is not registered.`);
      return;
    }

    const previousStateName = this.currentState ? this.currentState.name : null;

    if (this.currentState) {
      this.currentState.exit(stateName);
    }

    this.currentState = nextState;
    this.currentState.enter(previousStateName, payload);
  }

  update(dt) {
    if (this.currentState) {
      this.currentState.update(dt);
    }
  }

  render(ctx) {
    if (this.currentState) {
      this.currentState.render(ctx);
    }
  }

  getCurrentStateName() {
    return this.currentState ? this.currentState.name : null;
  }
}
