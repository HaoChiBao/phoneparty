"use client";

import { OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Player } from "@/lib/protocol";
import { pawFromSample } from "./pointer";
import { FIELD, fishPosition, LEAD_IN_MS, type Fish } from "./school";
import type { CalibratedPose, GyroSample } from "@/lib/protocol";

const WATER_TOP = "#2f7fa8";
const WATER_DEEP = "#12415e";
const SALMON = "#d9714a";
const SALMON_BACK = "#8f4430";
const PAW_FUR = "#7a4a28";
const PAW_PAD = "#3d2415";

/** Salmon silhouette, nose pointing left, in a 1-unit body. */
function salmonShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.62, 0);
  shape.quadraticCurveTo(-0.22, 0.31, 0.24, 0.18);
  shape.lineTo(0.62, 0.34);
  shape.lineTo(0.5, 0);
  shape.lineTo(0.62, -0.34);
  shape.lineTo(0.24, -0.18);
  shape.quadraticCurveTo(-0.22, -0.31, -0.62, 0);
  return shape;
}

/** Fits the 16x9 river to whatever shape the TV is, without distortion. */
function FitCamera() {
  const size = useThree((state) => state.size);
  const zoom = Math.min(size.width / FIELD.width, size.height / FIELD.height);
  return (
    <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={zoom} near={0.1} far={100} />
  );
}

function Water() {
  const bands = useMemo(
    () => Array.from({ length: 7 }, (_, index) => index),
    [],
  );
  return (
    <group position={[0, 0, -5]}>
      <mesh>
        <planeGeometry args={[FIELD.width + 4, FIELD.height + 4]} />
        <meshBasicMaterial color={WATER_DEEP} />
      </mesh>
      {/* lighter water toward the surface, so up and down read at a glance */}
      {bands.map((index) => {
        const t = index / (bands.length - 1);
        const y = FIELD.height / 2 - (t * FIELD.height) / 1.6;
        return (
          <mesh key={index} position={[0, y, 0.01 + index * 0.001]}>
            <planeGeometry args={[FIELD.width + 4, FIELD.height / 3]} />
            <meshBasicMaterial color={WATER_TOP} transparent opacity={0.1} />
          </mesh>
        );
      })}
    </group>
  );
}

function Ripples() {
  const group = useRef<THREE.Group>(null);
  const lines = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => ({
        y: (index / 13) * FIELD.height - FIELD.height / 2,
        speed: 0.5 + ((index * 37) % 10) / 12,
        width: 1.4 + ((index * 53) % 10) / 4,
        offset: ((index * 91) % 100) / 100,
      })),
    [],
  );
  useFrame(() => {
    if (!group.current) return;
    const t = performance.now() / 1000;
    group.current.children.forEach((child, index) => {
      const line = lines[index];
      const span = FIELD.width + 6;
      const x = ((line.offset + t * line.speed * 0.06) % 1) * span - span / 2;
      child.position.x = -x;
    });
  });
  return (
    <group ref={group} position={[0, 0, -4]}>
      {lines.map((line, index) => (
        <mesh key={index} position={[0, line.y, 0]}>
          <planeGeometry args={[line.width, 0.045]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.13} />
        </mesh>
      ))}
    </group>
  );
}

function School({
  school,
  caughtIds,
  elapsedAt,
}: {
  school: Fish[];
  caughtIds: ReadonlySet<number>;
  elapsedAt: () => number;
}) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => new THREE.ShapeGeometry(salmonShape()), []);

  useFrame(() => {
    if (!group.current) return;
    const elapsed = elapsedAt();
    group.current.children.forEach((child, index) => {
      const fish = school[index];
      if (!fish || caughtIds.has(fish.id)) {
        child.visible = false;
        return;
      }
      const at = fishPosition(fish, elapsed);
      if (!at) {
        child.visible = false;
        return;
      }
      child.visible = true;
      child.position.set(at.x, at.y, 0);
      child.scale.setScalar(fish.size);
      // Nose into the swim direction as it bobs.
      const ahead = fishPosition(fish, elapsed + 90);
      child.rotation.z = ahead ? Math.atan2(at.y - ahead.y, Math.abs(at.x - ahead.x)) : 0;
    });
  });

  return (
    <group ref={group}>
      {school.map((fish) => (
        <group key={fish.id} visible={false}>
          <mesh geometry={geometry}>
            <meshBasicMaterial color={SALMON} />
          </mesh>
          <mesh geometry={geometry} position={[0, 0.07, -0.01]} scale={[0.96, 0.6, 1]}>
            <meshBasicMaterial color={SALMON_BACK} />
          </mesh>
          <mesh position={[-0.42, 0.07, 0.01]}>
            <circleGeometry args={[0.045, 10]} />
            <meshBasicMaterial color="#14202a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const SWIPE_MS = 320;

function BearPaw({
  player,
  sample,
  zero,
  swipeAt,
  nowAt,
}: {
  player: Player;
  sample: GyroSample | undefined;
  zero: CalibratedPose;
  swipeAt: number;
  nowAt: () => number;
}) {
  const group = useRef<THREE.Group>(null);
  const toes = useMemo(() => [-0.19, -0.065, 0.065, 0.19], []);

  useFrame(() => {
    if (!group.current) return;
    const paw = pawFromSample(sample ?? null, zero);
    group.current.position.set(paw.x, paw.y, 1);
    // A swipe drives the paw into the water and it springs back.
    const since = nowAt() - swipeAt;
    const t = since >= 0 && since < SWIPE_MS ? since / SWIPE_MS : 1;
    const dip = t < 1 ? Math.sin(Math.PI * t) : 0;
    group.current.scale.setScalar(1 - dip * 0.28);
    group.current.position.y -= dip * 0.35;
  });

  return (
    <group ref={group}>
      <mesh>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color={PAW_FUR} />
      </mesh>
      <mesh position={[0, -0.05, 0.01]}>
        <circleGeometry args={[0.2, 20]} />
        <meshBasicMaterial color={PAW_PAD} />
      </mesh>
      {toes.map((x, index) => (
        <mesh key={x} position={[x, 0.3 - Math.abs(index - 1.5) * 0.06, 0.01]}>
          <circleGeometry args={[0.085, 14]} />
          <meshBasicMaterial color={PAW_PAD} />
        </mesh>
      ))}
      {/* a ring in the player's colour, so a bear can find their own paw */}
      <mesh position={[0, 0, -0.01]}>
        <ringGeometry args={[0.46, 0.56, 28]} />
        <meshBasicMaterial color={player.color} />
      </mesh>
    </group>
  );
}

function Splash({ at, nowAt }: { at: { x: number; y: number; time: number } | null; nowAt: () => number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!mesh.current || !material.current) return;
    if (!at) {
      mesh.current.visible = false;
      return;
    }
    const since = nowAt() - at.time;
    const life = 520;
    if (since < 0 || since > life) {
      mesh.current.visible = false;
      return;
    }
    const t = since / life;
    mesh.current.visible = true;
    mesh.current.position.set(at.x, at.y, 2);
    mesh.current.scale.setScalar(0.4 + t * 2.4);
    material.current.opacity = 0.75 * (1 - t);
  });
  return (
    <mesh ref={mesh} visible={false}>
      <ringGeometry args={[0.32, 0.44, 28]} />
      <meshBasicMaterial ref={material} color="#ffffff" transparent opacity={0} />
    </mesh>
  );
}

export function River({
  controllers,
  school,
  caughtIds,
  zeroByPlayer,
  gyroByPlayer,
  swipeAtByPlayer,
  splash,
  startedAt,
  offset,
}: {
  controllers: Player[];
  school: Fish[];
  caughtIds: ReadonlySet<number>;
  zeroByPlayer: Record<string, CalibratedPose>;
  gyroByPlayer: Record<string, GyroSample>;
  swipeAtByPlayer: Record<string, number>;
  splash: { x: number; y: number; time: number } | null;
  startedAt: number;
  offset: number;
}) {
  // Rendering and catch resolution share one timeline — the server's — so a
  // paw lands where the salmon actually is for everyone.
  const nowAt = useMemo(() => () => Date.now() + offset, [offset]);
  const elapsedAt = useMemo(
    () => () => (startedAt ? Date.now() + offset - startedAt - LEAD_IN_MS : 0),
    [startedAt, offset],
  );

  return (
    <>
      <FitCamera />
      <ambientLight intensity={1} />
      <Water />
      <Ripples />
      <School school={school} caughtIds={caughtIds} elapsedAt={elapsedAt} />
      <Splash at={splash} nowAt={nowAt} />
      {controllers.map((player) => {
        const zero = zeroByPlayer[player.id];
        if (!zero) return null;
        return (
          <BearPaw
            key={player.id}
            player={player}
            sample={gyroByPlayer[player.id]}
            zero={zero}
            swipeAt={swipeAtByPlayer[player.id] ?? -1}
            nowAt={nowAt}
          />
        );
      })}
    </>
  );
}
