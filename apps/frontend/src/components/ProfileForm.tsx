import { useMemo, useState, type FormEvent } from 'react';
import { BLOOD_TYPE_IDS } from '@third-eye/divination';
import { DEFAULT_PERSONA, profileUpdateSchema, type PersonaId, type ProfileDto, type ProfileUpdateInput } from '@third-eye/shared';
import { PersonaPicker } from './PersonaPicker';

export const detectTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

type FieldErrors = Partial<Record<keyof ProfileUpdateInput | 'form', string>>;

export function ProfileForm({ initial, submitLabel, onSubmit }: {
  initial?: ProfileDto; submitLabel: string; onSubmit: (input: ProfileUpdateInput) => Promise<void>;
}) {
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [bloodType, setBloodType] = useState<string>(initial?.bloodType ?? '');
  // Onboarding (no birth date yet) pre-selects the browser's zone; afterwards the saved zone is kept.
  const [timeZone, setTimeZone] = useState(initial?.birthDate ? initial.timeZone : detectTimeZone());
  const [persona, setPersona] = useState<PersonaId>(initial?.persona ?? DEFAULT_PERSONA);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    return all.includes(timeZone) ? all : [timeZone, ...all];
  }, [timeZone]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = { birthDate, fullName, bloodType: bloodType || null, timeZone, persona };
    const parsed = profileUpdateSchema.safeParse(payload);
    if (!parsed.success || !birthDate) {
      const fe = parsed.success ? {} : parsed.error.flatten().fieldErrors;
      setErrors({
        ...Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])),
        ...(!birthDate ? { birthDate: 'Your birth date is needed for the reading.' } : {}),
      });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(parsed.data);
    } catch {
      setErrors({ form: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div>
        <label className="label" htmlFor="birthDate">Birth date</label>
        <input id="birthDate" type="date" className="input" value={birthDate} min="1900-01-01" max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirthDate(e.target.value)} />
        {errors.birthDate && <p className="field-error">{errors.birthDate}</p>}
      </div>
      <div>
        <label className="label" htmlFor="fullName">Full birth name <span className="text-mist/50">(optional — used for numerology)</span></label>
        <input id="fullName" className="input" value={fullName} autoComplete="name" onChange={(e) => setFullName(e.target.value)} />
        {errors.fullName && <p className="field-error">{errors.fullName}</p>}
      </div>
      <div>
        <label className="label" htmlFor="bloodType">Blood type</label>
        <select id="bloodType" className="input" value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
          <option value="">I don't know</option>
          {BLOOD_TYPE_IDS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <PersonaPicker value={persona} onChange={setPersona} />
      <div>
        <label className="label" htmlFor="timeZone">Time zone</label>
        <select id="timeZone" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        {errors.timeZone && <p className="field-error">{errors.timeZone}</p>}
      </div>
      {errors.form && <p className="field-error">{errors.form}</p>}
      <button type="submit" className="btn-gold" disabled={busy}>{submitLabel}</button>
    </form>
  );
}
