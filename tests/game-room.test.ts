import { afterEach, describe, expect, it, vi } from "vitest";
import { GameRoom, type RoomTiming } from "../server/game/GameRoom";
import type { Card } from "../shared/game/cards";

const timing: RoomTiming = { turnMs: 1_000, revealMs: 20, resultMs: 20, roundStartMs: 10, reconnectMs: 1_000 };
const card = (rank: Card["rank"], suit: Card["suit"]): Card => ({ id: `${rank}-${suit}`, rank, suit });

function startedRoom() {
  const room = new GameRoom("ABC234", "Alice", "socket-a", timing, () => undefined);
  const bob = room.addPlayer("Bob", "socket-b");
  room.startMatch(room.hostId);
  vi.advanceTimersByTime(timing.roundStartMs);
  return { room, bob };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("authoritative room flow", () => {
  it("keeps opponent cards out of public bidding state", () => {
    vi.useFakeTimers();
    const { room } = startedRoom();
    const [alice, bob] = room.players;
    expect(alice.cards).toHaveLength(1);
    expect(bob.cards).toHaveLength(1);
    expect(room.publicState().players.every((player) => player.revealedCards === undefined)).toBe(true);
    expect(room.privateState(alice.id).cards).toEqual(alice.cards);
    expect(room.privateState(alice.id).cards).not.toEqual(bob.cards);
    room.destroy();
  });

  it("enforces turns and rejects equal or lower bids on the server", () => {
    vi.useFakeTimers();
    const { room } = startedRoom();
    const starter = room.getPlayer(room.currentTurnId!)!;
    room.submitBid(starter.id, { type: "PAIR", rank: "Q" });
    expect(() => room.submitBid(starter.id, { type: "PAIR", rank: "K" })).toThrow("not your turn");
    const next = room.getPlayer(room.currentTurnId!)!;
    expect(() => room.submitBid(next.id, { type: "PAIR", rank: "Q" })).toThrow("strictly higher");
    expect(() => room.submitBid(next.id, { type: "PAIR", rank: "J" })).toThrow("strictly higher");
    room.destroy();
  });

  it("reveals all cards and penalizes the challenger when the bid is true", () => {
    vi.useFakeTimers();
    const { room } = startedRoom();
    const declarer = room.getPlayer(room.currentTurnId!)!;
    const challenger = room.players.find((player) => player.id !== declarer.id)!;
    declarer.cards = [card("Q", "CLUBS")];
    challenger.cards = [card("Q", "HEARTS")];
    room.submitBid(declarer.id, { type: "PAIR", rank: "Q" });
    room.callBluff(challenger.id);
    expect(room.phase).toBe("REVEAL");
    expect(room.result).toMatchObject({ bidWasTrue: true, loserId: challenger.id, previousCardCount: 1, newCardCount: 2 });
    expect(room.publicState().players.every((player) => player.revealedCards)).toBe(true);
    room.destroy();
  });

  it("eliminates a five-card loser and declares the remaining player winner", () => {
    vi.useFakeTimers();
    const { room } = startedRoom();
    const declarer = room.getPlayer(room.currentTurnId!)!;
    const challenger = room.players.find((player) => player.id !== declarer.id)!;
    declarer.cardCount = 5;
    declarer.cards = [card("2", "CLUBS"), card("3", "CLUBS"), card("4", "CLUBS"), card("5", "CLUBS"), card("6", "CLUBS")];
    challenger.cards = [card("7", "HEARTS")];
    room.submitBid(declarer.id, { type: "HIGH_CARD", rank: "A" });
    room.callBluff(challenger.id);
    expect(declarer.eliminated).toBe(true);
    expect(room.result).toMatchObject({ bidWasTrue: false, loserId: declarer.id, eliminated: true });
    vi.advanceTimersByTime(timing.revealMs);
    expect(room.phase).toBe("MATCH_OVER");
    expect(room.winnerId).toBe(challenger.id);
    room.destroy();
  });
});

describe("leaving a room and transferring host ownership", () => {
  function roomWithThreePlayers() {
    const room = new GameRoom("ABC234", "Alice", "socket-a", timing, () => undefined);
    const alice = room.players[0];
    const bob = room.addPlayer("Bob", "socket-b");
    const charlie = room.addPlayer("Charlie", "socket-c");
    return { room, alice, bob, charlie };
  }

  it("passes lobby ownership clockwise and lets the new host start", () => {
    vi.useFakeTimers();
    const { room, alice, bob } = roomWithThreePlayers();
    const oldToken = alice.reconnectToken;
    room.leaveRoom(alice.id);
    expect(room.hostId).toBe(bob.id);
    expect(room.getPlayer(alice.id)).toBeUndefined();
    expect(room.getPlayerByToken(oldToken)).toBeUndefined();
    expect(room.players.map((player) => player.seat)).toEqual([0, 1]);
    expect(() => room.startMatch(bob.id)).not.toThrow();
    room.destroy();
  });

  it("prefers a connected successor over a player reserving a disconnected seat", () => {
    vi.useFakeTimers();
    const { room, alice, bob, charlie } = roomWithThreePlayers();
    room.disconnect(bob.id, () => undefined);
    room.leaveRoom(alice.id);
    expect(room.hostId).toBe(charlie.id);
    room.destroy();
  });

  it("forfeits an active host, keeps seats fixed, and restarts the changed card pool", () => {
    vi.useFakeTimers();
    const { room, alice, bob, charlie } = roomWithThreePlayers();
    room.startMatch(alice.id);
    vi.advanceTimersByTime(timing.roundStartMs);
    room.currentTurnId = alice.id;
    room.submitBid(alice.id, { type: "HIGH_CARD", rank: "A" });
    const oldToken = alice.reconnectToken;
    const oldSeats = room.players.map((player) => player.seat);
    room.leaveRoom(alice.id);
    expect(room.hostId).toBe(bob.id);
    expect(alice).toMatchObject({ eliminated: true, connected: false, leftRoom: true, socketId: null });
    expect(room.getPlayerByToken(oldToken)).toBeUndefined();
    expect(room.players.map((player) => player.seat)).toEqual(oldSeats);
    expect(room.currentTurnId).toBe(bob.id);
    expect(room.currentBid).toBeNull();
    expect(room.roundNumber).toBe(2);
    expect(room.phase).toBe("ROUND_START");
    expect(bob.cardCount).toBe(1);
    expect(charlie.cardCount).toBe(1);
    expect(alice.cards).toEqual([]);
    vi.advanceTimersByTime(timing.roundStartMs);
    expect(room.phase).toBe("BIDDING");
    expect(() => room.submitBid(alice.id, { type: "PAIR", rank: "A" })).toThrow();
    room.destroy();
  });

  it("moves past a departing opener during ROUND_START instead of getting stuck", () => {
    vi.useFakeTimers();
    const { room, alice } = roomWithThreePlayers();
    room.startMatch(alice.id);
    const opener = room.getPlayer(room.currentTurnId!)!;
    room.leaveRoom(opener.id);
    expect(room.currentTurnId).not.toBe(opener.id);
    vi.advanceTimersByTime(timing.roundStartMs);
    expect(room.phase).toBe("BIDDING");
    expect(() => room.submitBid(room.currentTurnId!, { type: "HIGH_CARD", rank: "2" })).not.toThrow();
    room.destroy();
  });

  it("awards the remaining active player the match and clears pending turn timers", () => {
    vi.useFakeTimers();
    const { room } = startedRoom();
    const departingPlayer = room.getPlayer(room.currentTurnId!)!;
    const remaining = room.players.find((player) => player.id !== departingPlayer.id)!;
    room.leaveRoom(departingPlayer.id);
    expect(room.phase).toBe("MATCH_OVER");
    expect(room.winnerId).toBe(remaining.id);
    expect(room.currentTurnId).toBeNull();
    expect(room.turnDeadline).toBeNull();
    vi.advanceTimersByTime(5_000);
    expect(room.phase).toBe("MATCH_OVER");
    expect(room.roundNumber).toBe(1);
    room.destroy();
  });

  it("does not reset the round when an already eliminated player leaves", () => {
    vi.useFakeTimers();
    const { room, alice, charlie } = roomWithThreePlayers();
    room.startMatch(alice.id);
    vi.advanceTimersByTime(timing.roundStartMs);
    charlie.eliminated = true;
    room.currentTurnId = alice.id;
    room.submitBid(alice.id, { type: "HIGH_CARD", rank: "3" });
    const turnId = room.currentTurnId;
    room.leaveRoom(charlie.id);
    expect(room.roundNumber).toBe(1);
    expect(room.phase).toBe("BIDDING");
    expect(room.currentTurnId).toBe(turnId);
    expect(room.currentBid).toEqual({ type: "HIGH_CARD", rank: "3" });
    room.destroy();
  });

  it("preserves a resolved reveal and skips a departed loser as the next opener", () => {
    vi.useFakeTimers();
    const { room, alice, bob, charlie } = roomWithThreePlayers();
    room.startMatch(alice.id);
    vi.advanceTimersByTime(timing.roundStartMs);
    room.currentTurnId = alice.id;
    alice.cards = [card("2", "CLUBS")];
    bob.cards = [card("3", "CLUBS")];
    charlie.cards = [card("4", "CLUBS")];
    room.submitBid(alice.id, { type: "HIGH_CARD", rank: "A" });
    room.callBluff(bob.id);
    const result = room.result;
    room.leaveRoom(alice.id);
    expect(room.phase).toBe("REVEAL");
    expect(room.result).toEqual(result);
    expect(room.publicState().players.find((player) => player.id === alice.id)?.revealedCards).toEqual([card("2", "CLUBS")]);
    vi.advanceTimersByTime(timing.revealMs + timing.resultMs + timing.roundStartMs);
    expect(room.phase).toBe("BIDDING");
    expect(room.currentTurnId).toBe(bob.id);
    expect(alice.cards).toEqual([]);
    room.destroy();
  });

  it("lets the successor manage the post-match lobby and removes departed seats", () => {
    vi.useFakeTimers();
    const { room, alice, bob, charlie } = roomWithThreePlayers();
    room.phase = "MATCH_OVER";
    room.winnerId = charlie.id;
    room.leaveRoom(alice.id);
    expect(room.hostId).toBe(bob.id);
    expect(room.winnerId).toBe(charlie.id);
    room.returnToLobby(bob.id);
    expect(room.phase).toBe("LOBBY");
    expect(room.players.map((player) => player.id)).toEqual([bob.id, charlie.id]);
    expect(room.players.map((player) => player.seat)).toEqual([0, 1]);
    room.destroy();
  });

  it("invalidates expired reconnect tokens and transfers host ownership after the grace period", () => {
    vi.useFakeTimers();
    const { room, alice, bob } = roomWithThreePlayers();
    room.startMatch(alice.id);
    vi.advanceTimersByTime(timing.roundStartMs);
    const token = alice.reconnectToken;
    room.disconnect(alice.id, () => undefined);
    expect(room.hostId).toBe(alice.id);
    vi.advanceTimersByTime(timing.reconnectMs);
    expect(room.hostId).toBe(bob.id);
    expect(room.getPlayerByToken(token)).toBeUndefined();
    room.destroy();
  });

  it("reports an empty room after the last member leaves, even with retained match seats", () => {
    vi.useFakeTimers();
    const { room } = startedRoom();
    const ids = room.players.map((player) => player.id);
    ids.forEach((id) => room.leaveRoom(id));
    expect(room.players).toHaveLength(2);
    expect(room.hasMembers()).toBe(false);
    room.destroy();
  });
});
