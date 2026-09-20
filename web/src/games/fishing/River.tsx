"use client";

import { OrthographicCamera, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CalibratedPose, GyroSample, Player } from "@/lib/protocol";
import type { Fight } from "./logic";
import { MIDDLE, pawFromSample, smoothPaw, type Paw } from "./pointer";
import {
  FIELD,
  fishPosition,
  KINDS,
  LEAD_IN_MS,
  reelsFor,
  type Fish,
  type FishKind,
} from "./school";

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
    const update = () => {
      reducedMotion.current = preference.matches;
    };
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
      const span = viewWidth + line.width + 1;
      child.position.x = span / 2 - ((line.offset * span + t * line.speed) % span);
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

function useFishMaps(): Record<FishKind, THREE.Texture> {
  const textures = useTexture([KINDS.small.src, KINDS.medium.src, KINDS.large.src]);
  const maps = {
    small: textures[0],
    medium: textures[1],
    large: textures[2],
  };
  useEffect(() => {
    (Object.keys(maps) as FishKind[]).forEach((kind) => {
      maps[kind].colorSpace = THREE.SRGBColorSpace;
    });
  }, [maps.small, maps.medium, maps.large]);
  return maps;
}

function fishGeometry(texture: THREE.Texture) {
  const image = texture.image as HTMLImageElement | undefined;
  const aspect = image?.width && image?.height ? image.width / image.height : 0.7;
  return new THREE.PlaneGeometry(1.4 * aspect, 1.4);
}

function School({
  school,
  busyIds,
  elapsedAt,
}: {
  school: Fish[];
  busyIds: ReadonlySet<number>;
  elapsedAt: () => number;
}) {
  const group = useRef<THREE.Group>(null);
  const maps = useFishMaps();
  const geometries = useMemo(
    () => ({
      small: fishGeometry(maps.small),
      medium: fishGeometry(maps.medium),
      large: fishGeometry(maps.large),
    }),
    [maps.small, maps.medium, maps.large],
  );

  useFrame(() => {
    if (!group.current) return;
    const elapsed = elapsedAt();
    group.current.children.forEach((child, index) => {
      const fish = school[index];
      if (!fish || busyIds.has(fish.id)) {
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
      const ahead = fishPosition(fish, elapsed + 90);
      child.rotation.z = ahead ? Math.atan2(at.y - ahead.y, Math.abs(at.x - ahead.x)) : 0;
    });
  });

  return (
    <group ref={group}>
      {school.map((fish) => (
        <group key={fish.id} visible={false}>
          {/* Upright art rotated to swim sideways. scale.x follows heading so
              left-swimmers and right-swimmers both keep their belly down. */}
          <mesh
            geometry={geometries[fish.kind]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[fish.heading, 1, 1]}
          >
            <meshBasicMaterial
              map={maps[fish.kind]}
              color={KINDS[fish.kind].tint}
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

function LatchedFish({
  fish,
  reels,
}: {
  fish: Fish;
  reels: number;
}) {
  const group = useRef<THREE.Group>(null);
  const maps = useFishMaps();
  const geometry = useMemo(() => fishGeometry(maps[fish.kind]), [maps.small, maps.medium, maps.large, fish.kind]);
  const need = reelsFor(fish);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const progress = Math.min(1, reels / need);
    const fight = 1 - progress;
    const hang = THREE.MathUtils.lerp(-0.85 * fish.size, 0.12, progress);
    const wiggle = Math.sin(clock.elapsedTime * (14 + fish.size * 4)) * 0.16 * fight;
    group.current.position.set(wiggle, hang, 0.02);
    group.current.rotation.z = wiggle * 1.8 - 0.15;
    group.current.scale.setScalar(fish.size * (0.92 + progress * 0.08));
  });

  return (
    <group ref={group}>
      <mesh geometry={geometry} rotation={[0, 0, Math.PI / 2]} scale={[-1, 1, 1]}>
        <meshBasicMaterial
          map={maps[fish.kind]}
          color={KINDS[fish.kind].tint}
          transparent
          alphaTest={0.01}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function PlayerHook({
  player,
  sample,
  zero,
  fight,
  school,
}: {
  player: Player;
  sample: GyroSample | undefined;
  zero: CalibratedPose;
  fight: Fight | undefined;
  school: Fish[];
}) {
  const group = useRef<THREE.Group>(null);
  const line = useRef<THREE.Mesh>(null);
  const filtered = useRef<Paw>(MIDDLE);
  const hook = useTexture("/fishing/hook.png", (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace;
  });
  const image = hook.image as HTMLImageElement | undefined;
  const aspect = image?.width && image?.height ? image.width / image.height : 1;
  const hooked = fight ? school.find((entry) => entry.id === fight.fishId) : null;

  useEffect(() => {
    filtered.current = MIDDLE;
  }, [zero]);

  useFrame((_, delta) => {
    if (!group.current) return;
    const paw = smoothPaw(filtered.current, pawFromSample(sample ?? null, zero), delta);
    filtered.current = paw;
    group.current.position.set(paw.x, paw.y, 1);
    if (line.current) {
      const top = FIELD.height / 2 + 0.4;
      const height = Math.max(0.2, top - paw.y);
      line.current.position.set(0, height / 2, -0.02);
      line.current.scale.set(1, height, 1);
    }
  });

  return (
    <group ref={group}>
      <mesh ref={line} position={[0, 0, -0.02]}>
        <planeGeometry args={[0.045, 1]} />
        <meshBasicMaterial color={player.color} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <ringGeometry args={[0.38, 0.5, 28]} />
        <meshBasicMaterial color={player.color} />
      </mesh>
      <mesh>
        <planeGeometry args={[0.72 * aspect, 0.72]} />
        <meshBasicMaterial
          map={hook}
          transparent
          alphaTest={0.05}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {hooked && fight ? <LatchedFish fish={hooked} reels={fight.reels} /> : null}
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
  busyIds,
  fights,
  zeroByPlayer,
  gyroByPlayer,
  splash,
  startedAt,
  offset,
}: {
  controllers: Player[];
  school: Fish[];
  busyIds: ReadonlySet<number>;
  fights: Record<string, Fight>;
  zeroByPlayer: Record<string, CalibratedPose>;
  gyroByPlayer: Record<string, GyroSample>;
  splash: { x: number; y: number; time: number } | null;
  startedAt: number;
  offset: number;
}) {
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
      <School school={school} busyIds={busyIds} elapsedAt={elapsedAt} />
      <Splash at={splash} nowAt={nowAt} />
      {controllers.map((player) => {
        const zero = zeroByPlayer[player.id];
        if (!zero) return null;
        return (
          <PlayerHook
            key={player.id}
            player={player}
            sample={gyroByPlayer[player.id]}
            zero={zero}
            fight={fights[player.id]}
            school={school}
          />
        );
      })}
    </>
  );
}
