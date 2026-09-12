import { z } from "zod";
import { RANKS } from "../game/cards";

export const nicknameSchema = z.string().trim().min(1).max(20).regex(/^[\p{L}\p{N} _.-]+$/u);
export const roomCodeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/);
export const tokenSchema = z.string().min(32).max(128);
const rankSchema = z.enum(RANKS);

export const bidSchema = z.union([
  z.object({ type: z.literal("HIGH_CARD"), rank: rankSchema }).strict(),
  z.object({ type: z.literal("PAIR"), rank: rankSchema }).strict(),
  z.object({ type: z.literal("STRAIGHT"), highRank: z.enum(["5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]) }).strict(),
  z.object({ type: z.literal("TWO_PAIR"), highPair: rankSchema, lowPair: rankSchema }).strict().refine((bid) => bid.highPair !== bid.lowPair),
  z.object({ type: z.literal("THREE_OF_A_KIND"), rank: rankSchema }).strict(),
  z.object({ type: z.literal("FULL_HOUSE"), tripsRank: rankSchema, pairRank: rankSchema }).strict().refine((bid) => bid.tripsRank !== bid.pairRank),
  z.object({ type: z.literal("FOUR_OF_A_KIND"), rank: rankSchema }).strict(),
  z.object({ type: z.literal("ROYAL_FLUSH") }).strict(),
]);

export const createRoomSchema = z.object({ nickname: nicknameSchema }).strict();
export const joinRoomSchema = z.object({ nickname: nicknameSchema, roomCode: roomCodeSchema }).strict();
export const reconnectSchema = z.object({ roomCode: roomCodeSchema, token: tokenSchema }).strict();
export const roomActionSchema = z.object({ roomCode: roomCodeSchema }).strict();
export const submitBidSchema = z.object({ roomCode: roomCodeSchema, bid: bidSchema }).strict();
