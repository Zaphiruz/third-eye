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
