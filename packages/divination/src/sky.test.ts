import { describe, expect, it } from 'vitest';
import { castSky, moonPhaseFor } from './sky.js';
import { sunSign } from './western.js';
import type { SkyData } from './types.js';

const at = (iso: string) => new Date(iso);

describe('castSky', () => {
  it('places every body at the reference instant 2026-09-30T12:00Z', () => {
    const expected: SkyData = {
      moon: { phase: 'waning-gibbous', illumination: 0.83, waxing: false },
      bodies: [
        { body: 'sun', sign: 'libra', degree: 7, retrograde: false },
        { body: 'moon', sign: 'taurus', degree: 26, retrograde: false },
        { body: 'mercury', sign: 'scorpio', degree: 0, retrograde: false },
        { body: 'venus', sign: 'scorpio', degree: 8, retrograde: false },
        { body: 'mars', sign: 'leo', degree: 1, retrograde: false },
        { body: 'jupiter', sign: 'leo', degree: 19, retrograde: false },
        { body: 'saturn', sign: 'aries', degree: 11, retrograde: true },
      ],
    };
    expect(castSky(at('2026-09-30T12:00:00Z'))).toEqual(expected);
  });

  it('sees the full moon of 2026-09-26 (16:49Z)', () => {
    const { moon } = castSky(at('2026-09-26T17:00:00Z'));
    expect(moon.phase).toBe('full');
    expect(moon.illumination).toBeGreaterThanOrEqual(0.98);
  });

  it('sees the new moon of 2026-10-10 (15:50Z)', () => {
    const { moon } = castSky(at('2026-10-10T15:50:00Z'));
    expect(moon.phase).toBe('new');
    expect(moon.illumination).toBeLessThanOrEqual(0.02);
  });

  it('sees the first quarter of 2026-09-18 (20:44Z)', () => {
    const { moon } = castSky(at('2026-09-18T20:44:00Z'));
    expect(moon.phase).toBe('first-quarter');
    expect(moon.illumination).toBeGreaterThanOrEqual(0.45);
    expect(moon.illumination).toBeLessThanOrEqual(0.55);
    expect(moon.waxing).toBe(true);
  });

  it('flags Mercury retrograde (2026-10-24 … 2026-11-14) and not before it', () => {
    const mercury = (iso: string) => castSky(at(iso)).bodies.find((b) => b.body === 'mercury')!;
    expect(mercury('2026-11-01T12:00:00Z').retrograde).toBe(true);
    expect(mercury('2026-10-15T12:00:00Z').retrograde).toBe(false);
  });

  it('puts the Sun in the conventional sun sign for mid-sign dates', () => {
    for (let m = 1; m <= 12; m++) {
      const date = `2026-${String(m).padStart(2, '0')}-05`;
      expect(castSky(at(`${date}T12:00:00Z`)).bodies[0]!.sign, date).toBe(sunSign(date));
    }
  });

  it('never marks the Sun or Moon retrograde, and keeps degrees whole numbers in 0–29', () => {
    for (let d = 0; d < 60; d++) {
      const sky = castSky(new Date(Date.UTC(2026, 0, 1 + d, 12)));
      expect(sky.bodies.map((b) => b.body)).toEqual(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']);
      expect(sky.bodies[0]!.retrograde).toBe(false);
      expect(sky.bodies[1]!.retrograde).toBe(false);
      for (const b of sky.bodies) {
        expect(Number.isInteger(b.degree)).toBe(true);
        expect(b.degree).toBeGreaterThanOrEqual(0);
        expect(b.degree).toBeLessThanOrEqual(29);
      }
    }
  });
});

describe('moonPhaseFor', () => {
  it.each([
    [0, 'new'], [22.4, 'new'], [22.5, 'waxing-crescent'], [67.5, 'first-quarter'], [90, 'first-quarter'],
    [112.5, 'waxing-gibbous'], [157.5, 'full'], [180, 'full'], [202.5, 'waning-gibbous'],
    [247.5, 'last-quarter'], [270, 'last-quarter'], [292.5, 'waning-crescent'], [337.4, 'waning-crescent'], [337.5, 'new'],
  ] as const)('elongation %s° is %s', (e, phase) => {
    expect(moonPhaseFor(e)).toBe(phase);
  });
});
