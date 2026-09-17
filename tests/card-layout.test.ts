import { describe, expect, it } from "vitest";
import { Euler, Vector3 } from "three";
import { BID_CARD_SCALE, BID_CARD_SPACING, CARD_HEIGHT, CARD_WIDTH, REVEAL_RING_RADIUS, getHandCardPose, getRevealCardPose, type CardPose } from "../client/game3d/cards/cardLayout";
import { getSeatAnchors } from "../client/game3d/seats/seatLayout";

function corners(pose: CardPose): Vector3[] {
  // Include the green outline, not just the paper face.
  const halfWidth = (CARD_WIDTH + 0.065) * pose.scale / 2;
  const halfHeight = (CARD_HEIGHT + 0.065) * pose.scale / 2;
  return [[-halfWidth, -halfHeight], [halfWidth, -halfHeight], [halfWidth, halfHeight], [-halfWidth, halfHeight]]
    .map(([x, y]) => new Vector3(x, y, 0).applyEuler(new Euler(...pose.rotation)).add(new Vector3(...pose.position)));
}

function overlap(a: Vector3[], b: Vector3[]): boolean {
  return [a, b].every((polygon) => polygon.every((point, index) => {
    const edge = polygon[(index + 1) % polygon.length].clone().sub(point);
    const axis = new Vector3(-edge.z, 0, edge.x).normalize();
    const left = a.map((corner) => corner.dot(axis));
    const right = b.map((corner) => corner.dot(axis));
    return Math.max(...left) > Math.min(...right) + 0.00001 && Math.max(...right) > Math.min(...left) + 0.00001;
  }));
}

describe("table card layout", () => {
  it("keeps every seat's hand in portrait orientation with the top edge pointing inward", () => {
    for (let playerCount = 2; playerCount <= 6; playerCount++) {
      for (const anchor of getSeatAnchors(playerCount)) {
        const poses = Array.from({ length: 5 }, (_, index) => getHandCardPose(anchor, index, 5));
        for (const pose of poses) {
          const rotation = new Euler(...pose.rotation);
          const faceNormal = new Vector3(0, 0, 1).applyEuler(rotation);
          const topEdge = new Vector3(0, 1, 0).applyEuler(rotation);
          const inward = new Vector3(-anchor.position[0], 0, -anchor.position[2]).normalize();
          expect(faceNormal.y).toBeCloseTo(1);
          expect(topEdge.dot(inward)).toBeCloseTo(1);
          expect(pose.rotation).toEqual(poses[0].rotation);
        }
      }
    }
  });

  it("places all revealed cards exactly on the yellow circle, face-up and pointing inward", () => {
    for (let playerCount = 2; playerCount <= 6; playerCount++) {
      for (const anchor of getSeatAnchors(playerCount)) {
        for (let index = 0; index < 5; index++) {
          const pose = getRevealCardPose(anchor, index, 5, playerCount, 5);
          expect(Math.hypot(pose.position[0], pose.position[2])).toBeCloseTo(REVEAL_RING_RADIUS);
          const topEdge = new Vector3(0, 1, 0).applyEuler(new Euler(...pose.rotation));
          expect(topEdge.dot(new Vector3(-pose.position[0], 0, -pose.position[2]).normalize())).toBeCloseTo(1);
        }
      }
    }
  });

  it("does not overlap cards or their green outlines in any two-to-six-player full reveal", () => {
    for (let playerCount = 2; playerCount <= 6; playerCount++) {
      for (let handSize = 1; handSize <= 5; handSize++) {
        const rectangles = getSeatAnchors(playerCount).flatMap((anchor) => Array.from({ length: handSize }, (_, index) => corners(getRevealCardPose(anchor, index, handSize, playerCount, handSize))));
        for (let a = 0; a < rectangles.length; a++) {
          for (let b = a + 1; b < rectangles.length; b++) expect(overlap(rectangles[a], rectangles[b]), `${playerCount} players, ${handSize} cards, pair ${a}/${b}`).toBe(false);
        }
      }
    }
  });

  it("keeps an uneven distribution of hands separated by player sector", () => {
    const sizes = [5, 1, 3, 4, 2, 5];
    const rectangles = getSeatAnchors(6).flatMap((anchor, seat) => Array.from({ length: sizes[seat] }, (_, index) => corners(getRevealCardPose(anchor, index, sizes[seat], 6, 5))));
    for (let a = 0; a < rectangles.length; a++) {
      for (let b = a + 1; b < rectangles.length; b++) expect(overlap(rectangles[a], rectangles[b])).toBe(false);
    }
  });

  it("fits the largest five-card declaration inside the yellow circle", () => {
    const halfWidth = 2 * BID_CARD_SPACING + CARD_WIDTH * BID_CARD_SCALE / 2;
    const halfHeight = CARD_HEIGHT * BID_CARD_SCALE / 2;
    expect(Math.hypot(halfWidth, halfHeight)).toBeLessThan(REVEAL_RING_RADIUS - (CARD_HEIGHT + 0.065) / 2);
  });
});
