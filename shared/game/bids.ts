import { RANKS, SUITS, rankValue, type Card, type Rank } from "./cards";

export const BID_CATEGORIES = [
  "HIGH_CARD",
  "PAIR",
  "STRAIGHT",
  "TWO_PAIR",
  "THREE_OF_A_KIND",
  "FULL_HOUSE",
  "FOUR_OF_A_KIND",
  "ROYAL_FLUSH",
] as const;

export type BidCategory = (typeof BID_CATEGORIES)[number];
export type StraightHighRank = "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export type Bid =
  | { type: "HIGH_CARD"; rank: Rank }
  | { type: "PAIR"; rank: Rank }
  | { type: "STRAIGHT"; highRank: StraightHighRank }
  | { type: "TWO_PAIR"; highPair: Rank; lowPair: Rank }
  | { type: "THREE_OF_A_KIND"; rank: Rank }
  | { type: "FULL_HOUSE"; tripsRank: Rank; pairRank: Rank }
  | { type: "FOUR_OF_A_KIND"; rank: Rank }
  | { type: "ROYAL_FLUSH" };

export const CATEGORY_LABELS: Record<BidCategory, { en: string; it: string }> = {
  HIGH_CARD: { en: "High Card", it: "Carta Alta" },
  PAIR: { en: "Pair", it: "Coppia" },
  STRAIGHT: { en: "Straight", it: "Scala" },
  TWO_PAIR: { en: "Two Pair", it: "Doppia Coppia" },
  THREE_OF_A_KIND: { en: "Three of a Kind", it: "Tris" },
  FULL_HOUSE: { en: "Full House", it: "Full" },
  FOUR_OF_A_KIND: { en: "Four of a Kind", it: "Poker" },
  ROYAL_FLUSH: { en: "Royal Flush", it: "Scala Reale" },
};

export const MINIMUM_CARDS: Record<BidCategory, number> = {
  HIGH_CARD: 1,
  PAIR: 2,
  STRAIGHT: 5,
  TWO_PAIR: 4,
  THREE_OF_A_KIND: 3,
  FULL_HOUSE: 5,
  FOUR_OF_A_KIND: 4,
  ROYAL_FLUSH: 5,
};

const STRAIGHT_HIGHS: StraightHighRank[] = ["5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const categoryValue = (type: BidCategory): number => BID_CATEGORIES.indexOf(type);

export function normalizeBid(bid: Bid): Bid {
  if (bid.type !== "TWO_PAIR") return bid;
  return rankValue(bid.highPair) >= rankValue(bid.lowPair)
    ? bid
    : { type: "TWO_PAIR", highPair: bid.lowPair, lowPair: bid.highPair };
}

function withinCategoryValue(bid: Bid): number[] {
  switch (bid.type) {
    case "HIGH_CARD":
    case "PAIR":
    case "THREE_OF_A_KIND":
    case "FOUR_OF_A_KIND":
      return [rankValue(bid.rank)];
    case "STRAIGHT":
      return [STRAIGHT_HIGHS.indexOf(bid.highRank)];
    case "TWO_PAIR": {
      const normalized = normalizeBid(bid) as Extract<Bid, { type: "TWO_PAIR" }>;
      return [rankValue(normalized.highPair), rankValue(normalized.lowPair)];
    }
    case "FULL_HOUSE":
      return [rankValue(bid.tripsRank), rankValue(bid.pairRank)];
    case "ROYAL_FLUSH":
      return [0];
  }
}

export function compareBids(a: Bid, b: Bid): number {
  const categoryDifference = categoryValue(a.type) - categoryValue(b.type);
  if (categoryDifference !== 0) return Math.sign(categoryDifference);
  const left = withinCategoryValue(a);
  const right = withinCategoryValue(b);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return Math.sign(left[index] - right[index]);
  }
  return 0;
}

export const isBidHigher = (previous: Bid | null, proposed: Bid): boolean =>
  previous === null || compareBids(proposed, previous) > 0;

export const isBidPhysicallyPossible = (bid: Bid, totalCardsInPlay: number): boolean =>
  totalCardsInPlay >= MINIMUM_CARDS[bid.type];

export function getAllPossibleBids(): Bid[] {
  const bids: Bid[] = [];
  RANKS.forEach((rank) => bids.push({ type: "HIGH_CARD", rank }));
  RANKS.forEach((rank) => bids.push({ type: "PAIR", rank }));
  STRAIGHT_HIGHS.forEach((highRank) => bids.push({ type: "STRAIGHT", highRank }));
  for (let high = 1; high < RANKS.length; high += 1) {
    for (let low = 0; low < high; low += 1) {
      bids.push({ type: "TWO_PAIR", highPair: RANKS[high], lowPair: RANKS[low] });
    }
  }
  RANKS.forEach((rank) => bids.push({ type: "THREE_OF_A_KIND", rank }));
  RANKS.forEach((tripsRank) => {
    RANKS.forEach((pairRank) => {
      if (pairRank !== tripsRank) bids.push({ type: "FULL_HOUSE", tripsRank, pairRank });
    });
  });
  RANKS.forEach((rank) => bids.push({ type: "FOUR_OF_A_KIND", rank }));
  bids.push({ type: "ROYAL_FLUSH" });
  return bids;
}

const ALL_BIDS = getAllPossibleBids();

export function getLegalNextBids(currentBid: Bid | null, totalCardsInPlay: number): Bid[] {
  return ALL_BIDS.filter(
    (bid) => isBidPhysicallyPossible(bid, totalCardsInPlay) && isBidHigher(currentBid, bid),
  );
}

function rankCounts(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  cards.forEach((card) => counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1));
  return counts;
}

function straightRanks(highRank: StraightHighRank): Rank[] {
  if (highRank === "5") return ["A", "2", "3", "4", "5"];
  const highIndex = rankValue(highRank);
  return RANKS.slice(highIndex - 4, highIndex + 1) as Rank[];
}

export function evaluateBid(bid: Bid, cards: Card[]): boolean {
  const counts = rankCounts(cards);
  switch (bid.type) {
    case "HIGH_CARD":
      return (counts.get(bid.rank) ?? 0) >= 1;
    case "PAIR":
      return (counts.get(bid.rank) ?? 0) >= 2;
    case "STRAIGHT":
      return straightRanks(bid.highRank).every((rank) => counts.has(rank));
    case "TWO_PAIR": {
      const normalized = normalizeBid(bid) as Extract<Bid, { type: "TWO_PAIR" }>;
      return normalized.highPair !== normalized.lowPair
        && (counts.get(normalized.highPair) ?? 0) >= 2
        && (counts.get(normalized.lowPair) ?? 0) >= 2;
    }
    case "THREE_OF_A_KIND":
      return (counts.get(bid.rank) ?? 0) >= 3;
    case "FULL_HOUSE":
      return bid.tripsRank !== bid.pairRank
        && (counts.get(bid.tripsRank) ?? 0) >= 3
        && (counts.get(bid.pairRank) ?? 0) >= 2;
    case "FOUR_OF_A_KIND":
      return (counts.get(bid.rank) ?? 0) >= 4;
    case "ROYAL_FLUSH":
      return SUITS.some((suit) =>
        (["10", "J", "Q", "K", "A"] as Rank[]).every((rank) =>
          cards.some((card) => card.rank === rank && card.suit === suit),
        ),
      );
  }
}

export function getMatchingCardIds(bid: Bid, cards: Card[]): string[] {
  if (!evaluateBid(bid, cards)) return [];
  let ranks: Rank[] = [];
  switch (bid.type) {
    case "HIGH_CARD":
    case "PAIR":
    case "THREE_OF_A_KIND":
    case "FOUR_OF_A_KIND":
      ranks = [bid.rank];
      break;
    case "STRAIGHT":
      ranks = straightRanks(bid.highRank);
      break;
    case "TWO_PAIR":
      ranks = [bid.highPair, bid.lowPair];
      break;
    case "FULL_HOUSE":
      ranks = [bid.tripsRank, bid.pairRank];
      break;
    case "ROYAL_FLUSH": {
      const suit = SUITS.find((candidate) =>
        (["10", "J", "Q", "K", "A"] as Rank[]).every((rank) =>
          cards.some((card) => card.rank === rank && card.suit === candidate),
        ),
      );
      return cards
        .filter((card) => suit === card.suit && ["10", "J", "Q", "K", "A"].includes(card.rank))
        .map((card) => card.id);
    }
  }
  return cards.filter((card) => ranks.includes(card.rank)).map((card) => card.id);
}

const rankName = (rank: Rank, locale: "en" | "it"): string => {
  const english: Partial<Record<Rank, string>> = { J: "Jack", Q: "Queen", K: "King", A: "Ace" };
  const italian: Partial<Record<Rank, string>> = { J: "Fante", Q: "Regina", K: "Re", A: "Asso" };
  return (locale === "it" ? italian[rank] : english[rank]) ?? rank;
};

export function formatBid(bid: Bid, locale: "en" | "it" = "en"): string {
  const label = CATEGORY_LABELS[bid.type][locale];
  switch (bid.type) {
    case "HIGH_CARD":
      return `${label}: ${rankName(bid.rank, locale)}`;
    case "PAIR":
    case "THREE_OF_A_KIND":
    case "FOUR_OF_A_KIND":
      return `${label}: ${rankName(bid.rank, locale)}`;
    case "STRAIGHT":
      return `${label} ${locale === "it" ? "al" : "to"} ${rankName(bid.highRank, locale)}`;
    case "TWO_PAIR":
      return `${label}: ${rankName(bid.highPair, locale)} + ${rankName(bid.lowPair, locale)}`;
    case "FULL_HOUSE":
      return `${label}: ${rankName(bid.tripsRank, locale)} ×3 + ${rankName(bid.pairRank, locale)} ×2`;
    case "ROYAL_FLUSH":
      return label;
  }
}
