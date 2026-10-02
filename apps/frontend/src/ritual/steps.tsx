import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { IChingData, RuneData, SkyData, TarotData } from '@third-eye/divination';
import type { FortuneDto } from '@third-eye/shared';
import { Hexagram, RuneStone, SignRing, SkyChart, TarotCard, signItems } from '@third-eye/ui';

export interface RitualStep { key: string; caption: string; duration: number; render: () => ReactNode }

/** Counts up 0 → max, one tick per `every` ms. Used to reveal cards / lines / signs one at a time. */
function useTicker(max: number, every: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= max) return undefined;
    const t = setTimeout(() => setN((x) => x + 1), every);
    return () => clearTimeout(t);
  }, [n, max, every]);
  return n;
}

function TarotStep({ data, reduced }: { data: TarotData; reduced: boolean }) {
  const flipped = useTicker(data.cards.length, reduced ? 150 : 800);
  return (
    <div className="flex justify-center gap-3">
      {data.cards.map((c, i) => {
        const revealed = i < flipped;
        return (
          <div key={c.id} className="flex w-24 flex-col items-center gap-2">
            {reduced ? (
              // Reduced motion: no rotation or translation, just an opacity cross-fade as the
              // card flips (re-keying on `revealed` re-triggers the fade instead of a rotation).
              <motion.div key={revealed ? 'up' : 'down'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                <TarotCard cardId={c.id} reversed={c.reversed} faceDown={!revealed} className="w-24" />
              </motion.div>
            ) : (
              <motion.div
                initial={{ rotateY: 180, y: -30, opacity: 0 }}
                animate={revealed ? { rotateY: 0, y: 0, opacity: 1 } : { rotateY: 180, y: 0, opacity: 1 }}
                transition={{ duration: 0.7 }}
              >
                <TarotCard cardId={c.id} reversed={c.reversed} faceDown={!revealed} className="w-24" />
              </motion.div>
            )}
            <span className="text-xs uppercase tracking-widest text-mist/60">{c.position}</span>
          </div>
        );
      })}
    </div>
  );
}

function RuneStep({ data, reduced }: { data: RuneData; reduced: boolean }) {
  return (
    <motion.div className="flex justify-center"
      initial={reduced ? { opacity: 0 } : { y: -80, rotate: -25, opacity: 0 }}
      animate={reduced ? { opacity: 1 } : { y: 0, rotate: 0, opacity: 1 }}
      transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 120, damping: 12 }}>
      <RuneStone runeId={data.id} reversed={data.reversed} className="w-28" />
    </motion.div>
  );
}

function IChingStep({ data, reduced }: { data: IChingData; reduced: boolean }) {
  const cast = useTicker(6, reduced ? 80 : 420);
  return (
    <div className="flex items-center justify-center gap-6">
      <Hexagram lines={data.lines} revealed={cast} className="w-28" />
      {data.relating !== null && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: cast >= 6 ? 1 : 0 }} transition={{ duration: 0.6 }} className="flex items-center gap-6">
          <span className="text-2xl text-gold/70">→</span>
          <Hexagram number={data.relating} className="w-20 opacity-80" />
        </motion.div>
      )}
    </div>
  );
}

function SignsStep({ fortune, reduced }: { fortune: FortuneDto; reduced: boolean }) {
  const items = signItems(fortune.results);
  const shown = useTicker(items.length, reduced ? 80 : 450);
  return <SignRing items={items} revealed={shown} />;
}

function OracleStep({ reduced }: { reduced: boolean }) {
  return (
    <motion.p className="text-center font-display text-3xl text-gold-soft"
      animate={reduced ? { opacity: 1 } : { opacity: [0.4, 1, 0.4] }}
      transition={reduced ? undefined : { duration: 2.4, repeat: Infinity }}>
      The oracle speaks…
    </motion.p>
  );
}

function SkyStep({ data, reduced }: { data: SkyData; reduced: boolean }) {
  const shown = useTicker(data.bodies.length, reduced ? 60 : 320);
  return (
    <motion.div className="flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0.2 : 0.8 }}>
      <SkyChart data={data} revealed={shown} />
    </motion.div>
  );
}

export function buildRitualSteps(fortune: FortuneDto, reduced: boolean): RitualStep[] {
  const d = (normal: number) => (reduced ? 800 : normal);
  const byMethod = Object.fromEntries(fortune.results.map((r) => [r.method, r.data]));
  const steps: RitualStep[] = [];
  if (byMethod.TAROT) steps.push({ key: 'tarot', caption: 'The cards are drawn', duration: d(3400), render: () => <TarotStep data={byMethod.TAROT as TarotData} reduced={reduced} /> });
  if (byMethod.RUNE) steps.push({ key: 'rune', caption: 'A rune is cast', duration: d(2200), render: () => <RuneStep data={byMethod.RUNE as RuneData} reduced={reduced} /> });
  if (byMethod.ICHING) steps.push({ key: 'iching', caption: 'The coins fall six times', duration: d(3600), render: () => <IChingStep data={byMethod.ICHING as IChingData} reduced={reduced} /> });
  if (byMethod.SKY) steps.push({ key: 'sky', caption: 'The heavens turn', duration: d(3200), render: () => <SkyStep data={byMethod.SKY as SkyData} reduced={reduced} /> });
  if (signItems(fortune.results).length) steps.push({ key: 'signs', caption: 'Your stars and numbers', duration: d(2800), render: () => <SignsStep fortune={fortune} reduced={reduced} /> });
  steps.push({ key: 'oracle', caption: '', duration: reduced ? 300 : 1200, render: () => <OracleStep reduced={reduced} /> });
  return steps;
}
