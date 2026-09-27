import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestCtx } from './test/helpers/test-app.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });

describe('app skeleton', () => {
  it('serves liveness and readiness', async () => {
    expect((await ctx.call(null, 'GET', '/health')).body).toEqual({ status: 'ok' });
    expect((await ctx.call(null, 'GET', '/api/ready')).body).toEqual({ status: 'ok' });
  });
  it('returns the error envelope for unknown routes', async () => {
    const r = await ctx.call(null, 'GET', '/api/nope');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: { code: 'not_found', message: 'Not found' } });
  });
  it('rejects mutating requests from a foreign origin', async () => {
    const r = await ctx.call(null, 'POST', '/api/nope', {}, { origin: 'https://evil.example' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('forbidden');
  });
});
