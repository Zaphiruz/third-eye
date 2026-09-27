import type { Fortune, FortuneResult } from '@prisma/client';
import { METHODS, type MethodData } from '@third-eye/divination';
import type { FortuneDto, FortuneResultDto, FortuneSummaryDto, PersonaId } from '@third-eye/shared';
import { fromDbDate } from '../lib/dates.js';

type WithResults = Fortune & { results: FortuneResult[] };

function results(f: WithResults, withReadings: boolean): FortuneResultDto[] {
  return [...f.results]
    .sort((a, b) => METHODS.indexOf(a.method) - METHODS.indexOf(b.method))
    .map((r) => ({ method: r.method, data: r.data as unknown as MethodData, reading: withReadings ? r.reading : null }));
}

export function serializeFortune(f: WithResults): FortuneDto {
  return {
    id: f.id, date: fromDbDate(f.date), status: f.status, persona: f.persona as PersonaId,
    summary: f.summary, results: results(f, true),
  };
}

/** First sentence of the summary, at most 160 characters. */
export function excerptOf(summary: string | null): string | null {
  if (!summary) return null;
  const first = summary.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? summary;
  return first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first;
}

export function serializeSummary(f: WithResults): FortuneSummaryDto {
  return {
    id: f.id, date: fromDbDate(f.date), status: f.status, persona: f.persona as PersonaId,
    excerpt: excerptOf(f.summary), results: results(f, false),
  };
}
