import { Prisma, type PrismaClient } from '@prisma/client';
import { castAll, type Rng } from '@third-eye/divination';
import { HISTORY_PAGE_SIZE, isoDateSchema, type FortuneDto, type FortunePageDto, type TodayDto } from '@third-eye/shared';
import { AppError, notFound, parse } from '../errors.js';
import { fromDbDate, localDate, toDbDate } from '../lib/dates.js';
import type { Oracle } from '../oracle/interpret.js';
import { serializeFortune, serializeSummary } from './serialize.js';

export interface FortuneServiceDeps {
  prisma: PrismaClient; oracle: Oracle; rng: Rng; now: () => Date; staleMs: number;
  onInterpret?: (p: Promise<void>) => void;
}
export interface FortuneService {
  today(userSub: string): Promise<TodayDto>;
  get(userSub: string, id: string): Promise<FortuneDto>;
  history(userSub: string, cursor?: string): Promise<FortunePageDto>;
}

const withResults = { results: true } as const;

/** A FAILED fortune is re-kicked only below this many total attempts, so a persistently broken reading stops billing retries. */
const MAX_TOTAL_ATTEMPTS = 8;

export function createFortuneService(deps: FortuneServiceDeps): FortuneService {
  const { prisma } = deps;

  function kick(id: string): void {
    const p = deps.oracle.interpret(id);
    deps.onInterpret?.(p);
  }

  async function resume(id: string): Promise<FortuneDto> {
    const f = await prisma.fortune.findUniqueOrThrow({ where: { id }, include: withResults });
    if (f.status === 'READY') return serializeFortune(f);
    const cutoff = new Date(deps.now().getTime() - deps.staleMs);
    const claimed = await prisma.fortune.updateMany({
      where: { id, OR: [{ status: 'FAILED', attempts: { lt: MAX_TOTAL_ATTEMPTS } }, { status: 'PENDING', startedAt: { lte: cutoff } }] },
      data: { status: 'PENDING', startedAt: deps.now(), lastError: null },
    });
    if (claimed.count !== 1) return serializeFortune(f);
    kick(id);
    return serializeFortune(await prisma.fortune.findUniqueOrThrow({ where: { id }, include: withResults }));
  }

  return {
    async today(userSub) {
      const user = await prisma.user.findUniqueOrThrow({ where: { sub: userSub } });
      if (!user.birthDate) throw new AppError(409, 'needs_onboarding', 'Complete your profile first');
      const date = localDate(deps.now(), user.timeZone);
      const key = { userSub_date: { userSub, date: toDbDate(date) } };

      // The newest fortune wins if it is dated today or later, so switching time zones can move a
      // fortune a day early but never produce an extra one.
      const existing = await prisma.fortune.findFirst({
        where: { userSub, date: { gte: toDbDate(date) } }, orderBy: { date: 'desc' },
      });
      if (existing) return { fortune: await resume(existing.id), fresh: false };

      const profile = { birthDate: fromDbDate(user.birthDate), fullName: user.fullName, bloodType: user.bloodType };
      const results = castAll(profile, deps.rng);
      try {
        const f = await prisma.fortune.create({
          data: {
            userSub, date: toDbDate(date), persona: user.persona, startedAt: deps.now(),
            profileSnapshot: { ...profile, timeZone: user.timeZone },
            results: { create: results.map((r) => ({ method: r.method, data: r.data as unknown as Prisma.InputJsonValue })) },
          },
          include: withResults,
        });
        kick(f.id);
        return { fortune: serializeFortune(f), fresh: true };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const winner = await prisma.fortune.findUniqueOrThrow({ where: key });
          return { fortune: await resume(winner.id), fresh: false };
        }
        throw err;
      }
    },

    async get(userSub, id) {
      const f = await prisma.fortune.findFirst({ where: { id, userSub }, include: withResults });
      if (!f) throw notFound();
      return serializeFortune(f);
    },

    async history(userSub, cursor) {
      const before = cursor === undefined ? undefined : parse(isoDateSchema, cursor);
      const rows = await prisma.fortune.findMany({
        where: { userSub, ...(before ? { date: { lt: toDbDate(before) } } : {}) },
        orderBy: { date: 'desc' },
        take: HISTORY_PAGE_SIZE + 1,
        include: withResults,
      });
      const page = rows.slice(0, HISTORY_PAGE_SIZE);
      return {
        items: page.map(serializeSummary),
        nextCursor: rows.length > HISTORY_PAGE_SIZE ? fromDbDate(page[page.length - 1]!.date) : null,
      };
    },
  };
}
