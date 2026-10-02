import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { METHOD_INFO } from '@third-eye/divination';
import { MethodCard } from './MethodCard.js';

describe('MethodCard explainer', () => {
  it('offers a no-JS "About" disclosure with the summary and both links', () => {
    const { container } = render(<MethodCard result={{ method: 'ICHING', data: { lines: [7, 7, 7, 8, 8, 8], primary: 11, changingLines: [], relating: null }, reading: 'Peace.' }} />);
    const summary = container.querySelector('details > summary')!;
    expect(summary.getAttribute('aria-label')).toBe('About I Ching');
    expect(summary.textContent).toBe('ⓘ');
    expect(screen.getByText(METHOD_INFO.ICHING.summary)).toBeInTheDocument();
    const how = screen.getByRole('link', { name: 'How Third Eye does this', hidden: true });
    expect(how.getAttribute('href')).toBe('/how-it-works#iching');
    const more = screen.getByRole('link', { name: /Learn more/, hidden: true });
    expect(more.getAttribute('href')).toBe(METHOD_INFO.ICHING.learnMoreUrl);
    expect(more.getAttribute('target')).toBe('_blank');
    expect(more.getAttribute('rel')).toBe('noopener noreferrer');
    expect(more.getAttribute('title')).toBe(`${METHOD_INFO.ICHING.learnMoreLabel} on Wikipedia`);
  });
});
