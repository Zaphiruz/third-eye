import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { METHODS, type MethodResult } from '@third-eye/divination';
import type { PersonaId } from '@third-eye/shared';
import { fromDbDate } from '../lib/dates.js';
import { buildPrompt, OracleOutputError, parseOracleOutput, PROMPT_VERSION } from './prompt.js';
import type { OracleClient } from './types.js';

export type OracleLog = Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;
export interface Oracle { interpret(fortuneId: string): Promise<void> }

const MAX_ATTEMPTS = 2;

export function firstNameOf(fullName: string | null): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

const errMessage = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 500);

export function createOracle(deps: { prisma: PrismaClient; client: OracleClient; log: OracleLog }): Oracle {
  const inFlight = new Set<string>();

  async function run(fortuneId: string): Promise<void> {
    const f = await deps.prisma.fortune.findUnique({ where: { id: fortuneId }, include: { results: true } });
    if (!f || f.status === 'READY') return;

    const results = f.results
      .map((r) => ({ method: r.method, data: r.data }) as unknown as MethodResult)
      .sort((a, b) => METHODS.indexOf(a.method) - METHODS.indexOf(b.method));
    const methods = results.map((r) => r.method);
    const snapshot = f.profileSnapshot as { fullName?: string | null };
    const request = buildPrompt({
      persona: f.persona as PersonaId, date: fromDbDate(f.date), firstName: firstNameOf(snapshot.fullName ?? null), results,
    });

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await deps.client.complete(request);
        if (res.stopReason !== 'end_turn') throw new OracleOutputError(`Unexpected stop reason: ${res.stopReason}`);
        const out = parseOracleOutput(res.text, methods);
        await deps.prisma.$transaction([
          ...f.results.map((r) => deps.prisma.fortuneResult.update({ where: { id: r.id }, data: { reading: out.readings[r.method]! } })),
          deps.prisma.fortune.update({
            where: { id: f.id },
            data: {
              status: 'READY', summary: out.summary, model: res.model, promptVersion: PROMPT_VERSION,
              completedAt: new Date(), lastError: null, attempts: { increment: attempt },
            },
          }),
        ]);
        deps.log.info({ fortuneId, attempt }, 'fortune interpreted');
        return;
      } catch (err) {
        lastError = err;
        deps.log.warn({ fortuneId, attempt, errType: (err as Error)?.name, errMessage: errMessage(err) }, 'oracle attempt failed');
      }
    }
    await deps.prisma.fortune.update({
      where: { id: f.id },
      data: { status: 'FAILED', lastError: errMessage(lastError), attempts: { increment: MAX_ATTEMPTS } },
    });
  }

  return {
    async interpret(fortuneId) {
      if (inFlight.has(fortuneId)) return;
      inFlight.add(fortuneId);
      try {
        await run(fortuneId);
      } catch (err) {
        deps.log.error({ fortuneId, errType: (err as Error)?.name, errMessage: errMessage(err) }, 'interpret crashed');
        try {
          await deps.prisma.fortune.updateMany({
            where: { id: fortuneId, status: 'PENDING' },
            data: { status: 'FAILED', lastError: errMessage(err), attempts: { increment: 1 } },
          });
        } catch (markErr) {
          deps.log.error({ fortuneId, errMessage: errMessage(markErr) }, 'failed to mark fortune FAILED after crash');
        }
      } finally {
        inFlight.delete(fortuneId);
      }
    },
  };
}
