import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import type { BloodType, Persona, PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';
import { createSessionStore } from '../../auth/session.js';
import { toDbDate } from '../../lib/dates.js';
import { getTestPrisma } from './db.js';
import { FakeOidcClient } from './fakes.js';

export const TEST_ORIGIN = 'http://localhost:5174';
export const TEST_COOKIE = 'third_eye_sid';
export interface TestUser { sub: string; name: string; cookie: string }
export interface CallResult { status: number; body: any; headers: Record<string, unknown> }
export interface UserOpts {
  name?: string; admin?: boolean; birthDate?: string | null; fullName?: string | null;
  bloodType?: BloodType | null; timeZone?: string; persona?: Persona;
}

export interface TestCtx {
  app: FastifyInstance;
  prisma: PrismaClient;
  fakeOidc: FakeOidcClient;
  call(user: TestUser | null, method: string, url: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<CallResult>;
  /** Onboarded by default (birthDate 1990-06-15, UTC). Pass birthDate: null for a fresh user. */
  user(opts?: UserOpts): Promise<TestUser>;
  close(): Promise<void>;
}

export interface CreateTestAppOpts {
  /** Passthrough to buildApp, e.g. to point Fastify's pino logger at an in-memory stream for log assertions. */
  logger?: FastifyServerOptions['logger'];
}

export async function createTestApp(opts: CreateTestAppOpts = {}): Promise<TestCtx> {
  const prisma = getTestPrisma();
  const fakeOidc = new FakeOidcClient();
  const sessions = createSessionStore(prisma, 3600);
  const app = await buildApp({
    prisma, frontendOrigin: TEST_ORIGIN, sessionSecret: 'test-secret', cookieSecure: false,
    oidcClient: fakeOidc, adminGroup: 'third-eye-admins', devBypass: false, disableRateLimit: true,
    ...(opts.logger !== undefined ? { logger: opts.logger } : {}),
  });
  await app.ready();
  let n = 0;
  return {
    app,
    prisma,
    fakeOidc,
    async call(user, method, url, body, extraHeaders = {}) {
      const res = await app.inject({
        method: method as 'GET',
        url,
        headers: {
          origin: TEST_ORIGIN,
          ...(user ? { cookie: user.cookie } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...extraHeaders,
        },
        ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
      });
      let parsed: unknown = null;
      try { parsed = res.body ? JSON.parse(res.body) : null; } catch { parsed = res.body; }
      return { status: res.statusCode, body: parsed, headers: res.headers };
    },
    async user(opts = {}) {
      n++;
      const sub = `sub-${Date.now()}-${n}`;
      const name = opts.name ?? `User ${n}`;
      const birthDate = opts.birthDate === undefined ? '1990-06-15' : opts.birthDate;
      await prisma.user.create({
        data: {
          sub, name, email: `u${n}@example.com`, lastLoginAt: new Date(),
          birthDate: birthDate ? toDbDate(birthDate) : null,
          fullName: opts.fullName ?? null,
          bloodType: opts.bloodType ?? null,
          timeZone: opts.timeZone ?? 'UTC',
          ...(opts.persona ? { persona: opts.persona } : {}),
        },
      });
      const sid = await sessions.create(sub, { groups: opts.admin ? ['third-eye-admins'] : [] });
      return { sub, name, cookie: `${TEST_COOKIE}=${sid}` };
    },
    async close() { await app.close(); },
  };
}
