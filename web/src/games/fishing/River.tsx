"use client";

import { OrthographicCamera, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Player } from "@/lib/protocol";
import { pawFromSample } from "./pointer";
import { FIELD, fishPosition, LEAD_IN_MS, type Fish } from "./school";
import type { CalibratedPose, GyroSample } from "@/lib/protocol";

const PAW_FUR = "#7a4a28";
const PAW_PAD = "#3d2415";

/** Fits the 16x9 river to whatever shape the TV is, without distortion. */
function FitCamera() {
  const size = useThree((state) => state.size);
  if (size.width < 2 || size.height < 2) return null;
  const zoom = Math.min(size.width / FIELD.width, size.height / FIELD.height);
  return (
    <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={zoom} near={0.1} far={100} />
  );
}

function Ripples() {
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const reducedMotion = useRef(false);
  const size = useThree((state) => state.size);
  // Match FitCamera's visible area, including extra water on wide/tall screens.
  const aspect = size.width / Math.max(size.height, 1) || FIELD.width / FIELD.height;
  const viewWidth = Math.max(FIELD.width, FIELD.height * aspect);
  const viewHeight = Math.max(FIELD.height, FIELD.width / aspect);
  const texture = useTexture("/fishing/wavestreak.png", (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace;
  });
  const image = texture.image as HTMLImageElement;
  const lines = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => ({
        lane: (index + 0.5) / 10 - 0.5,
        speed: 0.45 + ((index * 37) % 10) / 15,
        width: 6 + ((index * 53) % 10) / 2,
        offset: ((index * 91) % 100) / 100,
        opacity: 0.22 + ((index * 17) % 5) * 0.035,
      })),
    [],
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = preference.matches; };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useFrame((_, delta) => {
    if (!group.current) return;
    if (!reducedMotion.current) elapsed.current += Math.min(delta, 0.05);
    const t = elapsed.current;
    group.current.children.forEach((child, index) => {
      const line = lines[index];
      // Wrap only once the entire streak has left the viewport.
      const span = viewWidth + line.width + 1;
      child.position.x = span / 2 - (line.offset * span + t * line.speed) % span;
      child.position.y = line.lane * viewHeight + Math.sin(t * 0.45 + index) * 0.12;
    });
  });
  return (
    <group ref={group} position={[0, 0, -4]}>
      {lines.map((line, index) => (
        <mesh key={index}>
          <planeGeometry args={[line.width, line.width * (image.height / image.width)]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={line.opacity}
            depthWrite={false}
            toneMapped={false}
          />
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
  const texture = useTexture("/fishing/fish.png", (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace;
  });
  const geometry = useMemo(() => {
    const image = texture.image as HTMLImageElement;
    return new THREE.PlaneGeometry(1.4 * (image.width / image.height), 1.4);
  }, [texture]);

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
          {/* Rotate the upright art to swim left, then mirror its local X axis
              to put its top back above its belly without reversing the nose. */}
          <mesh geometry={geometry} rotation={[0, 0, Math.PI / 2]} scale={[-1, 1, 1]}>
            <meshBasicMaterial
              map={texture}
              transparent
              alphaTest={0.01}
              depthWrite={false}
              toneMapped={false}
            />
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
