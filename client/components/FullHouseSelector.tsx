import { RANKS, type Rank } from "../../shared/game/cards";
import type { Bid } from "../../shared/game/bids";
import { RankCardRow } from "./RankCardRow";

export type FullHouseBid = Extract<Bid, { type: "FULL_HOUSE" }>;

export function chooseFullHouseTrips(
  legalBids: FullHouseBid[],
  tripsRank: Rank,
  preferredPairRank: Rank,
): FullHouseBid | undefined {
  const candidates = legalBids.filter((bid) => bid.tripsRank === tripsRank);
  return candidates.find((bid) => bid.pairRank === preferredPairRank) ?? candidates[0];
}

export function FullHouseSelector({ legalBids, selected, onChange, disabled = false }: {
  legalBids: FullHouseBid[];
  selected: FullHouseBid;
  onChange: (bid: FullHouseBid) => void;
  disabled?: boolean;
}) {
  // Derive both rows from the domain engine's legal bids. No second copy of
  // hand ordering lives in the UI, and the pair can never equal the trips rank.
  const tripsRanks = RANKS.filter((rank) => legalBids.some((bid) => bid.tripsRank === rank));
  const pairBids = legalBids.filter((bid) => bid.tripsRank === selected.tripsRank);
  const pairRanks = RANKS.filter((rank) => pairBids.some((bid) => bid.pairRank === rank));

  return (
    <div className="full-house-selection">
      <RankCardRow label="Three of a kind" count={3} selectedRank={selected.tripsRank} enabledRanks={tripsRanks} disabled={disabled} onSelect={(rank) => {
        const bid = chooseFullHouseTrips(legalBids, rank, selected.pairRank);
        if (bid) onChange(bid);
      }} />
      <RankCardRow label="Pair" count={2} selectedRank={selected.pairRank} enabledRanks={pairRanks} disabled={disabled} onSelect={(rank) => {
        const bid = pairBids.find((candidate) => candidate.pairRank === rank);
        if (bid) onChange(bid);
      }} />
      <p className="builder-hint">Click a rank in each row: three of one rank, two of another. Disabled cards cannot make a legal raise.</p>
    </div>
  );
}
