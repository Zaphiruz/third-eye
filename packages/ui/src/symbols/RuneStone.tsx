import { useId } from 'react';
import { getRune } from '@third-eye/divination';

export function RuneStone({ runeId, reversed, className = '' }: { runeId: string; reversed: boolean; className?: string }) {
  const rune = getRune(runeId);
  const gid = `stone-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 100 120" role="img" aria-label={`${rune.name}${reversed ? ' (reversed)' : ''}`} className={className}>
      <defs>
        <radialGradient id={gid} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#4b4870" /><stop offset="100%" stopColor="#1b1935" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="60" rx="42" ry="54" fill={`url(#${gid})`} stroke="#d4af37" strokeOpacity="0.5" />
      <text x="50" y="78" textAnchor="middle" fontSize="52" fill="#d4af37" transform={reversed ? 'rotate(180 50 60)' : undefined}>{rune.glyph}</text>
    </svg>
  );
}
