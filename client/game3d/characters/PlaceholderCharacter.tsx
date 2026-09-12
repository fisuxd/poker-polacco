import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, MeshStandardMaterial } from "three";

interface Props {
  nickname: string;
  isCurrent: boolean;
  isLocal: boolean;
  eliminated: boolean;
  connected: boolean;
}

export function PlaceholderCharacter({ nickname, isCurrent, isLocal, eliminated, connected }: Props) {
  const group = useRef<Group>(null);
  const bodyMaterial = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const desiredY = eliminated ? -1.25 : (isCurrent ? Math.sin(clock.elapsedTime * 4) * 0.06 : 0);
    group.current.position.y += (desiredY - group.current.position.y) * Math.min(1, delta * 4);
    if (bodyMaterial.current) bodyMaterial.current.emissiveIntensity = isCurrent ? 0.55 : 0.05;
  });
  return (
    <group ref={group}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.35, 0.76, 8, 16]} />
        <meshStandardMaterial ref={bodyMaterial} color={isLocal ? "#c9944e" : "#454d59"} emissive={isCurrent ? "#f2a94c" : "#111111"} transparent opacity={connected ? 1 : 0.42} />
      </mesh>
      <mesh position={[0, 1.32, 0]} castShadow><sphereGeometry args={[0.3, 20, 16]} /><meshStandardMaterial color={connected ? "#aa8065" : "#4a4a4a"} roughness={0.8} /></mesh>
      <mesh position={[0, -0.35, 0.15]}><boxGeometry args={[1.15, 0.12, 0.62]} /><meshStandardMaterial color="#18120f" /></mesh>
      {!isLocal && (
        <Billboard position={[0, 1.88, 0]}>
          <Text fontSize={0.2} color={eliminated ? "#7b8189" : isCurrent ? "#ffd28b" : "#eef0ed"} anchorX="center" outlineWidth={0.012} outlineColor="#08090a">
            {nickname}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
