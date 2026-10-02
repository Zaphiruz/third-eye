import { describe, expect, it } from 'vitest';
import { METHOD_INFO } from './method-info.js';
import { METHODS } from '../types.js';

describe('METHOD_INFO', () => {
  it('explains every method with a short summary and an https link', () => {
    expect(Object.keys(METHOD_INFO).sort()).toEqual([...METHODS].sort());
    for (const m of METHODS) {
      const info = METHOD_INFO[m];
      expect(info.summary.length, m).toBeGreaterThan(80);
      expect(info.summary.length, m).toBeLessThan(420);
      expect(new URL(info.learnMoreUrl).protocol, m).toBe('https:');
      expect(info.learnMoreLabel.length, m).toBeGreaterThan(0);
    }
  });
});
