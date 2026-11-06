/**
 * @file Spells.js
 * @description Spell Phrases: three strokes in a row that land on ghosts, drawn in the right order within a short
 * time, cast a bigger spell. The recipes are secret until discovered (the Spellbook shows only a hint).
 *
 * PhraseTracker is pure (no DOM, no Game): feed it the rune of every successful stroke and it says when a recipe
 * was completed. Game applies the effect.
 */

/**
 * @typedef {Object} SpellPhrase
 * @property {string} id
 * @property {string} icon
 * @property {string} name
 * @property {string[]} runes the three strokes, in order
 * @property {string} effect what Game does: 'dispel' | 'freeze' | 'heal' | 'aegis' | 'gale' | 'golden'
 * @property {string} desc what it does
 * @property {string} hint riddle shown before it is discovered
 */

/** @type {SpellPhrase[]} */
export const SPELL_PHRASES = [
  {
    id: 'blade_storm', icon: '🌪️', name: 'Bão Kiếm', runes: ['horizontal', 'vertical', 'lightning'], effect: 'dispel',
    desc: 'Bóc đi ấn ký đầu tiên của mọi u linh trên màn hình.',
    hint: 'Một nhát ngang, một nhát dọc, rồi để sấm sét quyết định.'
  },
  {
    id: 'frost_echo', icon: '❄️', name: 'Dư Âm Băng Giá', runes: ['caret', 'v_shape', 'horizontal'], effect: 'freeze',
    desc: 'Đóng băng toàn bộ u linh trong 3,5 giây.',
    hint: 'Leo lên đỉnh núi, lao xuống vực sâu, rồi trải phẳng mặt hồ.'
  },
  {
    id: 'moon_blessing', icon: '🌙', name: 'Phước Lành Trăng Khuyết', runes: ['v_shape', 'caret', 'vertical'], effect: 'heal',
    desc: 'Hồi 1 tim (nếu đã đầy tim: thưởng 400 điểm).',
    hint: 'Chiếc cốc úp xuống, ngọn núi dựng lên, một tia sáng chạm trời.'
  },
  {
    id: 'aegis', icon: '🛡️', name: 'Khiên Hộ Mệnh', runes: ['vertical', 'horizontal', 'v_shape'], effect: 'aegis',
    desc: 'Bất tử trong 3,5 giây.',
    hint: 'Dựng cột, vắt xà ngang, rồi úp mái che xuống.'
  },
  {
    id: 'gale_hymn', icon: '🌀', name: 'Khúc Hát Cuồng Phong', runes: ['lightning', 'caret', 'v_shape'], effect: 'gale',
    desc: 'Đẩy lùi mọi u linh ra xa.',
    hint: 'Sét đánh trước, rồi gió lên và xuống như sóng.'
  },
  {
    id: 'golden_hour', icon: '🌅', name: 'Giờ Vàng', runes: ['horizontal', 'caret', 'lightning'], effect: 'golden',
    desc: 'Nhân đôi điểm trong 10 giây.',
    hint: 'Chân trời kéo ngang, mặt trời nhô lên, tia nắng đầu tiên rạch ngang.'
  }
];

/** Only these strokes take part in phrases (the tactical runes already have effects of their own) */
export const PHRASE_RUNES = ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning'];

/** Seconds allowed between two strokes of the same phrase */
export const PHRASE_WINDOW = 2.6;
/** Seconds before the same phrase can be cast again */
export const PHRASE_COOLDOWN = 7;

const LENGTH = 3;

export function getPhrase(id) {
  return SPELL_PHRASES.find(p => p.id === id) || null;
}

export class PhraseTracker {
  constructor() {
    this.clock = 0;
    /** @type {Array<{rune: string, t: number}>} */
    this.buffer = [];
    this._readyAt = {};
  }

  /** Start of a run: forget the chain and every cooldown */
  reset() {
    this.clock = 0;
    this.buffer.length = 0;
    this._readyAt = {};
  }

  /** The strokes of the chain so far (for the HUD) */
  get chain() {
    return this.buffer.map(b => b.rune);
  }

  /** A stroke missed or Momo got hurt: the chain is broken */
  breakChain() {
    if (this.buffer.length === 0) return false;
    this.buffer.length = 0;
    return true;
  }

  /**
   * @param {number} dt seconds of game time
   * @returns {boolean} true if the chain just ran out of time
   */
  tick(dt) {
    this.clock += dt;
    if (this.buffer.length > 0 && this.clock - this.buffer[this.buffer.length - 1].t > PHRASE_WINDOW) {
      this.buffer.length = 0;
      return true;
    }
    return false;
  }

  /**
   * Register a stroke that landed on a ghost.
   * @param {string} rune
   * @returns {SpellPhrase|null} the phrase that was just completed, if any
   */
  push(rune) {
    if (!PHRASE_RUNES.includes(rune)) return null;
    const last = this.buffer[this.buffer.length - 1];
    if (last && this.clock - last.t > PHRASE_WINDOW) this.buffer.length = 0;

    this.buffer.push({ rune, t: this.clock });
    if (this.buffer.length > LENGTH) this.buffer.shift();
    if (this.buffer.length < LENGTH) return null;

    const tail = this.buffer.map(b => b.rune);
    for (const phrase of SPELL_PHRASES) {
      if (phrase.runes.every((r, i) => r === tail[i])) {
        this.buffer.length = 0;
        if (this.clock < (this._readyAt[phrase.id] || 0)) return null; // still recharging
        this._readyAt[phrase.id] = this.clock + PHRASE_COOLDOWN;
        return phrase;
      }
    }
    return null;
  }
}
