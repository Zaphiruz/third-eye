import { describe, expect, it } from 'vitest';
import { castTarot } from './tarot.js';
import { TAROT_CARDS, getTarotCard } from './data/tarot.js';
import { seededRng } from './rng.js';

describe('tarot deck', () => {
  it('has 78 unique cards: 22 majors and 14 of each suit', () => {
    expect(TAROT_CARDS).toHaveLength(78);
    expect(new Set(TAROT_CARDS.map((c) => c.id)).size).toBe(78);
    expect(TAROT_CARDS.filter((c) => c.arcana === 'major')).toHaveLength(22);
    for (const suit of ['wands', 'cups', 'swords', 'pentacles']) {
      expect(TAROT_CARDS.filter((c) => c.suit === suit)).toHaveLength(14);
    }
  });
  it('names cards conventionally', () => {
    expect(getTarotCard('major-00').name).toBe('The Fool');
    expect(getTarotCard('major-16').name).toBe('The Tower');
    expect(getTarotCard('cups-01').name).toBe('Ace of Cups');
    expect(getTarotCard('swords-12').name).toBe('Knight of Swords');
    expect(getTarotCard('pentacles-14').name).toBe('King of Pentacles');
  });
  it('gives every card upright and reversed keywords', () => {
    for (const c of TAROT_CARDS) {
      expect(c.upright.length).toBeGreaterThanOrEqual(3);
      expect(c.reversed.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('castTarot', () => {
  it('draws three distinct cards into the three positions', () => {
    const d = castTarot(seededRng(3));
    expect(d.cards.map((c) => c.position)).toEqual(['situation', 'challenge', 'advice']);
    expect(new Set(d.cards.map((c) => c.id)).size).toBe(3);
    for (const c of d.cards) expect(() => getTarotCard(c.id)).not.toThrow();
  });
  it('is deterministic for a seed and produces both orientations across seeds', () => {
    expect(castTarot(seededRng(9))).toEqual(castTarot(seededRng(9)));
    const orientations = new Set(
      Array.from({ length: 50 }, (_, i) => castTarot(seededRng(i))).flatMap((d) => d.cards.map((c) => c.reversed)),
    );
    expect(orientations).toEqual(new Set([true, false]));
  });
});
