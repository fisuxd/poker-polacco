import { describe, expect, it } from "vitest";
import { getBidCards, getVisiblePlayerCards, isRevealPhase } from "../client/game3d/cards/cardPresentation";
import { getAllPossibleBids, MINIMUM_CARDS } from "../shared/game/bids";
import type { Card } from "../shared/game/cards";
import type { PublicPlayer } from "../shared/game/types";

const queen: Card = { id: "Q-HEARTS", rank: "Q", suit: "HEARTS" };
const player: PublicPlayer = { id: "alice", nickname: "Alice", seat: 0, cardCount: 2, connected: true, eliminated: false, leftRoom: false };

describe("card-based declarations", () => {
  it("renders the correct number of cards for every possible declaration", () => {
    for (const bid of getAllPossibleBids()) {
      expect(getBidCards(bid)).toHaveLength(MINIMUM_CARDS[bid.type]);
    }
  });

  it("shows both groups of a Full House in trips-then-pair order", () => {
    expect(getBidCards({ type: "FULL_HOUSE", tripsRank: "Q", pairRank: "8" }).map((card) => card.rank)).toEqual(["Q", "Q", "Q", "8", "8"]);
    expect(getBidCards({ type: "TWO_PAIR", highPair: "K", lowPair: "7" }).map((card) => card.rank)).toEqual(["K", "K", "7", "7"]);
  });

  it("shows Ace-low and Ace-high straights correctly", () => {
    expect(getBidCards({ type: "STRAIGHT", highRank: "5" }).map((card) => card.rank)).toEqual(["A", "2", "3", "4", "5"]);
    expect(getBidCards({ type: "STRAIGHT", highRank: "A" }).map((card) => card.rank)).toEqual(["10", "J", "Q", "K", "A"]);
  });

  it("does not imply specific hidden suits for rank-only declarations", () => {
    for (const bid of getAllPossibleBids().filter((bid) => bid.type !== "ROYAL_FLUSH")) {
      expect(getBidCards(bid).every((card) => card.suit === undefined && card.id === undefined)).toBe(true);
    }
    expect(getBidCards({ type: "ROYAL_FLUSH" }).map((card) => card.suit)).toEqual(Array(5).fill("SPADES"));
  });
});

describe("hand visibility", () => {
  it("shows only the local player's private cards before a challenge", () => {
    expect(getVisiblePlayerCards(player, "BIDDING", { playerId: "alice", cards: [queen] })).toEqual([queen]);
    expect(getVisiblePlayerCards({ ...player, revealedCards: [queen] }, "BIDDING", { playerId: "bob", cards: [queen] })).toEqual([undefined, undefined]);
    expect(getVisiblePlayerCards(player, "ROUND_START", null)).toEqual([undefined, undefined]);
  });

  it("uses public reveal cards, including a just-eliminated hand, after a challenge", () => {
    for (const phase of ["REVEAL", "ROUND_RESULT", "MATCH_OVER"] as const) {
      expect(isRevealPhase(phase)).toBe(true);
      expect(getVisiblePlayerCards({ ...player, eliminated: true, revealedCards: [queen] }, phase, null)).toEqual([queen]);
    }
    expect(getVisiblePlayerCards(player, "REVEAL", { playerId: "alice", cards: [queen] })).toEqual([]);
  });

  it("does not show phantom cards for eliminated or departed players in a new round", () => {
    expect(getVisiblePlayerCards({ ...player, eliminated: true }, "BIDDING", null)).toEqual([]);
    expect(getVisiblePlayerCards({ ...player, leftRoom: true }, "ROUND_START", null)).toEqual([]);
  });
});
