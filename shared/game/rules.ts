export interface LossPenalty {
  previousCardCount: number;
  newCardCount: number;
  eliminated: boolean;
}

export function applyLoss(cardCount: number): LossPenalty {
  if (!Number.isInteger(cardCount) || cardCount < 1 || cardCount > 5) {
    throw new Error("Card count must be an integer from 1 to 5.");
  }
  return cardCount === 5
    ? { previousCardCount: 5, newCardCount: 5, eliminated: true }
    : { previousCardCount: cardCount, newCardCount: cardCount + 1, eliminated: false };
}
