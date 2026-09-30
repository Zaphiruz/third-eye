import { describe, expect, it } from 'vitest';
import { isValidTimeZone, profileUpdateSchema, shareCreateSchema } from './schemas.js';

const ok = (v: unknown) => profileUpdateSchema.safeParse(v).success;

describe('profileUpdateSchema', () => {
  it('accepts a full onboarding payload', () => {
    expect(profileUpdateSchema.parse({
      birthDate: '1990-06-15', fullName: '  Ada Lovelace ', bloodType: 'AB', timeZone: 'America/Chicago', persona: 'MYSTIC',
    })).toEqual({ birthDate: '1990-06-15', fullName: 'Ada Lovelace', bloodType: 'AB', timeZone: 'America/Chicago', persona: 'MYSTIC' });
  });
  it('turns a blank name into null and allows clearing blood type', () => {
    expect(profileUpdateSchema.parse({ fullName: '   ', bloodType: null })).toEqual({ fullName: null, bloodType: null });
  });
  it('rejects impossible, future and pre-1900 birth dates', () => {
    expect(ok({ birthDate: '1990-02-30' })).toBe(false);
    expect(ok({ birthDate: '2999-01-01' })).toBe(false);
    expect(ok({ birthDate: '1899-12-31' })).toBe(false);
    expect(ok({ birthDate: '15/06/1990' })).toBe(false);
  });
  it('rejects null birth dates (it is required once set), unknown keys, and empty bodies', () => {
    expect(ok({ birthDate: null })).toBe(false);
    expect(ok({ favouriteColour: 'blue' })).toBe(false);
    expect(ok({})).toBe(false);
  });
  it('rejects bad enums and time zones', () => {
    expect(ok({ bloodType: 'C' })).toBe(false);
    expect(ok({ persona: 'WIZARD' })).toBe(false);
    expect(ok({ timeZone: 'Mars/Olympus_Mons' })).toBe(false);
  });
});

describe('isValidTimeZone', () => {
  it('knows real IANA zones', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
  });
});

describe('shareCreateSchema', () => {
  it('trims the name and requires a boolean', () => {
    expect(shareCreateSchema.parse({ sharedByName: '  Ada  ', includeBirthSigns: false })).toEqual({ sharedByName: 'Ada', includeBirthSigns: false });
  });
  it('rejects empty/overlong names, missing flags and unknown keys', () => {
    const bad = (v: unknown) => shareCreateSchema.safeParse(v).success;
    expect(bad({ sharedByName: '   ', includeBirthSigns: true })).toBe(false);
    expect(bad({ sharedByName: 'x'.repeat(61), includeBirthSigns: true })).toBe(false);
    expect(bad({ sharedByName: 'Ada' })).toBe(false);
    expect(bad({ sharedByName: 'Ada', includeBirthSigns: true, extra: 1 })).toBe(false);
  });
});
