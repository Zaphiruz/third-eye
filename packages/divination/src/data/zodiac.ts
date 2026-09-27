import type { ZodiacSignId } from '../types.js';

export interface ZodiacSign {
  id: ZodiacSignId; name: string; glyph: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water'; modality: 'Cardinal' | 'Fixed' | 'Mutable';
  ruler: string;
  /** First day of the sign (tropical, conventional boundaries) as [month, day]. */
  start: [number, number];
  traits: string[];
}

export const ZODIAC_SIGNS: ZodiacSign[] = [
  { id: 'aries', name: 'Aries', glyph: '♈', element: 'Fire', modality: 'Cardinal', ruler: 'Mars', start: [3, 21], traits: ['bold', 'energetic', 'impulsive'] },
  { id: 'taurus', name: 'Taurus', glyph: '♉', element: 'Earth', modality: 'Fixed', ruler: 'Venus', start: [4, 20], traits: ['steady', 'sensual', 'stubborn'] },
  { id: 'gemini', name: 'Gemini', glyph: '♊', element: 'Air', modality: 'Mutable', ruler: 'Mercury', start: [5, 21], traits: ['curious', 'adaptable', 'restless'] },
  { id: 'cancer', name: 'Cancer', glyph: '♋', element: 'Water', modality: 'Cardinal', ruler: 'the Moon', start: [6, 21], traits: ['nurturing', 'intuitive', 'protective'] },
  { id: 'leo', name: 'Leo', glyph: '♌', element: 'Fire', modality: 'Fixed', ruler: 'the Sun', start: [7, 23], traits: ['warm', 'expressive', 'proud'] },
  { id: 'virgo', name: 'Virgo', glyph: '♍', element: 'Earth', modality: 'Mutable', ruler: 'Mercury', start: [8, 23], traits: ['precise', 'helpful', 'analytical'] },
  { id: 'libra', name: 'Libra', glyph: '♎', element: 'Air', modality: 'Cardinal', ruler: 'Venus', start: [9, 23], traits: ['harmonious', 'fair-minded', 'indecisive'] },
  { id: 'scorpio', name: 'Scorpio', glyph: '♏', element: 'Water', modality: 'Fixed', ruler: 'Pluto and Mars', start: [10, 23], traits: ['intense', 'perceptive', 'private'] },
  { id: 'sagittarius', name: 'Sagittarius', glyph: '♐', element: 'Fire', modality: 'Mutable', ruler: 'Jupiter', start: [11, 22], traits: ['adventurous', 'optimistic', 'blunt'] },
  { id: 'capricorn', name: 'Capricorn', glyph: '♑', element: 'Earth', modality: 'Cardinal', ruler: 'Saturn', start: [12, 22], traits: ['disciplined', 'ambitious', 'reserved'] },
  { id: 'aquarius', name: 'Aquarius', glyph: '♒', element: 'Air', modality: 'Fixed', ruler: 'Uranus and Saturn', start: [1, 20], traits: ['inventive', 'independent', 'detached'] },
  { id: 'pisces', name: 'Pisces', glyph: '♓', element: 'Water', modality: 'Mutable', ruler: 'Neptune and Jupiter', start: [2, 19], traits: ['empathetic', 'imaginative', 'elusive'] },
];

const BY_ID = new Map(ZODIAC_SIGNS.map((s) => [s.id, s]));
export function getZodiacSign(id: ZodiacSignId): ZodiacSign {
  const s = BY_ID.get(id);
  if (!s) throw new RangeError(`Unknown zodiac sign: ${id}`);
  return s;
}
