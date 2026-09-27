import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetHistoryQuery } from '../api';
import { MiniSymbols } from '../components/MethodCard';
import { Screen } from '../components/Screen';

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function Page({ cursor, isLast, onMore }: { cursor: string | undefined; isLast: boolean; onMore: (c: string) => void }) {
  const { data, isLoading, isError, refetch } = useGetHistoryQuery(cursor);
  if (isLoading) return <p className="py-6 text-center text-mist/50">Consulting the archive…</p>;
  if (isError || !data) return <button className="btn-ghost mx-auto" onClick={() => void refetch()}>Try again</button>;
  if (!cursor && data.items.length === 0) return <Screen title="No fortunes yet">Your first reading will appear here tomorrow.</Screen>;
  return (
    <>
      {data.items.map((f) => (
        <Link key={f.id} to={`/history/${f.id}`} className="card block transition hover:border-gold/50">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm uppercase tracking-widest text-mist/60">{fmt(f.date)}</span>
            <MiniSymbols results={f.results} />
          </div>
          <p className="mt-2">{f.excerpt ?? (f.status === 'FAILED' ? 'The oracle was silent this day.' : 'The oracle is still speaking…')}</p>
        </Link>
      ))}
      {isLast && data.nextCursor && <button className="btn-ghost mx-auto" onClick={() => onMore(data.nextCursor!)}>Show older</button>}
    </>
  );
}

export function History() {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  return (
    <div className="grid gap-4 py-4">
      <h1 className="text-center text-4xl">Past fortunes</h1>
      {cursors.map((c, i) => (
        <Page key={c ?? 'first'} cursor={c} isLast={i === cursors.length - 1} onMore={(next) => setCursors((cs) => [...cs, next])} />
      ))}
    </div>
  );
}
