/**
 * @file StateMachine.js
 * @description Finite State Machine managing MENU, STORY, PLAYING, PAUSE, GAMEOVER, and VICTORY states.
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
    }

    if (this.game.audioSystem && typeof this.game.audioSystem.resumeBGM === 'function') {
      this.game.audioSystem.resumeBGM();
    }
  }

  exit(nextState) {
    this.game.inputHandler.setEnabled(false);
    if (nextState !== GAME_STATES.PAUSE) {
      this.game.uiManager.hideScreen(GAME_STATES.PLAYING);
      if (this.game.audioSystem && typeof this.game.audioSystem.stopBGM === 'function') {
        this.game.audioSystem.stopBGM();
      }
    } else {
      if (this.game.audioSystem && typeof this.game.audioSystem.pauseBGM === 'function') {
        this.game.audioSystem.pauseBGM();
      }
    }
  }

  update(dt) {
    this.game.updatePlaying(dt);
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
    if (nextState === GAME_STATES.PLAYING && this.game.audioSystem && typeof this.game.audioSystem.resumeBGM === 'function') {
      this.game.audioSystem.resumeBGM();
    }
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

    // Check & save High Score
    const finalScore = this.game.score;
    const isNewHighScore = this.game.saveHighScore(finalScore);

    this.game.uiManager.showScreen(GAME_STATES.GAMEOVER, {
      score: finalScore,
      highScore: this.game.highScore,
      isNewHighScore,
      wave: this.game.waveSystem.currentWave,
      spellsCast: this.game.metrics.spellsCast,
      accuracy: this.game.metrics.spellsCast > 0
        ? Math.round((this.game.metrics.spellsHit / this.game.metrics.spellsCast) * 100)
        : 100
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

    const finalScore = this.game.score;
    const isNewHighScore = this.game.saveHighScore(finalScore);

    this.game.uiManager.showScreen(GAME_STATES.VICTORY, {
      score: finalScore,
      highScore: this.game.highScore,
      isNewHighScore,
      spellsCast: this.game.metrics.spellsCast,
      accuracy: this.game.metrics.spellsCast > 0
        ? Math.round((this.game.metrics.spellsHit / this.game.metrics.spellsCast) * 100)
        : 100
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
