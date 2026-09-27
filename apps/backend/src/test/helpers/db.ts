import { PrismaClient } from '@prisma/client';
import type { FortuneStatus, Prisma } from '@prisma/client';
import { castAll, seededRng } from '@third-eye/divination';

let client: PrismaClient | undefined;
export function getTestPrisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export async function resetDatabase(): Promise<void> {
  const p = getTestPrisma();
  await p.fortuneResult.deleteMany();
  await p.fortune.deleteMany();
  await p.session.deleteMany();
  await p.user.deleteMany();
}

export interface SeedFortuneOpts {
  date?: string; status?: FortuneStatus; startedAt?: Date; summary?: string | null;
  bloodType?: 'A' | 'B' | 'AB' | 'O' | null; seed?: number;
}

/** Inserts a fortune with real draws (seeded) for `userSub`. Readings are filled when status is READY. */
export async function seedFortune(prisma: PrismaClient, userSub: string, opts: SeedFortuneOpts = {}) {
  const profile = { birthDate: '1990-06-15', fullName: null, bloodType: opts.bloodType ?? null };
  const results = castAll(profile, seededRng(opts.seed ?? 1));
  const status = opts.status ?? 'PENDING';
  return prisma.fortune.create({
    data: {
      userSub, date: new Date(`${opts.date ?? '2026-09-26'}T00:00:00.000Z`), status, persona: 'CONFIDANT',
      profileSnapshot: { ...profile, timeZone: 'UTC' } as Prisma.InputJsonValue,
      summary: status === 'READY' ? (opts.summary ?? 'A calm day. Then a surprise.') : null,
      startedAt: opts.startedAt ?? new Date(),
      results: { create: results.map((r) => ({
        method: r.method, data: r.data as unknown as Prisma.InputJsonValue,
        reading: status === 'READY' ? `Seeded ${r.method}.` : null,
      })) },
    },
    include: { results: true },
  });
}
