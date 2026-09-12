import type { Bid } from "./bids";
import type { Card } from "./cards";

export type GamePhase = "LOBBY" | "ROUND_START" | "BIDDING" | "REVEAL" | "ROUND_RESULT" | "MATCH_OVER";

export interface PublicPlayer {
  id: string;
  nickname: string;
  seat: number;
  cardCount: number;
  connected: boolean;
  eliminated: boolean;
  revealedCards?: Card[];
}

export interface RoundResult {
  challengerId: string;
  declarerId: string;
  loserId: string;
  bidWasTrue: boolean;
  bid: Bid;
  matchingCardIds: string[];
  previousCardCount: number;
  newCardCount: number;
  eliminated: boolean;
  automatic: boolean;
}

export interface PublicGameState {
  roomCode: string;
  hostId: string;
  phase: GamePhase;
  players: PublicPlayer[];
  currentTurnId: string | null;
  currentBid: Bid | null;
  lastBidderId: string | null;
  roundNumber: number;
  totalCardsInPlay: number;
  turnDeadline: number | null;
  result: RoundResult | null;
  winnerId: string | null;
  serverNow: number;
}

export interface PrivatePlayerState {
  playerId: string;
  cards: Card[];
}

export interface ActionResponse {
  ok: boolean;
  error?: string;
}

export interface JoinResponse extends ActionResponse {
  roomCode?: string;
  playerId?: string;
  reconnectToken?: string;
}
