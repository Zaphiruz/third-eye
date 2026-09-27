import { describe, expect, it } from 'vitest';
import { ERROR_CODES, PERSONA_IDS, PERSONAS, DEFAULT_PERSONA } from './index.js';

describe('constants', () => {
  it('has every error code the API uses', () => {
    expect([...ERROR_CODES].sort()).toEqual(
      ['forbidden', 'internal', 'needs_onboarding', 'not_found', 'rate_limited', 'unauthorized', 'validation_error'],
    );
  });
  it('has display metadata for every persona and a valid default', () => {
    for (const id of PERSONA_IDS) {
      expect(PERSONAS[id].name.length).toBeGreaterThan(0);
      expect(PERSONAS[id].sampleLine.length).toBeGreaterThan(20);
    }
    expect(PERSONA_IDS).toContain(DEFAULT_PERSONA);
  });
});
