"use client";

import { Grid, PerspectiveCamera } from "@react-three/drei";
import { HostCanvas } from "@/games/shared/HostCanvas";
import { MatteMaterial } from "@/games/shared/MatteMaterial";
import { Wand, wandsFromControllers } from "@/games/shared/Wand";
import type { GameSceneProps } from "@/games/types";

export function SandboxScene({
  controllers,
  gyroByPlayer,
  calibByPlayer,
}: GameSceneProps) {
  const wands = wandsFromControllers(controllers, gyroByPlayer, calibByPlayer);

  return (
    <HostCanvas>
      <color attach="background" args={["#ffffff"]} />
      <PerspectiveCamera makeDefault position={[0, 2.2, 7.2]} fov={55} />
      <ambientLight intensity={1.25} />
      <directionalLight position={[2, 5, 3]} intensity={1.3} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <MatteMaterial color="#ffffff" />
      </mesh>
      <Grid
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor="#e8ebf0"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#3a3a3a"
        fadeDistance={20}
        position={[0, 0.01, 0]}
      />
      {wands.map((wand) => (
        <Wand key={wand.player.id} {...wand} />
      ))}
    </HostCanvas>
  );
}
