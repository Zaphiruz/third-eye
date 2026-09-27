import type { MethodResult, ResultDescription } from './types.js';
import { METHOD_LABELS } from './types.js';
import { getTarotCard } from './data/tarot.js';
import { getRune } from './data/runes.js';
import { getHexagram } from './data/hexagrams.js';
import { getZodiacSign } from './data/zodiac.js';
import { getChineseAnimal, getChineseElement } from './data/chinese.js';
import { getNumberMeaning } from './data/numbers.js';
import { BLOOD_TYPES } from './data/blood-types.js';

const list = (xs: string[]) => xs.join(', ');
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const orient = (reversed: boolean) => (reversed ? 'reversed' : 'upright');

function numberFact(label: string, n: number): string {
  const m = getNumberMeaning(n);
  return `${label} ${n}${m.master ? ' (master number)' : ''}: ${m.title} — ${list(m.keywords)}`;
}

export function describeResult(r: MethodResult): ResultDescription {
  const title = METHOD_LABELS[r.method];
  switch (r.method) {
    case 'TAROT':
      return { method: r.method, title, facts: r.data.cards.map((c) => {
        const card = getTarotCard(c.id);
        return `${cap(c.position)}: ${card.name} (${orient(c.reversed)}) — ${list(c.reversed ? card.reversed : card.upright)}`;
      }) };
    case 'RUNE': {
      const rune = getRune(r.data.id);
      const words = r.data.reversed && rune.reversedMeaning ? rune.reversedMeaning : rune.meaning;
      return { method: r.method, title, facts: [`${rune.name} ${rune.glyph} (${orient(r.data.reversed)}) — ${list(words)}`] };
    }
    case 'ICHING': {
      const hex = (label: string, n: number) => {
        const h = getHexagram(n);
        return `${label} hexagram ${n}: ${h.name} (${h.pinyin}) — ${list(h.keywords)}`;
      };
      const facts = [hex('Primary', r.data.primary)];
      if (r.data.changingLines.length) facts.push(`Changing lines: ${r.data.changingLines.join(', ')}`);
      if (r.data.relating !== null) facts.push(hex('Relating', r.data.relating));
      return { method: r.method, title, facts };
    }
    case 'WESTERN': {
      const s = getZodiacSign(r.data.sign);
      return { method: r.method, title, facts: [
        `Sun sign ${s.name} ${s.glyph} — ${s.element}, ${s.modality}, ruled by ${s.ruler} — ${list(s.traits)}`,
      ] };
    }
    case 'CHINESE': {
      const a = getChineseAnimal(r.data.animal);
      const e = getChineseElement(r.data.element);
      return { method: r.method, title, facts: [
        `${e.name} ${a.name} (${r.data.polarity}), lunar year ${r.data.lunarYear} — ${a.name}: ${list(a.traits)}; ${e.name}: ${list(e.traits)}`,
      ] };
    }
    case 'NUMEROLOGY': {
      const facts = [numberFact('Life Path', r.data.lifePath)];
      if (r.data.expression !== null) facts.push(numberFact('Expression', r.data.expression));
      return { method: r.method, title, facts };
    }
    case 'BLOODTYPE': {
      const b = BLOOD_TYPES[r.data.type];
      return { method: r.method, title, facts: [`Blood type ${r.data.type}: ${b.title} — ${list(b.traits)}`] };
    }
  }
}
