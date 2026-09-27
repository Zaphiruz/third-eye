import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { FortuneDto } from '@third-eye/shared';
import { buildRitualSteps } from './steps';
import { useRitual } from './useRitual';

export function Ritual({ fortune, ready, onDone }: { fortune: FortuneDto; ready: boolean; onDone: () => void }) {
  const reduced = useReducedMotion() ?? false;
  // Built once per fortune: the draws don't change while the reading is written.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const steps = useMemo(() => buildRitualSteps(fortune, reduced), [fortune.id, reduced]);
  const durations = useMemo(() => steps.map((s) => s.duration), [steps]);
  const { index, done, skip } = useRitual(durations, ready);

  useEffect(() => { if (done) onDone(); }, [done, onDone]);
  const step = steps[index]!;

  return (
    <button type="button" onClick={skip} aria-label="Continue the ritual"
      className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-8 text-left">
      <AnimatePresence mode="wait">
        <motion.div key={step.key} className="w-full"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.15 : 0.4 }}>
          {step.render()}
        </motion.div>
      </AnimatePresence>
      {step.caption && <p className="font-display text-xl text-gold-soft/90">{step.caption}</p>}
      <p className="text-xs text-mist/40">Tap to continue</p>
    </button>
  );
}
