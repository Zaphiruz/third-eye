import type { TarotPosition } from '../types.js';

export type TarotSuit = 'wands' | 'cups' | 'swords' | 'pentacles';
export interface TarotCard {
  id: string; name: string; arcana: 'major' | 'minor';
  suit: TarotSuit | null; rank: number;   // majors: 0–21; minors: 1–14
  upright: string[]; reversed: string[];
}

export const TAROT_POSITIONS: TarotPosition[] = ['situation', 'challenge', 'advice'];

type K = [string[], string[]];
const MAJORS: [string, ...K][] = [
  ['The Fool', ['beginnings', 'spontaneity', 'leap of faith'], ['recklessness', 'hesitation', 'naivety']],
  ['The Magician', ['willpower', 'skill', 'manifestation'], ['manipulation', 'untapped talent', 'trickery']],
  ['The High Priestess', ['intuition', 'mystery', 'inner voice'], ['secrets', 'disconnection', 'ignored instincts']],
  ['The Empress', ['abundance', 'nurturing', 'creativity'], ['dependence', 'smothering', 'creative block']],
  ['The Emperor', ['structure', 'authority', 'stability'], ['rigidity', 'control', 'domination']],
  ['The Hierophant', ['tradition', 'guidance', 'belonging'], ['rebellion', 'dogma', 'unconventional paths']],
  ['The Lovers', ['union', 'alignment', 'choice'], ['disharmony', 'imbalance', 'misaligned values']],
  ['The Chariot', ['determination', 'momentum', 'victory'], ['lack of direction', 'aggression', 'stalled progress']],
  ['Strength', ['courage', 'compassion', 'inner strength'], ['self-doubt', 'weakness', 'raw emotion']],
  ['The Hermit', ['introspection', 'solitude', 'guidance'], ['isolation', 'loneliness', 'withdrawal']],
  ['Wheel of Fortune', ['cycles', 'luck', 'turning point'], ['resistance to change', 'bad luck', 'stagnation']],
  ['Justice', ['fairness', 'truth', 'accountability'], ['injustice', 'dishonesty', 'avoidance']],
  ['The Hanged Man', ['surrender', 'new perspective', 'pause'], ['stalling', 'resistance', 'needless sacrifice']],
  ['Death', ['endings', 'transformation', 'release'], ['clinging', 'fear of change', 'stagnation']],
  ['Temperance', ['balance', 'moderation', 'patience'], ['excess', 'imbalance', 'haste']],
  ['The Devil', ['attachment', 'temptation', 'shadow self'], ['release', 'breaking free', 'reclaiming power']],
  ['The Tower', ['upheaval', 'revelation', 'sudden change'], ['averted disaster', 'delayed change', 'fear of collapse']],
  ['The Star', ['hope', 'renewal', 'inspiration'], ['discouragement', 'lost faith', 'disconnection']],
  ['The Moon', ['illusion', 'intuition', 'the unconscious'], ['confusion lifting', 'repressed fear', 'clarity']],
  ['The Sun', ['joy', 'vitality', 'success'], ['dimmed enthusiasm', 'delay', 'overconfidence']],
  ['Judgement', ['awakening', 'reckoning', 'renewal'], ['self-doubt', 'harsh judgement', 'ignoring the call']],
  ['The World', ['completion', 'wholeness', 'fulfilment'], ['loose ends', 'lack of closure', 'shortcuts']],
];

const RANK_NAMES = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'];

/** Index 0 = Ace … 13 = King. */
const MINORS: Record<TarotSuit, K[]> = {
  wands: [
    [['inspiration', 'new venture', 'spark'], ['delays', 'lack of motivation', 'false start']],
    [['planning', 'future vision', 'decisions'], ['fear of the unknown', 'poor planning', 'playing safe']],
    [['expansion', 'foresight', 'progress'], ['obstacles', 'delays', 'frustration']],
    [['celebration', 'harmony', 'homecoming'], ['instability', 'transition', 'lack of support']],
    [['competition', 'conflict', 'rivalry'], ['avoiding conflict', 'tension released', 'compromise']],
    [['victory', 'recognition', 'confidence'], ['ego', 'fall from grace', 'lack of recognition']],
    [['defence', 'perseverance', 'standing ground'], ['overwhelm', 'giving up', 'exhaustion']],
    [['speed', 'movement', 'swift news'], ['delays', 'frustration', 'waiting']],
    [['resilience', 'persistence', 'last stand'], ['fatigue', 'paranoia', 'defensiveness']],
    [['burden', 'responsibility', 'hard work'], ['delegation', 'release', 'collapse under weight']],
    [['enthusiasm', 'exploration', 'discovery'], ['scattered energy', 'hasty decisions', 'lack of direction']],
    [['energy', 'adventure', 'impulsiveness'], ['recklessness', 'impatience', 'burnout']],
    [['confidence', 'warmth', 'determination'], ['jealousy', 'insecurity', 'demanding']],
    [['leadership', 'vision', 'boldness'], ['impulsiveness', 'arrogance', 'high expectations']],
  ],
  cups: [
    [['new love', 'compassion', 'emotional beginning'], ['blocked emotions', 'emptiness', 'self-neglect']],
    [['partnership', 'connection', 'mutual attraction'], ['imbalance', 'broken bond', 'miscommunication']],
    [['friendship', 'celebration', 'community'], ['overindulgence', 'gossip', 'isolation']],
    [['contemplation', 'apathy', 'reevaluation'], ['renewed interest', 'acceptance', 'new perspective']],
    [['loss', 'grief', 'regret'], ['acceptance', 'moving on', 'forgiveness']],
    [['nostalgia', 'childhood', 'innocence'], ['stuck in the past', 'rose-tinted memories', 'moving forward']],
    [['choices', 'fantasy', 'illusion'], ['clarity', 'focus', 'decisive action']],
    [['walking away', 'seeking meaning', 'withdrawal'], ['fear of change', 'aimless drifting', 'staying put']],
    [['contentment', 'wishes fulfilled', 'satisfaction'], ['smugness', 'dissatisfaction', 'materialism']],
    [['harmony', 'family', 'lasting happiness'], ['disconnection', 'broken home', 'misaligned values']],
    [['creative spark', 'intuition', 'curiosity'], ['emotional immaturity', 'creative block', 'insecurity']],
    [['romance', 'charm', 'following the heart'], ['moodiness', 'unrealistic ideals', 'jealousy']],
    [['compassion', 'calm', 'emotional security'], ['codependence', 'martyrdom', 'emotional overwhelm']],
    [['emotional balance', 'diplomacy', 'generosity'], ['manipulation', 'moodiness', 'volatility']],
  ],
  swords: [
    [['clarity', 'breakthrough', 'truth'], ['confusion', 'chaos', 'misjudgement']],
    [['indecision', 'stalemate', 'difficult choice'], ['information overload', 'lesser of two evils', 'release']],
    [['heartbreak', 'sorrow', 'painful truth'], ['recovery', 'forgiveness', 'releasing pain']],
    [['rest', 'recovery', 'contemplation'], ['restlessness', 'burnout', 'stagnation']],
    [['conflict', 'winning at a cost', 'tension'], ['reconciliation', 'making amends', 'past resentment']],
    [['transition', 'moving on', 'calmer waters'], ['unfinished business', 'resistance to change', 'baggage']],
    [['strategy', 'stealth', 'deception'], ['confession', 'conscience', 'getting caught']],
    [['restriction', 'self-imposed limits', 'feeling trapped'], ['release', 'new perspective', 'freedom']],
    [['anxiety', 'worry', 'sleepless nights'], ['hope', 'reaching out', 'releasing worry']],
    [['painful ending', 'rock bottom', 'betrayal'], ['recovery', 'regeneration', 'resisting an inevitable end']],
    [['curiosity', 'new ideas', 'vigilance'], ['gossip', 'all talk', 'deception']],
    [['ambition', 'action', 'fast thinking'], ['restlessness', 'rudeness', 'no direction']],
    [['clear boundaries', 'honesty', 'independent thought'], ['coldness', 'bitterness', 'cruelty']],
    [['intellectual power', 'authority', 'truth'], ['manipulation', 'tyranny', 'abuse of power']],
  ],
  pentacles: [
    [['opportunity', 'prosperity', 'new venture'], ['lost opportunity', 'poor planning', 'scarcity mindset']],
    [['balance', 'adaptability', 'juggling priorities'], ['overcommitment', 'disorganisation', 'imbalance']],
    [['teamwork', 'craftsmanship', 'learning'], ['disharmony', 'poor quality', 'working alone']],
    [['security', 'saving', 'control'], ['greed', 'possessiveness', 'letting go']],
    [['hardship', 'insecurity', 'isolation'], ['recovery', 'accepting help', 'turning a corner']],
    [['generosity', 'giving', 'receiving'], ['debt', 'strings attached', 'one-sided charity']],
    [['patience', 'long-term view', 'investment'], ['impatience', 'poor returns', 'wasted effort']],
    [['diligence', 'mastery', 'skill building'], ['perfectionism', 'lack of focus', 'shortcuts']],
    [['abundance', 'self-sufficiency', 'refinement'], ['overwork', 'hustling', 'financial setbacks']],
    [['legacy', 'wealth', 'family'], ['financial loss', 'family conflict', 'fleeting success']],
    [['ambition', 'study', 'manifestation'], ['procrastination', 'lack of progress', 'missed lessons']],
    [['routine', 'responsibility', 'steady progress'], ['boredom', 'stagnation', 'perfectionism']],
    [['nurturing', 'practicality', 'comfort'], ['self-neglect', 'work-home imbalance', 'smothering']],
    [['abundance', 'security', 'discipline'], ['greed', 'stubbornness', 'indulgence']],
  ],
};

const pad = (n: number) => String(n).padStart(2, '0');
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export const TAROT_CARDS: TarotCard[] = [
  ...MAJORS.map(([name, upright, reversed], i): TarotCard => ({
    id: `major-${pad(i)}`, name, arcana: 'major', suit: null, rank: i, upright, reversed,
  })),
  ...(Object.keys(MINORS) as TarotSuit[]).flatMap((suit) =>
    MINORS[suit].map(([upright, reversed], i): TarotCard => ({
      id: `${suit}-${pad(i + 1)}`, name: `${RANK_NAMES[i]} of ${cap(suit)}`,
      arcana: 'minor', suit, rank: i + 1, upright, reversed,
    })),
  ),
];

const BY_ID = new Map(TAROT_CARDS.map((c) => [c.id, c]));
export function getTarotCard(id: string): TarotCard {
  const c = BY_ID.get(id);
  if (!c) throw new RangeError(`Unknown tarot card: ${id}`);
  return c;
}
