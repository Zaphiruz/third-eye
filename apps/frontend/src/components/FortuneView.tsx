import { PERSONAS, type FortuneDto } from '@third-eye/shared';
import { MethodCard } from './MethodCard';

export function FortuneView({ fortune }: { fortune: FortuneDto }) {
  return (
    <article className="grid gap-5">
      <section className="card text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-mist/50">as told by</p>
        <p className="font-display text-2xl text-gold">{PERSONAS[fortune.persona].name}</p>
        {fortune.summary
          ? <p className="mt-4 whitespace-pre-line text-left text-lg leading-relaxed">{fortune.summary}</p>
          : <p data-testid="summary-pending" className="mt-4 h-28 animate-pulse rounded-lg bg-gold/10" aria-label="Summary in progress" />}
      </section>
      {fortune.results.map((r) => <MethodCard key={r.method} result={r} />)}
    </article>
  );
}
