# Third Eye — Part 3: Oracle & Fortunes (Tasks 13–16)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Read the index first: [2026-09-26-third-eye.md](2026-09-26-third-eye.md). This part depends on Parts 1 and 2. **No test in this part may call the real Anthropic API** — everything goes through the `OracleClient` interface and `FakeOracleClient`.

Test DB: `docker compose up -d postgres` must be running (see Task 2). Backend test command: `pnpm --filter @third-eye/backend test`.

---

### Task 13: Personas and prompt builder

**Files:**
- Create: `apps/backend/src/oracle/types.ts`, `apps/backend/src/oracle/personas.ts`, `apps/backend/src/oracle/prompt.ts`
- Test: `apps/backend/src/oracle/prompt.test.ts`

**Interfaces:**
- Consumes: `MethodResult`, `Method`, `METHODS`, `describeResult` (divination); `PersonaId`, `PERSONAS` (shared).
- Produces:
  - `OracleRequest`, `OracleResponse`, `OracleClient` (in `oracle/types.ts`, exactly as in the index).
  - `PERSONA_PROMPTS: Record<PersonaId, string>`.
  - `PROMPT_VERSION: string`.
  - `buildPrompt(input: PromptInput): OracleRequest` where `PromptInput = { persona: PersonaId; date: string; firstName: string | null; results: MethodResult[] }`.
  - `outputSchema(methods: Method[]): Record<string, unknown>` (JSON Schema for structured outputs).
  - `parseOracleOutput(text: string, methods: Method[]): OracleOutput` where `OracleOutput = { summary: string; readings: Partial<Record<Method, string>> }`; throws `OracleOutputError` on anything malformed.

**Privacy rule:** the prompt carries the derived results, the persona, the date and at most a first name. It must never contain the birth date, the full name, or the time zone.

- [ ] **Step 1: Write the failing test**

`apps/backend/src/oracle/prompt.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { castAll, seededRng } from '@third-eye/divination';
import { buildPrompt, outputSchema, parseOracleOutput, OracleOutputError } from './prompt.js';
import { PERSONA_PROMPTS } from './personas.js';

const results = castAll({ birthDate: '1990-06-15', fullName: 'Ada Byron Lovelace', bloodType: null }, seededRng(1));
const methods = results.map((r) => r.method);

describe('buildPrompt', () => {
  const req = buildPrompt({ persona: 'TRICKSTER', date: '2026-09-26', firstName: 'Ada', results });

  it('uses the persona voice in the system prompt', () => {
    expect(req.system).toContain(PERSONA_PROMPTS.TRICKSTER);
    expect(req.system).toMatch(/never (change|invent)/i);
  });
  it('lists every present method with its facts, and nothing for skipped methods', () => {
    for (const m of methods) expect(req.user).toContain(`[${m}]`);
    expect(req.user).not.toContain('[BLOODTYPE]');
    expect(req.user).toContain('Sun sign Gemini');
    expect(req.user).toContain('Saturday, 2026-09-26');
    expect(req.user).toContain('Seeker: Ada');
  });
  it('never leaks the birth date or the full name', () => {
    expect(req.user + req.system).not.toContain('1990-06-15');
    expect(req.user + req.system).not.toContain('Lovelace');
  });
  it('addresses an unnamed seeker neutrally', () => {
    expect(buildPrompt({ persona: 'MYSTIC', date: '2026-09-26', firstName: null, results }).user).toContain('Seeker: (name not given)');
  });
  it('requires exactly the present methods in the schema', () => {
    const s = outputSchema(methods) as any;
    expect(s.required).toEqual(['summary', 'readings']);
    expect(s.additionalProperties).toBe(false);
    expect(s.properties.readings.required).toEqual(methods);
    expect(s.properties.readings.additionalProperties).toBe(false);
    expect(req.schema).toEqual(s);
  });
});

describe('parseOracleOutput', () => {
  const good = { summary: 'Today glitters.', readings: Object.fromEntries(methods.map((m) => [m, `About ${m}.`])) };

  it('accepts a complete answer and trims text', () => {
    const out = parseOracleOutput(JSON.stringify({ ...good, summary: '  Today glitters.  ' }), methods);
    expect(out.summary).toBe('Today glitters.');
    expect(out.readings.TAROT).toBe('About TAROT.');
  });
  it.each([
    ['not json', 'nope'],
    ['missing a method', JSON.stringify({ ...good, readings: { TAROT: 'x' } })],
    ['an extra method', JSON.stringify({ ...good, readings: { ...good.readings, BLOODTYPE: 'x' } })],
    ['an empty reading', JSON.stringify({ ...good, readings: { ...good.readings, RUNE: '   ' } })],
    ['an empty summary', JSON.stringify({ ...good, summary: '' })],
  ])('rejects %s', (_label, text) => {
    expect(() => parseOracleOutput(text, methods)).toThrow(OracleOutputError);
  });
});
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/oracle`
Expected: FAIL — cannot resolve `./prompt.js`.

- [ ] **Step 2: Oracle types**

`apps/backend/src/oracle/types.ts`:
```ts
export interface OracleRequest { system: string; user: string; schema: Record<string, unknown> }
export interface OracleResponse { text: string; model: string; stopReason: string | null }
/** The only door to the language model. Production: Anthropic. Tests: FakeOracleClient. */
export interface OracleClient { complete(req: OracleRequest): Promise<OracleResponse> }
```

- [ ] **Step 3: Personas**

`apps/backend/src/oracle/personas.ts`:
```ts
import type { PersonaId } from '@third-eye/shared';

/** Voice only. Shared rules (accuracy, safety, format) are added by buildPrompt. */
export const PERSONA_PROMPTS: Record<PersonaId, string> = {
  MYSTIC:
    'You are The Mystic: a candlelit fortune-teller with a theatrical, incantatory voice. ' +
    'Address the reader as "seeker". Use rich imagery — veils, smoke, starlight, thresholds — and a slow, ' +
    'ceremonial rhythm, but keep every sentence understandable. Dramatic, never frightening.',
  CONFIDANT:
    'You are The Confidant: a warm, grounded friend who happens to know the symbols deeply. ' +
    'Speak plainly and kindly, connect the symbols to ordinary life — work, relationships, rest, small choices — ' +
    'and offer gentle, practical reflections. Reassuring without being saccharine.',
  TRICKSTER:
    'You are The Trickster: a playful, cheeky oracle who teases with affection. ' +
    'Use wit, light sarcasm and knowing asides, and have fun with the symbols, but land on something genuinely ' +
    'useful. Never mean, never mocking the reader for real problems.',
};
```

- [ ] **Step 4: Prompt builder, schema and parser**

`apps/backend/src/oracle/prompt.ts`:
```ts
import { z } from 'zod';
import { describeResult, type Method, type MethodResult } from '@third-eye/divination';
import type { PersonaId } from '@third-eye/shared';
import { PERSONA_PROMPTS } from './personas.js';
import type { OracleRequest } from './types.js';

/** Bump whenever the system prompt, user template or schema changes; stored on each fortune. */
export const PROMPT_VERSION = '2026-09-26.1';

export interface PromptInput { persona: PersonaId; date: string; firstName: string | null; results: MethodResult[] }
export interface OracleOutput { summary: string; readings: Partial<Record<Method, string>> }
export class OracleOutputError extends Error {}

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
```

- [ ] **Step 5: Run tests, commit**

Run: `pnpm --filter @third-eye/backend exec vitest run src/oracle`
Expected: PASS (11 tests).

```bash
git add -A
git commit -m "feat(oracle): persona prompts, structured output schema and parser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Anthropic client and `interpret`

**Files:**
- Create: `apps/backend/src/oracle/client.ts`, `apps/backend/src/oracle/interpret.ts`
- Modify: `apps/backend/package.json` (add `@anthropic-ai/sdk`), `apps/backend/src/test/helpers/fakes.ts`, `apps/backend/src/test/helpers/db.ts`
- Test: `apps/backend/src/oracle/interpret.test.ts`

**Interfaces:**
- Consumes: `buildPrompt`, `parseOracleOutput`, `PROMPT_VERSION`, `OracleClient` types; `fromDbDate`; Prisma models.
- Produces:
  - `createAnthropicOracleClient(cfg: { apiKey: string; model: string; timeoutMs?: number }): OracleClient`.
  - `createOracle(deps: { prisma: PrismaClient; client: OracleClient; log: OracleLog }): Oracle` with `Oracle.interpret(fortuneId): Promise<void>` — never rejects; concurrent calls for the same id collapse to one.
  - `OracleLog = Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>`.
  - `firstNameOf(fullName: string | null): string | null`.
  - Test helpers: `FakeOracleClient` (with `requests`, `enqueue(...)`, `hold()`), `autoAnswer(req)`, `seedFortune(prisma, userSub, opts)`, `silentLog`.

**Behaviour of `interpret`:**
1. Skip if this id is already in flight in this process, if the fortune doesn't exist, or if it is already `READY`.
2. Up to **2 attempts**. An attempt fails on any thrown error, a `stopReason` other than `end_turn` (e.g. `refusal`, `max_tokens`), or `OracleOutputError`.
3. Success → in one transaction write every result's `reading` and set the fortune `READY`, `summary`, `model`, `promptVersion`, `completedAt`, `lastError: null`, `attempts += n`.
4. Two failures → `FAILED`, `lastError` (message only, max 500 chars), `attempts += 2`.
5. Log fortune id, attempt number and error class/message — never prompt text or model output.

- [ ] **Step 1: Add the SDK**

Run: `pnpm --filter @third-eye/backend add @anthropic-ai/sdk`
Expected: dependency added to `apps/backend/package.json`.

- [ ] **Step 2: Anthropic client**

`apps/backend/src/oracle/client.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk';
import type { OracleClient } from './types.js';

export interface AnthropicOracleConfig { apiKey: string; model: string; timeoutMs?: number }

/**
 * Structured outputs: the response's text block is guaranteed to match `schema`.
 * SDK retries are off — interpret() owns the retry policy (exactly one retry).
 */
export function createAnthropicOracleClient(cfg: AnthropicOracleConfig): OracleClient {
  const client = new Anthropic({ apiKey: cfg.apiKey, maxRetries: 0, timeout: cfg.timeoutMs ?? 45_000 });
  return {
    async complete({ system, user, schema }) {
      const res = await client.messages.create({
        model: cfg.model,
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      });
      const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      return { text, model: res.model, stopReason: res.stop_reason };
    },
  };
}
```
If `tsc` rejects the `output_config` shape, check the installed SDK's `MessageCreateParams['output_config']` type (`node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts`) and match it — do not cast to `any`.

- [ ] **Step 3: Test fakes and fixtures**

Append to `apps/backend/src/test/helpers/fakes.ts`:
```ts
import type { OracleClient, OracleRequest, OracleResponse } from '../../oracle/types.js';

type Scripted = OracleResponse | Error | ((req: OracleRequest) => OracleResponse);

/** Answers every method in the request's schema with valid JSON. */
export function autoAnswer(req: OracleRequest): OracleResponse {
  const methods = (req.schema as any).properties.readings.required as string[];
  return {
    text: JSON.stringify({ summary: 'The stars are kind today.', readings: Object.fromEntries(methods.map((m) => [m, `A reading for ${m}.`])) }),
    model: 'fake-model',
    stopReason: 'end_turn',
  };
}

export class FakeOracleClient implements OracleClient {
  requests: OracleRequest[] = [];
  private script: Scripted[] = [];
  private gate: Promise<void> | null = null;

  /** Queue responses/errors for the next calls; after the queue drains, calls get autoAnswer. */
  enqueue(...items: Scripted[]): void { this.script.push(...items); }

  /** Make calls block until the returned release() is called. */
  hold(): () => void {
    let release!: () => void;
    this.gate = new Promise<void>((r) => { release = r; });
    return () => { this.gate = null; release(); };
  }

  async complete(req: OracleRequest): Promise<OracleResponse> {
    this.requests.push(req);
    if (this.gate) await this.gate;
    const next = this.script.shift();
    if (next === undefined) return autoAnswer(req);
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next(req) : next;
  }
}

export const silentLog = { info: () => {}, warn: () => {}, error: () => {} };
```
(Keep the existing `FakeOidcClient` above it; move the new `import type` line to the top of the file.)

Append to `apps/backend/src/test/helpers/db.ts`:
```ts
import type { FortuneStatus, Prisma } from '@prisma/client';
import { castAll, seededRng } from '@third-eye/divination';

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
```
(Add `PrismaClient` to the existing `@prisma/client` import in `db.ts`.)

- [ ] **Step 4: Write the failing test**

`apps/backend/src/oracle/interpret.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { getTestPrisma, resetDatabase, seedFortune } from '../test/helpers/db.js';
import { FakeOracleClient, autoAnswer, silentLog } from '../test/helpers/fakes.js';
import { createOracle, firstNameOf } from './interpret.js';
import { PROMPT_VERSION } from './prompt.js';

const prisma = getTestPrisma();
let fake: FakeOracleClient;
let sub: string;

beforeEach(async () => {
  await resetDatabase();
  fake = new FakeOracleClient();
  sub = 'u1';
  await prisma.user.create({ data: { sub, name: 'U', email: 'u@x', lastLoginAt: new Date() } });
});

const oracle = () => createOracle({ prisma, client: fake, log: silentLog });
const load = (id: string) => prisma.fortune.findUniqueOrThrow({ where: { id }, include: { results: true } });

describe('interpret', () => {
  it('writes the summary and every reading, and marks the fortune READY', async () => {
    const f = await seedFortune(prisma, sub);
    await oracle().interpret(f.id);
    const after = await load(f.id);
    expect(after.status).toBe('READY');
    expect(after.summary).toBe('The stars are kind today.');
    expect(after.model).toBe('fake-model');
    expect(after.promptVersion).toBe(PROMPT_VERSION);
    expect(after.attempts).toBe(1);
    expect(after.completedAt).not.toBeNull();
    for (const r of after.results) expect(r.reading).toBe(`A reading for ${r.method}.`);
    // draws untouched
    const byMethod = (rs: { method: string; data: unknown }[]) => Object.fromEntries(rs.map((x) => [x.method, x.data]));
    expect(byMethod(after.results)).toEqual(byMethod(f.results));
  });

  it('only asks about methods that were cast', async () => {
    const f = await seedFortune(prisma, sub, { bloodType: null });
    await oracle().interpret(f.id);
    expect(fake.requests[0]!.user).not.toContain('[BLOODTYPE]');
  });

  it('retries once after invalid output, then succeeds', async () => {
    fake.enqueue({ text: '{"summary":"x"}', model: 'fake-model', stopReason: 'end_turn' });
    const f = await seedFortune(prisma, sub);
    await oracle().interpret(f.id);
    const after = await load(f.id);
    expect(after.status).toBe('READY');
    expect(after.attempts).toBe(2);
    expect(fake.requests).toHaveLength(2);
  });

  it('treats a refusal as a failed attempt', async () => {
    fake.enqueue((req) => ({ ...autoAnswer(req), stopReason: 'refusal' }));
    const f = await seedFortune(prisma, sub);
    await oracle().interpret(f.id);
    expect((await load(f.id)).attempts).toBe(2);
  });

  it('marks FAILED after two failures and records the error', async () => {
    fake.enqueue(new Error('upstream 529'), new Error('timeout'));
    const f = await seedFortune(prisma, sub);
    await oracle().interpret(f.id);
    const after = await load(f.id);
    expect(after.status).toBe('FAILED');
    expect(after.lastError).toBe('timeout');
    expect(after.attempts).toBe(2);
    expect(after.results.every((r) => r.reading === null)).toBe(true);
  });

  it('collapses concurrent calls for the same fortune into one request', async () => {
    const f = await seedFortune(prisma, sub);
    const release = fake.hold();
    const o = oracle();
    const a = o.interpret(f.id);
    const b = o.interpret(f.id);
    release();
    await Promise.all([a, b]);
    expect(fake.requests).toHaveLength(1);
  });

  it('does nothing for READY or missing fortunes', async () => {
    const f = await seedFortune(prisma, sub, { status: 'READY' });
    await oracle().interpret(f.id);
    await oracle().interpret('00000000-0000-4000-8000-000000000000');
    expect(fake.requests).toHaveLength(0);
  });
});

describe('firstNameOf', () => {
  it('takes the first word', () => {
    expect(firstNameOf('Ada Byron Lovelace')).toBe('Ada');
    expect(firstNameOf('  Zoë ')).toBe('Zoë');
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf('   ')).toBeNull();
  });
});
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/oracle/interpret.test.ts`
Expected: FAIL — cannot resolve `./interpret.js`.

- [ ] **Step 5: Implement `interpret`**

`apps/backend/src/oracle/interpret.ts`:
```ts
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
        deps.log.error({ fortuneId, errMessage: errMessage(err) }, 'interpret crashed');
      } finally {
        inFlight.delete(fortuneId);
      }
    },
  };
}
```

- [ ] **Step 6: Run tests, commit**

Run: `pnpm --filter @third-eye/backend test; pnpm typecheck; pnpm lint`
Expected: PASS / exit 0.

```bash
git add -A
git commit -m "feat(oracle): anthropic structured-output client and interpret with one retry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Fortune service

**Files:**
- Create: `apps/backend/src/lib/rng.ts`, `apps/backend/src/fortunes/serialize.ts`, `apps/backend/src/fortunes/service.ts`
- Test: `apps/backend/src/fortunes/service.test.ts`

**Interfaces:**
- Consumes: `castAll`, `METHODS`, `Rng` (divination); `TodayDto`, `FortuneDto`, `FortunePageDto`, `HISTORY_PAGE_SIZE`, `isoDateSchema` (shared); `Oracle`; `localDate`, `toDbDate`, `fromDbDate`; `AppError`, `notFound`, `parse`.
- Produces:
  - `cryptoRng: Rng` (`apps/backend/src/lib/rng.ts`, uses `node:crypto.randomInt`).
  - `serializeFortune(f: Fortune & { results: FortuneResult[] }): FortuneDto`, `excerptOf(summary: string | null): string | null`.
  - `createFortuneService(deps: FortuneServiceDeps): FortuneService`:
    ```ts
    interface FortuneServiceDeps {
      prisma: PrismaClient; oracle: Oracle; rng: Rng; now: () => Date; staleMs: number;
      onInterpret?: (p: Promise<void>) => void;   // tests collect these to await background work
    }
    interface FortuneService {
      today(userSub: string): Promise<TodayDto>;          // AppError 409 needs_onboarding
      get(userSub: string, id: string): Promise<FortuneDto>;  // 404 if not the caller's
      history(userSub: string, cursor?: string): Promise<FortunePageDto>;  // 400 on bad cursor
    }
    ```

**`today` rules** (spec §6):
1. No birth date → `AppError(409, 'needs_onboarding', 'Complete your profile first')`.
2. `date = localDate(now(), user.timeZone)`.
3. Existing fortune for `(userSub, date)` → `resume` it and return `fresh: false`.
4. Otherwise `castAll(profile, rng)`; create fortune + results in one nested create; kick `oracle.interpret`; return `fresh: true`.
5. On unique violation (`P2002`, a concurrent request won) → re-read and resume, `fresh: false`.

**`resume` rules:** `READY` → return as is. `FAILED`, or `PENDING` with `startedAt` older than `staleMs` → claim it with a conditional `updateMany` (sets `PENDING`, `startedAt = now()`, `lastError = null`); only if exactly one row was claimed, kick `interpret`. Anything else → return as is. Draws are never touched.

- [ ] **Step 1: Write the failing test**

`apps/backend/src/fortunes/service.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { castAll, seededRng } from '@third-eye/divination';
import { getTestPrisma, resetDatabase, seedFortune } from '../test/helpers/db.js';
import { FakeOracleClient, silentLog } from '../test/helpers/fakes.js';
import { createOracle } from '../oracle/interpret.js';
import { toDbDate } from '../lib/dates.js';
import { createFortuneService } from './service.js';

const prisma = getTestPrisma();
let fake: FakeOracleClient;
let now: Date;
let pending: Promise<void>[];

function service(staleMs = 120_000) {
  return createFortuneService({
    prisma, oracle: createOracle({ prisma, client: fake, log: silentLog }), rng: seededRng(11),
    now: () => now, staleMs, onInterpret: (p) => pending.push(p),
  });
}
const settle = async () => { await Promise.all(pending.splice(0)); };
async function makeUser(sub: string, opts: { birthDate?: string | null; timeZone?: string; bloodType?: 'A' | null } = {}) {
  const birthDate = opts.birthDate === undefined ? '1990-06-15' : opts.birthDate;
  await prisma.user.create({ data: {
    sub, name: sub, email: `${sub}@x`, lastLoginAt: new Date(), timeZone: opts.timeZone ?? 'UTC',
    birthDate: birthDate ? toDbDate(birthDate) : null, bloodType: opts.bloodType ?? null,
  } });
}

beforeEach(async () => {
  await resetDatabase();
  fake = new FakeOracleClient();
  now = new Date('2026-09-26T15:00:00Z');
  pending = [];
});

describe('today', () => {
  it('requires onboarding', async () => {
    await makeUser('u1', { birthDate: null });
    await expect(service().today('u1')).rejects.toMatchObject({ status: 409, code: 'needs_onboarding' });
  });

  it('creates a pending fortune with real draws, then the oracle fills it in', async () => {
    await makeUser('u1', { bloodType: 'A' });
    const first = await service().today('u1');
    expect(first.fresh).toBe(true);
    expect(first.fortune.status).toBe('PENDING');
    expect(first.fortune.date).toBe('2026-09-26');
    expect(first.fortune.results.map((r) => r.method)).toEqual(['TAROT', 'RUNE', 'ICHING', 'WESTERN', 'CHINESE', 'NUMEROLOGY', 'BLOODTYPE']);
    expect(first.fortune.results.every((r) => r.reading === null)).toBe(true);
    const expected = castAll({ birthDate: '1990-06-15', fullName: null, bloodType: 'A' }, seededRng(11));
    expect(first.fortune.results.map((r) => r.data)).toEqual(expected.map((r) => r.data));

    await settle();
    const again = await service().today('u1');
    expect(again.fresh).toBe(false);
    expect(again.fortune.id).toBe(first.fortune.id);
    expect(again.fortune.status).toBe('READY');
    expect(again.fortune.summary).toBe('The stars are kind today.');
    expect(fake.requests).toHaveLength(1);
  });

  it('starts a new fortune on the next local day', async () => {
    await makeUser('u1');
    const a = await service().today('u1');
    await settle();
    now = new Date('2026-09-27T15:00:00Z');
    const b = await service().today('u1');
    expect(b.fresh).toBe(true);
    expect(b.fortune.id).not.toBe(a.fortune.id);
    expect(b.fortune.date).toBe('2026-09-27');
  });

  it("uses the user's time zone to decide what today is", async () => {
    now = new Date('2026-09-27T03:00:00Z');
    await makeUser('east', { timeZone: 'Asia/Tokyo' });
    await makeUser('west', { timeZone: 'America/Los_Angeles' });
    expect((await service().today('east')).fortune.date).toBe('2026-09-27');
    expect((await service().today('west')).fortune.date).toBe('2026-09-26');
  });

  it('two simultaneous requests create exactly one fortune and one oracle call', async () => {
    await makeUser('u1');
    const release = fake.hold();
    const svc = service();
    const [a, b] = await Promise.all([svc.today('u1'), svc.today('u1')]);
    release();
    await settle();
    expect(a.fortune.id).toBe(b.fortune.id);
    expect([a.fresh, b.fresh].sort()).toEqual([false, true]);
    expect(await prisma.fortune.count()).toBe(1);
    expect(fake.requests).toHaveLength(1);
  });

  it('re-kicks a stale PENDING fortune without re-rolling the draws', async () => {
    await makeUser('u1');
    const seeded = await seedFortune(prisma, 'u1', { startedAt: new Date(now.getTime() - 3 * 60_000) });
    const r = await service().today('u1');
    expect(r.fresh).toBe(false);
    await settle();
    const after = await prisma.fortune.findUniqueOrThrow({ where: { id: seeded.id }, include: { results: true } });
    expect(after.status).toBe('READY');
    const byMethod = (rs: { method: string; data: unknown }[]) => Object.fromEntries(rs.map((x) => [x.method, x.data]));
    expect(byMethod(after.results)).toEqual(byMethod(seeded.results));
  });

  it('leaves a fresh PENDING fortune alone', async () => {
    await makeUser('u1');
    await seedFortune(prisma, 'u1', { startedAt: new Date(now.getTime() - 30_000) });
    await service().today('u1');
    await settle();
    expect(fake.requests).toHaveLength(0);
  });

  it('retries a FAILED fortune when asked again', async () => {
    await makeUser('u1');
    fake.enqueue(new Error('down'), new Error('still down'));
    const first = await service().today('u1');
    await settle();
    expect((await service().get('u1', first.fortune.id)).status).toBe('FAILED');
    const retry = await service().today('u1');
    await settle();
    expect(retry.fortune.id).toBe(first.fortune.id);
    const done = await service().get('u1', first.fortune.id);
    expect(done.status).toBe('READY');
    expect(done.results.map((x) => x.data)).toEqual(first.fortune.results.map((x) => x.data));
  });
});

describe('get and history', () => {
  it("404s on another user's fortune", async () => {
    await makeUser('u1'); await makeUser('u2');
    const f = await seedFortune(prisma, 'u2');
    await expect(service().get('u1', f.id)).rejects.toMatchObject({ status: 404 });
  });

  it('pages newest first with a date cursor and only shows your own', async () => {
    await makeUser('u1'); await makeUser('u2');
    for (let d = 1; d <= 25; d++) {
      await seedFortune(prisma, 'u1', { date: `2026-08-${String(d).padStart(2, '0')}`, status: 'READY', summary: `Day ${d}. More text.` });
    }
    await seedFortune(prisma, 'u2', { date: '2026-08-10' });
    const p1 = await service().history('u1');
    expect(p1.items).toHaveLength(20);
    expect(p1.items[0]!.date).toBe('2026-08-25');
    expect(p1.items[0]!.excerpt).toBe('Day 25.');
    expect(p1.items[0]!.results.every((r) => r.reading === null)).toBe(true);
    expect(p1.nextCursor).toBe('2026-08-06');
    const p2 = await service().history('u1', p1.nextCursor!);
    expect(p2.items.map((i) => i.date)).toEqual(['2026-08-05', '2026-08-04', '2026-08-03', '2026-08-02', '2026-08-01']);
    expect(p2.nextCursor).toBeNull();
  });

  it('rejects a malformed cursor', async () => {
    await makeUser('u1');
    await expect(service().history('u1', 'yesterday')).rejects.toMatchObject({ status: 400 });
  });
});
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/fortunes`
Expected: FAIL — cannot resolve `./service.js`.

- [ ] **Step 2: Implement RNG and serializer**

`apps/backend/src/lib/rng.ts`:
```ts
import { randomInt } from 'node:crypto';
import type { Rng } from '@third-eye/divination';

/** Cryptographically random draws for production fortunes. */
export const cryptoRng: Rng = (maxExclusive) => randomInt(maxExclusive);
```

`apps/backend/src/fortunes/serialize.ts`:
```ts
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
```

- [ ] **Step 3: Implement the service**

`apps/backend/src/fortunes/service.ts`:
```ts
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
      where: { id, OR: [{ status: 'FAILED' }, { status: 'PENDING', startedAt: { lte: cutoff } }] },
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

      const existing = await prisma.fortune.findUnique({ where: key });
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
```

- [ ] **Step 4: Run tests, commit**

Run: `pnpm --filter @third-eye/backend test; pnpm typecheck; pnpm lint`
Expected: PASS / exit 0.

Note on the concurrency test: both `today` calls run `findUnique` before either creates, so one `create` hits `P2002` and follows step 5. If the test ever shows two oracle requests, the claim in `resume` is wrong — it must only kick when `updateMany` claimed exactly one row.

```bash
git add -A
git commit -m "feat(fortunes): daily get-or-create with race handling, stale re-kick and history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Fortune routes and server wiring

**Files:**
- Create: `apps/backend/src/fortunes/routes.ts`
- Modify: `apps/backend/src/app.ts`, `apps/backend/src/server.ts`, `apps/backend/src/test/helpers/test-app.ts`
- Test: `apps/backend/src/fortunes/routes.test.ts`

**Interfaces:**
- Consumes: `createFortuneService`, `createOracle`, `createAnthropicOracleClient`, `cryptoRng`, `uuidParam`.
- Produces:
  - `POST /api/fortunes/today` → `201 { data: TodayDto }` when `fresh`, else `200`.
  - `GET /api/fortunes/:id` → `{ data: FortuneDto }`.
  - `GET /api/fortunes?cursor=YYYY-MM-DD` → `{ data: FortunePageDto }`.
  - `BuildAppOptions` gains `oracleClient: OracleClient; now?: () => Date; rng?: Rng; staleMs?: number; onInterpret?: (p: Promise<void>) => void`.
  - Test ctx gains `fakeOracle: FakeOracleClient`, `setNow(d: Date)`, `settle(): Promise<void>`.

- [ ] **Step 1: Routes**

`apps/backend/src/fortunes/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import { uuidParam } from '../lib/ids.js';
import type { FortuneService } from './service.js';

export function registerFortuneRoutes(app: FastifyInstance, deps: { fortunes: FortuneService }): void {
  const auth = { preHandler: app.requireAuth };

  app.post('/api/fortunes/today', { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const data = await deps.fortunes.today(req.user!.sub);
    return reply.code(data.fresh ? 201 : 200).send({ data });
  });

  app.get<{ Params: { id: string } }>('/api/fortunes/:id', auth, async (req) => ({
    data: await deps.fortunes.get(req.user!.sub, uuidParam(req.params.id)),
  }));

  app.get<{ Querystring: { cursor?: string } }>('/api/fortunes', auth, async (req) => ({
    data: await deps.fortunes.history(req.user!.sub, req.query.cursor),
  }));
}
```

- [ ] **Step 2: Wire into `buildApp`**

In `apps/backend/src/app.ts` add imports:
```ts
import type { Rng } from '@third-eye/divination';
import { cryptoRng } from './lib/rng.js';
import { createOracle } from './oracle/interpret.js';
import type { OracleClient } from './oracle/types.js';
import { createFortuneService } from './fortunes/service.js';
import { registerFortuneRoutes } from './fortunes/routes.js';
```

Add to `BuildAppOptions`:
```ts
  oracleClient: OracleClient;
  /** Injectable clock and randomness for tests. */
  now?: () => Date;
  rng?: Rng;
  /** A PENDING fortune older than this is assumed orphaned (e.g. by a restart) and re-kicked. Default 2 min. */
  staleMs?: number;
  onInterpret?: (p: Promise<void>) => void;
```

Immediately before `return app;`, add:
```ts
  const oracle = createOracle({ prisma: options.prisma, client: options.oracleClient, log: app.log });
  const fortunes = createFortuneService({
    prisma: options.prisma, oracle, rng: options.rng ?? cryptoRng, now: options.now ?? (() => new Date()),
    staleMs: options.staleMs ?? 2 * 60_000,
    ...(options.onInterpret ? { onInterpret: options.onInterpret } : {}),
  });
  registerFortuneRoutes(app, { fortunes });
```

In `apps/backend/src/server.ts`, add `import { createAnthropicOracleClient } from './oracle/client.js';` and pass to `buildApp`:
```ts
  oracleClient: createAnthropicOracleClient({ apiKey: config.anthropic.apiKey, model: config.anthropic.model }),
```

- [ ] **Step 3: Extend the test app**

In `apps/backend/src/test/helpers/test-app.ts`:

- Change the fakes import to `import { FakeOidcClient, FakeOracleClient } from './fakes.js';` and add `import { seededRng } from '@third-eye/divination';`.
- Add to `TestCtx`:
```ts
  fakeOracle: FakeOracleClient;
  setNow(d: Date): void;
  /** Await every background interpretation started so far. */
  settle(): Promise<void>;
```
- In `createTestApp`, before `buildApp`:
```ts
  const fakeOracle = new FakeOracleClient();
  let now = new Date('2026-09-26T15:00:00Z');
  const pending: Promise<void>[] = [];
```
- Add to the `buildApp({...})` options:
```ts
    oracleClient: fakeOracle, now: () => now, rng: seededRng(11), onInterpret: (p) => { pending.push(p); },
```
- Add to the returned object:
```ts
    fakeOracle,
    setNow(d) { now = d; },
    async settle() { await Promise.all(pending.splice(0)); },
```

- [ ] **Step 4: Write the route tests**

`apps/backend/src/fortunes/routes.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';
import { resetDatabase, seedFortune } from '../test/helpers/db.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(async () => { await resetDatabase(); ctx.setNow(new Date('2026-09-26T15:00:00Z')); ctx.fakeOracle.requests.length = 0; });

describe('fortune routes', () => {
  it('requires a session', async () => {
    expect((await ctx.call(null, 'POST', '/api/fortunes/today')).status).toBe(401);
    expect((await ctx.call(null, 'GET', '/api/fortunes')).status).toBe(401);
  });

  it('409 needs_onboarding without a birth date', async () => {
    const u = await ctx.user({ birthDate: null });
    const r = await ctx.call(u, 'POST', '/api/fortunes/today');
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('needs_onboarding');
  });

  it('201 with draws first, then 200 and READY once interpreted', async () => {
    const u = await ctx.user({ persona: 'MYSTIC' });
    const first = await ctx.call(u, 'POST', '/api/fortunes/today');
    expect(first.status).toBe(201);
    expect(first.body.data.fresh).toBe(true);
    expect(first.body.data.fortune.persona).toBe('MYSTIC');
    const id = first.body.data.fortune.id;

    const polling = await ctx.call(u, 'GET', `/api/fortunes/${id}`);
    expect(['PENDING', 'READY']).toContain(polling.body.data.status);

    await ctx.settle();
    const ready = await ctx.call(u, 'GET', `/api/fortunes/${id}`);
    expect(ready.body.data.status).toBe('READY');
    expect(ready.body.data.results.every((r: any) => typeof r.reading === 'string')).toBe(true);

    const second = await ctx.call(u, 'POST', '/api/fortunes/today');
    expect(second.status).toBe(200);
    expect(second.body.data).toMatchObject({ fresh: false, fortune: { id, status: 'READY' } });
  });

  it("404s on malformed ids and other users' fortunes", async () => {
    const a = await ctx.user(); const b = await ctx.user();
    const f = await seedFortune(ctx.prisma, b.sub);
    expect((await ctx.call(a, 'GET', `/api/fortunes/${f.id}`)).status).toBe(404);
    expect((await ctx.call(a, 'GET', '/api/fortunes/not-a-uuid')).status).toBe(404);
  });

  it('lists history and validates the cursor', async () => {
    const u = await ctx.user();
    await seedFortune(ctx.prisma, u.sub, { date: '2026-09-20', status: 'READY' });
    await seedFortune(ctx.prisma, u.sub, { date: '2026-09-21', status: 'READY' });
    const r = await ctx.call(u, 'GET', '/api/fortunes');
    expect(r.body.data.items.map((i: any) => i.date)).toEqual(['2026-09-21', '2026-09-20']);
    expect(r.body.data.nextCursor).toBeNull();
    expect((await ctx.call(u, 'GET', '/api/fortunes?cursor=nope')).status).toBe(400);
  });
});
```

Run: `pnpm --filter @third-eye/backend test`
Expected: PASS (all backend tests).

- [ ] **Step 5: Manual smoke test against the real API (optional, costs ~1¢)**

With a real `ANTHROPIC_API_KEY` in `.env` (and `AUTH_DEV_BYPASS=1`), start the backend in one terminal:
```bash
pnpm --filter @third-eye/backend dev
```
In another, log in through the dev bypass with a cookie jar, onboard, and ask for today's fortune:
```bash
curl -s -c /tmp/te.jar -o /dev/null http://localhost:3001/api/auth/dev-login?sub=dev
curl -s -b /tmp/te.jar -X PATCH http://localhost:3001/api/me -H 'origin: http://localhost:5174' -H 'content-type: application/json' -d '{"birthDate":"1990-06-15","timeZone":"UTC"}'
curl -s -b /tmp/te.jar -X POST http://localhost:3001/api/fortunes/today -H 'origin: http://localhost:5174'
```
Expected: the last call returns `201` JSON with `fresh: true`, status `PENDING` and six results (no blood type). Wait ~20 s, then:
```bash
curl -s -b /tmp/te.jar http://localhost:3001/api/fortunes/<id-from-previous-response>
```
Expected: `status: "READY"`, a summary of roughly 120–200 words and six readings in the Confidant voice. Delete `/tmp/te.jar` afterwards.

- [ ] **Step 6: Typecheck, lint, commit**

Run: `pnpm typecheck; pnpm lint; pnpm build`
Expected: exit 0.

```bash
git add -A
git commit -m "feat(fortunes): today/get/history routes wired to the anthropic oracle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
