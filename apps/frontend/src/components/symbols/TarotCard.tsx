import { getTarotCard, type TarotCard as Card } from '@third-eye/divination';

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
const MINOR_RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'P', 'Kn', 'Q', 'K'];
const GOLD = '#d4af37';

function Emblem({ card }: { card: Card }) {
  switch (card.suit) {
    case 'wands':
      return <g stroke={GOLD} strokeWidth="3" strokeLinecap="round"><line x1="60" y1="70" x2="60" y2="130" /><circle cx="52" cy="85" r="3" fill={GOLD} /><circle cx="68" cy="100" r="3" fill={GOLD} /></g>;
    case 'cups':
      return <g fill="none" stroke={GOLD} strokeWidth="3"><path d="M40 78 Q60 128 80 78 Z" /><line x1="60" y1="104" x2="60" y2="124" /><line x1="48" y1="126" x2="72" y2="126" /></g>;
    case 'swords':
      return <g stroke={GOLD} strokeWidth="3" strokeLinecap="round"><line x1="60" y1="66" x2="60" y2="132" /><line x1="46" y1="112" x2="74" y2="112" /></g>;
    case 'pentacles':
      return <g fill="none" stroke={GOLD} strokeWidth="2.5"><circle cx="60" cy="100" r="24" /><polygon points="60,79 72,115 41,93 79,93 48,115" /></g>;
    default:
      return (
        <g fill="none" stroke={GOLD} strokeWidth="2.5">
          <path d="M32 100 Q60 72 88 100 Q60 128 32 100 Z" />
          <circle cx="60" cy="100" r="9" fill={GOLD} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="60" y1="62" x2="60" y2="70" transform={`rotate(${a} 60 100)`} />
          ))}
        </g>
      );
  }
}

export function TarotCard({ cardId, reversed, faceDown = false, className = '' }: {
  cardId: string; reversed: boolean; faceDown?: boolean; className?: string;
}) {
  if (faceDown) {
    return (
      <svg viewBox="0 0 120 200" role="img" aria-label="Face-down card" className={className}>
        <rect x="2" y="2" width="116" height="196" rx="10" fill="#1e1b4b" stroke={GOLD} strokeWidth="2" />
        <rect x="10" y="10" width="100" height="180" rx="6" fill="none" stroke={GOLD} strokeOpacity="0.4" />
        <path d="M34 100 Q60 78 86 100 Q60 122 34 100 Z" fill="none" stroke={GOLD} strokeWidth="2" />
        <circle cx="60" cy="100" r="7" fill={GOLD} />
      </svg>
    );
  }
  const card = getTarotCard(cardId);
  const corner = card.arcana === 'major' ? ROMAN[card.rank]! : MINOR_RANK[card.rank]!;
  return (
    <svg viewBox="0 0 120 200" role="img" aria-label={`${card.name}${reversed ? ' (reversed)' : ''}`} className={className}>
      <g transform={reversed ? 'rotate(180 60 100)' : undefined}>
        <rect x="2" y="2" width="116" height="196" rx="10" fill="#13112a" stroke={GOLD} strokeWidth="2" />
        <text x="60" y="30" textAnchor="middle" fill={GOLD} fontSize="16" fontFamily="Cormorant Garamond, serif">{corner}</text>
        <Emblem card={card} />
        <text x="60" y="178" textAnchor="middle" fill="#e9d8a6" fontSize="10" fontFamily="Cormorant Garamond, serif">{card.name}</text>
      </g>
    </svg>
  );
}
