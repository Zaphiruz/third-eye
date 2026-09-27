export interface NumberMeaning { title: string; keywords: string[]; master: boolean }

export const NUMBER_MEANINGS: Record<number, NumberMeaning> = {
  1: { title: 'The Leader', keywords: ['independence', 'initiative', 'drive'], master: false },
  2: { title: 'The Peacemaker', keywords: ['cooperation', 'sensitivity', 'diplomacy'], master: false },
  3: { title: 'The Communicator', keywords: ['expression', 'creativity', 'joy'], master: false },
  4: { title: 'The Builder', keywords: ['stability', 'discipline', 'hard work'], master: false },
  5: { title: 'The Adventurer', keywords: ['freedom', 'change', 'curiosity'], master: false },
  6: { title: 'The Nurturer', keywords: ['responsibility', 'care', 'harmony'], master: false },
  7: { title: 'The Seeker', keywords: ['introspection', 'analysis', 'spirituality'], master: false },
  8: { title: 'The Powerhouse', keywords: ['ambition', 'authority', 'abundance'], master: false },
  9: { title: 'The Humanitarian', keywords: ['compassion', 'completion', 'idealism'], master: false },
  11: { title: 'The Intuitive', keywords: ['insight', 'inspiration', 'sensitivity'], master: true },
  22: { title: 'The Master Builder', keywords: ['vision', 'practicality', 'large-scale achievement'], master: true },
  33: { title: 'The Master Teacher', keywords: ['compassion', 'guidance', 'selfless service'], master: true },
};

export function getNumberMeaning(n: number): NumberMeaning {
  const m = NUMBER_MEANINGS[n];
  if (!m) throw new RangeError(`No meaning for ${n}`);
  return m;
}
