import { describe, expect, it } from 'vitest';
import { buildMessageParams } from './client.js';

const req = { system: 'sys', user: 'hello', schema: { type: 'object' } };

describe('buildMessageParams', () => {
  it('disables thinking by default', () => {
    const p = buildMessageParams({ apiKey: 'k', model: 'claude-sonnet-5', thinking: 'off', effort: 'medium' }, req);
    expect(p).toMatchObject({
      model: 'claude-sonnet-5', system: 'sys', thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: 'hello' }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: { type: 'object' } } },
    });
  });
  it('uses adaptive thinking and the configured effort when turned on', () => {
    const p = buildMessageParams({ apiKey: 'k', model: 'claude-sonnet-5', thinking: 'adaptive', effort: 'high' }, req);
    expect(p.thinking).toEqual({ type: 'adaptive' });
    expect(p.output_config?.effort).toBe('high');
  });
});

describe('buildMessageParams on Haiku', () => {
  it('omits effort (not supported on Haiku 4.5) but keeps structured output and thinking off', () => {
    const p = buildMessageParams({ apiKey: 'k', model: 'claude-haiku-4-5', thinking: 'off', effort: 'medium' }, req);
    expect(p.thinking).toEqual({ type: 'disabled' });
    expect(p.output_config).toEqual({ format: { type: 'json_schema', schema: { type: 'object' } } });
  });
});
