/**
 * @file StoryDirector.js
 * @description Plays in-run story lines one after another and keeps the companions' small reactions
 * ("barks") from talking over a scene. No DOM and no timers of its own: Game calls update(dt) every frame
 * while the run is being played, so the dialogue freezes with the game (pause, 3-2-1 countdown) and
 * stops for good when the run ends (cancel()). The `say` callback does the actual drawing.
 */

/** Seconds between two lines of a scene */
const LINE_GAP = 0.3;
/** After a scene ends, companions stay quiet this long so the player can breathe */
const QUIET_AFTER_SCENE = 6;
/** Minimum time between two barks */
const BARK_COOLDOWN = 40;

export class StoryDirector {
  /**
   * @param {(line: object) => void} say shows one line (a resolved line from StoryScenes)
   */
  constructor(say, onCancel) {
    this.onCancel = onCancel;
    this.say = typeof say === 'function' ? say : () => {};
    this.enabled = true;
    this.cancel();
    this.barkCounts = {};
  }

  /** The player can turn story lines off in Settings; turning them off also clears what is queued */
  setEnabled(on) {
    this.enabled = !!on;
    if (!this.enabled) this.cancel();
  }

  /** True while a line is showing or more are waiting */
  get busy() {
    return !!this.current || this.queue.length > 0;
  }

  /** Forget everything that is queued, scheduled or showing (a run ends, the player quits) */
  cancel() {
    this.onCancel?.();
    this.generation = (this.generation || 0) + 1;
    this.queue = [];
    this.pending = [];
    this.current = null;
    this.timer = 0;
    this.quiet = 0;
    this.barkCooldown = 0;
  }

  /**
   * Start a scene now: its lines go to the back of the queue (a bark that is showing gives way).
   * @param {object[]} lines
   * @returns {boolean} false when nothing was started
   */
  play(lines) {
    if (!this.enabled || !Array.isArray(lines) || lines.length === 0) return false;
    if (this.current && this.current.isBark) {
      this.current = null;
      this.timer = 0;
    }
    for (const line of lines) this.queue.push(line);
    if (!this.current) this._next();
    return true;
  }

  /**
   * Start a scene after `seconds` of game time.
   * @param {number} seconds
   * @param {object[]} lines
   */
  schedule(seconds, lines) {
    if (!this.enabled || !Array.isArray(lines) || lines.length === 0) return;
    this.pending.push({ left: Math.max(0, seconds), lines });
  }

  /**
   * A short reaction from a companion. Dropped when a scene is playing or shortly after one,
   * and rate-limited so it stays a pleasant surprise.
   * @param {string} key which reaction (e.g. 'combo'); the wording is picked by how often it was used
   * @param {(count: number) => object|null} make builds the line for the n-th use
   * @returns {boolean} true if it was shown
   */
  bark(key, make) {
    if (!this.enabled || this.busy || this.quiet > 0 || this.barkCooldown > 0 || typeof make !== 'function') return false;
    const count = this.barkCounts[key] || 0;
    const line = make(count);
    if (!line) return false;
    this.barkCounts[key] = count + 1;
    this.barkCooldown = BARK_COOLDOWN;
    this.current = { ...line, isBark: true };
    this.timer = (line.ms || 3000) / 1000;
    this.say(line);
    return true;
  }

  /** @param {number} dt seconds */
  update(dt) {
    if (!(dt > 0)) return;
    if (this.quiet > 0) this.quiet = Math.max(0, this.quiet - dt);
    if (this.barkCooldown > 0) this.barkCooldown = Math.max(0, this.barkCooldown - dt);

    if (this.pending.length > 0) {
      const due = [];
      this.pending = this.pending.filter((p) => {
        p.left -= dt;
        if (p.left > 0) return true;
        due.push(p);
        return false;
      });
      for (const p of due) this.play(p.lines);
    }

    if (this.current) {
      this.timer -= dt;
      if (this.timer <= 0) this._next();
    }
  }

  resumeGraph(lines) {
    this.current = null;
    this.queue.unshift(...lines);
    this._next();
  }

  _next() {
    const line = this.queue.shift();
    if (!line) {
      const wasScene = this.current && !this.current.isBark;
      this.current = null;
      if (wasScene) this.quiet = QUIET_AFTER_SCENE;
      return;
    }
    this.current = line;
    this.timer = line.choices || line.battleId ? Infinity : (line.ms || 3500) / 1000 + LINE_GAP;
    this.say(line);
  }
}
