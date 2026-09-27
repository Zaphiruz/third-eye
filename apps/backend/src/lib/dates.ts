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
