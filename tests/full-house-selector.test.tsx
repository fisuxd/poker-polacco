import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BidBuilder } from "../client/components/BidBuilder";
import { chooseFullHouseTrips, type FullHouseBid } from "../client/components/FullHouseSelector";
import { getLegalNextBids, type Bid } from "../shared/game/bids";
import type { PublicGameState } from "../shared/game/types";

const fullHouseBids = (currentBid: Bid | null) => getLegalNextBids(currentBid, 6)
  .filter((bid): bid is FullHouseBid => bid.type === "FULL_HOUSE");

function renderBuilder(currentBid: Bid) {
  const state: PublicGameState = {
    roomCode: "ABC234", hostId: "host", phase: "BIDDING", players: [],
    currentTurnId: "host", currentBid, lastBidderId: "other", roundNumber: 1,
    totalCardsInPlay: 6, turnDeadline: null, result: null, winnerId: null, serverNow: 0,
  };
  return renderToStaticMarkup(<BidBuilder state={state} onClose={() => undefined} onSubmit={() => undefined} busy={false} />);
}

describe("Full House declaration builder", () => {
  it("renders separate trips and pair menus with a complete declaration preview", () => {
    const markup = renderBuilder({ type: "THREE_OF_A_KIND", rank: "A" });
    expect(markup.match(/<select/g)).toHaveLength(2);
    expect(markup).toContain("Three of a kind</span>");
    expect(markup).toContain("Pair</span>");
    expect(markup).not.toContain("Choose the exact declaration");
    expect(markup).toContain("Full House: 2 ×3 + 3 ×2");
    const pairMenu = markup.split("<select")[2].split("</select>")[0];
    expect(pairMenu).not.toContain('value="2"');
  });

  it("preserves the selected pair when changing the trips rank if still legal", () => {
    expect(chooseFullHouseTrips(fullHouseBids(null), "K", "8")).toEqual({ type: "FULL_HOUSE", tripsRank: "K", pairRank: "8" });
  });

  it("chooses a different pair automatically if the new trips rank matches it", () => {
    const bid = chooseFullHouseTrips(fullHouseBids(null), "8", "8");
    expect(bid).toEqual({ type: "FULL_HOUSE", tripsRank: "8", pairRank: "2" });
  });

  it("only allows combinations above a current Full House", () => {
    const current: FullHouseBid = { type: "FULL_HOUSE", tripsRank: "Q", pairRank: "8" };
    const legal = fullHouseBids(current);
    expect(chooseFullHouseTrips(legal, "J", "A")).toBeUndefined();
    expect(chooseFullHouseTrips(legal, "Q", "7")).toEqual({ type: "FULL_HOUSE", tripsRank: "Q", pairRank: "9" });
    expect(chooseFullHouseTrips(legal, "K", "2")).toEqual({ type: "FULL_HOUSE", tripsRank: "K", pairRank: "2" });
    const markup = renderBuilder(current);
    const tripsMenu = markup.split("<select")[1].split("</select>")[0];
    const pairMenu = markup.split("<select")[2].split("</select>")[0];
    expect(tripsMenu).not.toContain('value="J"');
    expect(pairMenu).not.toContain('value="8"');
    expect(pairMenu).not.toContain('value="Q"');
    expect(markup).toContain("Full House: Queen ×3 + 9 ×2");
  });
});
