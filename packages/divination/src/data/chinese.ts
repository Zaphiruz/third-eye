import type { ChineseAnimalId, ChineseElementId } from '../types.js';

export interface ChineseAnimal { id: ChineseAnimalId; name: string; glyph: string; traits: string[] }
export interface ChineseElement { id: ChineseElementId; name: string; traits: string[] }

/** Cycle order: index 0 (Rat) = lunar years 1924, 1936, 1948, … */
export const CHINESE_ANIMALS: ChineseAnimal[] = [
  { id: 'rat', name: 'Rat', glyph: '鼠', traits: ['quick-witted', 'resourceful', 'charming'] },
  { id: 'ox', name: 'Ox', glyph: '牛', traits: ['dependable', 'patient', 'determined'] },
  { id: 'tiger', name: 'Tiger', glyph: '虎', traits: ['brave', 'confident', 'unpredictable'] },
  { id: 'rabbit', name: 'Rabbit', glyph: '兔', traits: ['gentle', 'elegant', 'cautious'] },
  { id: 'dragon', name: 'Dragon', glyph: '龍', traits: ['ambitious', 'charismatic', 'energetic'] },
  { id: 'snake', name: 'Snake', glyph: '蛇', traits: ['wise', 'intuitive', 'enigmatic'] },
  { id: 'horse', name: 'Horse', glyph: '馬', traits: ['free-spirited', 'energetic', 'impatient'] },
  { id: 'goat', name: 'Goat', glyph: '羊', traits: ['gentle', 'creative', 'sympathetic'] },
  { id: 'monkey', name: 'Monkey', glyph: '猴', traits: ['clever', 'playful', 'inventive'] },
  { id: 'rooster', name: 'Rooster', glyph: '雞', traits: ['observant', 'hardworking', 'candid'] },
  { id: 'dog', name: 'Dog', glyph: '狗', traits: ['loyal', 'honest', 'protective'] },
  { id: 'pig', name: 'Pig', glyph: '豬', traits: ['generous', 'sincere', 'easygoing'] },
];

export const CHINESE_ELEMENTS: ChineseElement[] = [
  { id: 'wood', name: 'Wood', traits: ['growth', 'flexibility', 'generosity'] },
  { id: 'fire', name: 'Fire', traits: ['passion', 'dynamism', 'leadership'] },
  { id: 'earth', name: 'Earth', traits: ['stability', 'practicality', 'patience'] },
  { id: 'metal', name: 'Metal', traits: ['determination', 'discipline', 'clarity'] },
  { id: 'water', name: 'Water', traits: ['adaptability', 'intuition', 'diplomacy'] },
];

export const getChineseAnimal = (id: ChineseAnimalId): ChineseAnimal => CHINESE_ANIMALS.find((a) => a.id === id)!;
export const getChineseElement = (id: ChineseElementId): ChineseElement => CHINESE_ELEMENTS.find((e) => e.id === id)!;
