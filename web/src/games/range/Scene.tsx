"use client";

import { Grid, PerspectiveCamera } from "@react-three/drei";
import { HostCanvas } from "@/games/shared/HostCanvas";
import { MatteMaterial } from "@/games/shared/MatteMaterial";
import { Wand, wandsFromControllers } from "@/games/shared/Wand";
import type { GameSceneProps } from "@/games/types";

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
          <MatteMaterial color="#4c8dff" />
        </mesh>
      ))}
    </group>
  );
}

function Stage({ wands }: { wands: ReturnType<typeof wandsFromControllers> }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.6, 6.4]} fov={55} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 16]} />
        <MatteMaterial color="#ffffff" />
      </mesh>
      <Grid
        args={[18, 16]}
        cellSize={0.5}
        cellThickness={0.45}
        cellColor="#d7dce6"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#111111"
        fadeDistance={18}
        position={[0, 0.01, 0]}
      />
      <mesh position={[0, 2.4, -6]}>
        <planeGeometry args={[12, 5.2]} />
        <MatteMaterial color="#ffffff" />
      </mesh>
      <Targets />
      {wands.map((wand) => (
        <Wand key={wand.player.id} {...wand} />
      ))}
    </>
  );
}

export function RangeScene({
  controllers,
  gyroByPlayer,
  calibByPlayer,
}: GameSceneProps) {
  const wands = wandsFromControllers(controllers, gyroByPlayer, calibByPlayer);
  return (
    <HostCanvas>
      <Stage wands={wands} />
    </HostCanvas>
  );
}
