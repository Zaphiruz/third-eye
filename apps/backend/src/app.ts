import Fastify, { type FastifyError, type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@prisma/client';
import { AppError, sanitizeErrorLog } from './errors.js';
import { makeRequireAuth } from './auth/middleware.js';
import { registerAuthRoutes, type AuthRouteDeps } from './auth/routes.js';
import { registerDevBypass } from './auth/dev-bypass.js';
import { createSessionStore } from './auth/session.js';
import type { OidcClient } from './auth/oidc.js';
import { registerProfileRoutes } from './profile/routes.js';
import type { Rng } from '@third-eye/divination';
import { cryptoRng } from './lib/rng.js';
import { createOracle } from './oracle/interpret.js';
import type { OracleClient } from './oracle/types.js';
import { createFortuneService } from './fortunes/service.js';
import { registerFortuneRoutes } from './fortunes/routes.js';
import { createShareService } from './shares/service.js';
import { registerShareRoutes } from './shares/routes.js';
import { registerPublicShareRoutes } from './shares/public-routes.js';

export interface BuildAppOptions {
  logger?: FastifyServerOptions['logger'];
  prisma: PrismaClient;
  frontendOrigin: string;
  sessionSecret: string;
  cookieSecure: boolean;
  disableRateLimit?: boolean;
  rateLimitMax?: number;
  /** Proxy hops to trust for req.ip / X-Forwarded-For. 0 (default) trusts none. */
  trustProxyHops?: number;
  oidcClient: OidcClient;
  adminGroup?: string;
  sessionTtlSeconds?: number;
  devBypass?: boolean;
  oracleClient: OracleClient;
  /** Injectable clock and randomness for tests. */
  now?: () => Date;
  rng?: Rng;
  /** A PENDING fortune older than this is assumed orphaned (e.g. by a restart) and re-kicked. Default 2 min. */
  staleMs?: number;
  onInterpret?: (p: Promise<void>) => void;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  // Fastify's numeric trustProxy is a no-op; the hop-count predicate is what proxy-addr honours.
  const trustProxyHops = options.trustProxyHops ?? 0;
  const app = Fastify({
    logger: options.logger ?? false,
    trustProxy: (_addr: string, hop: number) => hop < trustProxyHops,
  });

  await app.register(cookie, { secret: options.sessionSecret });

  if (!options.disableRateLimit) {
    await app.register(rateLimit, {
      global: true,
      max: options.rateLimitMax ?? 600,
      timeWindow: '1 minute',
      allowList: (req) => req.url === '/health',
      keyGenerator: (req) => `ip:${req.ip}`,
    });
  }

  app.addHook('onRequest', async (req) => {
    if (SAFE_METHODS.has(req.method)) return;
    if (req.headers.origin !== options.frontendOrigin) throw new AppError(403, 'forbidden', 'Bad origin');
  });

  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send({
        error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
      });
    }
    const status = (err as FastifyError).statusCode;
    if (status === 429) return reply.code(429).send({ error: { code: 'rate_limited', message: 'Too many requests' } });
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({ error: { code: 'validation_error', message: err.message } });
    }
    req.log.error(sanitizeErrorLog(err), 'unhandled error');
    return reply.code(500).send({ error: { code: 'internal', message: 'Internal error' } });
  });
  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ error: { code: 'not_found', message: 'Not found' } }),
  );

  const cookieName = 'third_eye_sid';
  const ttlSeconds = options.sessionTtlSeconds ?? 7 * 24 * 60 * 60;
  const adminGroup = options.adminGroup ?? 'third-eye-admins';
  const sessionStore = createSessionStore(options.prisma, ttlSeconds);
  app.decorate('requireAuth', makeRequireAuth({
    prisma: options.prisma, sessionStore, cookieName, cookieSecure: options.cookieSecure, ttlSeconds, adminGroup,
  }));

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/api/ready', async (req, reply) => {
    try {
      await options.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (err) {
      req.log.error({ err }, 'readiness probe failed');
      return reply.code(503).send({ status: 'degraded' });
    }
  });

  const authDeps: AuthRouteDeps = {
    prisma: options.prisma, sessionStore, oidcClient: options.oidcClient, cookieName,
    cookieSecure: options.cookieSecure, ttlSeconds, frontendOrigin: options.frontendOrigin,
  };
  registerAuthRoutes(app, authDeps);
  if (options.devBypass) registerDevBypass(app, authDeps, adminGroup);
  registerProfileRoutes(app, { prisma: options.prisma });

  const oracle = createOracle({ prisma: options.prisma, client: options.oracleClient, log: app.log });
  const fortunes = createFortuneService({
    prisma: options.prisma, oracle, rng: options.rng ?? cryptoRng, now: options.now ?? (() => new Date()),
    staleMs: options.staleMs ?? 2 * 60_000,
    ...(options.onInterpret ? { onInterpret: options.onInterpret } : {}),
  });
  registerFortuneRoutes(app, { fortunes });
  const shares = createShareService({ prisma: options.prisma, frontendOrigin: options.frontendOrigin });
  registerShareRoutes(app, { shares });
  registerPublicShareRoutes(app, { shares });

  return app;
}
