import { describe, expect, it } from 'vitest';
import { serializeRequest } from './logging.js';

const TOKEN = 'A'.repeat(21) + '_';

describe('serializeRequest', () => {
  it('drops query strings', () => {
    expect(serializeRequest({ method: 'GET', url: '/auth/cb?code=x&state=y' }).url).toBe('/auth/cb');
  });

  it('redacts share tokens but keeps other /s/ paths', () => {
    expect(serializeRequest({ method: 'GET', url: `/s/${TOKEN}` }).url).toBe('/s/<redacted>');
    expect(serializeRequest({ method: 'GET', url: `/s/${TOKEN}?x=1` }).url).toBe('/s/<redacted>');
    expect(serializeRequest({ method: 'GET', url: '/s/assets/cormorant-400.woff2' }).url).toBe('/s/assets/cormorant-400.woff2');
  });
});
