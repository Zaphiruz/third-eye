export const ERROR_CODES = [
  'validation_error', 'unauthorized', 'forbidden', 'not_found', 'needs_onboarding', 'rate_limited', 'internal',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const PERSONA_IDS = ['MYSTIC', 'CONFIDANT', 'TRICKSTER'] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];
export const DEFAULT_PERSONA: PersonaId = 'CONFIDANT';

/** Display metadata only. The system prompts live in apps/backend/src/oracle/personas.ts. */
export const PERSONAS: Record<PersonaId, { name: string; tagline: string; sampleLine: string }> = {
  MYSTIC: {
    name: 'The Mystic',
    tagline: 'Candlelit, theatrical, steeped in omen.',
    sampleLine: 'The veil parts, seeker… the Tower rises in your path, and the old walls tremble.',
  },
  CONFIDANT: {
    name: 'The Confidant',
    tagline: 'Warm, grounded, a friend who knows the symbols.',
    sampleLine: 'The Tower suggests something you have been holding together may need to shift — give yourself room.',
  },
  TRICKSTER: {
    name: 'The Trickster',
    tagline: 'Playful, cheeky, lovingly unimpressed.',
    sampleLine: 'The Tower, reversed. Something is about to go sideways and you are pretending it is not. Very on-brand.',
  },
};

export const HISTORY_PAGE_SIZE = 20;
