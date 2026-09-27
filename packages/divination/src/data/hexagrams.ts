export interface Hexagram { number: number; name: string; pinyin: string; keywords: string[] }

type Bit = 0 | 1;
// Trigrams as bottom → top line strings (1 = yang).
const TRIGRAMS = ['111', '100', '010', '001', '000', '011', '101', '110'] as const;
//                 Qian   Zhen   Kan    Gen    Kun    Xun    Li     Dui
//                 Heaven Thunder Water Mountain Earth Wind  Fire   Lake

/** KING_WEN[lower][upper], both indexed in TRIGRAMS order. */
const KING_WEN: number[][] = [
  [1, 34, 5, 26, 11, 9, 14, 43],
  [25, 51, 3, 27, 24, 42, 21, 17],
  [6, 40, 29, 4, 7, 59, 64, 47],
  [33, 62, 39, 52, 15, 53, 56, 31],
  [12, 16, 8, 23, 2, 20, 35, 45],
  [44, 32, 48, 18, 46, 57, 50, 28],
  [13, 55, 63, 22, 36, 37, 30, 49],
  [10, 54, 60, 41, 19, 61, 38, 58],
];

/** bits: six lines bottom → top, 1 = yang. */
export function hexagramNumber(bits: Bit[]): number {
  if (bits.length !== 6) throw new RangeError('A hexagram has six lines');
  const lower = TRIGRAMS.indexOf(bits.slice(0, 3).join('') as (typeof TRIGRAMS)[number]);
  const upper = TRIGRAMS.indexOf(bits.slice(3).join('') as (typeof TRIGRAMS)[number]);
  return KING_WEN[lower]![upper]!;
}

export function hexagramLines(n: number): Bit[] {
  for (let lower = 0; lower < 8; lower++) {
    const upper = KING_WEN[lower]!.indexOf(n);
    if (upper !== -1) return [...TRIGRAMS[lower]!, ...TRIGRAMS[upper]!].map((c) => Number(c) as Bit);
  }
  throw new RangeError(`No hexagram ${n}`);
}

const H: [string, string, string[]][] = [
  ['The Creative', 'Qián', ['creative power', 'initiative', 'persistence']],
  ['The Receptive', 'Kūn', ['receptivity', 'devotion', 'yielding strength']],
  ['Difficulty at the Beginning', 'Zhūn', ['initial chaos', 'perseverance', 'gathering support']],
  ['Youthful Folly', 'Méng', ['inexperience', 'learning', 'seeking a teacher']],
  ['Waiting', 'Xū', ['patience', 'nourishment', 'right timing']],
  ['Conflict', 'Sòng', ['dispute', 'caution', 'seeking mediation']],
  ['The Army', 'Shī', ['discipline', 'organisation', 'leadership']],
  ['Holding Together', 'Bǐ', ['union', 'alliance', 'loyalty']],
  ['Small Taming', 'Xiǎo Chù', ['gentle restraint', 'small gains', 'patience']],
  ['Treading', 'Lǚ', ['careful conduct', 'propriety', 'treading lightly']],
  ['Peace', 'Tài', ['harmony', 'prosperity', 'flow']],
  ['Standstill', 'Pǐ', ['stagnation', 'withdrawal', 'integrity']],
  ['Fellowship', 'Tóng Rén', ['community', 'shared purpose', 'openness']],
  ['Great Possession', 'Dà Yǒu', ['abundance', 'generosity', 'stewardship']],
  ['Modesty', 'Qiān', ['humility', 'balance', 'quiet strength']],
  ['Enthusiasm', 'Yù', ['inspiration', 'momentum', 'readiness']],
  ['Following', 'Suí', ['adaptation', 'following', 'timing']],
  ['Work on What Has Been Spoiled', 'Gǔ', ['repair', 'correcting the past', 'renewal']],
  ['Approach', 'Lín', ['advance', 'opportunity', 'goodwill']],
  ['Contemplation', 'Guān', ['observation', 'perspective', 'example']],
  ['Biting Through', 'Shì Kè', ['decisiveness', 'justice', 'removing obstacles']],
  ['Grace', 'Bì', ['beauty', 'form', 'elegance']],
  ['Splitting Apart', 'Bō', ['decay', 'letting go', 'waiting it out']],
  ['Return', 'Fù', ['turning point', 'recovery', 'new cycle']],
  ['Innocence', 'Wú Wàng', ['sincerity', 'spontaneity', 'the unexpected']],
  ['Great Taming', 'Dà Chù', ['restraint', 'accumulated strength', 'study']],
  ['Nourishment', 'Yí', ['nourishment', 'care', 'what you take in']],
  ['Great Exceeding', 'Dà Guò', ['excess', 'pressure', 'bold action']],
  ['The Abysmal', 'Kǎn', ['danger', 'repetition', 'courage in difficulty']],
  ['The Clinging', 'Lí', ['clarity', 'dependence', 'illumination']],
  ['Influence', 'Xián', ['attraction', 'mutual influence', 'receptivity']],
  ['Duration', 'Héng', ['endurance', 'consistency', 'commitment']],
  ['Retreat', 'Dùn', ['strategic withdrawal', 'conserving strength', 'timing']],
  ['Great Power', 'Dà Zhuàng', ['strength', 'righteous action', 'restraint']],
  ['Progress', 'Jìn', ['advancement', 'recognition', 'rising']],
  ['Darkening of the Light', 'Míng Yí', ['adversity', 'hidden light', 'perseverance']],
  ['The Family', 'Jiā Rén', ['family', 'roles', 'loyalty']],
  ['Opposition', 'Kuí', ['divergence', 'misunderstanding', 'small matters']],
  ['Obstruction', 'Jiǎn', ['obstacles', 'reflection', 'seeking help']],
  ['Deliverance', 'Xiè', ['release', 'relief', 'forgiveness']],
  ['Decrease', 'Sǔn', ['simplifying', 'sacrifice', 'restraint']],
  ['Increase', 'Yì', ['growth', 'benefit', 'generosity']],
  ['Breakthrough', 'Guài', ['resolution', 'determination', 'speaking truth']],
  ['Coming to Meet', 'Gòu', ['temptation', 'unexpected encounter', 'caution']],
  ['Gathering Together', 'Cuì', ['assembly', 'community', 'shared purpose']],
  ['Pushing Upward', 'Shēng', ['gradual ascent', 'effort', 'growth']],
  ['Oppression', 'Kùn', ['exhaustion', 'adversity', 'inner resolve']],
  ['The Well', 'Jǐng', ['source', 'renewal', 'shared resources']],
  ['Revolution', 'Gé', ['transformation', 'shedding the old', 'timing']],
  ['The Cauldron', 'Dǐng', ['nourishment', 'culture', 'transformation']],
  ['The Arousing', 'Zhèn', ['shock', 'awakening', 'composure']],
  ['Keeping Still', 'Gèn', ['stillness', 'meditation', 'boundaries']],
  ['Development', 'Jiàn', ['gradual progress', 'patience', 'steady growth']],
  ['The Marrying Maiden', 'Guī Mèi', ['subordinate role', 'impulse', 'propriety']],
  ['Abundance', 'Fēng', ['peak', 'fullness', 'making the most of now']],
  ['The Wanderer', 'Lǚ', ['travel', 'transience', 'caution']],
  ['The Gentle', 'Xùn', ['gentle penetration', 'persistence', 'influence']],
  ['The Joyous', 'Duì', ['joy', 'openness', 'exchange']],
  ['Dispersion', 'Huàn', ['dissolution', 'release', 'reuniting']],
  ['Limitation', 'Jié', ['boundaries', 'moderation', 'structure']],
  ['Inner Truth', 'Zhōng Fú', ['sincerity', 'trust', 'inner truth']],
  ['Small Exceeding', 'Xiǎo Guò', ['attention to detail', 'humility', 'small steps']],
  ['After Completion', 'Jì Jì', ['completion', 'vigilance', 'order']],
  ['Before Completion', 'Wèi Jì', ['almost there', 'transition', 'care']],
];

export const HEXAGRAMS: Hexagram[] = H.map(([name, pinyin, keywords], i) => ({ number: i + 1, name, pinyin, keywords }));

export function getHexagram(n: number): Hexagram {
  const h = HEXAGRAMS[n - 1];
  if (!h) throw new RangeError(`No hexagram ${n}`);
  return h;
}
