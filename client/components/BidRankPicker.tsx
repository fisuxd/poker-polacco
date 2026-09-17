import type { Bid, BidCategory } from "../../shared/game/bids";
import { RANKS, type Rank } from "../../shared/game/cards";
import { FullHouseSelector, type FullHouseBid } from "./FullHouseSelector";
import { RankCardRow } from "./RankCardRow";

export type TwoPairBid = Extract<Bid, { type: "TWO_PAIR" }>;

export function chooseTwoPairHigh(legalBids: TwoPairBid[], highPair: Rank, preferredLowPair: Rank): TwoPairBid | undefined {
  const candidates = legalBids.filter((bid) => bid.highPair === highPair);
  return candidates.find((bid) => bid.lowPair === preferredLowPair) ?? candidates[0];
}

export function chooseRankBid(legalBids: Bid[], category: BidCategory, rank: Rank): Bid | undefined {
  return legalBids.find((bid) => bid.type === category && ("rank" in bid ? bid.rank === rank : bid.type === "STRAIGHT" && bid.highRank === rank));
}

export function BidRankPicker({ legalBids, selected, onChange, disabled = false }: {
  legalBids: Bid[];
  selected: Bid;
  onChange: (bid: Bid) => void;
  disabled?: boolean;
}) {
  if (selected.type === "FULL_HOUSE") return <FullHouseSelector legalBids={legalBids.filter((bid): bid is FullHouseBid => bid.type === "FULL_HOUSE")} selected={selected} onChange={onChange} disabled={disabled} />;
  if (selected.type === "TWO_PAIR") {
    const pairs = legalBids.filter((bid): bid is TwoPairBid => bid.type === "TWO_PAIR");
    const highRanks = RANKS.filter((rank) => pairs.some((bid) => bid.highPair === rank));
    const lowRanks = RANKS.filter((rank) => pairs.some((bid) => bid.highPair === selected.highPair && bid.lowPair === rank));
    return (
      <div className="two-pair-selection">
        <RankCardRow label="Higher pair" count={2} selectedRank={selected.highPair} enabledRanks={highRanks} disabled={disabled} onSelect={(rank) => {
          const bid = chooseTwoPairHigh(pairs, rank, selected.lowPair);
          if (bid) onChange(bid);
        }} />
        <RankCardRow label="Lower pair" count={2} selectedRank={selected.lowPair} enabledRanks={lowRanks} disabled={disabled} onSelect={(rank) => {
          const bid = pairs.find((candidate) => candidate.highPair === selected.highPair && candidate.lowPair === rank);
          if (bid) onChange(bid);
        }} />
        <p className="builder-hint">Click a rank for each pair. The lower pair must be below the higher pair.</p>
      </div>
    );
  }
  if (selected.type === "ROYAL_FLUSH") return <p className="builder-hint royal-flush-hint">10, J, Q, K and A in any single suit. The ranks are fixed—confirm the cards below.</p>;

  const straight = selected.type === "STRAIGHT";
  const rank = straight ? selected.highRank : selected.rank;
  const count = selected.type === "PAIR" ? 2 : selected.type === "THREE_OF_A_KIND" ? 3 : selected.type === "FOUR_OF_A_KIND" ? 4 : 1;
  const enabledRanks = RANKS.filter((candidate) => chooseRankBid(legalBids, selected.type, candidate));
  return (
    <div className="single-rank-selection">
      <RankCardRow label={straight ? "Straight high card" : "Choose the rank"} selectedRank={rank} enabledRanks={enabledRanks} count={count} disabled={disabled} onSelect={(candidate) => {
        const bid = chooseRankBid(legalBids, selected.type, candidate);
        if (bid) onChange(bid);
      }} />
      <p className="builder-hint">{straight ? "Click the highest card. A 5-high straight includes A–2–3–4–5." : `Click one rank${count > 1 ? ` to declare ${count} cards of that rank` : " to declare it"}.`}</p>
    </div>
  );
}
