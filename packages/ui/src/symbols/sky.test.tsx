import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SkyData } from '@third-eye/divination';
import { MoonGlyph } from './MoonGlyph.js';
import { SkyChart } from './SkyChart.js';
import { MethodCard, MiniSymbols } from '../MethodCard.js';

const SKY: SkyData = {
  moon: { phase: 'waning-gibbous', illumination: 0.83, waxing: false },
  bodies: [
    { body: 'sun', sign: 'libra', degree: 7, retrograde: false },
    { body: 'moon', sign: 'taurus', degree: 26, retrograde: false },
    { body: 'mercury', sign: 'scorpio', degree: 0, retrograde: false },
    { body: 'venus', sign: 'scorpio', degree: 8, retrograde: false },
    { body: 'mars', sign: 'leo', degree: 1, retrograde: false },
    { body: 'jupiter', sign: 'leo', degree: 19, retrograde: false },
    { body: 'saturn', sign: 'aries', degree: 11, retrograde: true },
  ],
};

describe('MoonGlyph', () => {
  it('lights the right side while waxing and the left while waning', () => {
    const { container } = render(<><MoonGlyph illumination={0.3} waxing /><MoonGlyph illumination={0.3} waxing={false} /></>);
    const svgs = container.querySelectorAll('svg');
    expect(svgs[0]!.getAttribute('data-lit')).toBe('right');
    expect(svgs[1]!.getAttribute('data-lit')).toBe('left');
    expect(svgs[0]!.getAttribute('aria-hidden')).toBe('true');
  });
  it('is labelled when given a label', () => {
    render(<MoonGlyph illumination={1} waxing label="Moon: full moon, 100% lit" />);
    expect(screen.getByRole('img', { name: 'Moon: full moon, 100% lit' })).toBeInTheDocument();
  });
});

describe('SkyChart', () => {
  it('shows the moon, its phase and a row per body with the retrograde mark', () => {
    const { container } = render(<SkyChart data={SKY} />);
    expect(screen.getByRole('img', { name: 'Moon: waning gibbous, 83% lit' })).toBeInTheDocument();
    expect(screen.getByText('Waning Gibbous · 83% lit')).toBeInTheDocument();
    const rows = container.querySelectorAll('li[data-body]');
    expect(Array.from(rows).map((r) => r.getAttribute('data-body'))).toEqual(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']);
    expect(rows[6]!.textContent).toContain('Saturn');
    expect(rows[6]!.textContent).toContain('11°');
    expect(rows[6]!.textContent).toContain('Aries');
    expect(rows[6]!.textContent).toContain('℞');
    expect(rows[6]!.textContent).toContain('retrograde');
    expect(rows[0]!.textContent).not.toContain('℞');
  });
  it('reveals rows one at a time for the ritual', () => {
    const { container } = render(<SkyChart data={SKY} revealed={2} />);
    expect(container.querySelectorAll('li[data-body].opacity-100')).toHaveLength(2);
  });
  it('is drawn by MethodCard for SKY, and adds a moon to MiniSymbols', () => {
    render(<MethodCard result={{ method: 'SKY', data: SKY, reading: 'Look up.' }} />);
    expect(screen.getByRole('heading', { name: 'The Sky' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Moon: waning gibbous, 83% lit' })).toBeInTheDocument();
    expect(screen.getByText('Saturn in Aries 11° (retrograde)')).toBeInTheDocument();
    const { container } = render(<MiniSymbols results={[{ method: 'SKY', data: SKY, reading: null }]} />);
    expect(container.querySelector('svg[data-lit="left"]')).toBeTruthy();
  });
});
