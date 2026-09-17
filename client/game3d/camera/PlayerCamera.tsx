import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { SeatAnchor } from "../seats/seatLayout";

export function PlayerCamera({ anchor }: { anchor?: SeatAnchor }) {
  const camera = useThree((state) => state.camera);
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height));
  useEffect(() => {
    const [x, , z] = anchor?.position ?? [0, 0, 4.2];
    const portraitZoomOut = Math.max(1, 0.85 / aspect);
    camera.position.set(x * 1.48 * portraitZoomOut, 5.8 * portraitZoomOut, z * 1.48 * portraitZoomOut);
    camera.lookAt(0, 0.35, 0);
    camera.updateProjectionMatrix();
  }, [anchor?.position[0], anchor?.position[2], aspect, camera]);
  return null;
}
