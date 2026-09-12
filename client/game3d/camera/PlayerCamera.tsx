import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { SeatAnchor } from "../seats/seatLayout";

export function PlayerCamera({ anchor }: { anchor?: SeatAnchor }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    const [x, , z] = anchor?.position ?? [0, 0, 4.2];
    camera.position.set(x * 1.48, 4.15, z * 1.48);
    camera.lookAt(0, 0.35, 0);
    camera.updateProjectionMatrix();
  }, [anchor, camera]);
  return null;
}
