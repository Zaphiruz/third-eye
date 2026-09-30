import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';
import { resetDatabase, seedFortune } from '../test/helpers/db.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(resetDatabase);

const body = { sharedByName: 'Ada', includeBirthSigns: false };

describe('share routes', () => {
  it('creates, lists and revokes a share for a READY fortune', async () => {
    const u = await ctx.user();
    const f = await seedFortune(ctx.prisma, u.sub, { status: 'READY' });
    const created = await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, body);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ sharedByName: 'Ada', includeBirthSigns: false });
    expect(created.body.data.url).toMatch(/^http:\/\/localhost:5174\/s\/[A-Za-z0-9_-]{22}$/);

    const second = await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, { sharedByName: 'Dad', includeBirthSigns: true });
    const list = await ctx.call(u, 'GET', `/api/fortunes/${f.id}/shares`);
    expect(list.body.data.map((s: any) => s.sharedByName)).toEqual(['Dad', 'Ada']);

    expect((await ctx.call(u, 'DELETE', `/api/shares/${second.body.data.id}`)).status).toBe(204);
    const after = await ctx.call(u, 'GET', `/api/fortunes/${f.id}/shares`);
    expect(after.body.data.map((s: any) => s.sharedByName)).toEqual(['Ada']);
    expect((await ctx.call(u, 'DELETE', `/api/shares/${second.body.data.id}`)).status).toBe(404);
  });

  it('refuses unfinished fortunes with 409 not_ready', async () => {
    const u = await ctx.user();
    const f = await seedFortune(ctx.prisma, u.sub, { status: 'PENDING' });
    const r = await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, body);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('not_ready');
  });

  it("404s on other users' fortunes and shares", async () => {
    const a = await ctx.user(); const b = await ctx.user();
    const f = await seedFortune(ctx.prisma, b.sub, { status: 'READY' });
    expect((await ctx.call(a, 'POST', `/api/fortunes/${f.id}/shares`, body)).status).toBe(404);
    expect((await ctx.call(a, 'GET', `/api/fortunes/${f.id}/shares`)).status).toBe(404);
    const s = await ctx.call(b, 'POST', `/api/fortunes/${f.id}/shares`, body);
    expect((await ctx.call(a, 'DELETE', `/api/shares/${s.body.data.id}`)).status).toBe(404);
    expect((await ctx.call(a, 'DELETE', '/api/shares/not-a-uuid')).status).toBe(404);
  });

  it('validates the body and requires a session and same origin', async () => {
    const u = await ctx.user();
    const f = await seedFortune(ctx.prisma, u.sub, { status: 'READY' });
    expect((await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, { sharedByName: '' , includeBirthSigns: true })).status).toBe(400);
    expect((await ctx.call(null, 'POST', `/api/fortunes/${f.id}/shares`, body)).status).toBe(401);
    expect((await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, body, { origin: 'https://evil.example' })).status).toBe(403);
  });
});
