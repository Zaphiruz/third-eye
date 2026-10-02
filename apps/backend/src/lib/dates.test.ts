import { describe, expect, it } from 'vitest';
import { fromDbDate, localDate, localNoonUtc, toDbDate } from './dates.js';

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

describe('localNoonUtc', () => {
  it.each([
    ['2026-09-30', 'UTC', '2026-09-30T12:00:00.000Z'],
    ['2026-09-30', 'America/Chicago', '2026-09-30T17:00:00.000Z'],      // CDT, UTC−5
    ['2026-09-30', 'Asia/Tokyo', '2026-09-30T03:00:00.000Z'],
    ['2026-09-30', 'Asia/Kolkata', '2026-09-30T06:30:00.000Z'],
    ['2026-09-30', 'Pacific/Kiritimati', '2026-09-29T22:00:00.000Z'],   // UTC+14
    ['2026-03-08', 'America/New_York', '2026-03-08T16:00:00.000Z'],     // DST starts 02:00 that morning
    ['2026-11-01', 'America/New_York', '2026-11-01T17:00:00.000Z'],     // DST ended 02:00 that morning
    ['2026-03-29', 'Europe/London', '2026-03-29T11:00:00.000Z'],        // BST starts 01:00 that morning
  ])('%s in %s → %s', (date, tz, iso) => {
    expect(localNoonUtc(date, tz).toISOString()).toBe(iso);
  });

  it('falls on the same local date', () => {
    for (const tz of ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Los_Angeles']) {
      expect(localDate(localNoonUtc('2026-09-30', tz), tz)).toBe('2026-09-30');
    }
  });
});
