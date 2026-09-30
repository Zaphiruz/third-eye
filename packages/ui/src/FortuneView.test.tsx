import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FortuneDto } from '@third-eye/shared';
import { FortuneView } from './FortuneView.js';

const base: FortuneDto = {
  id: 'f1', date: '2026-09-26', status: 'READY', persona: 'MYSTIC', summary: 'The veil parts.',
  results: [
    { method: 'RUNE', data: { id: 'ansuz', reversed: false }, reading: 'Listen closely today.' },
    { method: 'NUMEROLOGY', data: { lifePath: 4, expression: null }, reading: 'Build steadily.' },
  ],
};

describe('FortuneView', () => {
  it('shows the persona, summary, each method with its facts and reading', () => {
    render(<FortuneView fortune={base} />);
    expect(screen.getByText('The Mystic')).toBeInTheDocument();
    expect(screen.getByText('The veil parts.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rune' })).toBeInTheDocument();
    expect(screen.getByText(/Ansuz ᚨ \(upright\)/)).toBeInTheDocument();
    expect(screen.getByText('Listen closely today.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Numerology' })).toBeInTheDocument();
  });

  it('shows placeholders while readings are pending', () => {
    render(<FortuneView fortune={{ ...base, status: 'PENDING', summary: null, results: base.results.map((r) => ({ ...r, reading: null })) }} />);
    expect(screen.getAllByTestId('reading-pending')).toHaveLength(2);
  });
});
