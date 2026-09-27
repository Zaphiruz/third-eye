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
