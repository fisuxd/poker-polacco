import { PlaceholderEnvironment } from "./PlaceholderEnvironment";

// Swap this boundary for a GLTF environment later; the game never depends on its meshes.
export function Environment() {
  return <PlaceholderEnvironment />;
}
