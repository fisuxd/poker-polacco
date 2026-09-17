import { Text } from "@react-three/drei";
import { CATEGORY_LABELS } from "../../../shared/game/bids";
import type { PublicGameState } from "../../../shared/game/types";
import { PlayingCard } from "./PlayingCard";
import { BID_CARD_SCALE, BID_CARD_SPACING, TABLE_CARD_Y } from "./cardLayout";
import { getBidCards, isRevealPhase } from "./cardPresentation";

export function TableBid({ state, facingAngle }: { state: PublicGameState; facingAngle: number }) {
  const result = isRevealPhase(state.phase) ? state.result : null;
  const bid = result?.bid ?? state.currentBid;
  const cards = bid ? getBidCards(bid) : [];
  const declarer = state.players.find((player) => player.id === state.lastBidderId);
  const loser = state.players.find((player) => player.id === result?.loserId);
  const caption = result
    ? `${loser?.nickname ?? "Player"} ${result.eliminated ? "is eliminated" : `will hold ${result.newCardCount} cards`}`
    : declarer ? `Declared by ${declarer.nickname}` : "First player must declare";
  return (
    <group position={[0, TABLE_CARD_Y + 0.04, 0]} rotation={[0, facingAngle, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Text position={[0, 0.7, 0.03]} fontSize={0.13} letterSpacing={0.12} color={result ? result.bidWasTrue ? "#86e6ac" : "#ff7a83" : "#e4b267"}>
          {result ? result.bidWasTrue ? "THE BID WAS TRUE" : "THE BID WAS FALSE" : "CURRENT BID"}
        </Text>
        {cards.map((card, index) => (
          <group key={`${bid?.type}-${index}`} position={[(index - (cards.length - 1) / 2) * BID_CARD_SPACING, 0, 0]} scale={BID_CARD_SCALE}>
            <PlayingCard card={card} faceUp />
          </group>
        ))}
        {!bid && <Text fontSize={0.2} color="#fff1d8">The table is open</Text>}
        {bid && <Text position={[0, -0.62, 0.03]} fontSize={0.15} color="#fff1d8">{CATEGORY_LABELS[bid.type].en}{bid.type === "ROYAL_FLUSH" ? " · any single suit" : ""}</Text>}
        <Text position={[0, -0.84, 0.03]} fontSize={0.105} maxWidth={2.65} textAlign="center" color="#c1cbbf">{caption}</Text>
      </group>
    </group>
  );
}
