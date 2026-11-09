import { storyLines } from '../../shared/story/runtime.js';
/**
 * @file StoryScenes.js
 * @description In-run story: who says what, and when, during a Story level. Pure data plus two small
 * builders (no DOM), so StoryDirector and the tests can use it without a browser.
 *
 * A level has up to six "beats". Each beat is a short list of lines spoken one after another:
 *   intro          the level starts
 *   mid            half of the ordinary ghosts have appeared
 *   bossSpawn      the boss walks in
 *   bossHurtFirst  the boss loses its first life
 *   bossHurtLast   the boss is down to its last life
 *   bossDefeat     the boss is purified (the memory shard itself is shown on the upgrade screen)
 *
 * A line is { who, text } or { who, quote } where `quote` names a field of the level's LEVEL_CONFIGS entry
 * (the quotes shown in the story review screen live there, so they are written once). `once: true` marks lines
 * that are skipped on replays, i.e. once the level's memory shard is already in the journal.
 */

import { LEVEL_CONFIGS, ACADEMY_CHARACTERS } from './Constants.js';

/** Beat names, in the order they can happen in a level */
export const BEATS = ['intro', 'mid', 'bossSpawn', 'bossHurtFirst', 'bossHurtLast', 'bossDefeat'];

const BOSS_IDS = { 1: 'boss_librarian', 2: 'boss_chef', 3: 'boss_planetarium', 4: 'boss_coach', 5: 'boss_master' };

/** Speakers that do not depend on the level */
export const SPEAKERS = {
  momo: { name: 'Momo', role: 'Pháp Sư Mèo Đen', avatar: '🐱', color: '#c084fc', characterId: 'momo' },
  barnaby: { name: 'Viện Trưởng Barnaby', role: 'Đại Pháp Sư Cú Già', avatar: '🦉', color: '#60a5fa', characterId: 'barnaby' },
  oliver: { name: 'Oliver Cam Cam', role: 'Dược Sĩ Bánh Quy', avatar: '🐱', color: '#fb923c', characterId: 'oliver' },
  luna: { name: 'Luna Bạch Miêu', role: 'Chiêm Tinh Học Giả', avatar: '🐱', color: '#38bdf8', characterId: 'luna' },
  nyx: { name: 'Nyx Tam Thể', role: 'Đạo Tặc Tốc Độ', avatar: '🐱', color: '#34d399', characterId: 'nyx' },
  allies: { name: 'Liên Minh Mèo Phép Thuật', role: 'Momo & Những Người Bạn', avatar: '🐾', color: '#f43f5e', characterId: null },
  grimoire: { name: 'Cổ Thư Nhật Thực', role: 'Tiếng Thì Thầm', avatar: '📖', color: '#fbbf24', characterId: null },
  umbra: { name: 'Lord Umbra', role: 'Bóng Hộ Vệ', avatar: '👑', color: '#f43f5e', characterId: 'boss_master' }
};

/**
 * Story scenes by level. 'boss' is the level's boss while hostile, 'freed' the same boss once purified.
 */
export const STORY_SCENES = {
  1: {
    intro: [
      { who: 'barnaby', quote: 'storyIntroQuote' },
      { who: 'momo', once: true, text: 'Con sẽ vẽ lại từng ấn ký, thưa thầy. Từng nét một.' },
      { who: 'grimoire', once: true, text: '…đừng… để… họ… quên… ta…' }
    ],
    mid: [
      { who: 'barnaby', once: true, text: 'Lạ thật… những con ma này khóc nhiều hơn là tấn công. Chúng không muốn hại ai. Chúng đang sợ bị quên.' }
    ],
    bossSpawn: [{ who: 'boss', quote: 'bossSpawnQuote' }],
    bossHurtFirst: [
      { who: 'boss', once: true, text: 'Đừng gập góc trang đó! Ồ… cháu mở sách nhẹ tay quá. Đã lâu lắm rồi không ai đọc như thế.' }
    ],
    bossHurtLast: [],
    bossDefeat: [{ who: 'freed', quote: 'bossDefeatQuote' }]
  },
  2: {
    intro: [
      { who: 'oliver', quote: 'storyIntroQuote' },
      { who: 'momo', once: true, text: 'Cảm ơn Oliver. Mà lạ nhỉ, bếp lạnh ngắt, chẳng có lấy một mùi khét.' }
    ],
    mid: [
      { who: 'oliver', once: true, text: 'Bếp trưởng Bouillon nấu cho cả trường suốt bốn mươi năm. Rồi ai cũng quen ăn đồ đóng hộp, ông chẳng còn ai để nấu cho nữa.' }
    ],
    bossSpawn: [{ who: 'boss', quote: 'bossSpawnQuote' }],
    bossHurtFirst: [
      { who: 'boss', once: true, text: 'Ăn đi! Làm ơn, ăn đi! Chỉ một muỗng thôi cũng được!' }
    ],
    bossHurtLast: [],
    bossDefeat: [{ who: 'freed', quote: 'bossDefeatQuote' }]
  },
  3: {
    intro: [
      { who: 'luna', quote: 'storyIntroQuote' },
      { who: 'luna', once: true, text: 'Còn một điều lạ nữa, Momo: bản đồ sao cổ có một khoảng trống hình chú mèo ngồi, như ai đó tẩy mất cả một chòm sao.' }
    ],
    mid: [
      { who: 'grimoire', once: true, text: '…hãy ngước nhìn lên… ta sẽ viết tên mình… ở đó…' }
    ],
    bossSpawn: [{ who: 'boss', quote: 'bossSpawnQuote' }],
    bossHurtFirst: [
      { who: 'boss', once: true, text: 'Ta đếm sao mỗi đêm, và đêm nào cũng thiếu một ngôi. Tại sao lại thiếu?' }
    ],
    bossHurtLast: [],
    bossDefeat: [{ who: 'freed', quote: 'bossDefeatQuote' }]
  },
  4: {
    intro: [
      { who: 'nyx', quote: 'storyIntroQuote' },
      { who: 'nyx', once: true, text: 'Mà nhanh chưa đủ đâu. Thầy Striker hay nói: giỏi chạy là biết chạy chậm lại khi có người đang theo sau.' }
    ],
    mid: [
      { who: 'momo', once: true, text: 'Nyx, cậu có thấy không? Mấy con ma này cứ lượn vòng vòng như đang tìm đường về nhà.' }
    ],
    bossSpawn: [{ who: 'boss', quote: 'bossSpawnQuote' }],
    bossHurtFirst: [
      { who: 'boss', once: true, text: 'Từng có một người chạy chậm lại để chờ ta kịp đội hình. Ta nhớ rõ bước chân ấy, mà không nhớ nổi mặt người đó!' }
    ],
    bossHurtLast: [],
    bossDefeat: [{ who: 'freed', quote: 'bossDefeatQuote' }]
  },
  5: {
    intro: [
      { who: 'allies', quote: 'storyIntroQuote' },
      { who: 'momo', once: true, text: 'Con không đánh để thắng đâu, thưa thầy. Con đánh để ngài ấy nghe được ai đó gọi tên mình.' },
      { who: 'barnaby', once: true, text: '…Ừ. Con cứ làm điều con thấy đúng. Còn ta… ta sẽ ở đây, nhìn con.' }
    ],
    mid: [],
    bossSpawn: [{ who: 'boss', quote: 'bossSpawnQuote' }],
    bossHurtFirst: [
      { who: 'umbra', once: true, text: 'Đừng gọi ta là kẻ xấu… mà thật ra, ta cũng chẳng còn nhớ mình là ai. Chẳng ai gọi ta, nên tên ta tan mất rồi!' }
    ],
    bossHurtLast: [
      { who: 'barnaby', once: true, text: 'Momo… tay cầm kiếm của ngài ấy đang run. Ngài ấy không muốn đánh nữa.' },
      { who: 'umbra', once: true, text: 'Giọng nào… quen thế… như cậu học trò nhỏ năm xưa cầm bút…' }
    ],
    bossDefeat: [{ who: 'freed', quote: 'bossDefeatQuote' }]
  }
};

/**
 * Reactions of whoever Momo brought along. Two lines per event; BARK pick rotates through them.
 * `momo` speaks to herself when no companion is equipped.
 */
export const BARKS = {
  momo: {
    combo: ['Nét vẽ đang chảy như nước! Tiếp nào!', 'Mình cảm nhận được nhịp rồi!'],
    lowHp: ['Còn một trái tim thôi… nhưng mình chưa bỏ cuộc!', 'Thở sâu nào, Momo. Từng nét một.']
  },
  oliver: {
    combo: ['Ôi chao, combo đẹp như bánh vừa ra lò!', 'Momo giỏi quá, tớ suýt làm rơi cả khay bánh!'],
    lowHp: ['Momo! Vẽ trái tim [❤️] đi, tớ đang giữ súp ấm cho cậu!', 'Cố lên! Chỉ còn một ❤️ thôi, đừng để nguội!']
  },
  luna: {
    combo: ['Các vì sao đang xếp thẳng hàng theo nét bút của cậu!', 'Quỹ đạo hoàn hảo, Momo!'],
    lowHp: ['Trăng máu đang lên, đừng hoảng. Ánh sao vẫn ở phía cậu.', 'Một ❤️ thôi. Hít sâu, vẽ chậm và chính xác.']
  },
  nyx: {
    combo: ['Hê, nhanh phết đấy! Suýt đuổi kịp tớ rồi!', 'Combo kìa! Tớ không trêu cậu nữa đâu… hôm nay thôi.'],
    lowHp: ['Né đi Momo! Đừng đứng yên giữa đường bay của chúng!', 'Còn một ❤️! Tớ canh chừng cho cậu đây.']
  },
  barnaby: {
    combo: ['Nét bút vững vàng. Ta rất tự hào, Momo.', 'Lòng can đảm đang hiện rõ trong từng nét vẽ.'],
    lowHp: ['Bình tĩnh, Momo. Phong ấn mạnh nhất là lòng can đảm.', 'Đừng sợ. Ta vẫn ở trong từng ấn ký của con.']
  }
};

/** @typedef {{ name: string, role: string, avatar: string, color: string, characterId: string|null }} Speaker */

/**
 * Who a line belongs to, resolved for a level.
 * @param {string} who key of SPEAKERS, or 'boss' / 'freed'
 * @param {number} level
 * @returns {Speaker}
 */
export function resolveSpeaker(who, level) {
  if (SPEAKERS[who]) return SPEAKERS[who];
  if (who === 'boss' || who === 'freed') {
    const id = BOSS_IDS[level] || 'boss_master';
    const char = ACADEMY_CHARACTERS.find(c => c.id === id);
    const cfg = LEVEL_CONFIGS[level - 1];
    return {
      name: (char && char.name) || (cfg && cfg.bossName) || 'U Linh',
      role: who === 'freed' ? '✨ Đã Được Thanh Tẩy' : 'U Linh Thống Lĩnh',
      avatar: who === 'freed' ? '🌟' : '👻',
      color: who === 'freed' ? '#34d399' : '#f43f5e',
      characterId: id
    };
  }
  return SPEAKERS.momo;
}

/** How long a line stays on screen (ms): enough to skim it mid-fight, never a wall of waiting */
export function lineDuration(text) {
  const len = (text || '').length;
  return Math.max(2800, Math.min(6000, 2200 + len * 32));
}

/**
 * The lines of one beat, with speakers resolved and quotes looked up.
 * @param {number} level Story level 1..5
 * @param {string} beat one of BEATS
 * @param {{ replay?: boolean }} [opts] replay = the level's memory shard is already owned: `once` lines are dropped
 * @returns {Array<Speaker & { who: string, text: string, ms: number }>}
 */
export function buildScene(level, beat, opts = {}) {
  const resolve = line => ({
    ...resolveSpeaker(line.who, level), ...line, ms: lineDuration(line.text),
    ...(line.choices ? { choices: line.choices.map(choice => ({...choice,resume:()=>choice.resume().map(resolve)})) } : {}),
    ...(line.resume ? {resume:()=>line.resume().map(resolve)} : {})
  });
  return storyLines(`chapter.${level}.${beat}`, opts).map(resolve);
}

/**
 * A companion's reaction to something that just happened.
 * @param {string} companionId equipped companion id ('momo' when none)
 * @param {'combo'|'lowHp'} event
 * @param {number} [count] how many times this event has already produced a bark (rotates the wording)
 * @returns {(Speaker & { who: string, text: string, ms: number })|null}
 */
export function buildBark(companionId, event, count = 0) {
  const who = BARKS[companionId] ? companionId : 'momo';
  const lines = BARKS[who][event];
  if (!lines || lines.length === 0) return null;
  const text = storyLines(`reaction.${who}.${event}.${count % lines.length}`)[0]?.text || lines[count % lines.length];
  return { ...resolveSpeaker(who, 1), who, text, ms: Math.max(2600, lineDuration(text) - 500) };
}
