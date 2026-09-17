import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Euler, Quaternion, Vector3, type Group } from "three";
import { PlayingCard } from "./PlayingCard";
import type { CardPose } from "./cardLayout";
import type { CardArtwork } from "./cardPresentation";

export function TableCard({ pose, card, faceUp, highlighted, delay }: {
  pose: CardPose;
  card?: CardArtwork;
  faceUp: boolean;
  highlighted: boolean;
  delay: number;
}) {
  const group = useRef<Group>(null);
  const initialPose = useRef(pose);
  const position = useMemo(() => new Vector3(...pose.position), [pose.position[0], pose.position[1], pose.position[2]]);
  const rotation = useMemo(() => new Quaternion().setFromEuler(new Euler(...pose.rotation)), [pose.rotation[0], pose.rotation[1], pose.rotation[2]]);
  useLayoutEffect(() => {
    if (!group.current) return;
    group.current.position.set(...initialPose.current.position);
    group.current.quaternion.setFromEuler(new Euler(...initialPose.current.rotation));
    group.current.scale.setScalar(initialPose.current.scale);
  }, []);
  useFrame((_state, delta) => {
    if (!group.current) return;
    const blend = 1 - Math.exp(-delta * 7);
    group.current.position.lerp(position, blend);
    group.current.quaternion.slerp(rotation, blend);
    const scale = group.current.scale.x + (pose.scale - group.current.scale.x) * blend;
    group.current.scale.setScalar(scale);
  });
  return <group ref={group}><PlayingCard card={card} faceUp={faceUp} highlighted={highlighted} delay={delay} /></group>;
}
