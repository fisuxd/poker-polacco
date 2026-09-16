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
import { FullHouseSelector, type FullHouseBid } from "./FullHouseSelector";

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
              <button key={candidate} disabled={!enabled} className={candidate === category ? "selected" : ""} onClick={() => { setCategory(candidate); setSelectedIndex(0); }}>
                <small>{BID_CATEGORIES.indexOf(candidate) + 1}</small>{CATEGORY_LABELS[candidate].en}
              </button>
            );
          })}
        </div>
        {selected ? (
          <>
            {selected.type === "FULL_HOUSE" ? (
              <FullHouseSelector
                legalBids={options.filter((bid): bid is FullHouseBid => bid.type === "FULL_HOUSE")}
                selected={selected}
                onChange={(bid) => setSelectedIndex(options.indexOf(bid))}
              />
            ) : <label className="bid-choice">
              <span>Choose the exact declaration</span>
              <select value={selectedIndex} onChange={(event) => setSelectedIndex(Number(event.target.value))}>
                {options.map((bid, index) => <option key={JSON.stringify(bid)} value={index}>{formatBid(bid)}</option>)}
              </select>
            </label>}
            <div className="declaration-preview"><span>You are declaring</span><strong>{formatBid(selected)}</strong></div>
            <button className="primary-button full-width" disabled={busy} onClick={() => onSubmit(selected)}>{busy ? "Declaring…" : `Declare ${formatBid(selected)}`}</button>
          </>
        ) : (
          <p className="no-bids">There is no declaration above the current bid. Your only move is to call bluff.</p>
        )}
      </section>
    </div>
  );
}
