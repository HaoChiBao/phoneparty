"use client";

import { Grid, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { setRelativeQuaternion } from "@/lib/orientation";
import type { CalibratedPose, GyroSample, Player } from "@/lib/protocol";

type WandState = {
  player: Player;
  sample?: GyroSample;
  calib?: CalibratedPose;
};

function Wand({ player, sample, calib }: WandState) {
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
      };
    }
    setRelativeQuaternion(
      quaternion,
      sample,
      calib ?? firstPose.current,
      scratch,
    );
    group.current.quaternion.copy(quaternion);

    origin.set(0, 0, 0).applyMatrix4(group.current.matrixWorld);
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
          <meshStandardMaterial
            color="#1a1a1a"
            metalness={0.4}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0, -0.22]}>
          <sphereGeometry args={[0.07, 20, 20]} />
          <meshStandardMaterial
            color={player.color}
            emissive={player.color}
            emissiveIntensity={1.4}
          />
        </mesh>
        <mesh ref={beam} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 1, 8]} />
          <meshBasicMaterial color={player.color} transparent opacity={0.55} />
        </mesh>
      </group>
      <mesh ref={hit} visible={false}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={player.color} />
      </mesh>
    </>
  );
}

function Targets() {
  const spots = [
    [-2.2, 2.4, -5.96],
    [0, 3.1, -5.96],
    [2.2, 2.4, -5.96],
  ] as const;
  return (
    <group>
      {spots.map(([x, y, z]) => (
        <mesh key={`${x}-${y}`} position={[x, y, z]}>
          <ringGeometry args={[0.28, 0.38, 32]} />
          <meshBasicMaterial color="#f2f2ea" />
        </mesh>
      ))}
    </group>
  );
}

function Stage({ wands }: { wands: WandState[] }) {
  return (
    <>
      <color attach="background" args={["#10110f"]} />
      <fog attach="fog" args={["#10110f", 8, 22]} />
      <PerspectiveCamera makeDefault position={[0, 1.6, 6.4]} fov={55} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} />
      <pointLight position={[0, 3, -4]} intensity={8} color="#c4f542" distance={12} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 16]} />
        <meshStandardMaterial color="#171814" />
      </mesh>
      <Grid
        args={[18, 16]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#2a2d24"
        sectionSize={2}
        sectionThickness={1.1}
        sectionColor="#3d422f"
        fadeDistance={16}
        position={[0, 0.01, 0]}
      />
      <mesh position={[0, 2.4, -6]}>
        <planeGeometry args={[12, 5.2]} />
        <meshStandardMaterial color="#22241c" />
      </mesh>
      <Targets />
      {wands.map((wand) => (
        <Wand key={wand.player.id} {...wand} />
      ))}
    </>
  );
}

export function PartyScene({
  controllers,
  gyroByPlayer,
  calibByPlayer,
}: {
  controllers: Player[];
  gyroByPlayer: Record<string, GyroSample>;
  calibByPlayer: Record<string, CalibratedPose>;
}) {
  const wands = controllers.map((player) => ({
    player,
    sample: gyroByPlayer[player.id],
    calib: calibByPlayer[player.id],
  }));

  return (
    <div className="absolute inset-0">
      <Canvas
        className="h-full w-full"
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
      >
        <Stage wands={wands} />
      </Canvas>
    </div>
  );
}
