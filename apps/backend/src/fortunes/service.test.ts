import { beforeEach, describe, expect, it } from 'vitest';
import { castAll, seededRng } from '@third-eye/divination';
import { getTestPrisma, resetDatabase, seedFortune } from '../test/helpers/db.js';
import { FakeOracleClient, silentLog } from '../test/helpers/fakes.js';
import { createOracle } from '../oracle/interpret.js';
import { toDbDate } from '../lib/dates.js';
import { createFortuneService } from './service.js';

const prisma = getTestPrisma();
let fake: FakeOracleClient;
let now: Date;
let pending: Promise<void>[];

function service(staleMs = 120_000) {
  return createFortuneService({
    prisma, oracle: createOracle({ prisma, client: fake, log: silentLog }), rng: seededRng(11),
    now: () => now, staleMs, onInterpret: (p) => pending.push(p),
  });
}
const settle = async () => { await Promise.all(pending.splice(0)); };
async function makeUser(sub: string, opts: { birthDate?: string | null; timeZone?: string; bloodType?: 'A' | null } = {}) {
  const birthDate = opts.birthDate === undefined ? '1990-06-15' : opts.birthDate;
  await prisma.user.create({ data: {
    sub, name: sub, email: `${sub}@x`, lastLoginAt: new Date(), timeZone: opts.timeZone ?? 'UTC',
    birthDate: birthDate ? toDbDate(birthDate) : null, bloodType: opts.bloodType ?? null,
  } });
}

beforeEach(async () => {
  await resetDatabase();
  fake = new FakeOracleClient();
  now = new Date('2026-09-26T15:00:00Z');
  pending = [];
});

describe('today', () => {
  it('requires onboarding', async () => {
    await makeUser('u1', { birthDate: null });
    await expect(service().today('u1')).rejects.toMatchObject({ status: 409, code: 'needs_onboarding' });
  });

  it('creates a pending fortune with real draws, then the oracle fills it in', async () => {
    await makeUser('u1', { bloodType: 'A' });
    const first = await service().today('u1');
    expect(first.fresh).toBe(true);
    expect(first.fortune.status).toBe('PENDING');
    expect(first.fortune.date).toBe('2026-09-26');
    expect(first.fortune.results.map((r) => r.method)).toEqual(['TAROT', 'RUNE', 'ICHING', 'WESTERN', 'CHINESE', 'NUMEROLOGY', 'BLOODTYPE']);
    expect(first.fortune.results.every((r) => r.reading === null)).toBe(true);
    const expected = castAll({ birthDate: '1990-06-15', fullName: null, bloodType: 'A' }, seededRng(11));
    expect(first.fortune.results.map((r) => r.data)).toEqual(expected.map((r) => r.data));

    await settle();
    const again = await service().today('u1');
    expect(again.fresh).toBe(false);
    expect(again.fortune.id).toBe(first.fortune.id);
    expect(again.fortune.status).toBe('READY');
    expect(again.fortune.summary).toBe('The stars are kind today.');
    expect(fake.requests).toHaveLength(1);
  });

  it('starts a new fortune on the next local day', async () => {
    await makeUser('u1');
    const a = await service().today('u1');
    await settle();
    now = new Date('2026-09-27T15:00:00Z');
    const b = await service().today('u1');
    expect(b.fresh).toBe(true);
    expect(b.fortune.id).not.toBe(a.fortune.id);
    expect(b.fortune.date).toBe('2026-09-27');
  });

  it("uses the user's time zone to decide what today is", async () => {
    now = new Date('2026-09-27T03:00:00Z');
    await makeUser('east', { timeZone: 'Asia/Tokyo' });
    await makeUser('west', { timeZone: 'America/Los_Angeles' });
    expect((await service().today('east')).fortune.date).toBe('2026-09-27');
    expect((await service().today('west')).fortune.date).toBe('2026-09-26');
  });

  it('two simultaneous requests create exactly one fortune and one oracle call', async () => {
    await makeUser('u1');
    const release = fake.hold();
    const svc = service();
    const [a, b] = await Promise.all([svc.today('u1'), svc.today('u1')]);
    release();
    await settle();
    expect(a.fortune.id).toBe(b.fortune.id);
    expect([a.fresh, b.fresh].sort()).toEqual([false, true]);
    expect(await prisma.fortune.count()).toBe(1);
    expect(fake.requests).toHaveLength(1);
  });

  it('re-kicks a stale PENDING fortune without re-rolling the draws', async () => {
    await makeUser('u1');
    const seeded = await seedFortune(prisma, 'u1', { startedAt: new Date(now.getTime() - 3 * 60_000) });
    const r = await service().today('u1');
    expect(r.fresh).toBe(false);
    await settle();
    const after = await prisma.fortune.findUniqueOrThrow({ where: { id: seeded.id }, include: { results: true } });
    expect(after.status).toBe('READY');
    const byMethod = (rs: { method: string; data: unknown }[]) => Object.fromEntries(rs.map((x) => [x.method, x.data]));
    expect(byMethod(after.results)).toEqual(byMethod(seeded.results));
  });

  it('leaves a fresh PENDING fortune alone', async () => {
    await makeUser('u1');
    await seedFortune(prisma, 'u1', { startedAt: new Date(now.getTime() - 30_000) });
    await service().today('u1');
    await settle();
    expect(fake.requests).toHaveLength(0);
  });

  it('retries a FAILED fortune when asked again', async () => {
    await makeUser('u1');
    fake.enqueue(new Error('down'), new Error('still down'));
    const first = await service().today('u1');
    await settle();
    expect((await service().get('u1', first.fortune.id)).status).toBe('FAILED');
    const retry = await service().today('u1');
    await settle();
    expect(retry.fortune.id).toBe(first.fortune.id);
    const done = await service().get('u1', first.fortune.id);
    expect(done.status).toBe('READY');
    expect(done.results.map((x) => x.data)).toEqual(first.fortune.results.map((x) => x.data));
  });
});

describe('get and history', () => {
  it("404s on another user's fortune", async () => {
    await makeUser('u1'); await makeUser('u2');
    const f = await seedFortune(prisma, 'u2');
    await expect(service().get('u1', f.id)).rejects.toMatchObject({ status: 404 });
  });

  it('pages newest first with a date cursor and only shows your own', async () => {
    await makeUser('u1'); await makeUser('u2');
    for (let d = 1; d <= 25; d++) {
      await seedFortune(prisma, 'u1', { date: `2026-08-${String(d).padStart(2, '0')}`, status: 'READY', summary: `Day ${d}. More text.` });
    }
    await seedFortune(prisma, 'u2', { date: '2026-08-10' });
    const p1 = await service().history('u1');
    expect(p1.items).toHaveLength(20);
    expect(p1.items[0]!.date).toBe('2026-08-25');
    expect(p1.items[0]!.excerpt).toBe('Day 25.');
    expect(p1.items[0]!.results.every((r) => r.reading === null)).toBe(true);
    expect(p1.nextCursor).toBe('2026-08-06');
    const p2 = await service().history('u1', p1.nextCursor!);
    expect(p2.items.map((i) => i.date)).toEqual(['2026-08-05', '2026-08-04', '2026-08-03', '2026-08-02', '2026-08-01']);
    expect(p2.nextCursor).toBeNull();
  });

  it('rejects a malformed cursor', async () => {
    await makeUser('u1');
    await expect(service().history('u1', 'yesterday')).rejects.toMatchObject({ status: 400 });
  });
});
