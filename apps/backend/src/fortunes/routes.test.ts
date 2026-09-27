import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';
import { resetDatabase, seedFortune } from '../test/helpers/db.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(async () => { await resetDatabase(); ctx.setNow(new Date('2026-09-26T15:00:00Z')); ctx.fakeOracle.requests.length = 0; });

describe('fortune routes', () => {
  it('requires a session', async () => {
    expect((await ctx.call(null, 'POST', '/api/fortunes/today')).status).toBe(401);
    expect((await ctx.call(null, 'GET', '/api/fortunes')).status).toBe(401);
  });

  it('409 needs_onboarding without a birth date', async () => {
    const u = await ctx.user({ birthDate: null });
    const r = await ctx.call(u, 'POST', '/api/fortunes/today');
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('needs_onboarding');
  });

  it('201 with draws first, then 200 and READY once interpreted', async () => {
    const u = await ctx.user({ persona: 'MYSTIC' });
    const first = await ctx.call(u, 'POST', '/api/fortunes/today');
    expect(first.status).toBe(201);
    expect(first.body.data.fresh).toBe(true);
    expect(first.body.data.fortune.persona).toBe('MYSTIC');
    const id = first.body.data.fortune.id;

    const polling = await ctx.call(u, 'GET', `/api/fortunes/${id}`);
    expect(['PENDING', 'READY']).toContain(polling.body.data.status);

    await ctx.settle();
    const ready = await ctx.call(u, 'GET', `/api/fortunes/${id}`);
    expect(ready.body.data.status).toBe('READY');
    expect(ready.body.data.results.every((r: any) => typeof r.reading === 'string')).toBe(true);

    const second = await ctx.call(u, 'POST', '/api/fortunes/today');
    expect(second.status).toBe(200);
    expect(second.body.data).toMatchObject({ fresh: false, fortune: { id, status: 'READY' } });
  });

  it("404s on malformed ids and other users' fortunes", async () => {
    const a = await ctx.user(); const b = await ctx.user();
    const f = await seedFortune(ctx.prisma, b.sub);
    expect((await ctx.call(a, 'GET', `/api/fortunes/${f.id}`)).status).toBe(404);
    expect((await ctx.call(a, 'GET', '/api/fortunes/not-a-uuid')).status).toBe(404);
  });

  it('lists history and validates the cursor', async () => {
    const u = await ctx.user();
    await seedFortune(ctx.prisma, u.sub, { date: '2026-09-20', status: 'READY' });
    await seedFortune(ctx.prisma, u.sub, { date: '2026-09-21', status: 'READY' });
    const r = await ctx.call(u, 'GET', '/api/fortunes');
    expect(r.body.data.items.map((i: any) => i.date)).toEqual(['2026-09-21', '2026-09-20']);
    expect(r.body.data.nextCursor).toBeNull();
    expect((await ctx.call(u, 'GET', '/api/fortunes?cursor=nope')).status).toBe(400);
  });
});
