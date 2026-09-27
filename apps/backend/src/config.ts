export interface AppConfig {
  port: number; nodeEnv: string; databaseUrl: string; frontendOrigin: string;
  sessionSecret: string; cookieSecure: boolean; adminGroup: string; devBypass: boolean;
  trustProxyHops: number;
  oidc: { issuer: string; clientId: string; clientSecret: string; redirectUri: string };
  anthropic: { apiKey: string; model: string };
}
type Env = Record<string, string | undefined>;

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
    anthropic: { apiKey: required('ANTHROPIC_API_KEY'), model: env['ANTHROPIC_MODEL'] || 'claude-sonnet-5' },
  };
}
