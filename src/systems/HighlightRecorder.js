/**
 * @file HighlightRecorder.js
 * @description Records the arena canvas in back-to-back segments of 10 seconds during a run and keeps only the
 * most exciting one (the segment with the highest combo peak), so the end screen can offer "save / share your
 * best moment". Only the best finished segment and the one being recorded are ever held in memory.
 *
 * Built on canvas.captureStream() + MediaRecorder. When the game hands over an audio track (opts.getAudioTrack)
 * the clip carries the game's sound too; without one it is video only. Where captureStream/MediaRecorder are
 * missing (old browsers, tests) the recorder is simply inert: every method is safe to call and no clip is
 * produced. Any runtime failure turns it off for the rest of the session instead of disturbing the game.
 */

// VP8 first: it encodes in real time at a fraction of VP9's CPU cost, which matters while a game is running.
// The "+opus" forms are tried before the bare ones so a clip with sound gets an audio codec it can really play.
const MIME_CANDIDATES = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/webm;codecs=vp9',
  'video/mp4'
];

/** Audio quality of the game sound in a clip */
const AUDIO_BITS_PER_SECOND = 128000;

/** A segment shorter than this is not worth watching */
const MIN_SEGMENT_SECONDS = 2;
/** A clip needs at least this combo to count as a "moment" */
const MIN_PEAK = 3;
/** Give up waiting for MediaRecorder to flush after this long */
const FLUSH_TIMEOUT_MS = 1500;

export class HighlightRecorder {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{segmentSeconds?: number, maxBytes?: number, fps?: number, bitsPerSecond?: number,
   *   getAudioTrack?: function(): (MediaStreamTrack|null)}} [opts]
   *   getAudioTrack is asked for a fresh track at the start of every run; the recorder stops it when the run ends.
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.segmentSeconds = opts.segmentSeconds || 10;
    this.maxBytes = opts.maxBytes || 14e6;
    this.fps = opts.fps || 30;
    this.bitsPerSecond = opts.bitsPerSecond || 2.2e6;
    this.getAudioTrack = typeof opts.getAudioTrack === 'function' ? opts.getAudioTrack : null;
    this.hasAudio = false;

    this.supported = HighlightRecorder.isSupported(canvas);
    this.mimeType = this.supported ? HighlightRecorder.pickMimeType() : '';

    this.running = false;
    this.paused = false;
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.segTime = 0;
    this.seg = { peak: 0, casts: 0 };
    this._pending = 0;
    this._waiters = [];

    /** @type {{blob: Blob, mimeType: string, ext: string, peak: number, casts: number, seconds: number}|null} */
    this.best = null;
  }

  static isSupported(canvas) {
    return typeof MediaRecorder !== 'undefined' && !!canvas && typeof canvas.captureStream === 'function';
  }

  static pickMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';
    if (typeof MediaRecorder.isTypeSupported !== 'function') return 'video/webm';
    for (const type of MIME_CANDIDATES) {
      try {
        if (MediaRecorder.isTypeSupported(type)) return type;
      } catch (e) { /* try the next one */ }
    }
    return '';
  }

  /** Start of a run: throw away the previous clip and begin recording */
  begin() {
    this._teardown();
    this.best = null;
    if (!this.supported) return false;
    try {
      this.stream = this.canvas.captureStream(this.fps);
    } catch (e) {
      this._disable();
      return false;
    }
    this._attachAudio();
    this.running = true;
    this.paused = false;
    return this._startSegment();
  }

  /** A stroke landed: remember the combo so the segment can be rated */
  noteHit(combo) {
    if (!this.running) return;
    this.seg.casts++;
    if (combo > this.seg.peak) this.seg.peak = combo;
  }

  /** @param {number} dt seconds of game time spent playing */
  tick(dt) {
    if (!this.running || this.paused) return;
    this.segTime += dt;
    if (this.segTime >= this.segmentSeconds) {
      this._stopSegment();
      this._startSegment();
    }
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    try {
      if (this.recorder && this.recorder.state === 'recording') this.recorder.pause();
    } catch (e) { /* ignore */ }
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    try {
      if (this.recorder && this.recorder.state === 'paused') this.recorder.resume();
    } catch (e) { /* ignore */ }
  }

  /**
   * End of a run: finish the segment in progress and report the best clip.
   * @returns {Promise<{blob: Blob, mimeType: string, ext: string, peak: number, casts: number, seconds: number}|null>}
   */
  end() {
    if (this.running) {
      this.running = false;
      this._stopSegment();
      this._releaseStream();
    }
    if (this._pending === 0) return Promise.resolve(this.best);
    return new Promise((resolve) => {
      const done = () => resolve(this.best);
      this._waiters.push(done);
      setTimeout(done, FLUSH_TIMEOUT_MS);
    });
  }

  /** Stop recording and forget everything (the player left the run) */
  discard() {
    this._teardown();
    this.best = null;
  }

  // ------------------------------------------------------------------ internals

  /** Add the game's sound to the capture stream; any problem just leaves the clip silent */
  _attachAudio() {
    this.hasAudio = false;
    if (!this.getAudioTrack || !this.stream || typeof this.stream.addTrack !== 'function') return;
    try {
      const track = this.getAudioTrack();
      if (!track) return;
      this.stream.addTrack(track);
      this.hasAudio = true;
    } catch (e) { /* video only */ }
  }

  _startSegment() {
    if (!this.running || !this.stream) return false;
    try {
      const options = { videoBitsPerSecond: this.bitsPerSecond };
      if (this.hasAudio) options.audioBitsPerSecond = AUDIO_BITS_PER_SECOND;
      if (this.mimeType) options.mimeType = this.mimeType;
      const rec = new MediaRecorder(this.stream, options);
      const chunks = [];
      const seg = { peak: 0, casts: 0, seconds: 0 };
      rec.ondataavailable = (e) => {
        if (e && e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => this._onSegmentStop(seg, chunks);
      rec.onerror = () => this._disable();
      rec.start();
      this.recorder = rec;
      this.chunks = chunks;
      this.seg = seg;
      this.segTime = 0;
      if (this.paused) rec.pause();
      return true;
    } catch (e) {
      this._disable();
      return false;
    }
  }

  _stopSegment() {
    const rec = this.recorder;
    if (!rec) return;
    this.seg.seconds = this.segTime;
    this.recorder = null;
    this._pending++;
    try {
      if (rec.state !== 'inactive') rec.stop();
      else this._settle();
    } catch (e) {
      this._settle();
    }
  }

  _onSegmentStop(seg, chunks) {
    try {
      if (chunks.length > 0 && seg.peak >= MIN_PEAK && seg.seconds >= MIN_SEGMENT_SECONDS) {
        const blob = new Blob(chunks, { type: this.mimeType || 'video/webm' });
        const rating = seg.peak * 10 + seg.casts;
        const bestRating = this.best ? this.best.peak * 10 + this.best.casts : -1;
        if (blob.size > 0 && blob.size <= this.maxBytes && rating > bestRating) {
          const type = blob.type || 'video/webm';
          this.best = {
            blob,
            mimeType: type,
            ext: type.includes('mp4') ? 'mp4' : 'webm',
            peak: seg.peak,
            casts: seg.casts,
            seconds: Math.round(seg.seconds)
          };
        }
      }
    } catch (e) { /* a failed clip must never matter */ }
    this._settle();
  }

  _settle() {
    this._pending = Math.max(0, this._pending - 1);
    if (this._pending === 0 && this._waiters.length > 0) {
      const waiters = this._waiters;
      this._waiters = [];
      for (const fn of waiters) fn();
    }
  }

  _releaseStream() {
    try {
      if (this.stream && this.stream.getTracks) this.stream.getTracks().forEach(t => t.stop());
    } catch (e) { /* ignore */ }
    this.stream = null;
    this.hasAudio = false;
  }

  _teardown() {
    this.running = false;
    this.paused = false;
    const rec = this.recorder;
    this.recorder = null;
    if (rec) {
      rec.onstop = null;
      rec.ondataavailable = null;
      try { if (rec.state !== 'inactive') rec.stop(); } catch (e) { /* ignore */ }
    }
    this._releaseStream();
    this.chunks = [];
    this._pending = 0;
    if (this._waiters.length > 0) {
      const waiters = this._waiters;
      this._waiters = [];
      for (const fn of waiters) fn();
    }
  }

  _disable() {
    this.supported = false;
    this._teardown();
  }
}
