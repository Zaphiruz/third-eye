import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query';
import type { TodayDto } from '@third-eye/shared';
import { api, apiErrorCode, useGetFortuneQuery, useOpenTodayMutation } from '../api';
import { FortuneView } from '@third-eye/ui';
import { ShareButton } from '../components/ShareDialog';
import { Screen } from '../components/Screen';
import { Ritual } from '../ritual/Ritual';

export function Today() {
  const dispatch = useDispatch();
  const [openToday] = useOpenTodayMutation();
  const [today, setToday] = useState<TodayDto | null>(null);
  const [failedToOpen, setFailedToOpen] = useState(false);
  const [ritual, setRitual] = useState(false);
  const started = useRef(false);

  const open = useCallback(async () => {
    setFailedToOpen(false);
    try {
      const t = await openToday().unwrap();
      setToday(t);
      if (t.fresh) setRitual(true);
    } catch (err) {
      if (apiErrorCode(err) === 'needs_onboarding') dispatch(api.util.invalidateTags(['Me']));
      else setFailedToOpen(true);
    }
  }, [openToday, dispatch]);

  useEffect(() => {
    if (started.current) return;   // StrictMode mounts effects twice in dev
    started.current = true;
    void open();
  }, [open]);

  const [pollMs, setPollMs] = useState(2000);
  const { data: live } = useGetFortuneQuery(today ? today.fortune.id : skipToken, { pollingInterval: pollMs });
  const fortune = live ?? today?.fortune;
  useEffect(() => { setPollMs(fortune?.status === 'PENDING' ? 2000 : 0); }, [fortune?.status]);

  // If the backend restarts mid-interpretation, GET alone would poll a stale PENDING fortune forever
  // (only POST /fortunes/today re-claims it). Re-open just past the server's staleMs while pending.
  useEffect(() => {
    if (fortune?.status !== 'PENDING') return;
    const timer = setInterval(() => void open(), 130_000);
    return () => clearInterval(timer);
  }, [fortune?.status, open]);

  const endRitual = useCallback(() => setRitual(false), []);

  if (failedToOpen) {
    return <Screen title="The veil is clouded" action={<button className="btn-ghost" onClick={() => void open()}>Try again</button>}>We couldn't open today's fortune.</Screen>;
  }
  if (!fortune) return <Screen title="Opening the veil…" />;
  if (ritual) return <Ritual fortune={fortune} ready={fortune.status !== 'PENDING'} onDone={endRitual} />;

  return (
    <div className="grid gap-6 py-4">
      <header className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-mist/50">
          {new Date(`${fortune.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
        </p>
        <h1 className="mt-1 text-4xl">Your fortune</h1>
      </header>
      {fortune.status === 'FAILED' && (
        <Screen title="The spirits are quiet…" action={<button className="btn-gold" onClick={() => void open()}>Try again</button>}>
          Your cards are drawn, but the oracle could not speak just now.
        </Screen>
      )}
      {fortune.status === 'PENDING' && <p className="text-center font-display text-2xl text-gold-soft">The oracle is still speaking…</p>}
      <FortuneView fortune={fortune} />
      {fortune.status === 'READY' && (
        <div className="flex flex-wrap justify-center gap-3">
          <ShareButton fortuneId={fortune.id} />
          <button className="btn-ghost" onClick={() => setRitual(true)}>Replay the ritual</button>
        </div>
      )}
    </div>
  );
}
