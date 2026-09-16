import { randomBytes, randomInt } from "node:crypto";
import {
  evaluateBid,
  formatBid,
  getLegalNextBids,
  getMatchingCardIds,
  isBidHigher,
  isBidPhysicallyPossible,
  normalizeBid,
  type Bid,
} from "../../shared/game/bids";
import { shuffleDeck, type Card } from "../../shared/game/cards";
import { applyLoss } from "../../shared/game/rules";
import type {
  PrivatePlayerState,
  PublicGameState,
  PublicPlayer,
  RoundResult,
} from "../../shared/game/types";

export interface RoomPlayer {
  id: string;
  nickname: string;
  seat: number;
  cardCount: number;
  cards: Card[];
  connected: boolean;
  eliminated: boolean;
  leftRoom: boolean;
  reconnectToken: string;
  socketId: string | null;
  disconnectTimer: NodeJS.Timeout | null;
}

export interface RoomTiming {
  turnMs: number;
  revealMs: number;
  resultMs: number;
  roundStartMs: number;
  reconnectMs: number;
}

type ChangeHandler = (room: GameRoom) => void;

export class GameRoom {
  readonly code: string;
  hostId: string;
  players: RoomPlayer[];
  phase: PublicGameState["phase"] = "LOBBY";
  currentTurnId: string | null = null;
  currentBid: Bid | null = null;
  lastBidderId: string | null = null;
  roundNumber = 0;
  result: RoundResult | null = null;
  winnerId: string | null = null;
  turnDeadline: number | null = null;
  private phaseTimer: NodeJS.Timeout | null = null;
  private turnTimer: NodeJS.Timeout | null = null;
  private readonly timing: RoomTiming;
  private readonly onChange: ChangeHandler;

  constructor(code: string, hostNickname: string, hostSocketId: string, timing: RoomTiming, onChange: ChangeHandler) {
    this.code = code;
    this.timing = timing;
    this.onChange = onChange;
    const host = this.createPlayer(hostNickname, hostSocketId, 0);
    this.players = [host];
    this.hostId = host.id;
    this.log(`room created by ${host.nickname}`);
  }

  private createPlayer(nickname: string, socketId: string, seat: number): RoomPlayer {
    return {
      id: randomBytes(12).toString("hex"),
      nickname,
      seat,
      cardCount: 1,
      cards: [],
      connected: true,
      eliminated: false,
      leftRoom: false,
      reconnectToken: randomBytes(24).toString("hex"),
      socketId,
      disconnectTimer: null,
    };
  }

  private log(message: string): void {
    console.log(`[room ${this.code}] ${message}`);
  }

  private notify(): void {
    this.onChange(this);
  }

  addPlayer(nickname: string, socketId: string): RoomPlayer {
    if (this.phase !== "LOBBY") throw new Error("Game already in progress.");
    if (this.players.length >= 6) throw new Error("This room is full.");
    if (this.players.some((player) => player.nickname.toLocaleLowerCase() === nickname.toLocaleLowerCase())) {
      throw new Error("That nickname is already in this room.");
    }
    const player = this.createPlayer(nickname, socketId, this.players.length);
    this.players.push(player);
    this.log(`${player.nickname} joined`);
    this.notify();
    return player;
  }

  getPlayer(playerId: string): RoomPlayer | undefined {
    return this.players.find((player) => player.id === playerId);
  }

  getPlayerByToken(token: string): RoomPlayer | undefined {
    return this.players.find((player) => !player.leftRoom && player.reconnectToken === token);
  }

  hasMembers(): boolean {
    return this.players.some((player) => !player.leftRoom);
  }

  reconnect(player: RoomPlayer, socketId: string): void {
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
    player.connected = true;
    player.socketId = socketId;
    this.log(`${player.nickname} reconnected`);
    this.notify();
  }

  disconnect(playerId: string, onExpired: () => void): void {
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.connected = false;
    player.socketId = null;
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = setTimeout(() => {
      player.disconnectTimer = null;
      this.expireDisconnectedPlayer(playerId);
      onExpired();
    }, this.timing.reconnectMs);
    this.log(`${player.nickname} disconnected; reserving seat`);
    this.notify();
  }

  removeFromLobby(playerId: string): void {
    if (this.phase !== "LOBBY") throw new Error("The room is not in the lobby.");
    const player = this.getPlayer(playerId);
    if (!player) return;
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    this.players = this.players.filter((candidate) => candidate.id !== playerId);
    this.transferHostIfNeeded(player.seat);
    this.players.forEach((candidate, index) => { candidate.seat = index; });
    this.log(`${player.nickname} left`);
    this.notify();
  }

  expireDisconnectedPlayer(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player || player.connected || player.leftRoom) return;
    this.log(`${player.nickname} left after reconnect timeout`);
    this.leaveRoom(playerId);
  }

  leaveRoom(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player || player.leftRoom) throw new Error("You are no longer a member of this room.");
    if (this.phase === "LOBBY") {
      this.removeFromLobby(playerId);
      return;
    }

    const wasActive = !player.eliminated;
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
    player.leftRoom = true;
    player.connected = false;
    player.eliminated = true;
    player.socketId = null;
    player.reconnectToken = "";
    // Keep the seat and nickname for match history, and keep already revealed
    // cards until the next deal so leaving cannot erase the challenge evidence.
    if (this.phase === "BIDDING" || this.phase === "ROUND_START") player.cards = [];
    this.transferHostIfNeeded(player.seat);
    this.log(`${player.nickname} left${wasActive && this.phase !== "MATCH_OVER" ? " and forfeited" : ""}`);

    if (this.phase === "MATCH_OVER") {
      this.notify();
      return;
    }
    const active = this.activePlayers();
    if (active.length <= 1) {
      this.finishMatch(active[0]?.id ?? null);
    } else if (wasActive && (this.phase === "BIDDING" || this.phase === "ROUND_START")) {
      // Restart only an unfinished round: the departed hand was part of the
      // claimed pool, so preserving its current bid would change the rules.
      const next = this.nextActiveAfter(player.seat);
      this.beginRound(next?.id ?? active[0].id);
    } else {
      this.notify();
    }
  }

  private transferHostIfNeeded(previousSeat: number): void {
    const currentHost = this.getPlayer(this.hostId);
    if (currentHost && !currentHost.leftRoom) return;
    const remaining = this.players.filter((player) => !player.leftRoom).sort((a, b) => a.seat - b.seat);
    const connected = remaining.filter((player) => player.connected);
    const candidates = connected.length > 0 ? connected : remaining;
    const replacement = candidates.find((player) => player.seat > previousSeat) ?? candidates[0];
    if (replacement) {
      this.hostId = replacement.id;
      this.log(`${replacement.nickname} is now the host`);
    }
  }

  startMatch(requesterId: string): void {
    if (requesterId !== this.hostId) throw new Error("Only the host can start the game.");
    if (this.phase !== "LOBBY" && this.phase !== "MATCH_OVER") throw new Error("The match has already started.");
    const connectedPlayers = this.players.filter((player) => player.connected && !player.leftRoom);
    if (connectedPlayers.length < 2) throw new Error("At least two connected players are required.");
    this.clearTimers();
    this.players = connectedPlayers;
    this.players.forEach((player, seat) => {
      player.seat = seat;
      player.cardCount = 1;
      player.cards = [];
      player.eliminated = false;
      player.leftRoom = false;
    });
    this.roundNumber = 0;
    this.winnerId = null;
    this.result = null;
    const starter = this.players[randomInt(this.players.length)];
    this.log(`match started with ${this.players.length} players`);
    this.beginRound(starter.id);
  }

  returnToLobby(requesterId: string): void {
    if (requesterId !== this.hostId) throw new Error("Only the host can return to the lobby.");
    if (this.phase !== "MATCH_OVER") throw new Error("The match is not over.");
    this.clearTimers();
    this.players = this.players.filter((player) => player.connected && !player.leftRoom);
    this.players.forEach((player, seat) => {
      player.seat = seat;
      player.cardCount = 1;
      player.cards = [];
      player.eliminated = false;
      player.leftRoom = false;
    });
    this.phase = "LOBBY";
    this.currentBid = null;
    this.currentTurnId = null;
    this.lastBidderId = null;
    this.result = null;
    this.winnerId = null;
    this.roundNumber = 0;
    this.log("returned to lobby");
    this.notify();
  }

  private activePlayers(): RoomPlayer[] {
    return this.players.filter((player) => !player.eliminated).sort((a, b) => a.seat - b.seat);
  }

  private totalCards(): number {
    return this.activePlayers().reduce((total, player) => total + player.cardCount, 0);
  }

  private nextActiveAfter(seat: number): RoomPlayer | undefined {
    const active = this.activePlayers();
    return active.find((player) => player.seat > seat) ?? active[0];
  }

  private deal(): void {
    const deck = shuffleDeck();
    let deckIndex = 0;
    this.players.forEach((player) => {
      player.cards = player.eliminated ? [] : deck.slice(deckIndex, deckIndex + player.cardCount);
      deckIndex += player.cards.length;
    });
  }

  private beginRound(preferredStarterId: string): void {
    this.clearTimers();
    const active = this.activePlayers();
    if (active.length <= 1) {
      this.finishMatch(active[0]?.id ?? null);
      return;
    }
    const preferred = active.find((player) => player.id === preferredStarterId);
    const oldSeat = this.getPlayer(preferredStarterId)?.seat ?? -1;
    const starter = preferred ?? this.nextActiveAfter(oldSeat) ?? active[0];
    this.deal();
    this.roundNumber += 1;
    this.phase = "ROUND_START";
    this.currentTurnId = starter.id;
    this.currentBid = null;
    this.lastBidderId = null;
    this.turnDeadline = null;
    this.result = null;
    this.log(`round ${this.roundNumber} started; ${starter.nickname} acts first`);
    this.notify();
    this.phaseTimer = setTimeout(() => {
      if (this.phase !== "ROUND_START") return;
      this.phase = "BIDDING";
      this.startTurnTimer();
      this.notify();
    }, this.timing.roundStartMs);
  }

  submitBid(playerId: string, submittedBid: Bid, automatic = false): void {
    this.assertCanAct(playerId);
    const bid = normalizeBid(submittedBid);
    if (!isBidPhysicallyPossible(bid, this.totalCards())) throw new Error("That declaration is impossible with the number of cards in play.");
    if (!isBidHigher(this.currentBid, bid)) throw new Error("Your declaration must be strictly higher than the current one.");
    this.currentBid = bid;
    this.lastBidderId = playerId;
    const actingPlayer = this.getPlayer(playerId)!;
    const nextPlayer = this.nextActiveAfter(actingPlayer.seat);
    if (!nextPlayer) throw new Error("No next player is available.");
    this.currentTurnId = nextPlayer.id;
    this.log(`${actingPlayer.nickname} declared ${formatBid(bid)}${automatic ? " automatically" : ""}`);
    this.startTurnTimer();
    this.notify();
  }

  callBluff(playerId: string, automatic = false): void {
    this.assertCanAct(playerId);
    if (!this.currentBid || !this.lastBidderId) throw new Error("There is no declaration to challenge.");
    this.clearTurnTimer();
    const challenger = this.getPlayer(playerId)!;
    const declarer = this.getPlayer(this.lastBidderId)!;
    const allCards = this.activePlayers().flatMap((player) => player.cards);
    const bidWasTrue = evaluateBid(this.currentBid, allCards);
    const loser = bidWasTrue ? challenger : declarer;
    const penalty = applyLoss(loser.cardCount);
    loser.cardCount = penalty.newCardCount;
    loser.eliminated = penalty.eliminated;
    const result: RoundResult = {
      challengerId: challenger.id,
      declarerId: declarer.id,
      loserId: loser.id,
      bidWasTrue,
      bid: this.currentBid,
      matchingCardIds: getMatchingCardIds(this.currentBid, allCards),
      previousCardCount: penalty.previousCardCount,
      newCardCount: penalty.newCardCount,
      eliminated: penalty.eliminated,
      automatic,
    };
    this.result = result;
    this.phase = "REVEAL";
    this.currentTurnId = null;
    this.turnDeadline = null;
    this.log(`${challenger.nickname} called bluff${automatic ? " on timeout" : ""}; bid was ${bidWasTrue ? "true" : "false"}`);
    this.log(`${loser.nickname} lost and ${penalty.eliminated ? "was eliminated" : `now has ${penalty.newCardCount} cards`}`);
    this.notify();

    const nextStarter = penalty.eliminated ? this.nextActiveAfter(loser.seat)?.id : loser.id;
    this.phaseTimer = setTimeout(() => {
      const active = this.activePlayers();
      if (active.length <= 1) {
        this.finishMatch(active[0]?.id ?? null);
        return;
      }
      this.phase = "ROUND_RESULT";
      this.notify();
      this.phaseTimer = setTimeout(() => this.beginRound(nextStarter ?? active[0].id), this.timing.resultMs);
    }, this.timing.revealMs);
  }

  private assertCanAct(playerId: string): void {
    if (this.phase !== "BIDDING") throw new Error("Actions are not allowed in this phase.");
    if (this.currentTurnId !== playerId) throw new Error("It is not your turn.");
    const player = this.getPlayer(playerId);
    if (!player || player.eliminated) throw new Error("Eliminated players cannot act.");
  }

  private startTurnTimer(): void {
    this.clearTurnTimer();
    this.turnDeadline = Date.now() + this.timing.turnMs;
    const expectedPlayer = this.currentTurnId;
    this.turnTimer = setTimeout(() => {
      if (this.phase !== "BIDDING" || this.currentTurnId !== expectedPlayer || !expectedPlayer) return;
      try {
        if (this.currentBid) this.callBluff(expectedPlayer, true);
        else {
          const lowest = getLegalNextBids(null, this.totalCards())[0];
          this.submitBid(expectedPlayer, lowest, true);
        }
      } catch (error) {
        console.error(`[room ${this.code}] turn timeout failed`, error);
      }
    }, this.timing.turnMs);
  }

  private finishMatch(winnerId: string | null): void {
    this.clearTimers();
    this.phase = "MATCH_OVER";
    this.currentTurnId = null;
    this.turnDeadline = null;
    this.winnerId = winnerId;
    const winner = winnerId ? this.getPlayer(winnerId) : undefined;
    this.log(`match winner: ${winner?.nickname ?? "none"}`);
    this.notify();
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.turnDeadline = null;
  }

  private clearTimers(): void {
    this.clearTurnTimer();
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
  }

  publicState(): PublicGameState {
    const revealCards = this.phase === "REVEAL" || this.phase === "ROUND_RESULT" || this.phase === "MATCH_OVER";
    const players: PublicPlayer[] = this.players
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((player) => ({
        id: player.id,
        nickname: player.nickname,
        seat: player.seat,
        cardCount: player.cardCount,
        connected: player.connected,
        eliminated: player.eliminated,
        leftRoom: player.leftRoom,
        ...(revealCards ? { revealedCards: player.cards } : {}),
      }));
    return {
      roomCode: this.code,
      hostId: this.hostId,
      phase: this.phase,
      players,
      currentTurnId: this.currentTurnId,
      currentBid: this.currentBid,
      lastBidderId: this.lastBidderId,
      roundNumber: this.roundNumber,
      totalCardsInPlay: this.totalCards(),
      turnDeadline: this.turnDeadline,
      result: this.result,
      winnerId: this.winnerId,
      serverNow: Date.now(),
    };
  }

  privateState(playerId: string): PrivatePlayerState {
    const player = this.getPlayer(playerId);
    return { playerId, cards: player?.cards ?? [] };
  }

  destroy(): void {
    this.clearTimers();
    this.players.forEach((player) => {
      if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    });
  }
}
