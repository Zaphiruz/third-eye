import { describe, expect, it } from 'vitest';
import { PROTECTED_ENV_KEYS, filterSecrets } from '../env-filter.mjs';

describe('filterSecrets', () => {
  it('applies ordinary keys and refuses protected ones (names only)', () => {
    const { applied, ignored } = filterSecrets({ DATABASE_URL: 'pg://x', NODE_ENV: 'development', AUTH_DEV_BYPASS: '1', ANTHROPIC_API_KEY: 'k' });
    expect(applied).toEqual({ DATABASE_URL: 'pg://x', ANTHROPIC_API_KEY: 'k' });
    expect(ignored.sort()).toEqual(['AUTH_DEV_BYPASS', 'NODE_ENV']);
  });
  it('protects the keys that change what code runs', () => {
    expect([...PROTECTED_ENV_KEYS].sort()).toEqual(['AUTH_DEV_BYPASS', 'NODE_ENV', 'NODE_EXTRA_CA_CERTS', 'NODE_OPTIONS', 'PATH', 'TZ']);
  });
  it('tolerates an empty secret bag', () => {
    expect(filterSecrets(null)).toEqual({ applied: {}, ignored: [] });
  });
});
