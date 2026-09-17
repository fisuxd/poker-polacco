import type { CardArtwork } from "../game3d/cards/cardPresentation";

const SUIT_SYMBOL = { CLUBS: "♣", DIAMONDS: "♦", HEARTS: "♥", SPADES: "♠" } as const;

// A rank-only declaration deliberately shows all four suits, not an invented
// hidden card. The same small card artwork is used in choices and the preview.
export function CardFace({ card }: { card: CardArtwork }) {
  const ink = card.suit === "HEARTS" || card.suit === "DIAMONDS" ? "#bc3040" : "#202321";
  return (
    <svg className="bid-card-face" viewBox="0 0 57 82" aria-hidden="true" focusable="false" data-card-rank={card.rank}>
      <rect x="0.75" y="0.75" width="55.5" height="80.5" rx="5" fill="#f5f0e5" stroke="#d8cbb5" strokeWidth="1.5" />
      <g fill={ink} fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700">
        <text x="6" y="16" fontSize="12">{card.rank}</text>
        {card.suit && <text x="7" y="26" fontSize="10">{SUIT_SYMBOL[card.suit]}</text>}
        <text x="28.5" y="48" textAnchor="middle" fontSize={card.suit ? "29" : "24"}>{card.suit ? SUIT_SYMBOL[card.suit] : card.rank}</text>
        <g transform="rotate(180 28.5 41)"><text x="6" y="16" fontSize="12">{card.rank}</text></g>
      </g>
      {!card.suit && <text x="28.5" y="62" textAnchor="middle" fontSize="8" fill="#807b72">♣ ♦ ♥ ♠</text>}
    </svg>
  );
}
