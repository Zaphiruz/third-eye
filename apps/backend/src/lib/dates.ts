/** The calendar date (YYYY-MM-DD) that `now` falls on in `timeZone`. */
export function localDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** YYYY-MM-DD → the Date Prisma needs for a @db.Date column. */
export const toDbDate = (d: string): Date => new Date(`${d}T00:00:00.000Z`);

/** @db.Date value → YYYY-MM-DD. */
export const fromDbDate = (d: Date): string => d.toISOString().slice(0, 10);

/** How far `timeZone`'s wall clock is ahead of UTC at `at`, in ms. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant the clock in `timeZone` reads 12:00 on `date` (YYYY-MM-DD). The SKY method is cast for it. */
export function localNoonUtc(date: string, timeZone: string): Date {
  const noonAsUtc = Date.parse(`${date}T12:00:00Z`);
  // Two passes: the second uses the offset in force at (approximately) local noon, which handles DST days.
  const first = noonAsUtc - zoneOffsetMs(new Date(noonAsUtc), timeZone);
  return new Date(noonAsUtc - zoneOffsetMs(new Date(first), timeZone));
}
