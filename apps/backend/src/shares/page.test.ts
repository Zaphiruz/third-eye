import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';
import { resetDatabase, seedFortune } from '../test/helpers/db.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(resetDatabase);

async function share(opts: { includeBirthSigns?: boolean; name?: string } = {}) {
  const u = await ctx.user();
  const f = await seedFortune(ctx.prisma, u.sub, { status: 'READY', bloodType: 'O', date: '2026-09-29', summary: 'A gentle day.' });
  const r = await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, {
    sharedByName: opts.name ?? 'Ada', includeBirthSigns: opts.includeBirthSigns ?? false,
  });
  const token = (r.body.data.url as string).split('/s/')[1]!;
  return { u, f, token, id: r.body.data.id as string };
}
const page = (token: string) => ctx.app.inject({ method: 'GET', url: `/s/${token}` });

describe('public share page', () => {
  it('renders the fortune as static HTML with the right headers', async () => {
    const { token } = await share();
    const r = await page(token);
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-robots-tag']).toBe('noindex');
    expect(r.headers['referrer-policy']).toBe('no-referrer');
    expect(r.headers['content-security-policy']).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.body.startsWith('<!doctype html>')).toBe(true);
    expect(r.body).toContain('Shared by Ada');
    expect(r.body).toContain('Tuesday, September 29');
    expect(r.body).toContain('The Confidant');
    expect(r.body).toContain('A gentle day.');
    expect(r.body).toContain('Tarot');
    expect(r.body).not.toMatch(/<script/i);
  });

  it('hides birth-based methods unless the share includes them', async () => {
    const first = await share({ includeBirthSigns: false });
    const hidden = await page(first.token);
    expect(hidden.body).not.toContain('Sun Sign');
    expect(hidden.body).not.toContain('Blood Type');
    expect(hidden.body).not.toContain(first.f.id);
    await resetDatabase();
    const shown = await page((await share({ includeBirthSigns: true })).token);
    expect(shown.body).toContain('Sun Sign');
    expect(shown.body).toContain('Chinese Zodiac');
    expect(shown.body).toContain('Numerology');
    expect(shown.body).toContain('Blood Type');
  });

  it('emits link-preview tags', async () => {
    const { token } = await share();
    const html = (await page(token)).body;
    expect(html).toContain('<meta property="og:title" content="Ada&#x27;s fortune — Sep 29"/>');
    expect(html).toMatch(/<meta property="og:description" content="[^"]+ · [^"]+ · Hexagram \d+: [^"]+"\/>/);
    expect(html).toContain('<meta property="og:site_name" content="Third Eye"/>');
    expect(html).toContain('<meta name="twitter:card" content="summary"/>');
    expect(html).toContain('<meta name="robots" content="noindex"/>');
  });

  it('escapes the shared-by name', async () => {
    const { token } = await share({ name: '<script>alert(1)</script>' });
    const html = (await page(token)).body;
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('shows the same 404 page for revoked, unknown and malformed tokens', async () => {
    const { u, token, id } = await share();
    await ctx.call(u, 'DELETE', `/api/shares/${id}`);
    for (const t of [token, 'A'.repeat(22), 'bad']) {
      const r = await page(t);
      expect(r.statusCode).toBe(404);
      expect(r.headers['cache-control']).toBe('no-store');
      expect(r.headers['content-security-policy']).toContain("default-src 'none'");
      expect(r.headers['x-robots-tag']).toBe('noindex');
      expect(r.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(r.body).toContain('This link is no longer active');
      expect(r.body).not.toMatch(/<script/i);
    }
  });

  it('shows the 404 page when the shared fortune is not READY', async () => {
    const u = await ctx.user();
    const f = await seedFortune(ctx.prisma, u.sub, { status: 'PENDING' });
    await ctx.prisma.share.create({ data: { token: 'B'.repeat(22), fortuneId: f.id, userSub: u.sub, sharedByName: 'Ada' } });
    const r = await page('B'.repeat(22));
    expect(r.statusCode).toBe(404);
    expect(r.body).toContain('This link is no longer active');
  });

  it('serves the two fonts with immutable caching and nothing else', async () => {
    const f = await ctx.app.inject({ method: 'GET', url: '/s/assets/cormorant-400.woff2' });
    expect(f.statusCode).toBe(200);
    expect(f.headers['content-type']).toBe('font/woff2');
    expect(f.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(f.rawPayload.length).toBeGreaterThan(1000);
    expect((await ctx.app.inject({ method: 'GET', url: '/s/assets/..%2F..%2Fpackage.json' })).statusCode).toBe(404);
  });

  it('rejects inherited object keys as font names', async () => {
    for (const n of ['constructor', '__proto__', 'toString']) {
      expect((await ctx.app.inject({ method: 'GET', url: `/s/assets/${n}` })).statusCode).toBe(404);
    }
  });

  it('serves the HTML 404 with share headers for nested /s/ paths', async () => {
    const r = await ctx.app.inject({ method: 'GET', url: '/s/a/b' });
    expect(r.statusCode).toBe(404);
    expect(r.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(r.headers['content-security-policy']).toContain("default-src 'none'");
    expect(r.body).toContain('This link is no longer active');
  });

  it('serves an HTML 500 when the lookup fails', async () => {
    const spy = vi.spyOn(ctx.prisma.share, 'findUnique').mockRejectedValueOnce(new Error('db down'));
    const r = await page('C'.repeat(22));
    spy.mockRestore();
    expect(r.statusCode).toBe(500);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(r.body).toContain('The oracle is resting');
    expect(r.body.startsWith('<!doctype html>')).toBe(true);
  });
});
