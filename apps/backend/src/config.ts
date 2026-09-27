export interface AppConfig {
  port: number; nodeEnv: string; databaseUrl: string; frontendOrigin: string;
  sessionSecret: string; cookieSecure: boolean; adminGroup: string; devBypass: boolean;
  trustProxyHops: number;
  oidc: { issuer: string; clientId: string; clientSecret: string; redirectUri: string };
  anthropic: AnthropicSettings;
}

export const THINKING_MODES = ['off', 'adaptive'] as const;
export const EFFORT_LEVELS = ['low', 'medium', 'high'] as const;
export interface AnthropicSettings {
  apiKey: string;
  model: string;
  /** 'off' (default) is faster and cheaper; 'adaptive' lets the model think before writing (not on Haiku). */
  thinking: (typeof THINKING_MODES)[number];
  /** Ignored on Haiku, which doesn't support it. */
  effort: (typeof EFFORT_LEVELS)[number];
}
type Env = Record<string, string | undefined>;

function oneOf<T extends string>(name: string, allowed: readonly T[], raw: string | undefined, fallback: T): T {
  if (raw === undefined || raw === '') return fallback;
  if (!(allowed as readonly string[]).includes(raw)) throw new Error(`${name} must be one of: ${allowed.join(', ')}`);
  return raw as T;
}

/** Haiku 4.5 takes neither adaptive thinking nor the effort setting. */
export const isHaikuModel = (model: string): boolean => model.startsWith('claude-haiku');

function anthropicSettings(env: Env, apiKey: string): AnthropicSettings {
  const model = env['ANTHROPIC_MODEL'] || 'claude-haiku-4-5';
  const thinking = oneOf('ANTHROPIC_THINKING', THINKING_MODES, env['ANTHROPIC_THINKING'], 'off');
  if (thinking === 'adaptive' && isHaikuModel(model)) {
    throw new Error(`ANTHROPIC_THINKING=adaptive is not supported on ${model}; use off or a Sonnet/Opus model`);
  }
  return { apiKey, model, thinking, effort: oneOf('ANTHROPIC_EFFORT', EFFORT_LEVELS, env['ANTHROPIC_EFFORT'], 'medium') };
}

/** Proxy hops that may set X-Forwarded-For. Defaults to 0 (trust nothing) so misconfiguration fails closed. */
function trustProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  return n;
}

export function loadConfig(env: Env = process.env): AppConfig {
  const required = (name: string): string => {
    const v = env[name];
    if (!v) throw new Error(`Missing required environment variable: ${name}`);
    return v;
  };
  const nodeEnv = env['NODE_ENV'] ?? 'development';
  const devBypass = env['AUTH_DEV_BYPASS'] === '1';
  if (devBypass && nodeEnv === 'production') throw new Error('AUTH_DEV_BYPASS must not be set in production');

  return {
    port: Number(env['PORT'] ?? '3000'), nodeEnv,
    databaseUrl: required('DATABASE_URL'),
    frontendOrigin: required('FRONTEND_ORIGIN'),
    sessionSecret: required('SESSION_SECRET'),
    cookieSecure: (env['SESSION_COOKIE_SECURE'] ?? (nodeEnv === 'production' ? 'true' : 'false')) === 'true',
    adminGroup: env['AUTHENTIK_ADMIN_GROUP'] ?? 'third-eye-admins',
    devBypass,
    trustProxyHops: trustProxyHops(env['TRUST_PROXY_HOPS']),
    oidc: {
      issuer: required('AUTHENTIK_ISSUER_URL'), clientId: required('AUTHENTIK_CLIENT_ID'),
      clientSecret: required('AUTHENTIK_CLIENT_SECRET'), redirectUri: required('AUTHENTIK_REDIRECT_URI'),
    },
    // The oracle is the product: no key, no start.
    anthropic: anthropicSettings(env, required('ANTHROPIC_API_KEY')),
  };
}
