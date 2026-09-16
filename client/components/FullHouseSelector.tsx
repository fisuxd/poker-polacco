import { RANKS, type Rank } from "../../shared/game/cards";
import type { Bid } from "../../shared/game/bids";

export type FullHouseBid = Extract<Bid, { type: "FULL_HOUSE" }>;

export function chooseFullHouseTrips(
  legalBids: FullHouseBid[],
  tripsRank: Rank,
  preferredPairRank: Rank,
): FullHouseBid | undefined {
  const candidates = legalBids.filter((bid) => bid.tripsRank === tripsRank);
  return candidates.find((bid) => bid.pairRank === preferredPairRank) ?? candidates[0];
}

export function FullHouseSelector({ legalBids, selected, onChange }: {
  legalBids: FullHouseBid[];
  selected: FullHouseBid;
  onChange: (bid: FullHouseBid) => void;
}) {
  // Derive both menus from the domain engine's legal bids. No second copy of
  // hand ordering lives in the UI, and the pair can never equal the trips rank.
  const tripsRanks = RANKS.filter((rank) => legalBids.some((bid) => bid.tripsRank === rank));
  const pairBids = legalBids.filter((bid) => bid.tripsRank === selected.tripsRank);
  const pairRanks = RANKS.filter((rank) => pairBids.some((bid) => bid.pairRank === rank));

  return (
    <div className="full-house-selection">
      <div className="full-house-choices">
        <label className="bid-choice">
          <span>Three of a kind</span>
          <select value={selected.tripsRank} onChange={(event) => {
            const bid = chooseFullHouseTrips(legalBids, event.target.value as Rank, selected.pairRank);
            if (bid) onChange(bid);
          }}>
            {tripsRanks.map((rank) => <option key={rank} value={rank}>{rank} {rank} {rank}</option>)}
          </select>
        </label>
        <span className="full-house-plus" aria-hidden="true">+</span>
        <label className="bid-choice">
          <span>Pair</span>
          <select value={selected.pairRank} onChange={(event) => {
            const bid = pairBids.find((candidate) => candidate.pairRank === event.target.value);
            if (bid) onChange(bid);
          }}>
            {pairRanks.map((rank) => <option key={rank} value={rank}>{rank} {rank}</option>)}
          </select>
        </label>
      </div>
      <p className="builder-hint">Choose three of one rank and two of a different rank. Only legal raises are shown.</p>
    </div>
  );
}
