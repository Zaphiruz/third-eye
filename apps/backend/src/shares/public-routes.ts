import type { FastifyInstance } from 'fastify';
import { shareFont } from './fonts.js';
import { sanitizeErrorLog } from '../errors.js';
import { renderErrorPage, renderNotFoundPage, renderSharePage } from './page.js';
import type { ShareService } from './service.js';

export const SHARE_PAGE_HEADERS = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
} as const;

export function registerPublicShareRoutes(app: FastifyInstance, deps: { shares: ShareService }): void {
  app.get<{ Params: { file: string } }>('/s/assets/:file', async (req, reply) => {
    const font = shareFont(req.params.file);
    if (!font) {
      return reply.code(404).headers(SHARE_PAGE_HEADERS).type('text/html; charset=utf-8').send(renderNotFoundPage());
    }
    return reply
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .type('font/woff2').send(font);
  });

  app.get<{ Params: { token: string } }>('/s/:token',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      reply.headers(SHARE_PAGE_HEADERS).type('text/html; charset=utf-8');
      try {
        const share = await deps.shares.findPublic(req.params.token);
        if (!share) return reply.code(404).send(renderNotFoundPage());
        return reply.send(renderSharePage(share));
      } catch (err) {
        req.log.error(sanitizeErrorLog(err), 'share page failed');
        return reply.code(500).send(renderErrorPage());
      }
    });

  // Any other /s/* path (e.g. /s/a/b) gets the same HTML 404 rather than the JSON not-found envelope.
  app.get('/s/*', async (_req, reply) =>
    reply.code(404).headers(SHARE_PAGE_HEADERS).type('text/html; charset=utf-8').send(renderNotFoundPage()));
}
