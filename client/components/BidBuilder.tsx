import { useEffect, useMemo, useState } from "react";
import {
  BID_CATEGORIES,
  CATEGORY_LABELS,
  MINIMUM_CARDS,
  formatBid,
  getLegalNextBids,
  type Bid,
  type BidCategory,
} from "../../shared/game/bids";
import type { PublicGameState } from "../../shared/game/types";
import { BidRankPicker } from "./BidRankPicker";
import { CardFace } from "./CardFace";
import { getBidCards } from "../game3d/cards/cardPresentation";

export function BidBuilder({ state, onClose, onSubmit, busy }: {
  state: PublicGameState;
  onClose: () => void;
  onSubmit: (bid: Bid) => void;
  busy: boolean;
}) {
  const legalBids = useMemo(() => getLegalNextBids(state.currentBid, state.totalCardsInPlay), [state.currentBid, state.totalCardsInPlay]);
  const grouped = useMemo(() => new Map(BID_CATEGORIES.map((category) => [category, legalBids.filter((bid) => bid.type === category)])), [legalBids]);
  const physicallyPossible = BID_CATEGORIES.filter((category) => MINIMUM_CARDS[category] <= state.totalCardsInPlay);
  const firstCategory = physicallyPossible.find((category) => (grouped.get(category)?.length ?? 0) > 0);
  const [category, setCategory] = useState<BidCategory | undefined>(firstCategory);
  const options = category ? grouped.get(category) ?? [] : [];
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!category || (grouped.get(category)?.length ?? 0) === 0) setCategory(firstCategory);
    setSelectedIndex(0);
  }, [firstCategory, category, grouped]);

  const selected = options[selectedIndex] ?? options[0];

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="bid-builder glass-panel" role="dialog" aria-modal="true" aria-labelledby="bid-builder-title">
        <button className="close-button" onClick={onClose} aria-label="Close declaration builder">×</button>
        <p className="eyebrow">Your declaration</p>
        <h2 id="bid-builder-title">Raise the stakes</h2>
        <div className="current-bid-line"><span>Current bid</span><strong>{state.currentBid ? formatBid(state.currentBid) : "No declaration yet"}</strong></div>
        <p className="builder-label">Choose a combination</p>
        <div className="category-grid">
          {physicallyPossible.map((candidate) => {
            const enabled = (grouped.get(candidate)?.length ?? 0) > 0;
            return (
              <button key={candidate} type="button" aria-pressed={candidate === category} disabled={busy || !enabled} className={candidate === category ? "selected" : ""} onClick={() => { setCategory(candidate); setSelectedIndex(0); }}>
                <small>{BID_CATEGORIES.indexOf(candidate) + 1}</small>{CATEGORY_LABELS[candidate].en}
              </button>
            );
          })}
        </div>
        {selected ? (
          <>
            <BidRankPicker legalBids={options} selected={selected} onChange={(bid) => setSelectedIndex(options.indexOf(bid))} disabled={busy} />
            <p className="rank-scroll-hint">Swipe the card rows to see more ranks →</p>
            <div className="declaration-preview" aria-live="polite"><span>You are declaring</span><strong>{formatBid(selected)}</strong>
              <div className="declaration-cards" aria-hidden="true">{getBidCards(selected).map((card, index) => <CardFace key={index} card={card} />)}</div>
            </div>
            <div className="builder-submit"><button className="primary-button full-width" disabled={busy} onClick={() => onSubmit(selected)}>{busy ? "Declaring…" : `Declare ${formatBid(selected)}`}</button></div>
          </>
        ) : (
          <p className="no-bids">There is no declaration above the current bid. Your only move is to call bluff.</p>
        )}
      </section>
    </div>
  );
}
