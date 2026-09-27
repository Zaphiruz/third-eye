export interface Rune { id: string; name: string; glyph: string; meaning: string[]; reversedMeaning: string[] | null }

export const RUNES: Rune[] = [
  { id: 'fehu', name: 'Fehu', glyph: 'ᚠ', meaning: ['wealth', 'abundance', 'earned reward'], reversedMeaning: ['loss', 'greed', 'setback'] },
  { id: 'uruz', name: 'Uruz', glyph: 'ᚢ', meaning: ['strength', 'vitality', 'endurance'], reversedMeaning: ['weakness', 'missed chance', 'low spirits'] },
  { id: 'thurisaz', name: 'Thurisaz', glyph: 'ᚦ', meaning: ['defence', 'conflict', 'catalyst'], reversedMeaning: ['danger', 'defencelessness', 'compulsion'] },
  { id: 'ansuz', name: 'Ansuz', glyph: 'ᚨ', meaning: ['communication', 'wisdom', 'divine message'], reversedMeaning: ['misunderstanding', 'deceit', 'bad counsel'] },
  { id: 'raidho', name: 'Raidho', glyph: 'ᚱ', meaning: ['journey', 'rhythm', 'right action'], reversedMeaning: ['disruption', 'stalled travel', 'injustice'] },
  { id: 'kenaz', name: 'Kenaz', glyph: 'ᚲ', meaning: ['illumination', 'creativity', 'knowledge'], reversedMeaning: ['darkness', 'blocked creativity', 'endings'] },
  { id: 'gebo', name: 'Gebo', glyph: 'ᚷ', meaning: ['gift', 'partnership', 'exchange'], reversedMeaning: null },
  { id: 'wunjo', name: 'Wunjo', glyph: 'ᚹ', meaning: ['joy', 'harmony', 'belonging'], reversedMeaning: ['sorrow', 'alienation', 'strife'] },
  { id: 'hagalaz', name: 'Hagalaz', glyph: 'ᚺ', meaning: ['disruption', 'uncontrolled forces', 'transformation'], reversedMeaning: null },
  { id: 'naudhiz', name: 'Naudhiz', glyph: 'ᚾ', meaning: ['need', 'constraint', 'endurance'], reversedMeaning: null },
  { id: 'isa', name: 'Isa', glyph: 'ᛁ', meaning: ['stillness', 'pause', 'clarity'], reversedMeaning: null },
  { id: 'jera', name: 'Jera', glyph: 'ᛃ', meaning: ['harvest', 'cycles', 'reward for patience'], reversedMeaning: null },
  { id: 'eihwaz', name: 'Eihwaz', glyph: 'ᛇ', meaning: ['endurance', 'protection', 'resilience'], reversedMeaning: null },
  { id: 'perthro', name: 'Perthro', glyph: 'ᛈ', meaning: ['mystery', 'fate', 'hidden things'], reversedMeaning: ['stagnation', 'secrets revealed', 'loneliness'] },
  { id: 'algiz', name: 'Algiz', glyph: 'ᛉ', meaning: ['protection', 'instinct', 'higher self'], reversedMeaning: ['vulnerability', 'hidden danger', 'warning'] },
  { id: 'sowilo', name: 'Sowilo', glyph: 'ᛊ', meaning: ['success', 'wholeness', 'the power of the sun'], reversedMeaning: null },
  { id: 'tiwaz', name: 'Tiwaz', glyph: 'ᛏ', meaning: ['justice', 'honour', 'courage'], reversedMeaning: ['injustice', 'imbalance', 'faltering will'] },
  { id: 'berkano', name: 'Berkano', glyph: 'ᛒ', meaning: ['growth', 'birth', 'renewal'], reversedMeaning: ['stagnation', 'anxiety', 'family troubles'] },
  { id: 'ehwaz', name: 'Ehwaz', glyph: 'ᛖ', meaning: ['movement', 'trust', 'teamwork'], reversedMeaning: ['restlessness', 'mistrust', 'disharmony'] },
  { id: 'mannaz', name: 'Mannaz', glyph: 'ᛗ', meaning: ['self', 'humanity', 'cooperation'], reversedMeaning: ['isolation', 'self-delusion', 'manipulation'] },
  { id: 'laguz', name: 'Laguz', glyph: 'ᛚ', meaning: ['flow', 'intuition', 'the unconscious'], reversedMeaning: ['confusion', 'fear', 'poor judgement'] },
  { id: 'ingwaz', name: 'Ingwaz', glyph: 'ᛜ', meaning: ['gestation', 'inner growth', 'completion'], reversedMeaning: null },
  { id: 'dagaz', name: 'Dagaz', glyph: 'ᛞ', meaning: ['breakthrough', 'awakening', 'daylight'], reversedMeaning: null },
  { id: 'othala', name: 'Othala', glyph: 'ᛟ', meaning: ['heritage', 'home', 'inheritance'], reversedMeaning: ['rootlessness', 'prejudice', 'loss of home'] },
];

const BY_ID = new Map(RUNES.map((r) => [r.id, r]));
export function getRune(id: string): Rune {
  const r = BY_ID.get(id);
  if (!r) throw new RangeError(`Unknown rune: ${id}`);
  return r;
}
