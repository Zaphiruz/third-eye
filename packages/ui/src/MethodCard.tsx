import { describeResult, getRune, getZodiacSign, METHOD_INFO, type IChingData, type Method, type MethodResult, type RuneData, type SkyData, type TarotData, type WesternData } from '@third-eye/divination';
import type { FortuneResultDto } from '@third-eye/shared';
import { TarotCard } from './symbols/TarotCard.js';
import { RuneStone } from './symbols/RuneStone.js';
import { Hexagram } from './symbols/Hexagram.js';
import { MoonGlyph } from './symbols/MoonGlyph.js';
import { SkyChart } from './symbols/SkyChart.js';
import { SignRing, signItems } from './symbols/SignRing.js';

const linkClass = 'text-gold underline-offset-2 hover:underline';

/** A plain <details> so it works on the JavaScript-free share pages too. */
function MethodHelp({ method, label }: { method: Method; label: string }) {
  const info = METHOD_INFO[method];
  return (
    <details>
      <summary aria-label={`About ${label}`}
        className="absolute right-0 top-0 flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full border border-gold/40 text-gold/80 hover:text-gold [&::-webkit-details-marker]:hidden">ⓘ</summary>
      <div className="mt-2 grid gap-2 rounded-lg bg-veil/40 p-3 text-sm text-mist/80">
        <p>{info.summary}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a className={linkClass} href={`/how-it-works#${method.toLowerCase()}`}>How Third Eye does this</a>
          <a className={linkClass} href={info.learnMoreUrl} target="_blank" rel="noopener noreferrer"
            title={`${info.learnMoreLabel} on Wikipedia`}>Learn more ↗</a>
        </p>
      </div>
    </details>
  );
}

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
    case 'SKY':
      return <SkyChart data={result.data as SkyData} />;
    default:
      return <SignRing items={signItems([result])} />;
  }
}

export function MethodCard({ result }: { result: FortuneResultDto }) {
  const desc = describeResult({ method: result.method, data: result.data } as MethodResult);
  return (
    <section className="card grid gap-3">
      <header className="relative">
        <h3 className="pr-10 text-2xl">{desc.title}</h3>
        <MethodHelp method={result.method} label={desc.title} />
      </header>
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
  let sky: SkyData | null = null;
  for (const r of results) {
    if (r.method === 'RUNE') glyphs.push(getRune((r.data as RuneData).id).glyph);
    if (r.method === 'ICHING') glyphs.push(String.fromCodePoint(0x4dc0 + (r.data as IChingData).primary - 1));
    if (r.method === 'SKY') sky = r.data as SkyData;
    if (r.method === 'WESTERN') glyphs.push(getZodiacSign((r.data as WesternData).sign).glyph);
  }
  return (
    <span aria-hidden className="inline-flex items-center gap-2 font-display text-xl tracking-widest text-gold/80">
      {glyphs.join(' ')}
      {sky && <MoonGlyph illumination={sky.moon.illumination} waxing={sky.moon.waxing} size={20} />}
    </span>
  );
}
