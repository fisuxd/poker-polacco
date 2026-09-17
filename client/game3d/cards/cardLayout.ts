import type { SeatAnchor } from "../seats/seatLayout";

export const CARD_WIDTH = 0.57;
export const CARD_HEIGHT = 0.82;
export const TABLE_CARD_Y = 0.56;
export const REVEAL_RING_RADIUS = 2.05;
export const BID_CARD_SPACING = 0.64;
export const BID_CARD_SCALE = 0.95;

export interface CardPose {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export function getSeatFacingAngle(anchor?: SeatAnchor): number {
  return anchor ? Math.atan2(anchor.position[0], anchor.position[2]) : 0;
}

export function getHandCardPose(anchor: SeatAnchor, index: number, cardCount: number): CardPose {
  const yaw = getSeatFacingAngle(anchor);
  const offset = (index - (cardCount - 1) / 2) * 0.47;
  return {
    position: [Math.sin(yaw) * 2.6 + Math.cos(yaw) * offset, TABLE_CARD_Y + index * 0.003, Math.cos(yaw) * 2.6 - Math.sin(yaw) * offset],
    // XYZ Euler: the card face points up and its portrait top edge points in.
    // Using yaw on Z after flattening is equivalent to Y-yaw then X-flatten.
    rotation: [-Math.PI / 2, 0, yaw],
    scale: 1,
  };
}

export function getRevealCardPose(
  anchor: SeatAnchor,
  index: number,
  cardCount: number,
  playerCount: number,
  largestHand: number,
): CardPose {
  const sector = Math.PI * 2 / Math.max(2, playerCount);
  const step = sector / (Math.max(1, largestHand) + 0.75);
  // Seat positions form an ellipse. Use their evenly spaced seat angle here,
  // not the ellipse's polar angle, so neighboring reveal sectors cannot overlap.
  const angle = Math.PI / 2 - anchor.rotationY + (index - (cardCount - 1) / 2) * step;
  const x = Math.cos(angle) * REVEAL_RING_RADIUS;
  const z = Math.sin(angle) * REVEAL_RING_RADIUS;
  // Size at the cards' inner edge, where a radial row is most crowded.
  // Include the green frame and a little breathing room in that calculation.
  const halfAngle = Math.tan(step / 2);
  const radialFit = 2 * REVEAL_RING_RADIUS * halfAngle / (CARD_WIDTH + 0.065 + (CARD_HEIGHT + 0.065) * halfAngle);
  return {
    position: [x, TABLE_CARD_Y, z],
    rotation: [-Math.PI / 2, 0, Math.atan2(x, z)],
    // Leave a gap even at a six-player, thirty-card reveal. Never stack cards.
    scale: Math.min(1, radialFit * 0.92),
  };
}
