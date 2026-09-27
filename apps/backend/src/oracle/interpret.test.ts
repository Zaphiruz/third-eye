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

  it('marks FAILED (not stuck PENDING) when building the prompt throws', async () => {
    const f = await seedFortune(prisma, sub);
    const tarot = f.results.find((r) => r.method === 'TAROT')!;
    await prisma.fortuneResult.update({ where: { id: tarot.id }, data: { data: {} } });
    await oracle().interpret(f.id);
    const after = await load(f.id);
    expect(after.status).toBe('FAILED');
    expect(after.lastError).not.toBeNull();
    expect(after.attempts).toBe(1);
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
