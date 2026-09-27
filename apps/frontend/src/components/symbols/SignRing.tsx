import { getChineseAnimal, getChineseElement, getZodiacSign } from '@third-eye/divination';
import type { FortuneResultDto } from '@third-eye/shared';

export interface SignItem { key: string; glyph: string; label: string }

export function signItems(results: FortuneResultDto[]): SignItem[] {
  const items: SignItem[] = [];
  for (const r of results) {
    if (r.method === 'WESTERN') {
      const s = getZodiacSign((r.data as { sign: Parameters<typeof getZodiacSign>[0] }).sign);
      items.push({ key: r.method, glyph: s.glyph, label: s.name });
    } else if (r.method === 'CHINESE') {
      const d = r.data as { animal: Parameters<typeof getChineseAnimal>[0]; element: Parameters<typeof getChineseElement>[0] };
      const a = getChineseAnimal(d.animal);
      items.push({ key: r.method, glyph: a.glyph, label: `${getChineseElement(d.element).name} ${a.name}` });
    } else if (r.method === 'NUMEROLOGY') {
      const n = (r.data as { lifePath: number }).lifePath;
      items.push({ key: r.method, glyph: String(n), label: `Life Path ${n}` });
    } else if (r.method === 'BLOODTYPE') {
      const t = (r.data as { type: string }).type;
      items.push({ key: r.method, glyph: t, label: `Blood type ${t}` });
    }
  }
  return items;
}

export function SignRing({ items, revealed }: { items: SignItem[]; revealed?: number }) {
  const shown = revealed ?? items.length;
  return (
    <ul className="flex flex-wrap justify-center gap-4">
      {items.map((it, i) => (
        <li key={it.key} className={`flex w-24 flex-col items-center gap-1 transition-opacity duration-500 ${i < shown ? 'opacity-100' : 'opacity-0'}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 font-display text-3xl text-gold shadow-[0_0_18px_rgba(212,175,55,0.25)]">{it.glyph}</span>
          <span className="text-center text-sm text-mist/80">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
