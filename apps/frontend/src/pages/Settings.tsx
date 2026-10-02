import { useState } from 'react';
import { useGetMeQuery, useLogoutMutation, useUpdateMeMutation } from '../api';
import { ProfileForm } from '../components/ProfileForm';

export function Settings() {
  const { data: me } = useGetMeQuery();
  const [updateMe] = useUpdateMeMutation();
  const [logout] = useLogoutMutation();
  const [saved, setSaved] = useState(false);
  if (!me) return null;
  return (
    <div className="grid gap-6 py-4">
      <h1 className="text-3xl">Settings</h1>
      <div className="card">
        <ProfileForm initial={me.profile} submitLabel="Save"
          onSubmit={async (input) => { setSaved(false); await updateMe(input).unwrap(); setSaved(true); }} />
        {saved && <p className="mt-3 text-center text-gold-soft" role="status">Saved</p>}
      </div>
      <p className="text-center text-sm text-mist/60">Changes apply from your next daily fortune. Past fortunes keep the details they were read with.</p>
      <a className="text-center text-sm text-gold underline-offset-2 hover:underline" href="/how-it-works">How readings work</a>
      <button className="btn-ghost" onClick={async () => {
        const r = await logout().unwrap();
        globalThis.location.assign(r.endSessionUrl ?? '/');
      }}>Sign out</button>
    </div>
  );
}
