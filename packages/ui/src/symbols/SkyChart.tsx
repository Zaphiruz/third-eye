import { getZodiacSign, MOON_PHASE_NAMES, SKY_BODIES, type SkyData } from '@third-eye/divination';
import { MoonGlyph } from './MoonGlyph.js';

export function SkyChart({ data, revealed, className = '' }: { data: SkyData; revealed?: number; className?: string }) {
  const shown = revealed ?? data.bodies.length;
  const pct = Math.round(data.moon.illumination * 100);
  const phase = MOON_PHASE_NAMES[data.moon.phase];
  return (
    <div className={`grid w-full max-w-xs justify-items-center gap-3 ${className}`}>
      <MoonGlyph illumination={data.moon.illumination} waxing={data.moon.waxing} size={88}
        label={`Moon: ${phase.toLowerCase()}, ${pct}% lit`} />
      <p aria-hidden className="text-sm text-mist/80">{phase} · {pct}% lit</p>
      <ul className="grid w-full gap-1 text-sm">
        {data.bodies.map((b, i) => {
          const body = SKY_BODIES[b.body];
          const sign = getZodiacSign(b.sign);
          return (
            <li key={b.body} data-body={b.body} aria-hidden={i >= shown || undefined}
              className={`flex items-center gap-2 transition-opacity duration-500 ${i < shown ? 'opacity-100' : 'opacity-0'}`}>
              <span aria-hidden className="w-6 text-center font-display text-lg text-gold">{body.glyph}</span>
              <span className="flex-1">{body.name}</span>
              <span className="text-mist/80">{b.degree}° <span aria-hidden>{sign.glyph}</span> {sign.name}</span>
              {b.retrograde && <span className="text-gold"><span aria-hidden>℞</span><span className="sr-only">retrograde</span></span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
