import { describe, expect, it } from 'vitest';
import { ERROR_CODES, PERSONA_IDS, PERSONAS, DEFAULT_PERSONA, BIRTH_SIGN_METHODS } from './index.js';

describe('constants', () => {
  it('has every error code the API uses', () => {
    expect([...ERROR_CODES].sort()).toEqual(
      ['forbidden', 'internal', 'needs_onboarding', 'not_found', 'not_ready', 'rate_limited', 'unauthorized', 'validation_error'],
    );
  });
  it('lists the birth-based methods', () => {
    expect([...BIRTH_SIGN_METHODS]).toEqual(['WESTERN', 'CHINESE', 'NUMEROLOGY', 'BLOODTYPE']);
  });
  it('has display metadata for every persona and a valid default', () => {
    for (const id of PERSONA_IDS) {
      expect(PERSONAS[id].name.length).toBeGreaterThan(0);
      expect(PERSONAS[id].sampleLine.length).toBeGreaterThan(20);
    }
    expect(PERSONA_IDS).toContain(DEFAULT_PERSONA);
  });
});
