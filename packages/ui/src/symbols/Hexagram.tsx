import { getHexagram, hexagramLines, hexagramNumber } from '@third-eye/divination';

type LineValue = 6 | 7 | 8 | 9;

export function Hexagram({ lines, number, revealed = 6, className = '' }: {
  lines?: LineValue[]; number?: number; revealed?: number; className?: string;
}) {
  const bits = lines ? lines.map((l) => (l === 7 || l === 9 ? 1 : 0)) : hexagramLines(number!);
  const n = lines ? hexagramNumber(bits as (0 | 1)[]) : number!;
  const hex = getHexagram(n);
  // Row 0 is the TOP line (index 5); lines are cast bottom-up.
  const rows = [5, 4, 3, 2, 1, 0];
  return (
    <svg viewBox="0 0 100 110" role="img" aria-label={`Hexagram ${n}: ${hex.name}`} className={className}>
      {rows.map((i, row) => {
        const y = 8 + row * 17;
        const value = lines?.[i];
        const changing = value === 6 || value === 9;
        const hidden = i >= revealed;
        const color = changing ? '#f5d76e' : '#d4af37';
        const common = {
          'data-line': bits[i] ? 'yang' : 'yin',
          ...(changing ? { 'data-changing': '' } : {}),
          ...(hidden ? { 'data-hidden': '' } : {}),
          opacity: hidden ? 0 : 1,
          style: { transition: 'opacity 400ms' },
        };
        return bits[i]
          ? <rect key={i} {...common} x="10" y={y} width="80" height="9" rx="2" fill={color} filter={changing ? 'drop-shadow(0 0 3px #f5d76e)' : undefined} />
          : (
            <g key={i} {...common} fill={color}>
              <rect x="10" y={y} width="34" height="9" rx="2" />
              <rect x="56" y={y} width="34" height="9" rx="2" />
            </g>
          );
      })}
    </svg>
  );
}
