import { describe, expect, it } from 'vitest';
import { fromDbDate, localDate, toDbDate } from './dates.js';

describe('localDate', () => {
  const instant = new Date('2026-09-27T03:30:00Z');
  it('gives different calendar dates for the same instant in different zones', () => {
    expect(localDate(instant, 'UTC')).toBe('2026-09-27');
    expect(localDate(instant, 'America/Chicago')).toBe('2026-09-26');
    expect(localDate(instant, 'Asia/Tokyo')).toBe('2026-09-27');
  });
  it('zero-pads month and day', () => {
    expect(localDate(new Date('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05');
  });
});

describe('db date conversion', () => {
  it('round-trips a calendar date without drifting a day', () => {
    expect(fromDbDate(toDbDate('1990-02-28'))).toBe('1990-02-28');
    expect(toDbDate('1990-02-28').toISOString()).toBe('1990-02-28T00:00:00.000Z');
  });
});
