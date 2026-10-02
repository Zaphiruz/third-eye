/**
 * The moon as seen from the northern hemisphere: lit on the right while waxing, on the left while waning.
 * The lit shape is a limb semicircle closed by the terminator, an ellipse whose x-radius is r·|1 − 2k|.
 */
export function MoonGlyph({ illumination, waxing, size = 64, label, className = '' }: {
  illumination: number; waxing: boolean; size?: number; label?: string; className?: string;
}) {
  const c = 50, r = 44;
  const k = Math.min(1, Math.max(0, illumination));
  const rx = Math.abs(1 - 2 * k) * r;
  // Lit on the right: top → (limb, clockwise via the right) → bottom → (terminator) → top.
  // A crescent's terminator bows toward the lit side (sweep 0); a gibbous one bows away (sweep 1).
  const lit = `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} A ${rx} ${r} 0 0 ${k > 0.5 ? 1 : 0} ${c} ${c - r} Z`;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} data-lit={waxing ? 'right' : 'left'} className={className} {...a11y}>
      <circle cx={c} cy={c} r={r} fill="#1e1b4b" stroke="#d4af37" strokeOpacity="0.4" strokeWidth="1.5" />
      <path d={lit} fill="#e9d8a6" transform={waxing ? undefined : `translate(${2 * c} 0) scale(-1 1)`}
        filter="drop-shadow(0 0 4px rgba(233,216,166,0.45))" />
    </svg>
  );
}
