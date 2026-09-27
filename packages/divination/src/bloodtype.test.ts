import { describe, expect, it } from 'vitest';
import { castBloodType } from './bloodtype.js';
import { BLOOD_TYPES } from './data/blood-types.js';

describe('castBloodType', () => {
  it('returns null without a blood type', () => {
    expect(castBloodType({ birthDate: '1990-06-15', fullName: null, bloodType: null })).toBeNull();
  });
  it('wraps the type', () => {
    expect(castBloodType({ birthDate: '1990-06-15', fullName: null, bloodType: 'AB' })).toEqual({ type: 'AB' });
  });
  it('has a profile for every type', () => {
    expect(Object.keys(BLOOD_TYPES).sort()).toEqual(['A', 'AB', 'B', 'O']);
  });
});
