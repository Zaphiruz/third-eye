import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { METHOD_INFO, METHODS } from '@third-eye/divination';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });

describe('GET /how-it-works', () => {
  it('is a public, cacheable, script-free page', async () => {
    const r = await ctx.app.inject({ method: 'GET', url: '/how-it-works' });   // no session cookie
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(r.headers['cache-control']).toBe('public, max-age=3600');
    expect(r.headers['x-robots-tag']).toBe('noindex');
    expect(r.headers['referrer-policy']).toBe('no-referrer');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-security-policy']).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(r.body.startsWith('<!doctype html>')).toBe(true);
    expect(r.body).not.toMatch(/<script/i);
    expect(r.body).toContain('<title>How readings work — Third Eye</title>');
  });

  it('explains how a reading is made, what is shared, and every method', async () => {
    const html = (await ctx.app.inject({ method: 'GET', url: '/how-it-works' })).body;
    expect(html).toContain('id="how"');
    expect(html).toContain('id="privacy"');
    for (const m of METHODS) {
      expect(html, m).toContain(`id="${m.toLowerCase()}"`);
      expect(html, m).toContain(`href="${METHOD_INFO[m].learnMoreUrl}"`);
    }
    expect(html).toContain('For reflection and entertainment');
  });
});
