export interface SeatAnchor {
  position: [number, number, number];
  rotationY: number;
}

export function getSeatAnchors(playerCount: number): SeatAnchor[] {
  const count = Math.max(2, Math.min(6, playerCount));
  return Array.from({ length: count }, (_, index) => {
    const angle = Math.PI / 2 + (index / count) * Math.PI * 2;
    return {
      position: [Math.cos(angle) * 4.25, 0, Math.sin(angle) * 3.35],
      rotationY: -angle + Math.PI / 2,
    };
  });
}
