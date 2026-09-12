import { Canvas } from "@react-three/fiber";
import { Environment } from "./environment/Environment";
import { PokerTable } from "./table/PokerTable";
import { Character } from "./characters/Character";
import { PlayingCard } from "./cards/PlayingCard";
import { PlayerCamera } from "./camera/PlayerCamera";
import { getSeatAnchors } from "./seats/seatLayout";
import type { PrivatePlayerState, PublicGameState } from "../../shared/game/types";

function TableContents({ state, privateState }: { state: PublicGameState; privateState: PrivatePlayerState | null }) {
  const anchors = getSeatAnchors(state.players.length);
  const localPlayer = state.players.find((player) => player.id === privateState?.playerId);
  const reveal = state.phase === "REVEAL" || state.phase === "ROUND_RESULT" || state.phase === "MATCH_OVER";
  const highlighted = new Set(state.result?.matchingCardIds ?? []);

  return (
    <>
      <Environment />
      <PokerTable active={state.phase === "BIDDING"} />
      <PlayerCamera anchor={localPlayer ? anchors[localPlayer.seat] : undefined} />
      {state.players.map((player) => {
        const anchor = anchors[player.seat];
        const isLocal = player.id === privateState?.playerId;
        const cards = reveal ? (player.revealedCards ?? []) : isLocal ? (privateState?.cards ?? []) : Array.from({ length: player.cardCount }, () => undefined);
        const directionLength = Math.hypot(anchor.position[0], anchor.position[2]);
        const towardCenter: [number, number, number] = [-anchor.position[0] / directionLength, 0, -anchor.position[2] / directionLength];
        const cardCenter: [number, number, number] = [anchor.position[0] + towardCenter[0] * 1.25, 0.62, anchor.position[2] + towardCenter[2] * 1.25];
        return (
          <group key={player.id}>
            <group position={anchor.position} rotation={[0, anchor.rotationY, 0]}>
              <Character nickname={player.nickname} isCurrent={player.id === state.currentTurnId} isLocal={isLocal} eliminated={player.eliminated} connected={player.connected} />
            </group>
            <group position={cardCenter} rotation={[0, -anchor.rotationY, 0]}>
              {cards.map((card, index) => (
                <group key={card?.id ?? `${player.id}-${index}`} position={[(index - (cards.length - 1) / 2) * 0.34, index * 0.008, 0]} rotation={[-Math.PI / 2, 0, (index - (cards.length - 1) / 2) * 0.07]}>
                  <PlayingCard card={card} faceUp={Boolean(isLocal || reveal)} highlighted={Boolean(card && highlighted.has(card.id))} delay={index * 75} />
                </group>
              ))}
            </group>
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
