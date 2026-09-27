import { vi } from 'vitest';

export interface MockReply { status?: number; body: unknown }
export type Handler = (req: { body: unknown; url: URL }) => MockReply | Promise<MockReply>;

/**
 * Replaces global fetch. Keys are "METHOD /path" (path without /api prefix and without query).
 * Returns the list of calls so tests can assert on them.
 */
export function installMockApi(handlers: Record<string, Handler | MockReply>) {
  const calls: { method: string; path: string; body: unknown; url: URL }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, '');
    const text = await req.text();
    const body = text ? JSON.parse(text) : undefined;
    calls.push({ method: req.method, path, body, url });
    const h = handlers[`${req.method} ${path}`];
    if (!h) return new Response(JSON.stringify({ error: { code: 'not_found', message: `unmocked ${req.method} ${path}` } }), { status: 404, headers: { 'content-type': 'application/json' } });
    const reply = typeof h === 'function' ? await h({ body, url }) : h;
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
  });
  return calls;
}

export const ok = (data: unknown, status = 200): MockReply => ({ status, body: { data } });
