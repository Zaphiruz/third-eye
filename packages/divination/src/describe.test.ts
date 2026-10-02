import { describe, expect, it } from 'vitest';
import { describeResult } from './describe.js';

describe('describeResult', () => {
  it('describes a tarot spread with positions, orientation and keywords', () => {
    const d = describeResult({ method: 'TAROT', data: { cards: [
      { id: 'major-16', reversed: true, position: 'situation' },
      { id: 'cups-01', reversed: false, position: 'challenge' },
      { id: 'swords-12', reversed: false, position: 'advice' },
    ] } });
    expect(d.title).toBe('Tarot');
    expect(d.facts[0]).toBe('Situation: The Tower (reversed) — averted disaster, delayed change, fear of collapse');
    expect(d.facts[1]).toBe('Challenge: Ace of Cups (upright) — new love, compassion, emotional beginning');
  });
  it('describes an I Ching cast with changing lines and relating hexagram', () => {
    const d = describeResult({ method: 'ICHING', data: { lines: [9, 9, 9, 9, 9, 9], primary: 1, changingLines: [1, 2, 3, 4, 5, 6], relating: 2 } });
    expect(d.facts).toEqual([
      'Primary hexagram 1: The Creative (Qián) — creative power, initiative, persistence',
      'Changing lines: 1, 2, 3, 4, 5, 6',
      'Relating hexagram 2: The Receptive (Kūn) — receptivity, devotion, yielding strength',
    ]);
  });
  it('describes the sky: moon first, then each body, then the retrograde summary', () => {
    const data = {
      moon: { phase: 'waning-gibbous' as const, illumination: 0.83, waxing: false },
      bodies: [
        { body: 'sun' as const, sign: 'libra' as const, degree: 7, retrograde: false },
        { body: 'moon' as const, sign: 'taurus' as const, degree: 26, retrograde: false },
        { body: 'mercury' as const, sign: 'scorpio' as const, degree: 0, retrograde: true },
        { body: 'venus' as const, sign: 'scorpio' as const, degree: 8, retrograde: false },
        { body: 'mars' as const, sign: 'leo' as const, degree: 1, retrograde: false },
        { body: 'jupiter' as const, sign: 'leo' as const, degree: 19, retrograde: false },
        { body: 'saturn' as const, sign: 'aries' as const, degree: 11, retrograde: true },
      ],
    };
    const d = describeResult({ method: 'SKY', data });
    expect(d.title).toBe('The Sky');
    expect(d.facts).toEqual([
      'Moon: waning gibbous, 83% lit, in Taurus 26°',
      'Sun in Libra 7°',
      'Mercury in Scorpio 0° (retrograde)',
      'Venus in Scorpio 8°',
      'Mars in Leo 1°',
      'Jupiter in Leo 19°',
      'Saturn in Aries 11° (retrograde)',
      'Retrograde today: Mercury, Saturn',
    ]);
    const direct = { ...data, bodies: data.bodies.map((b) => ({ ...b, retrograde: false })) };
    expect(describeResult({ method: 'SKY', data: direct }).facts.at(-1)).toBe('No planets retrograde today');
  });
  it('describes the birth-based methods', () => {
    expect(describeResult({ method: 'WESTERN', data: { sign: 'gemini' } }).facts[0])
      .toBe('Sun sign Gemini ♊ — Air, Mutable, ruled by Mercury — curious, adaptable, restless');
    expect(describeResult({ method: 'CHINESE', data: { animal: 'horse', element: 'metal', polarity: 'yang', lunarYear: 1990 } }).facts[0])
      .toBe('Metal Horse (yang) — Horse: free-spirited, energetic, impatient; Metal: determination, discipline, clarity');
    expect(describeResult({ method: 'NUMEROLOGY', data: { lifePath: 11, expression: null } }).facts)
      .toEqual(['Life Path 11 (master number): The Intuitive — insight, inspiration, sensitivity']);
    expect(describeResult({ method: 'BLOODTYPE', data: { type: 'AB' } }).facts[0])
      .toBe('Blood type AB: The Enigmatic Dreamer — rational, adaptable, dual-natured, imaginative');
    expect(describeResult({ method: 'RUNE', data: { id: 'ansuz', reversed: false } }).facts[0])
      .toBe('Ansuz ᚨ (upright) — communication, wisdom, divine message');
  });
});
