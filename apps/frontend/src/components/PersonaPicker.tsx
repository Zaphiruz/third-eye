import { PERSONA_IDS, PERSONAS, type PersonaId } from '@third-eye/shared';

export function PersonaPicker({ value, onChange }: { value: PersonaId; onChange: (p: PersonaId) => void }) {
  return (
    <fieldset>
      <legend className="label">Your oracle</legend>
      <div className="grid gap-3">
        {PERSONA_IDS.map((id) => {
          const p = PERSONAS[id];
          const checked = value === id;
          return (
            <label key={id} className={`card cursor-pointer transition ${checked ? 'border-gold ring-1 ring-gold' : 'opacity-80'}`}>
              <input type="radio" name="persona" value={id} checked={checked} onChange={() => onChange(id)} className="sr-only" aria-label={p.name} />
              <span className="block font-display text-xl text-gold-soft">{p.name}</span>
              <span className="block text-sm text-mist/70">{p.tagline}</span>
              <span className="mt-2 block text-sm italic text-mist/90">“{p.sampleLine}”</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
