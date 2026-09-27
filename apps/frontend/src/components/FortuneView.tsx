import { METHOD_LABELS } from '@third-eye/divination';
import type { FortuneDto } from '@third-eye/shared';

/** Minimal version; Task 21 replaces this with the full layout. */
export function FortuneView({ fortune }: { fortune: FortuneDto }) {
  return (
    <article className="grid gap-4">
      {fortune.summary && <p className="card whitespace-pre-line text-lg leading-relaxed">{fortune.summary}</p>}
      {fortune.results.map((r) => (
        <section key={r.method} className="card">
          <h3 className="text-xl">{METHOD_LABELS[r.method]}</h3>
          {r.reading && <p>{r.reading}</p>}
        </section>
      ))}
    </article>
  );
}
