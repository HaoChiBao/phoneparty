"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Player } from "@/lib/protocol";

const APPLE = "#c43b32";
const FALLING_POOL = 16;
const PILE_MAX = 26;
const GRAVITY = 16;

/** Stable scatter so a pile looks tossed but never reshuffles as it grows. */
function scatter(index: number) {
  const a = Math.sin(index * 12.9898) * 43758.5453;
  const b = Math.sin(index * 78.233) * 12345.6789;
  return { x: (a - Math.floor(a) - 0.5) * 1.5, z: (b - Math.floor(b) - 0.5) * 0.9 };
}

type Falling = { active: boolean; x: number; y: number; z: number; vy: number };

function Tree({
  player,
  apples,
  x,
  isLeader,
}: {
  player: Player;
  apples: number;
  x: number;
  isLeader: boolean;
}) {
  const canopy = useRef<THREE.Group>(null);
  const drops = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pool = useRef<Falling[]>(
    Array.from({ length: FALLING_POOL }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vy: 0,
    })),
  );
  const seen = useRef(0);
  const energy = useRef(0);
  const clock = useRef(0);

  const piled = Math.min(apples, PILE_MAX);
  const pile = useMemo(
    () => Array.from({ length: piled }, (_, index) => scatter(index)),
    [piled],
  );

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    clock.current += step;

    // Each new apple is a stroke that landed, so the count is also the shake.
    const gained = apples - seen.current;
    if (gained > 0) {
      energy.current = Math.min(1, energy.current + 0.3 * Math.min(gained, 3));
      // Cap the spawn burst: a phone that reconnects with a big jump in count
      // should not rain a hundred apples in one frame.
      for (let i = 0; i < Math.min(gained, 3); i += 1) {
        const slot = pool.current.find((drop) => !drop.active);
        if (!slot) break;
        const spot = scatter(seen.current + i);
        slot.active = true;
        slot.x = spot.x * 1.1;
        slot.y = 3.1 + Math.abs(spot.z);
        slot.z = spot.z;
        slot.vy = 0;
      }
      seen.current = apples;
    } else if (gained < 0) {
      seen.current = apples; // a new round reset the count
    }

    energy.current = Math.max(0, energy.current - step * 1.5);
    if (canopy.current) {
      const sway = Math.sin(clock.current * 15) * 0.13 * energy.current;
      canopy.current.rotation.z = sway;
      canopy.current.position.x = sway * 0.4;
    }

    const mesh = drops.current;
    if (!mesh) return;
    for (let i = 0; i < FALLING_POOL; i += 1) {
      const drop = pool.current[i];
      if (drop.active) {
        drop.vy -= GRAVITY * step;
        drop.y += drop.vy * step;
        if (drop.y <= 0.16) drop.active = false;
      }
      if (drop.active) {
        dummy.position.set(drop.x, drop.y, drop.z);
        dummy.scale.setScalar(1);
      } else {
        dummy.position.set(0, -50, 0); // parked out of frame
        dummy.scale.setScalar(0.001);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 1.4, 10]} />
        <meshStandardMaterial color="#6b4728" roughness={0.86} />
      </mesh>

      <group ref={canopy} position={[0, 1.4, 0]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <sphereGeometry args={[1.15, 20, 16]} />
          <meshStandardMaterial color="#2f7a38" roughness={0.72} />
        </mesh>
        <mesh position={[-0.72, 0.45, 0.28]} castShadow>
          <sphereGeometry args={[0.72, 18, 14]} />
          <meshStandardMaterial color="#34863c" roughness={0.7} />
        </mesh>
        <mesh position={[0.74, 0.5, -0.2]} castShadow>
          <sphereGeometry args={[0.68, 18, 14]} />
          <meshStandardMaterial color="#276b31" roughness={0.74} />
        </mesh>
        {[
          [-0.55, 0.35, 0.8],
          [0.5, 0.25, 0.75],
          [0.05, 1.4, 0.7],
          [-0.8, 1.05, 0.2],
          [0.85, 1.1, 0.15],
        ].map(([ax, ay, az]) => (
          <mesh key={`${ax}-${ay}`} position={[ax, ay, az]} castShadow>
            <sphereGeometry args={[0.15, 12, 10]} />
            <meshStandardMaterial color={APPLE} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* apples on the way down */}
      <instancedMesh ref={drops} args={[undefined, undefined, FALLING_POOL]} castShadow>
        <sphereGeometry args={[0.15, 12, 10]} />
        <meshStandardMaterial color={APPLE} roughness={0.4} />
      </instancedMesh>

      {/* what has already been shaken loose */}
      {pile.map((spot, index) => (
        <mesh
          key={index}
          position={[spot.x, 0.15 + Math.floor(index / 9) * 0.16, spot.z + 0.55]}
          castShadow
        >
          <sphereGeometry args={[0.15, 12, 10]} />
          <meshStandardMaterial color={APPLE} roughness={0.4} />
        </mesh>
      ))}

      {/* whose tree this is */}
      <mesh position={[0, 0.06, 1.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[isLeader ? 1.15 : 0.95, 28]} />
        <meshStandardMaterial
          color={player.color}
          transparent
          opacity={isLeader ? 0.55 : 0.3}
        />
      </mesh>
    </group>
  );
}

export function Grove({
  order,
  apples,
  leaders,
}: {
  order: Player[];
  apples: Record<string, number>;
  leaders: string[];
}) {
  const spacing = 3.4;
  return (
    <group>
      {order.map((player, index) => (
        <Tree
          key={player.id}
          player={player}
          apples={apples[player.id] ?? 0}
          x={(index - (order.length - 1) / 2) * spacing}
          isLeader={leaders.includes(player.id)}
        />
      ))}
    </group>
  );
}
