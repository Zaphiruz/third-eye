import type { FastifyInstance } from 'fastify';
import { SHARE_PAGE_HEADERS } from '../shares/public-routes.js';
import { renderHowItWorksPage } from './page.js';

/** Same lock-down as share pages, but identical for everyone, so it may be cached. */
export const HELP_PAGE_HEADERS = { ...SHARE_PAGE_HEADERS, 'cache-control': 'public, max-age=3600' } as const;

export function registerHelpRoutes(app: FastifyInstance): void {
  const html = renderHowItWorksPage(); // static: render once at startup
  app.get('/how-it-works', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (_req, reply) => reply.headers(HELP_PAGE_HEADERS).type('text/html; charset=utf-8').send(html));
}
