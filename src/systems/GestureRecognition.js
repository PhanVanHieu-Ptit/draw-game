/** Off-thread recognition, including in the single-file offline build. */
export class GestureRecognition {
  constructor(engine, createWorker = null) {
    this.engine = engine;
    this.pending = new Map();
    this.sequence = 0;
    this.destroyed = false;
    this.ready = (createWorker
      ? Promise.resolve().then(createWorker)
      : import('../workers/gesture.worker.js?worker&inline').then(({ default: WorkerClass }) => new WorkerClass())
    ).then(worker => {
      if (this.destroyed) { worker.terminate(); return; }
      this.worker = worker;
      worker.onerror = event => { event.preventDefault?.(); this._failWorker(); };
      worker.onmessageerror = () => this._failWorker();
      worker.onmessage = ({ data }) => {
        const job = this.pending.get(data.id);
        if (!job) return;
        clearTimeout(job.timer);
        this.pending.delete(data.id);
        job.resolve(data.result);
      };
    }).catch(() => { this.worker = null; });
  }

  // A blocked worker (CSP/private iframe) falls back after yielding to the renderer.
  _fallback(job) {
    setTimeout(() => {
      if (!this.destroyed) job.resolve(job.target ? this.engine.scoreFor(job.points, job.target) : this.engine.recognize(job.points));
      else job.resolve(null);
    }, 0);
  }

  _failWorker() {
    this.worker?.terminate();
    this.worker = null;
    for (const job of this.pending.values()) {
      clearTimeout(job.timer);
      this._fallback(job);
    }
    this.pending.clear();
  }

  recognize(points) { return this._request(points); }

  scoreFor(points, target) { return this._request(points, target); }

  async _request(points, target = null) {
    await this.ready;
    if (this.destroyed) return null;
    return new Promise(resolve => {
      const job = { points, target, resolve };
      if (!this.worker) { this._fallback(job); return; }
      const id = ++this.sequence;
      const e = this.engine;
      // Snapshot settings for this stroke. Keep custom compiled templates in sync as well.
      const config = Object.fromEntries(['minScore', 'thresholds', 'minMargin', 'maxInputPoints',
        'oneDThreshold', 'minPathLength', 'pointCount', 'boxSize', 'sensitivity'].map(key => [key, e[key]]));
      const signature = JSON.stringify(config);
      if (signature !== this.signature || e.templates !== this.templates || e.templates.length !== this.templateCount) {
        config.templates = e.templates;
        this.signature = signature;
        this.templates = e.templates;
        this.templateCount = e.templates.length;
      }
      job.timer = setTimeout(() => this._failWorker(), 1500);
      this.pending.set(id, job);
      try { this.worker.postMessage({ id, points, target, config }); }
      catch { this._failWorker(); }
    });
  }

  destroy() {
    this.destroyed = true;
    this.worker?.terminate();
    for (const job of this.pending.values()) { clearTimeout(job.timer); job.resolve(null); }
    this.pending.clear();
  }
}
