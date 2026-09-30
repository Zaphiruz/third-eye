import { describeResult, getRune, getZodiacSign, type IChingData, type MethodResult, type RuneData, type TarotData, type WesternData } from '@third-eye/divination';
import type { FortuneResultDto } from '@third-eye/shared';
import { TarotCard } from './symbols/TarotCard.js';
import { RuneStone } from './symbols/RuneStone.js';
import { Hexagram } from './symbols/Hexagram.js';
import { SignRing, signItems } from './symbols/SignRing.js';

function MethodSymbol({ result }: { result: FortuneResultDto }) {
  switch (result.method) {
    case 'TAROT':
      return <div className="flex gap-2">{(result.data as TarotData).cards.map((c) => <TarotCard key={c.id} cardId={c.id} reversed={c.reversed} className="w-16" />)}</div>;
    case 'RUNE': {
      const d = result.data as RuneData;
      return <RuneStone runeId={d.id} reversed={d.reversed} className="w-14" />;
    }
    case 'ICHING': {
      const d = result.data as IChingData;
      return <div className="flex items-center gap-3"><Hexagram lines={d.lines} className="w-16" />{d.relating !== null && <><span className="text-gold/60">→</span><Hexagram number={d.relating} className="w-12" /></>}</div>;
    }
    default:
      return <SignRing items={signItems([result])} />;
  }
}

export function MethodCard({ result }: { result: FortuneResultDto }) {
  const desc = describeResult({ method: result.method, data: result.data } as MethodResult);
  return (
    <section className="card grid gap-3">
      <h3 className="text-2xl">{desc.title}</h3>
      <div className="flex justify-center"><MethodSymbol result={result} /></div>
      <ul className="grid gap-1 text-sm text-mist/60">{desc.facts.map((f) => <li key={f}>{f}</li>)}</ul>
      {result.reading
        ? <p className="leading-relaxed">{result.reading}</p>
        : <p data-testid="reading-pending" className="h-12 animate-pulse rounded-lg bg-gold/10" aria-label="Reading in progress" />}
    </section>
  );
}

/** Compact glyph row for history rows. */
export function MiniSymbols({ results }: { results: FortuneResultDto[] }) {
  const glyphs: string[] = [];
  for (const r of results) {
    if (r.method === 'RUNE') glyphs.push(getRune((r.data as RuneData).id).glyph);
    if (r.method === 'ICHING') glyphs.push(String.fromCodePoint(0x4dc0 + (r.data as IChingData).primary - 1));
    if (r.method === 'WESTERN') glyphs.push(getZodiacSign((r.data as WesternData).sign).glyph);
  }
  return <span aria-hidden className="font-display text-xl tracking-widest text-gold/80">{glyphs.join(' ')}</span>;
}
