/**
 * @file test-gesture-enhancements.js
 * @description Comprehensive test suite verifying that spiral, circle, and lightning
 * are easy, forgiving, and reliably recognized from any direction, starting point, and natural human drawing variations.
 */

import assert from 'assert';
import { GestureEngine } from './src/GestureEngine.js';

console.log('🧪 Starting Gesture Recognition Enhancement Tests (Spiral, Circle, Lightning)...\n');

const engine = new GestureEngine();

let passed = 0;
let total = 0;

function test(description, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     ${err.message}`);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// 1. LIGHTNING TESTS (Tia Sét ⚡)
// -------------------------------------------------------------
console.log('--- 1. Testing Lightning Recognition (⚡) ---');

test('Classic Z-shape lightning (Left -> Right -> Diag Left -> Right)', () => {
  const zPoints = [
    { x: 100, y: 100 }, { x: 180, y: 105 }, { x: 110, y: 180 }, { x: 190, y: 185 }
  ];
  const res = engine.recognize(zPoints);
  assert.strictEqual(res.gesture, 'lightning', `Expected lightning, got ${res.gesture}`);
  assert(res.score >= 0.80, `Expected score >= 0.80, got ${res.score}`);
});

test('Inverted Z-shape lightning (Right -> Left -> Diag Right -> Left)', () => {
  const invZ = [
    { x: 180, y: 100 }, { x: 100, y: 105 }, { x: 170, y: 180 }, { x: 90, y: 185 }
  ];
  const res = engine.recognize(invZ);
  assert.strictEqual(res.gesture, 'lightning', `Expected lightning, got ${res.gesture}`);
  assert(res.score >= 0.80, `Expected score >= 0.80, got ${res.score}`);
});

test('Vertical 3-segment lightning bolt (Top -> Down with zigzags)', () => {
  const vLight = [
    { x: 150, y: 100 }, { x: 120, y: 140 }, { x: 170, y: 140 }, { x: 130, y: 190 }
  ];
  const res = engine.recognize(vLight);
  assert.strictEqual(res.gesture, 'lightning', `Expected lightning, got ${res.gesture}`);
  assert(res.score >= 0.80, `Expected score >= 0.80, got ${res.score}`);
});

test('Quick diagonal lightning slash', () => {
  const quickLight = [
    { x: 160, y: 100 }, { x: 130, y: 135 }, { x: 155, y: 135 }, { x: 125, y: 180 }
  ];
  const res = engine.recognize(quickLight);
  assert.strictEqual(res.gesture, 'lightning', `Expected lightning, got ${res.gesture}`);
  assert(res.score >= 0.70, `Expected score >= 0.70, got ${res.score}`);
});

test('Bottom-to-top Z-shape lightning', () => {
  const bottomZ = [
    { x: 100, y: 190 }, { x: 180, y: 185 }, { x: 110, y: 110 }, { x: 190, y: 105 }
  ];
  const res = engine.recognize(bottomZ);
  assert.strictEqual(res.gesture, 'lightning', `Expected lightning, got ${res.gesture}`);
  assert(res.score >= 0.70, `Expected score >= 0.70, got ${res.score}`);
});

// -------------------------------------------------------------
// 2. CIRCLE TESTS (Hình Tròn ❄️)
// -------------------------------------------------------------
console.log('\n--- 2. Testing Circle Recognition (❄️) ---');

test('Circle starting from top (12 o\'clock) Clockwise', () => {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: 150 + 60 * Math.cos(a), y: 150 + 60 * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'circle', `Expected circle, got ${res.gesture}`);
  assert(res.score >= 0.85, `Expected score >= 0.85, got ${res.score}`);
});

test('Circle starting from top (12 o\'clock) Counter-Clockwise', () => {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 - (i / 24) * Math.PI * 2;
    pts.push({ x: 150 + 60 * Math.cos(a), y: 150 + 60 * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'circle', `Expected circle, got ${res.gesture}`);
  assert(res.score >= 0.85, `Expected score >= 0.85, got ${res.score}`);
});

test('Circle starting from right (3 o\'clock) Clockwise', () => {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push({ x: 150 + 60 * Math.cos(a), y: 150 + 60 * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'circle', `Expected circle, got ${res.gesture}`);
  assert(res.score >= 0.85, `Expected score >= 0.85, got ${res.score}`);
});

test('Circle starting from right (3 o\'clock) Counter-Clockwise', () => {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = -(i / 24) * Math.PI * 2;
    pts.push({ x: 150 + 60 * Math.cos(a), y: 150 + 60 * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'circle', `Expected circle, got ${res.gesture}`);
  assert(res.score >= 0.85, `Expected score >= 0.85, got ${res.score}`);
});

test('Circle starting from bottom (6 o\'clock) Clockwise', () => {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI / 2 + (i / 24) * Math.PI * 2;
    pts.push({ x: 150 + 60 * Math.cos(a), y: 150 + 60 * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'circle', `Expected circle, got ${res.gesture}`);
  assert(res.score >= 0.85, `Expected score >= 0.85, got ${res.score}`);
});

test('Circle starting from left (9 o\'clock) Clockwise', () => {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i / 24) * Math.PI * 2;
    pts.push({ x: 150 + 60 * Math.cos(a), y: 150 + 60 * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'circle', `Expected circle, got ${res.gesture}`);
  assert(res.score >= 0.85, `Expected score >= 0.85, got ${res.score}`);
});

test('Circle with casual 80% closure (drawn quickly in combat with a gap)', () => {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const a = -Math.PI / 2 + (i / 24) * Math.PI * 2;
    pts.push({ x: 150 + 60 * Math.cos(a), y: 150 + 60 * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'circle', `Expected circle, got ${res.gesture}`);
  assert(res.score >= 0.70, `Expected score >= 0.70, got ${res.score}`);
});

// -------------------------------------------------------------
// 3. SPIRAL TESTS (Xoắn Ốc 🌀)
// -------------------------------------------------------------
console.log('\n--- 3. Testing Spiral Recognition (🌀) ---');

test('Spiral drawn OUTSIDE-IN (Clockwise)', () => {
  const pts = [];
  for (let i = 0; i <= 35; i++) {
    const t = i / 35;
    const r = 60 * (1 - t * 0.72);
    const a = t * Math.PI * 3.0;
    pts.push({ x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'spiral', `Expected spiral, got ${res.gesture}`);
  assert(res.score >= 0.75, `Expected score >= 0.75, got ${res.score}`);
});

test('Spiral drawn INSIDE-OUT (Clockwise from center)', () => {
  const pts = [];
  for (let i = 0; i <= 35; i++) {
    const t = i / 35;
    const r = 10 + 50 * t;
    const a = t * Math.PI * 3.0;
    pts.push({ x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'spiral', `Expected spiral, got ${res.gesture}`);
  assert(res.score >= 0.75, `Expected score >= 0.75, got ${res.score}`);
});

test('Spiral drawn INSIDE-OUT (Counter-Clockwise from center)', () => {
  const pts = [];
  for (let i = 0; i <= 35; i++) {
    const t = i / 35;
    const r = 10 + 50 * t;
    const a = -t * Math.PI * 3.0;
    pts.push({ x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'spiral', `Expected spiral, got ${res.gesture}`);
  assert(res.score >= 0.75, `Expected score >= 0.75, got ${res.score}`);
});

test('Spiral drawn OUTSIDE-IN starting from Right (3 o\'clock)', () => {
  const pts = [];
  for (let i = 0; i <= 35; i++) {
    const t = i / 35;
    const r = 60 * (1 - t * 0.72);
    const a = t * Math.PI * 3.2;
    pts.push({ x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'spiral', `Expected spiral, got ${res.gesture}`);
  assert(res.score >= 0.80, `Expected score >= 0.80, got ${res.score}`);
});

test('Fast casual swirl / vortex (1.25 turns)', () => {
  const pts = [];
  for (let i = 0; i <= 25; i++) {
    const t = i / 25;
    const r = 55 * (1 - t * 0.65);
    const a = t * Math.PI * 2.5;
    pts.push({ x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a) });
  }
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'spiral', `Expected spiral, got ${res.gesture}`);
  assert(res.score >= 0.75, `Expected score >= 0.75, got ${res.score}`);
});

// -------------------------------------------------------------
// 4. REGRESSION SAFETY FOR EXISTING BASIC GESTURES
// -------------------------------------------------------------
console.log('\n--- 4. Regression Safety for Basic Gestures ---');

test('Horizontal stroke is recognized as horizontal', () => {
  const pts = [{ x: 50, y: 100 }, { x: 250, y: 100 }];
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'horizontal');
  assert.strictEqual(res.score, 1);
});

test('Vertical stroke is recognized as vertical', () => {
  const pts = [{ x: 100, y: 50 }, { x: 100, y: 250 }];
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'vertical');
  assert.strictEqual(res.score, 1);
});

test('V-shape is recognized as v_shape', () => {
  const pts = [{ x: 50, y: 50 }, { x: 100, y: 150 }, { x: 150, y: 50 }];
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'v_shape');
  assert.strictEqual(res.score, 1);
});

test('Caret (^) is recognized as caret', () => {
  const pts = [{ x: 50, y: 150 }, { x: 100, y: 50 }, { x: 150, y: 150 }];
  const res = engine.recognize(pts);
  assert.strictEqual(res.gesture, 'caret');
  assert.strictEqual(res.score, 1);
});

console.log(`\n========================================`);
console.log(`Results: ${passed} Passed, ${total - passed} Failed`);
console.log(`========================================\n`);

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
