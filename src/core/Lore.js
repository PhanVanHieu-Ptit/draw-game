/**
 * @file Lore.js
 * @description The mystery that runs through the Story: "Cái Tên Bị Lãng Quên" (the forgotten name).
 *
 * Three hundred years ago a knight cat sealed the Fog of Oblivion inside the Grimoire. The fog ate his
 * name and renamed him "Umbra" (shadow); his real name is LUMEN (light). Each of the five bosses is someone
 * the fog fed on (a librarian nobody reads, a cook nobody eats with ...) and keeps a piece of his memory.
 *
 *  - Memory Shard ("Mảnh Ký Ức"): story text, earned for free by clearing a Story level for the first time.
 *  - Pledge ("Lời Hứa"): an optional challenge per level. Keeping it lights up one letter of LUMEN.
 *    Five letters unlock the true ending.
 *
 * Pure data and logic (no DOM, no canvas) so it can be unit-tested in Node. What the player has earned
 * lives in ProgressStore (`data.lore`); this file only describes it.
 */

/** The knight's real name, one letter per Story level */
export const FORGOTTEN_NAME = 'LUMEN';
/** The name the fog gave him */
export const FOG_NAME = 'Umbra';

/** Hearts Momo needs left when Lord Umbra falls (Level 5 pledge) */
export const PLEDGE_HEARTS = 3;
/** Combo to reach inside Level 2 (Level 2 pledge) */
export const PLEDGE_COMBO = 12;
/** Share of strokes that must land in Level 4 (Level 4 pledge) */
export const PLEDGE_ACCURACY = 0.8;
/** A level needs at least this many strokes before accuracy means anything */
export const PLEDGE_MIN_CASTS = 10;

/**
 * @typedef {Object} PledgeDef
 * @property {string} virtue Vietnamese name of the virtue
 * @property {string} enVirtue English word that starts with the level's letter
 * @property {string} title
 * @property {string} riddle poetic hint, always visible
 * @property {string} objective plain-words condition, shown once the level has been cleared
 * @property {string} reveal what the Grimoire writes when the pledge is kept
 */

/**
 * @typedef {Object} ShardDef
 * @property {number} level Story level (1..5)
 * @property {string} letter this level's letter of the forgotten name
 * @property {string} icon
 * @property {string} keeper the boss who held the shard
 * @property {string} title
 * @property {string} shard the memory
 * @property {PledgeDef} pledge
 */

/** @type {ShardDef[]} */
export const MEMORY_SHARDS = [
  {
    level: 1, letter: 'L', icon: '📚', keeper: 'Madame Libraria',
    title: 'Trang Sách Bị Xé',
    shard: 'Cổ Thư không do một bàn chân viết. Có hai: một dấu chân to của hiệp sĩ, và một dấu chân nhỏ run run của cậu học trò ngồi cạnh. Ở cuối trang phong ấn, tên người hiệp sĩ bị gạch đi, bằng chính thứ mực của sương mù.',
    pledge: {
      virtue: 'Học', enVirtue: 'Learn', title: 'Trang Sách Nguyên Vẹn',
      riddle: '“Sách quý không chỉ để cất đi, mà để được đọc, trang nào cũng nguyên vẹn.”',
      objective: 'Hạ Madame Libraria mà không bị trúng đòn nào trong màn này.',
      reveal: 'Chữ thứ nhất: L. Điều đầu tiên ta dạy các em là Học: phải hiểu mình đang bảo vệ điều gì.'
    }
  },
  {
    level: 2, letter: 'U', icon: '🍲', keeper: 'Chef Bouillon',
    title: 'Ổ Bánh Cháy Lúc Nửa Đêm',
    shard: 'Đêm nào hiệp sĩ cũng ghé nhà bếp lúc canh khuya, xin ổ bánh mì cháy mà chẳng ai muốn ăn. “Ngon nhất đời,” ngài nói rồi cười. Hóa ra ngài không thích món cháy, ngài chỉ không thích ăn một mình.',
    pledge: {
      virtue: 'Sẻ chia', enVirtue: 'Unite', title: 'Bữa Ăn Liền Mạch',
      riddle: '“Một bữa ăn trọn vẹn là một bữa liền mạch, không ai bỏ giữa chừng.”',
      objective: `Đạt chuỗi combo ${PLEDGE_COMBO} trở lên trong màn này.`,
      reveal: 'Chữ thứ hai: U. Ổ bánh cháy ngon nhất đời vì có người ngồi cùng. Sẻ chia là điều gắn mọi người lại.'
    }
  },
  {
    level: 3, letter: 'M', icon: '🔭', keeper: 'Professor Stella',
    title: 'Chòm Sao Bị Tẩy',
    shard: 'Trước khi tự ràng mình vào phong ấn, hiệp sĩ dặn cậu học trò: “Nếu một ngày ta bị lãng quên, hãy ngước nhìn trời. Ta sẽ viết tên mình ở đó.” Nhưng sương đã tẩy cả chòm sao ấy khỏi mọi tấm bản đồ.',
    pledge: {
      virtue: 'Ngước nhìn', enVirtue: 'Marvel', title: 'Đọc Sao Bằng Lời Chú',
      riddle: '“Muốn đọc sao phải bằng lời, không chỉ bằng mắt.”',
      objective: 'Niệm thành công một Câu Thần Chú (3 nét liên tiếp, xem Sổ Phép) trong màn này.',
      reveal: 'Chữ thứ ba: M. Hãy ngước lên mà ngạc nhiên về trời đất, đừng để mắt chỉ nhìn xuống chân mình.'
    }
  },
  {
    level: 4, letter: 'E', icon: '🏀', keeper: 'Coach Striker',
    title: 'Người Chạy Chậm Lại',
    shard: 'Hiệp sĩ huấn luyện lứa học trò đầu tiên của học viện, và luôn chạy chậm lại để chờ đứa nhỏ nhất. “Nhanh để về nhà,” ngài bảo, “đâu phải để bỏ ai lại phía sau.”',
    pledge: {
      virtue: 'Kiên trì', enVirtue: 'Endure', title: 'Chạy Mà Không Vội',
      riddle: '“Nhanh mà vội thì lạc đường. Hãy chạy chậm lại để không ai bị bỏ lại.”',
      objective: `Giữ độ chính xác từ ${Math.round(PLEDGE_ACCURACY * 100)}% trở lên trong màn này (nét vẽ trúng / tổng số nét).`,
      reveal: 'Chữ thứ tư: E. Chạy nhanh không khó. Chạy chậm lại để chờ người sau mới khó, và đó là kiên trì.'
    }
  },
  {
    level: 5, letter: 'N', icon: '🏰', keeper: 'Lord Umbra',
    title: 'Lời Dặn Cuối Cùng',
    shard: 'Đêm Trăng Máu ba trăm năm trước, hiệp sĩ bước vào Cổ Thư để giữ chân Màn Sương Quên Lãng. “Hãy gọi tên ta mỗi kỳ trăng máu,” ngài dặn. Cậu học trò gật đầu, rồi sương trắng phủ xuống và cái tên tan vào gió.',
    pledge: {
      virtue: 'Ghi nhớ', enVirtue: 'Never forget', title: 'Giữ Trọn Lời Thề',
      riddle: '“Giữ trọn lời thề là bước tới cuối cùng mà vẫn còn đủ những người thân yêu bên mình.”',
      objective: `Hạ Lord Umbra khi Momo còn từ ${PLEDGE_HEARTS} ❤️ trở lên.`,
      reveal: 'Chữ cuối: N. Sẽ không ai bị bỏ lại, chừng nào còn người nhớ tên mình.'
    }
  }
];

/** The five virtues in one line, as Lumen's oath */
export const OATH = 'Học để hiểu · Sẻ để gần · Ngước để mơ · Kiên trì để chờ · Ghi nhớ để không ai bị bỏ lại';

/** @param {number} level @returns {ShardDef|null} */
export function shardForLevel(level) {
  return MEMORY_SHARDS.find(s => s.level === level) || null;
}

/**
 * Facts about one Story level, collected by Game while it is played.
 * @typedef {Object} LevelFacts
 * @property {number} damage hits taken in this level
 * @property {number} maxCombo best combo inside this level
 * @property {number} phrases Spell Phrases cast in this level
 * @property {number} casts strokes drawn in this level
 * @property {number} hits strokes that landed in this level
 * @property {number} hearts hearts left when the boss fell
 */

const PLEDGE_CHECKS = {
  1: f => f.damage === 0,
  2: f => f.maxCombo >= PLEDGE_COMBO,
  3: f => f.phrases >= 1,
  4: f => f.casts >= PLEDGE_MIN_CASTS && f.hits / f.casts >= PLEDGE_ACCURACY,
  5: f => f.hearts >= PLEDGE_HEARTS
};

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Did this level's play keep the pledge?
 * @param {number} level Story level (1..5)
 * @param {Partial<LevelFacts>} facts
 * @returns {boolean}
 */
export function evaluatePledge(level, facts) {
  const check = PLEDGE_CHECKS[level];
  if (!check || !facts) return false;
  return !!check({
    damage: num(facts.damage, Infinity),
    maxCombo: num(facts.maxCombo),
    phrases: num(facts.phrases),
    casts: num(facts.casts),
    hits: num(facts.hits),
    hearts: num(facts.hearts)
  });
}

/**
 * The name, letter by letter: a letter is shown once its pledge is kept.
 * @param {import('./ProgressStore.js').ProgressStore} store
 * @returns {Array<{level: number, letter: string, known: boolean}>}
 */
export function loreLetters(store) {
  return MEMORY_SHARDS.map(s => ({ level: s.level, letter: s.letter, known: store.hasPledge(s.level) }));
}

/**
 * @param {import('./ProgressStore.js').ProgressStore} store
 * @returns {{shards: number, pledges: number, total: number, ready: boolean, name: string}}
 *   `name` is "L U _ _ _" style, `ready` means every pledge is kept (the true ending is open)
 */
export function loreSummary(store) {
  const total = MEMORY_SHARDS.length;
  const pledges = store.pledgeCount();
  return {
    shards: store.shardCount(),
    pledges,
    total,
    ready: pledges >= total,
    name: loreLetters(store).map(l => (l.known ? l.letter : '_')).join(' ')
  };
}

/**
 * One line of mystery for the main menu: what to chase next.
 * @param {import('./ProgressStore.js').ProgressStore} store
 * @returns {string}
 */
export function mysteryHint(store) {
  if (store.pledgeCount() >= MEMORY_SHARDS.length) {
    return 'Đủ năm chữ cái rồi. Cái tên đã được gọi lại.';
  }
  if (store.shardCount() === 0) {
    return 'Có một cái tên đã bị sương mù xóa khỏi lịch sử. Hạ các trùm để lần theo dấu vết.';
  }
  // The first pledge that is still open on a level whose shard we already hold
  const open = MEMORY_SHARDS.find(s => store.hasShard(s.level) && !store.hasPledge(s.level));
  if (open) return open.pledge.riddle;
  const missing = MEMORY_SHARDS.find(s => !store.hasShard(s.level));
  return missing ? `Mảnh Ký Ức tiếp theo đang ở Màn ${missing.level}: ${missing.keeper}.` : '';
}
