import assert from 'node:assert/strict';
import { ParticleSystem } from '../src/systems/ParticleSystem.js';

let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`  ✅ PASS: ${name}`); }
const prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
const draws = [];
let fills = 0;
function context(canvas) {
  return { canvas, shadowBlur: 0,
    setTransform() {}, save() {}, restore() {}, translate() {}, rotate() {},
    beginPath() {}, arc() {}, moveTo() {}, quadraticCurveTo() {}, stroke() {},
    fill() { fills++; },
    drawImage(sprite) { draws.push({ sprite, blur: this.shadowBlur }); }
  };
}
globalThis.document = { createElement() { const canvas = { width: 0, height: 0 }; canvas.getContext = () => context(canvas); return canvas; } };
try {
  const particles = new ParticleSystem(4, 1);
  const ring = particles._acquireParticle(); Object.assign(ring, { type: 'ring', life: 0.8, radius: 20, color: '#f472b6' });
  const spark = particles._acquireParticle(); Object.assign(spark, { type: 'magic_spark', life: 0.7, size: 3, color: '#38bdf8' });
  const ctx = context({ width: 800, clientWidth: 800 });
  check('cached particles preserve the simulation and do not inherit an expanding ring blur', () => {
    const before = JSON.stringify([ring, spark]); particles.renderParticles(ctx);
    assert.equal(JSON.stringify([ring, spark]), before); assert.equal(particles.activeParticleCount, 2);
    assert.equal(draws.length, 1); assert.equal(draws[0].blur, 0); assert.equal(particles._sprites.size, 1);
  });
  check('many distinct effects keep a bounded retained sprite cache', () => {
    for (let i = 0; i < 600; i++) { spark.color = `#${i.toString(16).padStart(6, '0')}`; particles.renderParticles(ctx); }
    assert.equal(particles._sprites.size, 256); assert.equal(particles.activeParticleCount, 2);
    assert.equal(spark.life, 0.7);
  });
  check('density changes rebuild sprites; unavailable offscreen contexts retain visible vector effects', () => {
    const old = draws.at(-1).sprite; ctx.canvas.width = 1600; particles.renderParticles(ctx);
    assert.equal(particles._sprites.size, 1); assert.notEqual(draws.at(-1).sprite, old);
    assert.ok(draws.at(-1).sprite.width > old.width);
    document.createElement = () => ({ getContext: () => null });
    const fallback = new ParticleSystem(2, 1); const p = fallback._acquireParticle();
    Object.assign(p, { type: 'magic_spark', life: 1, size: 3 });
    const n = draws.length; const f = fills; fallback.renderParticles(ctx);
    assert.equal(draws.length, n); assert.ok(fills > f); assert.equal(fallback.activeParticleCount, 1);
  });
} finally { if (prior) Object.defineProperty(globalThis, 'document', prior); else delete globalThis.document; }
console.log(`\nParticle Sprite Tests: ${checks} Passed, 0 Failed`);
