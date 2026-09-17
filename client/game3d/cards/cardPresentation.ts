import type { Bid } from "../../../shared/game/bids";
import { RANKS, type Card, type Rank, type Suit } from "../../../shared/game/cards";
import type { GamePhase, PrivatePlayerState, PublicPlayer } from "../../../shared/game/types";

// Declarations specify ranks, not the suits of hidden cards. Only a Royal
// Flush needs a suited illustration; its caption makes the example explicit.
export interface CardArtwork {
  rank: Rank;
  suit?: Suit;
  id?: string;
}

export function getBidCards(bid: Bid): CardArtwork[] {
  let ranks: Rank[];
  switch (bid.type) {
    case "HIGH_CARD": ranks = [bid.rank]; break;
    case "PAIR": ranks = [bid.rank, bid.rank]; break;
    case "THREE_OF_A_KIND": ranks = [bid.rank, bid.rank, bid.rank]; break;
    case "FOUR_OF_A_KIND": ranks = [bid.rank, bid.rank, bid.rank, bid.rank]; break;
    case "TWO_PAIR": ranks = [bid.highPair, bid.highPair, bid.lowPair, bid.lowPair]; break;
    case "FULL_HOUSE": ranks = [bid.tripsRank, bid.tripsRank, bid.tripsRank, bid.pairRank, bid.pairRank]; break;
    case "STRAIGHT": {
      const high = RANKS.indexOf(bid.highRank);
      ranks = bid.highRank === "5" ? ["A", "2", "3", "4", "5"] : RANKS.slice(high - 4, high + 1);
      break;
    }
    case "ROYAL_FLUSH":
      return (["10", "J", "Q", "K", "A"] as Rank[]).map((rank) => ({ rank, suit: "SPADES" }));
  }
  return ranks.map((rank) => ({ rank }));
}

export const isRevealPhase = (phase: GamePhase): boolean =>
  phase === "REVEAL" || phase === "ROUND_RESULT" || phase === "MATCH_OVER";

export function getVisiblePlayerCards(
  player: PublicPlayer,
  phase: GamePhase,
  privateState: PrivatePlayerState | null,
): (Card | undefined)[] {
  if (isRevealPhase(phase)) return player.revealedCards ?? [];
  if (player.eliminated || player.leftRoom) return [];
  if (player.id === privateState?.playerId) return privateState.cards;
  return Array.from({ length: player.cardCount }, () => undefined);
}
