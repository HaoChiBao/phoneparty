"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { setRelativeQuaternion } from "@/lib/orientation";
import type { CalibratedPose, GyroSample, Player } from "@/lib/protocol";

export type WandState = {
  player: Player;
  sample?: GyroSample;
  calib?: CalibratedPose;
};

export function Wand({ player, sample, calib }: WandState) {
  const group = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const hit = useRef<THREE.Mesh>(null);
  const firstPose = useRef<CalibratedPose | null>(null);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const scratch = useMemo(() => new THREE.Quaternion(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const wallPoint = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!group.current || !sample) return;
    if (!firstPose.current) {
      firstPose.current = {
        alpha: sample.alpha,
        beta: sample.beta,
        gamma: sample.gamma,
        x: sample.x,
        y: sample.y,
        z: sample.z,
      };
    }
    setRelativeQuaternion(
      quaternion,
      sample,
      calib ?? firstPose.current,
      scratch,
    );
    group.current.quaternion.copy(quaternion);
    group.current.position.set(sample.x, 1.15 + sample.y, 3.4 + sample.z);

    origin.set(0, 0, 0).applyMatrix4(group.current.matrixWorld);
    // Local -Z is wand forward. After calibrate-at-the-TV that is the phone front.
    direction.set(0, 0, -1).applyQuaternion(group.current.quaternion);
    const wallZ = -6;
    const t = direction.z !== 0 ? (wallZ - origin.z) / direction.z : -1;
    if (t > 0 && hit.current && beam.current) {
      wallPoint.copy(origin).addScaledVector(direction, t);
      wallPoint.x = THREE.MathUtils.clamp(wallPoint.x, -5.4, 5.4);
      wallPoint.y = THREE.MathUtils.clamp(wallPoint.y, 0.2, 4.6);
      wallPoint.z = wallZ + 0.04;
      hit.current.position.copy(wallPoint);
      hit.current.visible = true;
      const length = origin.distanceTo(wallPoint);
      beam.current.scale.set(1, length, 1);
      beam.current.position.set(0, 0, -length / 2);
    } else if (hit.current) {
      hit.current.visible = false;
    }
  });

  return (
    <>
      <group ref={group} position={[0, 1.15, 3.4]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.18]}>
          <cylinderGeometry args={[0.045, 0.055, 0.72, 16]} />
          <meshStandardMaterial color="#111111" metalness={0.2} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, -0.22]}>
          <sphereGeometry args={[0.07, 20, 20]} />
          <meshStandardMaterial
            color={player.color}
            emissive={player.color}
            emissiveIntensity={0.8}
          />
        </mesh>
        <mesh ref={beam} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 1, 8]} />
          <meshBasicMaterial color={player.color} transparent opacity={0.7} />
        </mesh>
      </group>
      <mesh ref={hit} visible={false}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={player.color} />
      </mesh>
    </>
  );
}

export function wandsFromControllers(
  controllers: Player[],
  gyroByPlayer: Record<string, GyroSample>,
  calibByPlayer: Record<string, CalibratedPose>,
): WandState[] {
  return controllers.map((player) => ({
    player,
    sample: gyroByPlayer[player.id],
    calib: calibByPlayer[player.id],
  }));
}
