import { useState } from 'react';
import { shareCreateSchema, type ShareDto } from '@third-eye/shared';
import { apiErrorCode, useCreateShareMutation, useGetMeQuery, useGetSharesQuery, useRevokeShareMutation } from '../api';

function LinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input readOnly value={url} aria-label="Share link" className="input min-w-0 flex-1 text-sm" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn-ghost" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* clipboard blocked: the field is selectable */ }
      }}>{copied ? 'Copied' : 'Copy'}</button>
      {canShare && (
        <button type="button" className="btn-ghost" onClick={() => { void navigator.share({ title: 'A Third Eye fortune', url }).catch(() => {}); }}>
          Share…
        </button>
      )}
    </div>
  );
}

function ShareDialog({ fortuneId, onClose }: { fortuneId: string; onClose: () => void }) {
  const { data: me } = useGetMeQuery();
  const { data: shares = [] } = useGetSharesQuery(fortuneId);
  const [createShare, { isLoading: creating }] = useCreateShareMutation();
  const [revokeShare] = useRevokeShareMutation();
  // Until the user types, follow the profile name (the dialog can open before /me has loaded).
  const [typedName, setName] = useState<string | null>(null);
  const name = typedName ?? me?.profile.fullName ?? me?.user.name ?? '';
  const [includeBirthSigns, setIncludeBirthSigns] = useState(false);
  const [created, setCreated] = useState<ShareDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    const parsed = shareCreateSchema.safeParse({ sharedByName: name, includeBirthSigns });
    if (!parsed.success) { setError('Enter a name of 1–60 characters.'); return; }
    try {
      setCreated(await createShare({ fortuneId, ...parsed.data }).unwrap());
    } catch (err) {
      setError(apiErrorCode(err) === 'not_ready' ? "This reading isn't finished yet." : 'Could not create the link. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/80 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="card grid w-full max-w-md gap-4" onClick={(e) => e.stopPropagation()}>
        <h2 id="share-title" className="text-2xl">Share this fortune</h2>
        <div>
          <label className="label" htmlFor="share-name">Shared by</label>
          <input id="share-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={includeBirthSigns} onChange={(e) => setIncludeBirthSigns(e.target.checked)}
            aria-describedby="share-signs-hint" aria-label="Include birth-based signs" />
          <span>
            Include birth-based signs
            <span id="share-signs-hint" className="block text-mist/60">
              Adds your sun sign, Chinese zodiac, numbers and blood type. The written summary may still mention them.
            </span>
          </span>
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="button" className="btn-gold" disabled={creating} onClick={() => void create()}>Create link</button>
        {created && <LinkRow url={created.url} />}
        {shares.length > 0 && (
          <section className="grid gap-3">
            <h3 className="text-lg">Active links</h3>
            {shares.map((s) => (
              <div key={s.id} className="grid gap-2 rounded-xl border border-gold/15 p-3">
                <p className="text-sm text-mist/80">
                  {s.sharedByName} · {s.includeBirthSigns ? 'with signs' : 'without signs'} · {new Date(s.createdAt).toLocaleDateString()}
                </p>
                <LinkRow url={s.url} />
                <button type="button" className="btn-ghost justify-self-start text-sm" onClick={() => {
                  if (window.confirm('Stop sharing this link? Anyone who has it will no longer be able to open it.')) {
                    void revokeShare({ id: s.id, fortuneId });
                  }
                }}>Stop sharing</button>
              </div>
            ))}
          </section>
        )}
        <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export function ShareButton({ fortuneId }: { fortuneId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost mx-auto" onClick={() => setOpen(true)}>Share</button>
      {open && <ShareDialog fortuneId={fortuneId} onClose={() => setOpen(false)} />}
    </>
  );
}
