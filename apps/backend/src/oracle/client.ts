import Anthropic from '@anthropic-ai/sdk';
import type { AnthropicSettings } from '../config.js';
import type { OracleClient, OracleRequest } from './types.js';

export interface AnthropicOracleConfig extends AnthropicSettings { timeoutMs?: number }

export function buildMessageParams(cfg: AnthropicOracleConfig, req: OracleRequest): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: cfg.model,
    max_tokens: 16000,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
    thinking: cfg.thinking === 'adaptive' ? { type: 'adaptive' } : { type: 'disabled' },
    output_config: { effort: cfg.effort, format: { type: 'json_schema', schema: req.schema } },
  };
}

/**
 * Structured outputs: the response's text block is guaranteed to match `schema`.
 * SDK retries are off — interpret() owns the retry policy (exactly one retry).
 */
export function createAnthropicOracleClient(cfg: AnthropicOracleConfig): OracleClient {
  const client = new Anthropic({ apiKey: cfg.apiKey, maxRetries: 0, timeout: cfg.timeoutMs ?? 45_000 });
  return {
    async complete(req) {
      const res = await client.messages.create(buildMessageParams(cfg, req));
      const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      return { text, model: res.model, stopReason: res.stop_reason };
    },
  };
}
