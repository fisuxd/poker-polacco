import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BidBuilder } from "../client/components/BidBuilder";
import { BidRankPicker, chooseRankBid, chooseTwoPairHigh, type TwoPairBid } from "../client/components/BidRankPicker";
import { CardFace } from "../client/components/CardFace";
import { RankCardRow } from "../client/components/RankCardRow";
import { BID_CATEGORIES, getLegalNextBids, isBidHigher, type Bid } from "../shared/game/bids";
import { RANKS, type Rank } from "../shared/game/cards";
import type { PublicGameState } from "../shared/game/types";
import { getRankButton, getRankRow } from "./helpers/rank-card-actions";

const state = (currentBid: Bid | null, totalCardsInPlay = 6): PublicGameState => ({
  roomCode: "ABC234", hostId: "host", phase: "BIDDING", players: [], currentTurnId: "host", currentBid,
  lastBidderId: "other", roundNumber: 1, totalCardsInPlay, turnDeadline: null, result: null, winnerId: null, serverNow: 0,
});
const pairs = (currentBid: Bid | null) => getLegalNextBids(currentBid, 6).filter((bid): bid is TwoPairBid => bid.type === "TWO_PAIR");

describe("clickable rank card row", () => {
  it("renders all thirteen rank cards and exposes selected and disabled states", () => {
    const markup = renderToStaticMarkup(<RankCardRow label="Pair" count={2} selectedRank="Q" enabledRanks={["Q", "K", "A"]} onSelect={() => undefined} />);
    expect(markup.match(/data-rank=/g)).toHaveLength(13);
    expect(markup.match(/disabled=""/g)).toHaveLength(10);
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(markup).not.toContain("<select");
    expect(markup).toContain('aria-label="Pair: Q"');
    expect(markup).toContain("×2");
  });

  it("emits the clicked rank only when legal and not submitting", () => {
    const onSelect = vi.fn();
    const row = { label: "Rank", selectedRank: "K" as Rank, enabledRanks: ["K", "A"] as Rank[], onSelect };
    getRankButton(row, "8").onClick();
    expect(onSelect).not.toHaveBeenCalled();
    getRankButton(row, "A").onClick();
    expect(onSelect).toHaveBeenCalledWith("A");
    onSelect.mockClear();
    getRankButton({ ...row, disabled: true }, "A").onClick();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("uses card graphics without inventing a suit for a rank-only choice", () => {
    const markup = renderToStaticMarkup(<CardFace card={{ rank: "K" }} />);
    expect(markup).toContain("<svg");
    expect(markup).toContain('data-card-rank="K"');
    expect(markup).toContain("♣ ♦ ♥ ♠");
  });
});

describe("single-rank declarations", () => {
  it.each([
    ["HIGH_CARD", "Choose the rank", { type: "HIGH_CARD", rank: "K" }, "A", { type: "HIGH_CARD", rank: "A" }],
    ["PAIR", "Choose the rank", { type: "PAIR", rank: "8" }, "Q", { type: "PAIR", rank: "Q" }],
    ["THREE_OF_A_KIND", "Choose the rank", { type: "THREE_OF_A_KIND", rank: "Q" }, "A", { type: "THREE_OF_A_KIND", rank: "A" }],
    ["FOUR_OF_A_KIND", "Choose the rank", { type: "FOUR_OF_A_KIND", rank: "8" }, "10", { type: "FOUR_OF_A_KIND", rank: "10" }],
    ["STRAIGHT", "Straight high card", { type: "STRAIGHT", highRank: "8" }, "Q", { type: "STRAIGHT", highRank: "Q" }],
  ] as const)("composes %s by clicking a card", (_category, label, currentBid, rank, expected) => {
    const legalBids = getLegalNextBids(currentBid, 6);
    const selected = legalBids.find((bid) => bid.type === currentBid.type)!;
    const onChange = vi.fn();
    const view = BidRankPicker({ legalBids, selected, onChange });
    const row = getRankRow(view, label);
    getRankButton(row, rank).onClick();
    expect(onChange).toHaveBeenCalledWith(expected);
    onChange.mockClear();
    getRankButton(row, "2").onClick();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cannot select a non-straight high rank or a lower/equal straight", () => {
    const legal = getLegalNextBids({ type: "STRAIGHT", highRank: "8" }, 6);
    for (const rank of ["2", "3", "4", "5", "8"] as Rank[]) expect(chooseRankBid(legal, "STRAIGHT", rank)).toBeUndefined();
    expect(chooseRankBid(getLegalNextBids(null, 5), "STRAIGHT", "5")).toEqual({ type: "STRAIGHT", highRank: "5" });
  });

  it("only offers valid domain-engine raises across every category and rank", () => {
    const current: Bid = { type: "PAIR", rank: "Q" };
    const legal = getLegalNextBids(current, 6);
    for (const category of BID_CATEGORIES) for (const rank of RANKS) {
      const chosen = chooseRankBid(legal, category, rank);
      if (chosen) {
        expect(legal).toContain(chosen);
        expect(isBidHigher(current, chosen)).toBe(true);
      }
    }
  });
});

describe("Two Pair rank cards", () => {
  it("composes both pairs through two independent card rows", () => {
    let selected: TwoPairBid = { type: "TWO_PAIR", highPair: "3", lowPair: "2" };
    const onChange = (bid: Bid) => { selected = bid as TwoPairBid; };
    const view = () => BidRankPicker({ legalBids: pairs(null), selected, onChange });
    getRankButton(getRankRow(view(), "Higher pair"), "K").onClick();
    expect(selected).toEqual({ type: "TWO_PAIR", highPair: "K", lowPair: "2" });
    getRankButton(getRankRow(view(), "Lower pair"), "8").onClick();
    expect(selected).toEqual({ type: "TWO_PAIR", highPair: "K", lowPair: "8" });
  });

  it("preserves the lower pair when legal and replaces it when the higher pair moves below it", () => {
    expect(chooseTwoPairHigh(pairs(null), "A", "8")).toEqual({ type: "TWO_PAIR", highPair: "A", lowPair: "8" });
    expect(chooseTwoPairHigh(pairs(null), "7", "8")).toEqual({ type: "TWO_PAIR", highPair: "7", lowPair: "2" });
    expect(chooseTwoPairHigh(pairs(null), "2", "3")).toBeUndefined();
  });

  it("disables equal, reversed and lower/equal raises", () => {
    const current: TwoPairBid = { type: "TWO_PAIR", highPair: "K", lowPair: "8" };
    const selected: TwoPairBid = { type: "TWO_PAIR", highPair: "K", lowPair: "9" };
    const onChange = vi.fn();
    const view = BidRankPicker({ legalBids: pairs(current), selected, onChange });
    const higher = getRankRow(view, "Higher pair");
    const lower = getRankRow(view, "Lower pair");
    for (const [row, rank] of [[higher, "Q"], [lower, "8"], [lower, "K"], [lower, "A"]] as const) {
      expect(getRankButton(row, rank).disabled).toBe(true);
      getRankButton(row, rank).onClick();
    }
    expect(onChange).not.toHaveBeenCalled();
    getRankButton(lower, "Q").onClick();
    expect(onChange).toHaveBeenCalledWith({ type: "TWO_PAIR", highPair: "K", lowPair: "Q" });
  });
});

describe("declaration builder rendering", () => {
  it("contains no dropdown for any available initial category and previews the actual combination", () => {
    const boundaries: (Bid | null)[] = [null, { type: "HIGH_CARD", rank: "A" }, { type: "PAIR", rank: "A" }, { type: "STRAIGHT", highRank: "A" }, { type: "TWO_PAIR", highPair: "A", lowPair: "K" }, { type: "THREE_OF_A_KIND", rank: "A" }, { type: "FULL_HOUSE", tripsRank: "A", pairRank: "K" }, { type: "FOUR_OF_A_KIND", rank: "A" }];
    for (const current of boundaries) {
      const markup = renderToStaticMarkup(<BidBuilder state={state(current)} onClose={() => undefined} onSubmit={() => undefined} busy={false} />);
      expect(markup).not.toContain("<select");
      expect(markup).not.toContain("<option");
      expect(markup).toContain('class="declaration-cards"');
      expect(markup).toContain("data-card-rank=");
    }
  });

  it("explains Royal Flush's fixed ranks without offering misleading choices", () => {
    const markup = renderToStaticMarkup(<BidBuilder state={state({ type: "FOUR_OF_A_KIND", rank: "A" })} onClose={() => undefined} onSubmit={() => undefined} busy={false} />);
    expect(markup).toContain("The ranks are fixed");
    expect(markup).not.toContain("data-rank=");
    expect(markup.match(/data-card-rank=/g)).toHaveLength(5);
  });

  it("locks every rank and category button while submitting", () => {
    const markup = renderToStaticMarkup(<BidBuilder state={state(null)} onClose={() => undefined} onSubmit={() => undefined} busy />);
    const rankTags = markup.match(/<button\b[^>]*data-rank="[^"]+"[^>]*>/g)!;
    expect(rankTags).toHaveLength(13);
    expect(rankTags.every((tag) => tag.includes('disabled=""'))).toBe(true);
    const categories = markup.split('class="category-grid"')[1].split("</div>")[0];
    expect(categories.match(/disabled=""/g)).toHaveLength(8);
  });

  it("does not offer physically impossible combinations or a raise above Royal Flush", () => {
    const small = renderToStaticMarkup(<BidBuilder state={state(null, 3)} onClose={() => undefined} onSubmit={() => undefined} busy={false} />);
    expect(small).not.toContain("Full House");
    const maximal = renderToStaticMarkup(<BidBuilder state={state({ type: "ROYAL_FLUSH" })} onClose={() => undefined} onSubmit={() => undefined} busy={false} />);
    expect(maximal).toContain("There is no declaration above the current bid");
    expect(maximal).not.toContain("data-rank=");
    expect(maximal).not.toContain('class="builder-submit"');
  });
});
