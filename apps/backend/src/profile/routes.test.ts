import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';
import { resetDatabase } from '../test/helpers/db.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(resetDatabase);

describe('PATCH /api/me', () => {
  it('onboards a fresh user', async () => {
    const u = await ctx.user({ birthDate: null });
    const r = await ctx.call(u, 'PATCH', '/api/me', {
      birthDate: '1988-02-10', fullName: 'Ada Lovelace', bloodType: 'O', timeZone: 'America/Chicago', persona: 'TRICKSTER',
    });
    expect(r.status).toBe(200);
    expect(r.body.data.onboarded).toBe(true);
    expect(r.body.data.profile).toEqual({
      birthDate: '1988-02-10', fullName: 'Ada Lovelace', bloodType: 'O', timeZone: 'America/Chicago', persona: 'TRICKSTER',
    });
  });

  it('updates a single field and leaves the rest alone', async () => {
    const u = await ctx.user({ bloodType: 'A' });
    const r = await ctx.call(u, 'PATCH', '/api/me', { persona: 'MYSTIC' });
    expect(r.body.data.profile).toMatchObject({ birthDate: '1990-06-15', bloodType: 'A', persona: 'MYSTIC' });
  });

  it('returns field errors for invalid input', async () => {
    const u = await ctx.user();
    const r = await ctx.call(u, 'PATCH', '/api/me', { birthDate: '2999-01-01', timeZone: 'Nope/Nope' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('validation_error');
    expect(Object.keys(r.body.error.details.fieldErrors).sort()).toEqual(['birthDate', 'timeZone']);
  });

  it('requires a session and a same-origin request', async () => {
    expect((await ctx.call(null, 'PATCH', '/api/me', { persona: 'MYSTIC' })).status).toBe(401);
    const u = await ctx.user();
    expect((await ctx.call(u, 'PATCH', '/api/me', { persona: 'MYSTIC' }, { origin: 'https://evil.example' })).status).toBe(403);
  });
});
