import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const base = {
  DATABASE_URL: 'postgres://x', FRONTEND_ORIGIN: 'http://localhost:5174', SESSION_SECRET: 's',
  AUTHENTIK_ISSUER_URL: 'https://a/', AUTHENTIK_CLIENT_ID: 'id', AUTHENTIK_CLIENT_SECRET: 'sec',
  AUTHENTIK_REDIRECT_URI: 'http://localhost:5174/api/auth/callback', ANTHROPIC_API_KEY: 'sk-test',
};

describe('loadConfig', () => {
  it('loads defaults', () => {
    const c = loadConfig(base);
    expect(c.port).toBe(3000);
    expect(c.adminGroup).toBe('third-eye-admins');
    expect(c.anthropic).toEqual({ apiKey: 'sk-test', model: 'claude-sonnet-5', thinking: 'off', effort: 'medium' });
    expect(c.trustProxyHops).toBe(0);
  });
  it('refuses to start without an Anthropic key', () => {
    const { ANTHROPIC_API_KEY: _omit, ...rest } = base;
    expect(() => loadConfig(rest)).toThrow('ANTHROPIC_API_KEY');
  });
  it('refuses AUTH_DEV_BYPASS in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', AUTH_DEV_BYPASS: '1' })).toThrow('AUTH_DEV_BYPASS');
  });
  it('honours ANTHROPIC_MODEL', () => {
    expect(loadConfig({ ...base, ANTHROPIC_MODEL: 'claude-opus-5' }).anthropic.model).toBe('claude-opus-5');
  });
  it('reads the thinking and effort settings', () => {
    const c = loadConfig({ ...base, ANTHROPIC_THINKING: 'adaptive', ANTHROPIC_EFFORT: 'low' });
    expect(c.anthropic).toMatchObject({ thinking: 'adaptive', effort: 'low' });
  });
  it('rejects unknown thinking and effort values', () => {
    expect(() => loadConfig({ ...base, ANTHROPIC_THINKING: 'maybe' })).toThrow('ANTHROPIC_THINKING');
    expect(() => loadConfig({ ...base, ANTHROPIC_EFFORT: 'extreme' })).toThrow('ANTHROPIC_EFFORT');
  });
});
