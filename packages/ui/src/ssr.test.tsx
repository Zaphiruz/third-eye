// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FortuneDto } from '@third-eye/shared';
import { FortuneView } from './index.js';

const fortune: FortuneDto = {
  id: 'f1', date: '2026-09-29', status: 'READY', persona: 'CONFIDANT', summary: 'A gentle day.',
  results: [
    { method: 'TAROT', data: { cards: [
      { id: 'major-16', reversed: true, position: 'situation' },
      { id: 'cups-01', reversed: false, position: 'challenge' },
      { id: 'swords-12', reversed: false, position: 'advice' },
    ] }, reading: 'Let go.' },
    { method: 'RUNE', data: { id: 'ansuz', reversed: false }, reading: 'Listen.' },
    { method: 'ICHING', data: { lines: [9, 8, 7, 6, 7, 8], primary: 63, changingLines: [1, 4], relating: 17 }, reading: 'Finish well.' },
    { method: 'WESTERN', data: { sign: 'gemini' }, reading: 'Curious.' },
  ],
};

describe('server rendering', () => {
  it('renders the fortune view to static HTML without a DOM', () => {
    const html = renderToStaticMarkup(<FortuneView fortune={fortune} />);
    expect(html).toContain('A gentle day.');
    expect(html).toContain('The Tower (reversed)');
    expect(html).toContain('Ansuz');
    expect(html).toContain('<svg');
    expect(html).not.toContain('<script');
  });
});
