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
