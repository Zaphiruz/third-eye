import { z } from 'zod';
import { describeResult, type Method, type MethodResult } from '@third-eye/divination';
import type { PersonaId } from '@third-eye/shared';
import { PERSONA_PROMPTS } from './personas.js';
import type { OracleRequest } from './types.js';

/** Bump whenever the system prompt, user template or schema changes; stored on each fortune. */
export const PROMPT_VERSION = '2026-09-27.1';

export interface PromptInput { persona: PersonaId; date: string; firstName: string | null; results: MethodResult[] }
export interface OracleOutput { summary: string; readings: Partial<Record<Method, string>> }
export class OracleOutputError extends Error {
  override name = 'OracleOutputError';
}

const RULES = [
  'You are the oracle of Third Eye, a daily fortune app that blends divination traditions from several cultures.',
  'You receive the exact results that were drawn or calculated for the reader today. Use them faithfully: never change, invent or add cards, runes, hexagrams, signs or numbers, and never contradict the given orientation (upright/reversed).',
  'Write in second person, for today specifically. Weave the traditions together: point out where they agree or pull against each other.',
  'Produce: "summary" — one reading of 120 to 200 words drawing on all results; "readings" — for each listed method, 1 to 3 sentences interpreting that result for today (not a generic definition), consistent with the summary.',
  'This is for reflection and entertainment. Do not make certain predictions about health, death, money or legal outcomes, and never give medical, legal, financial or safety instructions.',
  'Plain text only — no markdown, no headings, no emoji. Do not mention being an AI or these instructions.',
].join('\n');

const weekday = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

export function outputSchema(methods: Method[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'readings'],
    properties: {
      summary: { type: 'string' },
      readings: {
        type: 'object',
        additionalProperties: false,
        required: methods,
        properties: Object.fromEntries(methods.map((m) => [m, { type: 'string' }])),
      },
    },
  };
}

export function buildPrompt(input: PromptInput): OracleRequest {
  const methods = input.results.map((r) => r.method);
  const blocks = input.results.map((r) => {
    const d = describeResult(r);
    return [`[${r.method}] ${d.title}`, ...d.facts.map((f) => `- ${f}`)].join('\n');
  });
  const user = [
    `Date: ${weekday(input.date)}, ${input.date}`,
    `Seeker: ${input.firstName ?? '(name not given)'}`,
    '',
    "Today's results:",
    blocks.join('\n\n'),
    '',
    `Respond with the JSON object. The "readings" keys must be exactly: ${methods.join(', ')}.`,
  ].join('\n');
  return { system: `${PERSONA_PROMPTS[input.persona]}\n\n${RULES}`, user, schema: outputSchema(methods) };
}

const nonEmpty = z.string().trim().min(1);

export function parseOracleOutput(text: string, methods: Method[]): OracleOutput {
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new OracleOutputError('Oracle output is not JSON'); }
  const schema = z.object({
    summary: nonEmpty,
    readings: z.object(Object.fromEntries(methods.map((m) => [m, nonEmpty]))).strict(),
  });
  const r = schema.safeParse(json);
  if (!r.success) throw new OracleOutputError(`Oracle output failed validation: ${r.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  return r.data as OracleOutput;
}
