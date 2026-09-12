import { describe, expect, it } from "vitest";
import {
  BID_CATEGORIES,
  compareBids,
  evaluateBid,
  getAllPossibleBids,
  getLegalNextBids,
  isBidHigher,
  type Bid,
} from "../shared/game/bids";
import { RANKS, type Card, type Rank, type Suit } from "../shared/game/cards";

const card = (rank: Rank, suit: Suit = "CLUBS"): Card => ({ id: `${rank}-${suit}`, rank, suit });

const representatives: Record<(typeof BID_CATEGORIES)[number], Bid> = {
  HIGH_CARD: { type: "HIGH_CARD", rank: "A" },
  PAIR: { type: "PAIR", rank: "2" },
  STRAIGHT: { type: "STRAIGHT", highRank: "5" },
  TWO_PAIR: { type: "TWO_PAIR", highPair: "3", lowPair: "2" },
  THREE_OF_A_KIND: { type: "THREE_OF_A_KIND", rank: "2" },
  FULL_HOUSE: { type: "FULL_HOUSE", tripsRank: "2", pairRank: "3" },
  FOUR_OF_A_KIND: { type: "FOUR_OF_A_KIND", rank: "2" },
  ROYAL_FLUSH: { type: "ROYAL_FLUSH" },
};

describe("Poker Polacco bid ordering", () => {
  it("orders ranks from 2 through Ace", () => {
    for (let index = 1; index < RANKS.length; index += 1) {
      expect(compareBids({ type: "HIGH_CARD", rank: RANKS[index] }, { type: "HIGH_CARD", rank: RANKS[index - 1] })).toBe(1);
    }
  });

  it("compares every category against every other category in the custom order", () => {
    for (let left = 0; left < BID_CATEGORIES.length; left += 1) {
      for (let right = 0; right < BID_CATEGORIES.length; right += 1) {
        expect(compareBids(representatives[BID_CATEGORIES[left]], representatives[BID_CATEGORIES[right]])).toBe(Math.sign(left - right));
      }
    }
  });

  it("keeps Straight below Two Pair and Two Pair below Trips", () => {
    expect(compareBids({ type: "STRAIGHT", highRank: "A" }, { type: "TWO_PAIR", highPair: "3", lowPair: "2" })).toBe(-1);
    expect(compareBids({ type: "TWO_PAIR", highPair: "A", lowPair: "K" }, representatives.THREE_OF_A_KIND)).toBe(-1);
  });

  it("orders Pairs by rank", () => {
    expect(compareBids({ type: "PAIR", rank: "A" }, { type: "PAIR", rank: "K" })).toBe(1);
  });

  it("orders Straights by their high card", () => {
    expect(compareBids({ type: "STRAIGHT", highRank: "6" }, { type: "STRAIGHT", highRank: "5" })).toBe(1);
    expect(compareBids({ type: "STRAIGHT", highRank: "A" }, { type: "STRAIGHT", highRank: "K" })).toBe(1);
  });

  it("orders Two Pair by high pair, then low pair, and normalizes comparison", () => {
    expect(compareBids({ type: "TWO_PAIR", highPair: "A", lowPair: "Q" }, { type: "TWO_PAIR", highPair: "A", lowPair: "J" })).toBe(1);
    expect(compareBids({ type: "TWO_PAIR", highPair: "K", lowPair: "Q" }, { type: "TWO_PAIR", highPair: "Q", lowPair: "J" })).toBe(1);
    expect(compareBids({ type: "TWO_PAIR", highPair: "8", lowPair: "K" }, { type: "TWO_PAIR", highPair: "K", lowPair: "7" })).toBe(1);
  });

  it("orders Trips, Full House, and Four of a Kind correctly", () => {
    expect(compareBids({ type: "THREE_OF_A_KIND", rank: "Q" }, { type: "THREE_OF_A_KIND", rank: "J" })).toBe(1);
    expect(compareBids({ type: "FULL_HOUSE", tripsRank: "A", pairRank: "2" }, { type: "FULL_HOUSE", tripsRank: "K", pairRank: "A" })).toBe(1);
    expect(compareBids({ type: "FULL_HOUSE", tripsRank: "Q", pairRank: "9" }, { type: "FULL_HOUSE", tripsRank: "Q", pairRank: "8" })).toBe(1);
    expect(compareBids({ type: "FOUR_OF_A_KIND", rank: "10" }, { type: "FOUR_OF_A_KIND", rank: "9" })).toBe(1);
  });

  it("rejects equal and lower declarations", () => {
    const current: Bid = { type: "PAIR", rank: "Q" };
    expect(isBidHigher(current, { type: "PAIR", rank: "Q" })).toBe(false);
    expect(isBidHigher(current, { type: "PAIR", rank: "J" })).toBe(false);
    expect(isBidHigher(current, { type: "HIGH_CARD", rank: "A" })).toBe(false);
    expect(isBidHigher(current, { type: "STRAIGHT", highRank: "5" })).toBe(true);
  });
});

describe("bid evaluation", () => {
  it("evaluates High Card and Pair as true or false", () => {
    const cards = [card("Q"), card("Q", "HEARTS"), card("7")];
    expect(evaluateBid({ type: "HIGH_CARD", rank: "7" }, cards)).toBe(true);
    expect(evaluateBid({ type: "HIGH_CARD", rank: "A" }, cards)).toBe(false);
    expect(evaluateBid({ type: "PAIR", rank: "Q" }, cards)).toBe(true);
    expect(evaluateBid({ type: "PAIR", rank: "7" }, cards)).toBe(false);
  });

  it("recognizes the Ace-low and Ace-high Straights", () => {
    expect(evaluateBid({ type: "STRAIGHT", highRank: "5" }, [card("A"), card("2"), card("3"), card("4"), card("5")])).toBe(true);
    expect(evaluateBid({ type: "STRAIGHT", highRank: "A" }, [card("10"), card("J"), card("Q"), card("K"), card("A")])).toBe(true);
    expect(evaluateBid({ type: "STRAIGHT", highRank: "A" }, [card("9"), card("J"), card("Q"), card("K"), card("A")])).toBe(false);
  });

  it("evaluates Two Pair, Trips, Full House and Poker", () => {
    const cards = [card("K"), card("K", "HEARTS"), card("8"), card("8", "SPADES"), card("8", "DIAMONDS")];
    expect(evaluateBid({ type: "TWO_PAIR", highPair: "K", lowPair: "8" }, cards)).toBe(true);
    expect(evaluateBid({ type: "THREE_OF_A_KIND", rank: "8" }, cards)).toBe(true);
    expect(evaluateBid({ type: "FULL_HOUSE", tripsRank: "8", pairRank: "K" }, cards)).toBe(true);
    expect(evaluateBid({ type: "FULL_HOUSE", tripsRank: "K", pairRank: "8" }, cards)).toBe(false);
    expect(evaluateBid({ type: "FOUR_OF_A_KIND", rank: "8" }, cards)).toBe(false);
    expect(evaluateBid({ type: "FOUR_OF_A_KIND", rank: "8" }, [...cards, card("8", "HEARTS")])).toBe(true);
  });

  it("requires a Royal Flush in one suit", () => {
    const royal = (["10", "J", "Q", "K", "A"] as Rank[]).map((rank) => card(rank, "HEARTS"));
    expect(evaluateBid({ type: "ROYAL_FLUSH" }, royal)).toBe(true);
    expect(evaluateBid({ type: "ROYAL_FLUSH" }, royal.map((value, index) => index === 4 ? card("A", "SPADES") : value))).toBe(false);
  });
});

describe("physical availability", () => {
  it("with three cards exposes only High Card, Pair, and Trips", () => {
    const categories = new Set(getLegalNextBids(null, 3).map((bid) => bid.type));
    expect(categories).toEqual(new Set(["HIGH_CARD", "PAIR", "THREE_OF_A_KIND"]));
  });

  it("filters all five-card categories at four cards", () => {
    const categories = new Set(getLegalNextBids(null, 4).map((bid) => bid.type));
    expect(categories.has("TWO_PAIR")).toBe(true);
    expect(categories.has("FOUR_OF_A_KIND")).toBe(true);
    expect(categories.has("STRAIGHT")).toBe(false);
    expect(categories.has("FULL_HOUSE")).toBe(false);
    expect(categories.has("ROYAL_FLUSH")).toBe(false);
  });

  it("enumerates a deterministic, strictly ordered declaration list", () => {
    const bids = getAllPossibleBids();
    for (let index = 1; index < bids.length; index += 1) expect(compareBids(bids[index], bids[index - 1])).toBeGreaterThan(0);
  });
});
