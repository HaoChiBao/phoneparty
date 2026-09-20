"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { Player } from "@/lib/protocol";
import { BELL_SCORE, scoreHeight, type SwingRecord } from "./logic";

const PAW_REST = 1.12;
const SLAM_MS = 170;
const MAX_APPLES = 100;
const GROUND_Y = 0.12;
const GRAVITY = -22;
const CANOPY_Y = 5.4;
const TREE_X = 0.45;

const dummy = new THREE.Object3D();
const appleTint = new THREE.Color();

type FallingApple = {
  delay: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  settled: boolean;
};

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInQuad(t: number) {
  return t * t;
}

function spawnApples(score: number, seed: number): FallingApple[] {
  const count = Math.min(MAX_APPLES, Math.max(0, Math.round(score)));
  const power = scoreHeight(score);
  const apples: FallingApple[] = [];
  for (let i = 0; i < count; i += 1) {
    const a = hash(seed + i * 17.2);
    const b = hash(seed + i * 31.7 + 4);
    const c = hash(seed + i * 53.1 + 9);
    apples.push({
      delay: 30 + a * 420,
      x: TREE_X + (a - 0.5) * 2.6,
      y: CANOPY_Y + b * 1.7,
      z: (c - 0.5) * 1.7,
      vx: (a - 0.5) * (1.4 + 3.2 * power),
      vy: 0.4 + b * (1.2 + 2.4 * power),
      vz: (c - 0.5) * (1.1 + 2.2 * power),
      spin: (a - 0.5) * 10,
      settled: false,
    });
  }
  return apples;
}

function Tree({
  shake,
}: {
  shake: RefObject<{ amount: number }>;
}) {
  const trunk = useRef<THREE.Group>(null);
  const canopy = useRef<THREE.Group>(null);

  useFrame(() => {
    const amount = shake.current?.amount ?? 0;
    if (trunk.current) trunk.current.rotation.z = amount * 0.45;
    if (canopy.current) {
      canopy.current.rotation.z = amount;
      canopy.current.position.x = TREE_X + amount * 0.55;
    }
  });

  return (
    <group>
      <group ref={trunk} position={[TREE_X, 0, 0]}>
        <mesh position={[0, 1.7, 0]}>
          <cylinderGeometry args={[0.28, 0.46, 3.5, 10]} />
          <meshStandardMaterial color="#6b4728" roughness={0.86} />
        </mesh>
        <mesh position={[0.38, 3.15, 0.1]} rotation={[0, 0, -0.55]}>
          <cylinderGeometry args={[0.08, 0.12, 1.1, 8]} />
          <meshStandardMaterial color="#5c3d22" roughness={0.86} />
        </mesh>
        <mesh position={[-0.32, 3.35, -0.12]} rotation={[0, 0, 0.62]}>
          <cylinderGeometry args={[0.07, 0.11, 0.95, 8]} />
          <meshStandardMaterial color="#5c3d22" roughness={0.86} />
        </mesh>
      </group>
      <group ref={canopy} position={[TREE_X, 5.15, 0]}>
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[1.55, 18, 14]} />
          <meshStandardMaterial color="#2f7a38" roughness={0.72} />
        </mesh>
        <mesh position={[1.05, -0.15, 0.35]}>
          <sphereGeometry args={[1.05, 16, 12]} />
          <meshStandardMaterial color="#3c8f44" roughness={0.72} />
        </mesh>
        <mesh position={[-1.0, 0.05, 0.2]}>
          <sphereGeometry args={[1.12, 16, 12]} />
          <meshStandardMaterial color="#276b31" roughness={0.74} />
        </mesh>
        <mesh position={[0.15, 0.85, -0.45]}>
          <sphereGeometry args={[1.02, 16, 12]} />
          <meshStandardMaterial color="#34863c" roughness={0.7} />
        </mesh>
        <mesh position={[0.2, -0.55, -0.7]}>
          <sphereGeometry args={[0.85, 14, 12]} />
          <meshStandardMaterial color="#2a7332" roughness={0.74} />
        </mesh>
        {[
          [0.55, 0.2, 1.15],
          [-0.7, 0.45, 0.9],
          [1.15, -0.35, 0.55],
          [-0.15, 0.95, 0.35],
          [0.85, 0.55, -0.7],
          [-0.95, -0.15, 0.15],
        ].map((pos) => (
          <mesh key={pos.join(",")} position={pos as [number, number, number]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshStandardMaterial color="#c43b32" roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function DistantTree({
  position,
  scale,
}: {
  position: [number, number, number];
  scale: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.18, 0.28, 2.5, 8]} />
        <meshStandardMaterial color="#5a3c22" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.8, 0]}>
        <sphereGeometry args={[1.15, 12, 10]} />
        <meshStandardMaterial color="#2d6a34" roughness={0.8} />
      </mesh>
      <mesh position={[0.55, 2.5, 0.2]}>
        <sphereGeometry args={[0.75, 10, 8]} />
        <meshStandardMaterial color="#3a7d40" roughness={0.8} />
      </mesh>
    </group>
  );
}

function BearBody() {
  return (
    <group position={[-2.55, 0, 0.55]} rotation={[0, 0.55, 0]}>
      <mesh position={[0, 1.15, 0]} scale={[1, 0.95, 0.85]}>
        <sphereGeometry args={[0.95, 18, 14]} />
        <meshStandardMaterial color="#7a4a28" roughness={0.78} />
      </mesh>
      <mesh position={[0.15, 2.15, 0.35]}>
        <sphereGeometry args={[0.52, 16, 12]} />
        <meshStandardMaterial color="#7a4a28" roughness={0.76} />
      </mesh>
      <mesh position={[-0.22, 2.52, 0.28]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color="#6a3f22" roughness={0.76} />
      </mesh>
      <mesh position={[0.38, 2.55, 0.22]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color="#6a3f22" roughness={0.76} />
      </mesh>
      <mesh position={[0.28, 2.02, 0.72]} scale={[0.85, 0.7, 0.9]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color="#c4a07a" roughness={0.7} />
      </mesh>
      <mesh position={[0.08, 2.22, 0.78]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[0.38, 2.22, 0.72]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[-0.55, 0.42, 0.35]} rotation={[0.4, 0, 0.35]}>
        <sphereGeometry args={[0.28, 12, 10]} />
        <meshStandardMaterial color="#6a3f22" roughness={0.8} />
      </mesh>
      <mesh position={[0.45, 0.38, 0.2]} rotation={[0.35, 0, -0.2]}>
        <sphereGeometry args={[0.28, 12, 10]} />
        <meshStandardMaterial color="#6a3f22" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Paw({ color }: { color: string }) {
  return (
    <group position={[1.38, -0.08, 0]} rotation={[0.15, 0.2, -0.35]}>
      <mesh scale={[1.15, 0.55, 0.95]}>
        <sphereGeometry args={[0.34, 14, 12]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0.02, -0.16, 0.02]} scale={[0.7, 0.28, 0.55]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial color="#5a3318" roughness={0.65} />
      </mesh>
      {[
        [0.28, -0.02, 0.22],
        [0.34, -0.02, 0.02],
        [0.3, -0.02, -0.18],
        [0.12, 0.08, 0.28],
      ].map((pos) => (
        <mesh
          key={pos.join(",")}
          position={pos as [number, number, number]}
          rotation={[0, 0, -1.05]}
        >
          <coneGeometry args={[0.045, 0.16, 6]} />
          <meshStandardMaterial color="#1c120c" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

type OrchardProps = {
  order: Player[];
  swings: Record<string, SwingRecord>;
  lastSwing: SwingRecord | null;
  roundId: number;
  accent: string;
};

export function Orchard({
  order,
  swings,
  lastSwing,
  roundId,
  accent,
}: OrchardProps) {
  const arm = useRef<THREE.Group>(null);
  const applesMesh = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const shake = useRef({ amount: 0 });
  const anim = useRef<{
    startedAt: number;
    score: number;
    apples: FallingApple[];
    lastMs: number;
  } | null>(null);

  const colorByPlayer = useMemo(() => {
    const map: Record<string, string> = {};
    for (const player of order) map[player.id] = player.color;
    return map;
  }, [order]);

  const pawColor = lastSwing
    ? (colorByPlayer[lastSwing.playerId] ?? "#7a4a28")
    : "#7a4a28";

  useLayoutEffect(() => {
    const mesh = applesMesh.current;
    if (!mesh) return;
    for (let i = 0; i < MAX_APPLES; i += 1) {
      dummy.scale.setScalar(0);
      dummy.position.set(0, -10, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(() => {
    if (!lastSwing) {
      anim.current = null;
      shake.current.amount = 0;
      return;
    }
    anim.current = {
      startedAt: performance.now(),
      score: lastSwing.score,
      apples: spawnApples(lastSwing.score, lastSwing.timestamp + lastSwing.score),
      lastMs: performance.now(),
    };
    const mesh = applesMesh.current;
    if (!mesh) return;
    const gold = lastSwing.score >= BELL_SCORE;
    for (let i = 0; i < MAX_APPLES; i += 1) {
      dummy.scale.setScalar(0);
      dummy.position.set(0, -10, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      appleTint.set(gold ? "#d4a017" : i % 4 === 0 ? "#a82e26" : "#c43b32");
      mesh.setColorAt(i, appleTint);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [lastSwing, roundId]);

  useFrame(() => {
    const state = anim.current;
    const now = performance.now();
    let pawAngle = PAW_REST;
    let ringScale = 0;
    let ringOpacity = 0;
    let shakeAmount = 0;

    if (state) {
      const elapsed = now - state.startedAt;
      const dt = Math.min((now - state.lastMs) / 1000, 0.05);
      state.lastMs = now;
      if (elapsed < SLAM_MS) {
        const t = elapsed / SLAM_MS;
        pawAngle = PAW_REST * (1 - easeInQuad(t));
      } else {
        const u = elapsed - SLAM_MS;
        pawAngle = PAW_REST * easeOutCubic(Math.min(u / 560, 1));
        const hit = scoreHeight(state.score);
        const decay = Math.exp(-u / 420);
        shakeAmount = (0.05 + 0.22 * hit) * decay * Math.sin(u / 38);
        if (u < 720) {
          ringScale = 0.35 + 1.5 * (u / 720);
          ringOpacity = 0.7 * (1 - u / 720);
        }
        const mesh = applesMesh.current;
        if (mesh) {
          for (let i = 0; i < MAX_APPLES; i += 1) {
            const apple = state.apples[i];
            if (!apple) {
              dummy.scale.setScalar(0);
              dummy.position.set(0, -10, 0);
              dummy.updateMatrix();
              mesh.setMatrixAt(i, dummy.matrix);
              continue;
            }
            if (u >= apple.delay && !apple.settled) {
              apple.vy += GRAVITY * dt;
              apple.x += apple.vx * dt;
              apple.y += apple.vy * dt;
              apple.z += apple.vz * dt;
              apple.spin += 3.4 * dt;
              if (apple.y <= GROUND_Y) {
                apple.y = GROUND_Y;
                if (Math.abs(apple.vy) < 2.4) {
                  apple.settled = true;
                  apple.vy = 0;
                  apple.vx = 0;
                  apple.vz = 0;
                } else {
                  apple.vy *= -0.32;
                  apple.vx *= 0.7;
                  apple.vz *= 0.7;
                }
              }
            }
            dummy.position.set(apple.x, apple.y, apple.z);
            dummy.rotation.set(apple.spin * 0.4, apple.spin, apple.spin * 0.2);
            dummy.scale.setScalar(u >= apple.delay ? 1 : 0);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
          }
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }

    shake.current.amount = shakeAmount;
    if (arm.current) arm.current.rotation.z = pawAngle;
    if (ring.current) {
      ring.current.visible = ringOpacity > 0.02;
      ring.current.scale.setScalar(Math.max(ringScale, 0.001));
    }
    if (ringMaterial.current) ringMaterial.current.opacity = ringOpacity;
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[28, 22]} />
        <meshStandardMaterial color="#6fa35a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.4, 0.01, 0.2]}>
        <circleGeometry args={[2.4, 24]} />
        <meshStandardMaterial color="#5b8a48" />
      </mesh>

      <DistantTree position={[6.4, 0, -4.2]} scale={0.72} />
      <DistantTree position={[-6.2, 0, -3.4]} scale={0.5} />
      <DistantTree position={[4.8, 0, -6.1]} scale={0.4} />

      <Tree shake={shake} />
      <BearBody />

      <group
        ref={arm}
        position={[-1.42, 1.86, 0.72]}
        rotation={[0.1, 0.32, PAW_REST]}
      >
        <mesh position={[0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.14, 0.2, 1.28, 10]} />
          <meshStandardMaterial color={pawColor} roughness={0.74} />
        </mesh>
        <Paw color={pawColor} />
      </group>

      <mesh ref={ring} position={[0.12, 1.52, 0.52]} visible={false}>
        <ringGeometry args={[0.28, 0.4, 24]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color={accent}
          transparent
          opacity={0}
        />
      </mesh>

      <instancedMesh
        ref={applesMesh}
        args={[undefined, undefined, MAX_APPLES]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.11, 12, 10]} />
        <meshStandardMaterial roughness={0.42} />
      </instancedMesh>

      {order.map((player, index) => {
        const record = swings[player.id];
        if (!record) return null;
        const shown = Math.min(10, Math.max(1, Math.round(record.score / 10)));
        const side = index % 2 === 0 ? -1 : 1;
        const row = Math.floor(index / 2);
        return (
          <group
            key={`${roundId}-${player.id}`}
            position={[side * (1.7 + row * 0.55), 0, 1.55 + row * 0.7]}
          >
            {Array.from({ length: shown }, (_, appleIndex) => {
              const col = appleIndex % 3;
              const layer = Math.floor(appleIndex / 3);
              return (
                <mesh
                  key={appleIndex}
                  position={[
                    (col - 1) * 0.22,
                    GROUND_Y + layer * 0.18,
                    (appleIndex % 2) * 0.16,
                  ]}
                >
                  <sphereGeometry args={[0.1, 10, 8]} />
                  <meshStandardMaterial
                    color={player.color}
                    emissive={player.color}
                    emissiveIntensity={0.22}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
