/**
 * @file tests/accessibility.test.js
 * @description Keyboard / screen-reader behaviour of the DOM layers, and the reduced-motion default.
 *
 * Found by reading the code and confirmed in a real browser before the fixes:
 *  - UIManager treated Enter as "start the game" even when a menu button had focus, so Tab to Settings + Enter started a
 *    run instead of opening Settings (keyboard users could not use the menu),
 *  - the 17 overlays had no dialog role, no name, no focus hand-over and no Tab trap,
 *  - the arena canvas had no accessible name,
 *  - a device that asks the OS for reduced motion still started with screen shake on.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const { FocusManager, describeAsDialog, isInteractiveTarget } = await load('src/ui/FocusManager.js');
const { SettingsStore, DEFAULT_SETTINGS } = await load('src/core/Settings.js');

let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  ✅ PASS: ${name}`);
}

// ---- a very small DOM ---------------------------------------------------------------------------------------
function makeDom() {
  const doc = { activeElement: null, body: { tag: 'body' }, all: [] };
  doc.activeElement = doc.body;
  doc.contains = (node) => doc.all.includes(node);
  doc.querySelectorAll = (selector) => (selector === '.ui-screen.active' ? doc.all.filter((n) => n.classList.contains('ui-screen') && n.classList.contains('active')) : []);
  doc.getElementById = (id) => doc.all.find((n) => n.id === id) || null;

  class El {
    constructor(id, classes = [], tag = 'div') {
      this.id = id; this.tag = tag; this.attrs = {}; this.kids = []; this.inert = false;
      const set = new Set(classes);
      this.classList = { add: (c) => set.add(c), remove: (c) => set.delete(c), contains: (c) => set.has(c) };
      doc.all.push(this);
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    hasAttribute(k) { return k in this.attrs; }
    removeAttribute(k) { delete this.attrs[k]; }
    append(child) { this.kids.push(child); child.parent = this; return child; }
    contains(node) { return node === this || this.kids.some((k) => k.contains(node)); }
    querySelector(sel) { return /h1|h2|h3/.test(sel) ? this.kids.find((k) => /^h[123]$/.test(k.tag)) || null : null; }
    focus() { doc.activeElement = this; }
    closest(sel) {
      // enough of a selector engine for the INTERACTIVE list: match on tag / role
      for (let n = this; n; n = n.parent) {
        if (['button', 'input', 'select', 'textarea', 'summary'].includes(n.tag) || n.attrs.role === 'button' || n.attrs.role === 'switch' || (n.tag === 'a' && 'href' in n.attrs)) return n;
      }
      return null;
    }
  }
  return { doc, El };
}

function scene() {
  const { doc, El } = makeDom();
  const canvas = new El('gameCanvas', [], 'canvas');
  const notices = new El('game-notices');
  const menu = new El('menu-screen', ['ui-screen', 'modal-overlay', 'active']);
  const openSettings = menu.append(new El('btn-open-settings', [], 'button'));
  const settings = new El('settings-screen', ['ui-screen', 'modal-overlay', 'meta-layer']);
  const title = settings.append(new El('', [], 'h2'));
  const records = new El('records-screen', ['ui-screen', 'modal-overlay', 'meta-layer']);
  records.append(new El('', [], 'h2'));
  const show = (el) => el.classList.add('active');
  const hide = (el) => el.classList.remove('active');
  return { doc, El, canvas, notices, menu, openSettings, settings, title, records, show, hide, manager: new FocusManager(doc) };
}

// ---- 1. Dialog semantics -----------------------------------------------------------------------------------
await check('an overlay becomes a named modal dialog that can take programmatic focus', () => {
  const { settings, title } = scene();
  assert.equal(describeAsDialog(settings), true);
  assert.equal(settings.getAttribute('role'), 'dialog');
  assert.equal(settings.getAttribute('aria-modal'), 'true');
  assert.equal(title.id, 'settings-screen-title', 'the heading gets an id so it can name the dialog');
  assert.equal(settings.getAttribute('aria-labelledby'), 'settings-screen-title');
  assert.equal(settings.getAttribute('tabindex'), '-1', 'focusable from script, not part of the Tab order');
});

await check('describing a dialog is idempotent and respects an author-supplied role and name', () => {
  const { El } = makeDom();
  const el = new El('custom', ['ui-screen']);
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-label', 'Hand written');
  el.setAttribute('tabindex', '0');
  describeAsDialog(el);
  describeAsDialog(el);
  assert.equal(el.getAttribute('role'), 'alertdialog');
  assert.equal(el.getAttribute('aria-label'), 'Hand written');
  assert.equal(el.getAttribute('aria-labelledby'), null);
  assert.equal(el.getAttribute('tabindex'), '0');
});

await check('a DOM without setAttribute (the Node test stub) is left alone instead of throwing', () => {
  assert.equal(describeAsDialog({ classList: {} }), false);
  assert.equal(describeAsDialog(null), false);
  const manager = new FocusManager(null);
  manager.opened({ classList: {} });
  manager.closed({ classList: {} });
  manager.sync();
});

// ---- 2. Opening and closing a layer ------------------------------------------------------------------------
await check('opening a layer moves focus in and makes the screen and canvas underneath inert', () => {
  const { doc, canvas, notices, menu, openSettings, settings, show, manager } = scene();
  openSettings.focus();
  show(settings);
  manager.opened(settings);
  assert.equal(doc.activeElement, settings, 'focus is inside the dialog');
  assert.equal(menu.getAttribute('inert'), '', 'the menu underneath cannot be reached');
  assert.equal(canvas.getAttribute('inert'), '', 'neither can the arena');
  assert.equal(notices.getAttribute('inert'), '', 'dialogue controls outside the HUD are also blocked');
  assert.equal(settings.getAttribute('inert'), null, 'the dialog itself stays live');
});

await check('closing it restores focus to the control that opened it and removes only its own inert marks', () => {
  const { doc, canvas, notices, menu, openSettings, settings, show, hide, manager } = scene();
  openSettings.focus();
  show(settings);
  manager.opened(settings);
  hide(settings);
  manager.closed(settings);
  assert.equal(doc.activeElement, openSettings);
  assert.equal(menu.getAttribute('inert'), null);
  assert.equal(canvas.getAttribute('inert'), null);
  assert.equal(notices.getAttribute('inert'), null, 'notice controls become available again');
  assert.equal(manager.hasOpen, false);
});

await check('stacked layers: closing the top one keeps the lower layer modal', () => {
  const { doc, canvas, menu, openSettings, settings, records, show, hide, manager } = scene();
  openSettings.focus();
  show(settings); manager.opened(settings);
  show(records); manager.opened(records);
  assert.equal(settings.getAttribute('inert'), '', 'the settings layer is now underneath');
  assert.equal(menu.getAttribute('inert'), '');

  hide(records); manager.closed(records);
  assert.equal(settings.getAttribute('inert'), null, 'settings is live again');
  assert.equal(menu.getAttribute('inert'), '', 'but the menu stays shut off while settings is open');
  assert.equal(canvas.getAttribute('inert'), '');
  assert.equal(doc.activeElement, settings, 'focus goes back into the layer that is now on top');

  hide(settings); manager.closed(settings);
  assert.equal(menu.getAttribute('inert'), null);
  assert.equal(canvas.getAttribute('inert'), null);
});

await check('layers closed out of order still release every node exactly once', () => {
  const { canvas, menu, settings, records, show, hide, manager } = scene();
  show(settings); manager.opened(settings);
  show(records); manager.opened(records);
  hide(settings); manager.closed(settings); // the lower one first
  assert.equal(menu.getAttribute('inert'), '', 'records is still open, so the menu must stay inert');
  hide(records); manager.closed(records);
  assert.equal(menu.getAttribute('inert'), null);
  assert.equal(canvas.getAttribute('inert'), null);
});

await check('an inert attribute the page put there itself is never removed by the manager', () => {
  const { menu, settings, show, hide, manager } = scene();
  menu.setAttribute('inert', '');
  show(settings); manager.opened(settings);
  hide(settings); manager.closed(settings);
  assert.equal(menu.getAttribute('inert'), '');
});

await check('sync() releases a layer that was hidden without going through closed()', () => {
  const { canvas, menu, settings, show, hide, manager } = scene();
  show(settings); manager.opened(settings);
  hide(settings); // some code path just removed the class
  manager.sync();
  assert.equal(menu.getAttribute('inert'), null, 'the arena cannot stay inert for good');
  assert.equal(canvas.getAttribute('inert'), null);
  assert.equal(manager.hasOpen, false);
});

await check('opening the same layer twice does not stack it', () => {
  const { settings, show, hide, manager } = scene();
  show(settings); manager.opened(settings); manager.opened(settings);
  hide(settings); manager.closed(settings);
  assert.equal(manager.hasOpen, false);
});

// ---- 3. Enter belongs to the focused control ---------------------------------------------------------------
await check('Enter on a focused button / link / switch is the control\'s own; Enter elsewhere is the game shortcut', () => {
  const { El } = makeDom();
  const button = new El('b', [], 'button');
  const wrapped = new El('w', []); wrapped.append(button); button.parent = wrapped;
  const input = new El('i', [], 'input');
  const sw = new El('s', []); sw.setAttribute('role', 'switch');
  const link = new El('a', [], 'a'); link.setAttribute('href', '#');
  const plain = new El('p', []);
  for (const el of [button, input, sw, link]) assert.equal(isInteractiveTarget(el), true, `${el.id} handles Enter itself`);
  assert.equal(isInteractiveTarget(plain), false, 'a screen container does not');
  assert.equal(isInteractiveTarget(null), false);
  assert.equal(isInteractiveTarget({}), false, 'a target without closest() is not interactive');
});

await check('UIManager only treats Enter as "start / retry" when the target is not an interactive control', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/ui/UIManager.js'), 'utf8');
  assert.match(source, /e\.key === 'Enter' && !isInteractiveTarget\(e\.target\)/, 'the global Enter shortcut is guarded');
});

// ---- 4. Reduced motion -------------------------------------------------------------------------------------
function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

async function withMatchMedia(matches, fn) {
  const saved = globalThis.window;
  globalThis.window = { matchMedia: (q) => ({ matches: matches && /prefers-reduced-motion/.test(q) }) };
  try { return await fn(); } finally { if (saved === undefined) delete globalThis.window; else globalThis.window = saved; }
}

await check('an OS that asks for reduced motion starts the game with screen shake off', async () => {
  await withMatchMedia(true, () => {
    assert.equal(SettingsStore.effectiveDefaults().screenShake, false);
    assert.equal(new SettingsStore(memoryStorage()).get('screenShake'), false);
  });
});

await check('without the OS preference nothing changes, and the shipped default stays true', async () => {
  await withMatchMedia(false, () => {
    assert.equal(new SettingsStore(memoryStorage()).get('screenShake'), true);
  });
  assert.equal(DEFAULT_SETTINGS.screenShake, true);
  assert.equal(new SettingsStore(memoryStorage()).get('screenShake'), true, 'and with no window at all (Node)');
});

await check('a choice the player saved always wins over the OS default, and reset() returns to the effective default', async () => {
  await withMatchMedia(true, () => {
    const saved = memoryStorage({ arcane_paws_settings_v1: JSON.stringify({ screenShake: true }) });
    const store = new SettingsStore(saved);
    assert.equal(store.get('screenShake'), true, 'explicitly on stays on');
    store.reset();
    assert.equal(store.get('screenShake'), false, 'reset goes back to what this device asks for');
  });
});

// ---- 5. Markup ---------------------------------------------------------------------------------------------
await check('every styled toggle in index.html is exposed as a switch', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const toggles = html.match(/<input\b[^>]*class="switch"[^>]*>/g) || [];
  assert.ok(toggles.length >= 8, 'the settings toggles are there');
  for (const tag of toggles) assert.match(tag, /role="switch"/, tag);
});

console.log(`\nAccessibility Tests: ${checks} Passed, 0 Failed`);
