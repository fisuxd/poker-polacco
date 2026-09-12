export function PlaceholderEnvironment() {
  return (
    <group>
      <color attach="background" args={["#080a0b"]} />
      <fog attach="fog" args={["#080a0b", 8, 22]} />
      <ambientLight intensity={0.35} color="#9aa7bc" />
      <pointLight position={[0, 6, 0]} intensity={55} distance={16} color="#ffbd70" castShadow />
      <pointLight position={[-6, 2, -5]} intensity={15} distance={12} color="#6a2e20" />
      <mesh position={[0, -0.62, 0]} receiveShadow>
        <cylinderGeometry args={[11, 11, 0.2, 48]} />
        <meshStandardMaterial color="#111315" roughness={0.95} />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index / 12 * Math.PI * 2;
        return <mesh key={index} position={[Math.cos(angle) * 9, 2.2, Math.sin(angle) * 9]}><boxGeometry args={[0.18, 5.5, 0.18]} /><meshStandardMaterial color="#211a16" /></mesh>;
      })}
    </group>
  );
}
