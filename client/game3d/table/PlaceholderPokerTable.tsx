import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { MeshStandardMaterial } from "three";
import { REVEAL_RING_RADIUS } from "../cards/cardLayout";

export function PlaceholderPokerTable({ active }: { active: boolean }) {
  const ringMaterial = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!ringMaterial.current) return;
    ringMaterial.current.emissiveIntensity = active ? 0.35 + Math.sin(clock.elapsedTime * 3) * 0.15 : 0.08;
  });
  return (
    <group>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.55, 3.65, 0.42, 64]} />
        <meshStandardMaterial color="#241712" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.45, 0]} receiveShadow>
        <cylinderGeometry args={[3.28, 3.28, 0.08, 64]} />
        <meshStandardMaterial color="#133d32" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.505, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[REVEAL_RING_RADIUS - 0.025, REVEAL_RING_RADIUS + 0.025, 96]} />
        <meshStandardMaterial ref={ringMaterial} color="#c7974c" emissive="#d99639" emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, -0.12, 0]} castShadow><cylinderGeometry args={[1.1, 1.45, 0.8, 32]} /><meshStandardMaterial color="#19100d" /></mesh>
    </group>
  );
}
