import { describe, expect, it } from "vitest";
import { applyLoss } from "../shared/game/rules";

describe("loss progression", () => {
  it("adds one card after losses from one through four cards", () => {
    for (let count = 1; count <= 4; count += 1) {
      expect(applyLoss(count)).toEqual({ previousCardCount: count, newCardCount: count + 1, eliminated: false });
    }
  });

  it("eliminates a player who loses while already holding five cards", () => {
    expect(applyLoss(5)).toEqual({ previousCardCount: 5, newCardCount: 5, eliminated: true });
  });

  it("rejects invalid card counts", () => {
    expect(() => applyLoss(0)).toThrow();
    expect(() => applyLoss(6)).toThrow();
  });
});
