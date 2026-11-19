/**
 * @file FocusManager.js
 * @description Keyboard and screen-reader plumbing for the game's DOM overlays (menu, pause, settings, records...).
 *
 * The overlays are plain <div class="ui-screen"> layers toggled with an `active` class. Visually that works, but for
 * a keyboard or screen-reader user a layer opened on top of another one is invisible: focus stays on the button that
 * opened it, Tab walks into the page underneath, and nothing says "a dialog opened". This module adds the missing
 * pieces without changing the visuals:
 *
 *   - role="dialog" + aria-modal + an accessible name taken from the layer's own heading,
 *   - focus moves into a layer when it opens and goes back to the opener when it closes,
 *   - while a layer is open the layers/canvas underneath are `inert` (not focusable, not read), which also traps Tab.
 *
 * Everything here guards its DOM access: the Node test-suite runs the UI against a very small DOM stub (no
 * setAttribute, no querySelector...), and an accessibility helper must never be the thing that throws.
 */

/** Controls that handle Enter / Space themselves (a global "Enter starts the game" shortcut must leave them alone) */
const INTERACTIVE = 'button, a[href], input, select, textarea, summary, [role="button"], [role="switch"], [role="checkbox"], [contenteditable="true"]';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Whether a keyboard event came from a control that acts on Enter/Space by itself.
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
export function isInteractiveTarget(target) {
  try {
    return Boolean(target && typeof target.closest === 'function' && target.closest(INTERACTIVE));
  } catch (e) {
    return false;
  }
}

/**
 * Give an overlay the dialog semantics screen readers need (idempotent; never overrides an author's own role).
 * @param {HTMLElement} el
 * @returns {boolean} true if the element was (or already is) described as a dialog
 */
export function describeAsDialog(el) {
  if (!el || typeof el.setAttribute !== 'function' || typeof el.getAttribute !== 'function') return false;
  if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  if (!el.getAttribute('aria-labelledby') && !el.getAttribute('aria-label') && typeof el.querySelector === 'function') {
    const heading = el.querySelector('h1, h2, h3');
    if (heading) {
      if (!heading.id && el.id) heading.id = `${el.id}-title`;
      if (heading.id) el.setAttribute('aria-labelledby', heading.id);
    }
  }
  // The container itself can take programmatic focus (to announce the dialog) without joining the Tab order
  if (el.getAttribute('tabindex') === null) el.setAttribute('tabindex', '-1');
  return true;
}

/** Make a layer inert (or not) where the browser supports the attribute; reports whether it did anything */
function setInert(el, on) {
  if (!el) return false;
  try {
    if (on) {
      if (typeof el.setAttribute !== 'function') return false;
      el.setAttribute('inert', '');
      el.inert = true;
    } else {
      if (typeof el.removeAttribute === 'function') el.removeAttribute('inert');
      el.inert = false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export class FocusManager {
  /**
   * @param {Document|null} [doc]
   * @param {{backdrop?: () => Array<HTMLElement>}} [opts] backdrop(): the elements that sit beneath a newly opened layer
   *   (default: the canvas and every other active .ui-screen)
   */
  constructor(doc = (typeof document !== 'undefined' ? document : null), opts = {}) {
    this.doc = doc;
    this.getBackdrop = opts.backdrop || (() => this._defaultBackdrop());
    /** Open layers, oldest first: { el, opener, held: HTMLElement[] } */
    this._stack = [];
    /** node -> { count, byUs }: how many open layers need the node inert, and whether the inert attribute is ours */
    this._holds = new Map();
    // Inert excludes the backdrop, but Tab at the boundary can still leave the document.
    // Keep both directions inside the top dialog, including when its container has focus.
    doc?.addEventListener?.('keydown', (event) => {
      if (event.key !== 'Tab' || event.defaultPrevented || !this.hasOpen) return;
      const el = this._stack[this._stack.length - 1].el;
      const controls = typeof el.querySelectorAll === 'function'
        ? [...el.querySelectorAll(FOCUSABLE)].filter(node => !node.closest('[inert]') && node.getClientRects().length > 0)
        : [];
      const index = controls.indexOf(doc.activeElement);
      if (!controls.length) {
        event.preventDefault();
        this._focusInto(el);
      } else if (index < 0 || (event.shiftKey ? index === 0 : index === controls.length - 1)) {
        event.preventDefault();
        controls[event.shiftKey ? controls.length - 1 : 0].focus();
      }
    });
  }

  /** Everything the player could still reach under a new layer: the arena, notices and other open screens */
  _defaultBackdrop() {
    const doc = this.doc;
    if (!doc || typeof doc.querySelectorAll !== 'function') return [];
    const list = [];
    try {
      const canvas = typeof doc.getElementById === 'function' ? doc.getElementById('gameCanvas') : null;
      if (canvas && typeof canvas.setAttribute === 'function') list.push(canvas);
      const notices = doc.getElementById?.('game-notices');
      if (notices && typeof notices.setAttribute === 'function') list.push(notices);
      for (const screen of doc.querySelectorAll('.ui-screen.active')) list.push(screen);
    } catch (e) { /* no DOM: nothing to make inert */ }
    return list;
  }

  /** @returns {boolean} whether a layer opened through this manager is still open */
  get hasOpen() { return this._stack.length > 0; }

  /** A node must be inert for one more layer. Only an `inert` attribute WE added is ever taken away again. */
  _hold(node) {
    let rec = this._holds.get(node);
    if (!rec) {
      const already = typeof node.hasAttribute === 'function' && node.hasAttribute('inert');
      rec = { count: 0, byUs: !already && setInert(node, true) };
      this._holds.set(node, rec);
    }
    rec.count++;
  }

  _release(node) {
    const rec = this._holds.get(node);
    if (!rec) return;
    if (--rec.count > 0) return;
    this._holds.delete(node);
    if (rec.byUs) setInert(node, false);
  }

  /**
   * A layer was just shown. Call right after it becomes visible.
   * @param {HTMLElement} el
   * @param {{focus?: boolean}} [opts] focus: false leaves focus where it is
   */
  opened(el, opts = {}) {
    if (!el || this._stack.some((entry) => entry.el === el)) return;
    describeAsDialog(el);

    const doc = this.doc;
    const opener = doc && doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;

    let backdrop = [];
    try { backdrop = this.getBackdrop() || []; } catch (e) { backdrop = []; }
    const held = [];
    for (const node of backdrop) {
      if (node === el || (typeof node.contains === 'function' && node.contains(el))) continue;
      this._hold(node);
      held.push(node);
    }

    this._stack.push({ el, opener, held });
    if (opts.focus !== false) this._focusInto(el);
  }

  /**
   * A layer was just hidden. Call right after it stops being visible.
   * @param {HTMLElement} el
   * @param {{restore?: boolean}} [opts] restore: false leaves focus alone (the next screen decides where it goes)
   */
  closed(el, opts = {}) {
    const i = this._stack.findIndex((entry) => entry.el === el);
    if (i < 0) return;
    const [entry] = this._stack.splice(i, 1);
    for (const node of entry.held) this._release(node);
    if (opts.restore === false) return;
    this._restoreFocus(entry.opener);
  }

  /**
   * Safety net, called on every state change: a layer that lost its `active` class without going through closed()
   * would otherwise leave the arena (and the screens under it) inert for good. Un-inert whatever it was holding.
   */
  sync() {
    for (const entry of [...this._stack]) {
      const cl = entry.el && entry.el.classList;
      if (cl && typeof cl.contains === 'function' && !cl.contains('active')) this.closed(entry.el, { restore: false });
    }
  }

  /** Forget everything (every layer closed at once) */
  reset() {
    for (const entry of this._stack.splice(0)) for (const node of entry.held) this._release(node);
  }

  _focusInto(el) {
    try {
      if (typeof el.focus === 'function') el.focus({ preventScroll: true });
    } catch (e) { /* not focusable (hidden in a stub DOM): fine */ }
  }

  _restoreFocus(opener) {
    const doc = this.doc;
    try {
      if (opener && typeof opener.focus === 'function' && doc && (typeof doc.contains !== 'function' || doc.contains(opener))) {
        opener.focus({ preventScroll: true });
        return;
      }
      // The opener is gone (or never existed): land on the layer that is now on top, if any
      const top = this._stack[this._stack.length - 1];
      if (top) this._focusInto(top.el);
    } catch (e) { /* ignore */ }
  }
}

/** First focusable control inside a layer (for callers that prefer a concrete control to the container) */
export function firstFocusable(el) {
  try {
    return el && typeof el.querySelector === 'function' ? el.querySelector(FOCUSABLE) : null;
  } catch (e) {
    return null;
  }
}
