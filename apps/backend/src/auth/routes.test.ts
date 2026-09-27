import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';
import { resetDatabase } from '../test/helpers/db.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(resetDatabase);

function cookieFrom(headers: Record<string, unknown>, name: string): string | undefined {
  const raw = headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  return list.find((c) => c.startsWith(`${name}=`))?.split(';')[0];
}

describe('auth', () => {
  it('login sets the signed state cookie and redirects to the provider', async () => {
    const r = await ctx.call(null, 'GET', '/api/auth/login');
    expect(r.status).toBe(302);
    expect(r.headers['location']).toBe('https://auth.example/authorize');
    expect(cookieFrom(r.headers, 'third_eye_oidc')).toBeDefined();
  });

  it('callback upserts the user, creates a session, and /me reports a not-yet-onboarded profile', async () => {
    ctx.fakeOidc.userinfo = { sub: 'abc', email: 'a@b.c', name: 'Ada', groups: ['third-eye-admins'], idToken: 't' };
    const login = await ctx.call(null, 'GET', '/api/auth/login');
    const state = cookieFrom(login.headers, 'third_eye_oidc')!;
    const cb = await ctx.call(null, 'GET', '/api/auth/callback?code=c&state=state-0', undefined, { cookie: state });
    expect(cb.status).toBe(302);
    expect(cb.headers['location']).toBe('http://localhost:5174/');
    const sid = cookieFrom(cb.headers, 'third_eye_sid')!;
    const me = await ctx.call(null, 'GET', '/api/me', undefined, { cookie: sid });
    expect(me.status).toBe(200);
    expect(me.body.data).toEqual({
      user: { sub: 'abc', name: 'Ada', email: 'a@b.c', isAdmin: true },
      profile: { birthDate: null, fullName: null, bloodType: null, timeZone: 'UTC', persona: 'CONFIDANT' },
      onboarded: false,
    });
  });

  it('callback rejects a state mismatch', async () => {
    const login = await ctx.call(null, 'GET', '/api/auth/login');
    const state = cookieFrom(login.headers, 'third_eye_oidc')!;
    const cb = await ctx.call(null, 'GET', '/api/auth/callback?code=c&state=WRONG', undefined, { cookie: state });
    expect(cb.status).toBe(400);
  });

  it('/me is 401 without a session; onboarded users are reported as such', async () => {
    expect((await ctx.call(null, 'GET', '/api/me')).status).toBe(401);
    const u = await ctx.user();
    const me = await ctx.call(u, 'GET', '/api/me');
    expect(me.body.data.user.isAdmin).toBe(false);
    expect(me.body.data.onboarded).toBe(true);
    expect(me.body.data.profile.birthDate).toBe('1990-06-15');
  });

  it('logout destroys the session', async () => {
    const u = await ctx.user();
    const out = await ctx.call(u, 'POST', '/api/auth/logout');
    expect(out.status).toBe(200);
    expect(out.body.data.endSessionUrl).toBe('https://auth.example/logout');
    expect((await ctx.call(u, 'GET', '/api/me')).status).toBe(401);
  });

  it('dev-login does not exist unless devBypass is on', async () => {
    expect((await ctx.call(null, 'GET', '/api/auth/dev-login?sub=x')).status).toBe(404);
  });
});
