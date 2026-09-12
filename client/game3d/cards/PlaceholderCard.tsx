import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group } from "three";
import type { Card } from "../../../shared/game/cards";

const SUIT_SYMBOL = { CLUBS: "♣", DIAMONDS: "♦", HEARTS: "♥", SPADES: "♠" } as const;

export function PlaceholderCard({ card, faceUp, highlighted, delay = 0 }: { card?: Card; faceUp: boolean; highlighted?: boolean; delay?: number }) {
  const group = useRef<Group>(null);
  const bornAt = useRef(performance.now() + delay);
  useEffect(() => { bornAt.current = performance.now() + delay; }, [card?.id, delay]);
  useFrame((_state, delta) => {
    if (!group.current) return;
    const ready = performance.now() >= bornAt.current;
    const targetY = ready ? 0 : 2.4;
    group.current.position.y += (targetY - group.current.position.y) * Math.min(1, delta * 7);
    const targetRotation = faceUp ? 0 : Math.PI;
    group.current.rotation.y += (targetRotation - group.current.rotation.y) * Math.min(1, delta * 9);
  });
  const red = card?.suit === "HEARTS" || card?.suit === "DIAMONDS";
  return (
    <group ref={group}>
      <mesh castShadow>
        <boxGeometry args={[0.57, 0.82, 0.035]} />
        <meshStandardMaterial color={highlighted ? "#ffd47e" : "#eee9dd"} emissive={highlighted ? "#e79b35" : "#000000"} emissiveIntensity={highlighted ? 0.55 : 0} roughness={0.58} />
      </mesh>
      <group position={[0, 0, 0.021]} visible={faceUp}>
        <Text position={[-0.18, 0.24, 0]} fontSize={0.18} color={red ? "#bc3040" : "#16191d"} anchorX="center" fontWeight={700}>{card?.rank ?? "?"}</Text>
        <Text position={[0, -0.04, 0]} fontSize={0.27} color={red ? "#bc3040" : "#16191d"}>{card ? SUIT_SYMBOL[card.suit] : "?"}</Text>
      </group>
      <group position={[0, 0, -0.021]} rotation={[0, Math.PI, 0]} visible={!faceUp}>
        <mesh><planeGeometry args={[0.49, 0.73]} /><meshStandardMaterial color="#381f2a" /></mesh>
        <Text position={[0, 0, 0.004]} fontSize={0.22} color="#d1a65e">PP</Text>
      </group>
    </group>
  );
}
