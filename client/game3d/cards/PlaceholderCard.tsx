import { RoundedBox, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import type { CardArtwork } from "./cardPresentation";
import { CARD_HEIGHT, CARD_WIDTH } from "./cardLayout";

const SUIT_SYMBOL = { CLUBS: "♣", DIAMONDS: "♦", HEARTS: "♥", SPADES: "♠" } as const;

export function PlaceholderCard({ card, faceUp, highlighted, delay = 0 }: { card?: CardArtwork; faceUp: boolean; highlighted?: boolean; delay?: number }) {
  const group = useRef<Group>(null);
  const flipAt = useRef(performance.now() + delay);
  const initialRotation = useMemo<[number, number, number]>(() => [0, faceUp ? 0 : Math.PI, 0], []);
  useEffect(() => { flipAt.current = performance.now() + delay; }, [faceUp, delay]);
  useFrame((_state, delta) => {
    if (!group.current) return;
    if (performance.now() < flipAt.current) return;
    const targetRotation = faceUp ? 0 : Math.PI;
    group.current.rotation.y += (targetRotation - group.current.rotation.y) * (1 - Math.exp(-delta * 9));
  });
  const red = card?.suit === "HEARTS" || card?.suit === "DIAMONDS";
  return (
    <group ref={group} rotation={initialRotation}>
      {highlighted && <RoundedBox args={[CARD_WIDTH + 0.065, CARD_HEIGHT + 0.065, 0.029]} radius={0.012} smoothness={3}>
        <meshBasicMaterial color="#59f394" toneMapped={false} />
      </RoundedBox>}
      <RoundedBox args={[CARD_WIDTH, CARD_HEIGHT, 0.035]} radius={0.012} smoothness={3} castShadow>
        <meshStandardMaterial color="#f5f0e5" roughness={0.75} />
      </RoundedBox>
      <group position={[0, 0, 0.021]} visible={faceUp}>
        <Text position={[-0.18, 0.27, 0]} fontSize={0.15} color={red ? "#bc3040" : "#16191d"} fontWeight={700}>{card?.rank ?? "?"}</Text>
        {card?.suit ? <>
          <Text position={[-0.18, 0.12, 0]} fontSize={0.12} color={red ? "#bc3040" : "#16191d"}>{SUIT_SYMBOL[card.suit]}</Text>
          <Text position={[0, -0.04, 0]} fontSize={0.32} color={red ? "#bc3040" : "#16191d"}>{SUIT_SYMBOL[card.suit]}</Text>
          <group position={[0.18, -0.27, 0]} rotation={[0, 0, Math.PI]}><Text fontSize={0.15} color={red ? "#bc3040" : "#16191d"} fontWeight={700}>{card.rank}</Text></group>
        </> : <>
          <Text position={[0, 0, 0]} fontSize={0.32} color="#16191d" fontWeight={700}>{card?.rank ?? "?"}</Text>
          <Text position={[0, -0.27, 0]} fontSize={0.085} color="#73706b">♣ ♦ ♥ ♠</Text>
        </>}
      </group>
      <group position={[0, 0, -0.021]} rotation={[0, Math.PI, 0]} visible={!faceUp}>
        <mesh><planeGeometry args={[0.49, 0.73]} /><meshStandardMaterial color="#381f2a" /></mesh>
        <Text position={[0, 0, 0.004]} fontSize={0.22} color="#d1a65e">PP</Text>
      </group>
    </group>
  );
}
