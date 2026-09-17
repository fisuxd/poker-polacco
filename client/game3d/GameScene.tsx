import { Canvas } from "@react-three/fiber";
import { Environment } from "./environment/Environment";
import { PokerTable } from "./table/PokerTable";
import { Character } from "./characters/Character";
import { TableCard } from "./cards/TableCard";
import { TableBid } from "./cards/TableBid";
import { getHandCardPose, getRevealCardPose, getSeatFacingAngle } from "./cards/cardLayout";
import { getVisiblePlayerCards, isRevealPhase } from "./cards/cardPresentation";
import { PlayerCamera } from "./camera/PlayerCamera";
import { getSeatAnchors } from "./seats/seatLayout";
import type { PrivatePlayerState, PublicGameState } from "../../shared/game/types";

function TableContents({ state, privateState }: { state: PublicGameState; privateState: PrivatePlayerState | null }) {
  const anchors = getSeatAnchors(state.players.length);
  const localPlayer = state.players.find((player) => player.id === privateState?.playerId);
  const reveal = isRevealPhase(state.phase);
  const highlighted = new Set(state.result?.matchingCardIds ?? []);
  const largestHand = Math.max(1, ...state.players.map((player) => getVisiblePlayerCards(player, state.phase, privateState).length));

  return (
    <>
      <Environment />
      <PokerTable active={state.phase === "BIDDING"} />
      <PlayerCamera anchor={localPlayer ? anchors[localPlayer.seat] : undefined} />
      <TableBid state={state} facingAngle={getSeatFacingAngle(localPlayer ? anchors[localPlayer.seat] : undefined)} />
      {state.players.map((player) => {
        const anchor = anchors[player.seat];
        const isLocal = player.id === privateState?.playerId;
        const cards = getVisiblePlayerCards(player, state.phase, privateState);
        return (
          <group key={player.id}>
            <group position={anchor.position} rotation={[0, anchor.rotationY, 0]}>
              <Character nickname={player.nickname} isCurrent={player.id === state.currentTurnId} isLocal={isLocal} eliminated={player.eliminated} connected={player.connected} />
            </group>
            {cards.map((card, index) => (
              <TableCard
                key={`${player.id}-${index}`}
                pose={reveal ? getRevealCardPose(anchor, index, cards.length, state.players.length, largestHand) : getHandCardPose(anchor, index, cards.length)}
                card={card}
                faceUp={Boolean(isLocal || reveal)}
                highlighted={Boolean(reveal && card && highlighted.has(card.id))}
                delay={reveal ? index * 40 : 0}
              />
            ))}
          </group>
        );
      })}
    </>
  );
}

export function GameScene({ state, privateState }: { state: PublicGameState; privateState: PrivatePlayerState | null }) {
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 48, near: 0.1, far: 60 }} gl={{ antialias: true }}>
      <TableContents state={state} privateState={privateState} />
    </Canvas>
  );
}
