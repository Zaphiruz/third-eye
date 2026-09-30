import { Link, useParams } from 'react-router-dom';
import { useGetFortuneQuery } from '../api';
import { FortuneView } from '@third-eye/ui';
import { Screen } from '../components/Screen';

export function FortuneDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useGetFortuneQuery(id!);
  if (isLoading) return <Screen title="Opening the archive…" />;
  if (isError || !data) return <Screen title="Not found" action={<Link className="btn-ghost" to="/history">Back to history</Link>} />;
  return (
    <div className="grid gap-6 py-4">
      <Link to="/history" className="text-sm text-gold-soft/80">← History</Link>
      <h1 className="text-center text-3xl">
        {new Date(`${data.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
      </h1>
      <FortuneView fortune={data} />
    </div>
  );
}
