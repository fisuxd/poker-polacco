import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BidBuilder } from "../client/components/BidBuilder";
import { FullHouseSelector, chooseFullHouseTrips, type FullHouseBid } from "../client/components/FullHouseSelector";
import { getLegalNextBids, type Bid } from "../shared/game/bids";
import type { PublicGameState } from "../shared/game/types";
import { getRankButton, getRankRow, rankButtonTag } from "./helpers/rank-card-actions";

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
  it("renders two clickable card rows with a complete five-card preview and no dropdowns", () => {
    const markup = renderBuilder({ type: "THREE_OF_A_KIND", rank: "A" });
    expect(markup).not.toContain("<select");
    expect(markup.match(/<fieldset/g)).toHaveLength(2);
    expect(markup.match(/data-rank=/g)).toHaveLength(26);
    expect(markup.indexOf('aria-label="Three of a kind"')).toBeLessThan(markup.indexOf('aria-label="Pair"'));
    expect(markup).not.toContain("Choose the exact declaration");
    expect(markup).toContain("Full House: 2 ×3 + 3 ×2");
    expect(rankButtonTag(markup, "Pair", "2")).toContain('disabled=""');
    expect(rankButtonTag(markup, "Pair", "3")).toContain('aria-pressed="true"');
    expect(markup.split('class="declaration-cards"')[1].match(/data-card-rank=/g)).toHaveLength(5);
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
    expect(rankButtonTag(markup, "Three of a kind", "J")).toContain('disabled=""');
    expect(rankButtonTag(markup, "Three of a kind", "Q")).not.toContain('disabled=""');
    expect(rankButtonTag(markup, "Pair", "8")).toContain('disabled=""');
    expect(rankButtonTag(markup, "Pair", "Q")).toContain('disabled=""');
    expect(rankButtonTag(markup, "Pair", "9")).not.toContain('disabled=""');
    expect(markup).toContain("Full House: Queen ×3 + 9 ×2");
  });

  it("clicks through both rows to compose the chosen Full House", () => {
    let selected: FullHouseBid = { type: "FULL_HOUSE", tripsRank: "2", pairRank: "3" };
    const onChange = (bid: FullHouseBid) => { selected = bid; };
    const view = () => FullHouseSelector({ legalBids: fullHouseBids(null), selected, onChange });
    getRankButton(getRankRow(view(), "Three of a kind"), "Q").onClick();
    expect(selected).toEqual({ type: "FULL_HOUSE", tripsRank: "Q", pairRank: "3" });
    getRankButton(getRankRow(view(), "Pair"), "8").onClick();
    expect(selected).toEqual({ type: "FULL_HOUSE", tripsRank: "Q", pairRank: "8" });
    expect(getRankButton(getRankRow(view(), "Three of a kind"), "Q")["aria-pressed"]).toBe(true);
    expect(getRankButton(getRankRow(view(), "Pair"), "8")["aria-pressed"]).toBe(true);
  });

  it("never allows the pair to match the trips, including after changing the trips", () => {
    let selected: FullHouseBid = { type: "FULL_HOUSE", tripsRank: "Q", pairRank: "8" };
    const onChange = vi.fn((bid: FullHouseBid) => { selected = bid; });
    const view = () => FullHouseSelector({ legalBids: fullHouseBids(null), selected, onChange });
    getRankButton(getRankRow(view(), "Pair"), "Q").onClick();
    expect(onChange).not.toHaveBeenCalled();
    getRankButton(getRankRow(view(), "Three of a kind"), "8").onClick();
    expect(selected).toEqual({ type: "FULL_HOUSE", tripsRank: "8", pairRank: "2" });
    expect(getRankButton(getRankRow(view(), "Pair"), "8").disabled).toBe(true);
  });

  it("rejects clicks on lower Full House raises and permits a higher pair", () => {
    const current: FullHouseBid = { type: "FULL_HOUSE", tripsRank: "Q", pairRank: "8" };
    const selected: FullHouseBid = { type: "FULL_HOUSE", tripsRank: "Q", pairRank: "9" };
    const onChange = vi.fn();
    const view = FullHouseSelector({ legalBids: fullHouseBids(current), selected, onChange });
    getRankButton(getRankRow(view, "Three of a kind"), "J").onClick();
    getRankButton(getRankRow(view, "Pair"), "8").onClick();
    expect(onChange).not.toHaveBeenCalled();
    getRankButton(getRankRow(view, "Pair"), "A").onClick();
    expect(onChange).toHaveBeenCalledWith({ type: "FULL_HOUSE", tripsRank: "Q", pairRank: "A" });
  });

  it("locks both rows while the declaration is being submitted", () => {
    const onChange = vi.fn();
    const view = FullHouseSelector({ legalBids: fullHouseBids(null), selected: { type: "FULL_HOUSE", tripsRank: "Q", pairRank: "8" }, onChange, disabled: true });
    for (const label of ["Three of a kind", "Pair"]) {
      const row = getRankRow(view, label);
      expect(row.disabled).toBe(true);
      getRankButton(row, "A").onClick();
    }
    expect(onChange).not.toHaveBeenCalled();
  });
});
