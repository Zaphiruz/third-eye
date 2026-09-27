import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FortuneResultDto } from '@third-eye/shared';
import { TarotCard } from './TarotCard';
import { RuneStone } from './RuneStone';
import { Hexagram } from './Hexagram';
import { SignRing, signItems } from './SignRing';

describe('symbols', () => {
  it('labels tarot cards by name and orientation', () => {
    render(<><TarotCard cardId="major-16" reversed /><TarotCard cardId="cups-01" reversed={false} /><TarotCard cardId="cups-02" reversed={false} faceDown /></>);
    expect(screen.getByRole('img', { name: 'The Tower (reversed)' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ace of Cups' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Face-down card' })).toBeInTheDocument();
  });

  it('labels runes', () => {
    render(<RuneStone runeId="ansuz" reversed />);
    expect(screen.getByRole('img', { name: 'Ansuz (reversed)' })).toBeInTheDocument();
  });

  it('gives each rune stone instance a unique gradient id', () => {
    const { container } = render(<><RuneStone runeId="ansuz" reversed={false} /><RuneStone runeId="ansuz" reversed={false} /></>);
    const gradients = container.querySelectorAll('radialGradient');
    expect(gradients).toHaveLength(2);
    const ids = Array.from(gradients).map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
    const ellipses = container.querySelectorAll('ellipse');
    expect(ellipses).toHaveLength(2);
    ellipses.forEach((ellipse, i) => {
      expect(ellipse.getAttribute('fill')).toBe(`url(#${ids[i]})`);
    });
  });

  it('draws six lines and marks the changing ones', () => {
    const { container } = render(<Hexagram lines={[9, 8, 7, 6, 7, 8]} />);
    const lines = container.querySelectorAll('[data-line]');
    expect(lines).toHaveLength(6);
    expect(container.querySelectorAll('[data-changing]')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Hexagram 63: After Completion' })).toBeInTheDocument();
  });

  it('reveals only the bottom lines during the ritual', () => {
    const { container } = render(<Hexagram lines={[7, 7, 7, 8, 8, 8]} revealed={2} />);
    expect(container.querySelectorAll('[data-line]:not([data-hidden])')).toHaveLength(2);
  });

  it('builds sign items from birth results', () => {
    const results: FortuneResultDto[] = [
      { method: 'WESTERN', data: { sign: 'gemini' }, reading: null },
      { method: 'CHINESE', data: { animal: 'horse', element: 'metal', polarity: 'yang', lunarYear: 1990 }, reading: null },
      { method: 'NUMEROLOGY', data: { lifePath: 4, expression: null }, reading: null },
      { method: 'BLOODTYPE', data: { type: 'O' }, reading: null },
    ];
    const items = signItems(results);
    expect(items.map((i) => i.label)).toEqual(['Gemini', 'Metal Horse', 'Life Path 4', 'Blood type O']);
    render(<SignRing items={items} />);
    expect(screen.getByText('Metal Horse')).toBeInTheDocument();
  });
});
