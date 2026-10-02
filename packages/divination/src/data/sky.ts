import type { MoonPhase, SkyBody } from '../types.js';

export const SKY_BODY_IDS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const satisfies readonly SkyBody[];

// U+FE0E asks for the text (not emoji) presentation of each glyph.
export const SKY_BODIES: Record<SkyBody, { id: SkyBody; name: string; glyph: string }> = {
  sun: { id: 'sun', name: 'Sun', glyph: '☉︎' },
  moon: { id: 'moon', name: 'Moon', glyph: '☽︎' },
  mercury: { id: 'mercury', name: 'Mercury', glyph: '☿︎' },
  venus: { id: 'venus', name: 'Venus', glyph: '♀︎' },
  mars: { id: 'mars', name: 'Mars', glyph: '♂︎' },
  jupiter: { id: 'jupiter', name: 'Jupiter', glyph: '♃︎' },
  saturn: { id: 'saturn', name: 'Saturn', glyph: '♄︎' },
};

export const MOON_PHASE_NAMES: Record<MoonPhase, string> = {
  'new': 'New Moon', 'waxing-crescent': 'Waxing Crescent', 'first-quarter': 'First Quarter',
  'waxing-gibbous': 'Waxing Gibbous', 'full': 'Full Moon', 'waning-gibbous': 'Waning Gibbous',
  'last-quarter': 'Last Quarter', 'waning-crescent': 'Waning Crescent',
};
