"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Player } from "@/lib/protocol";
import type { Aim } from "./aim";
import type { Shot } from "./logic";
import { windStrength, type Wind } from "./wind";

export const TARGET_Z = -9;
export const TARGET_Y = 2.2;
export const TARGET_RADIUS = 1.6;
const BOW_ORIGIN = new THREE.Vector3(0, 1.5, 1.4);
const FLIGHT_MS = 420;
const RINGS = 10;

const ACCENT = "#0057FF";

function ringColor(ring: number) {
  if (ring >= 9) return ACCENT;
  if (ring >= 7) return "#7AA6FF";
  if (ring >= 4) return "#ffffff";
  return "#eef1f6";
}

/** Face position for an aim, where 1 is the outer edge of the target. */
export function facePoint(x: number, y: number, out: THREE.Vector3) {
  return out.set(x * TARGET_RADIUS, TARGET_Y + y * TARGET_RADIUS, TARGET_Z);
}

function Arrow({
  color,
  position,
}: {
  color: string;
  position: [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.022, 0.022, 0.62, 8]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[0, 0, 0.58]}>
        <boxGeometry args={[0.13, 0.13, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function WindSock({ wind }: { wind: Wind }) {
  const strength = windStrength(wind);
  const length = 0.35 + strength * 1.15;
  const blowingRight = wind.x >= 0;
  // Lean the streamer for the gust's vertical share.
  const lean = Math.atan2(wind.y, Math.abs(wind.x) || 0.001) * 0.6;
  return (
    <group position={[2.9, 0, TARGET_Z + 0.2]}>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 2.8, 8]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <group
        position={[0, 2.7, 0]}
        rotation={[0, blowingRight ? 0 : Math.PI, blowingRight ? lean : -lean]}
      >
        <mesh position={[length / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.16, length, 12, 1, true]} />
          <meshStandardMaterial
            color={ACCENT}
            side={THREE.DoubleSide}
            transparent
            opacity={0.85}
          />
        </mesh>
      </group>
    </group>
  );
}

export function Target({
  order,
  shots,
  lastShot,
  liveAim,
  liveColor,
  roundId,
  wind,
}: {
  order: Player[];
  shots: Record<string, Shot[]>;
  lastShot: Shot | null;
  liveAim: Aim | null;
  liveColor: string;
  roundId: number;
  wind: Wind;
}) {
  const flight = useRef<THREE.Group>(null);
  const crosshair = useRef<THREE.Group>(null);
  const anim = useRef<{
    startedAt: number;
    to: THREE.Vector3;
    aimed: THREE.Vector3;
  } | null>(null);
  const point = useRef(new THREE.Vector3());
  const landed = useRef(new THREE.Vector3());

  const colorByPlayer = useMemo(() => {
    const map: Record<string, string> = {};
    for (const player of order) map[player.id] = player.color;
    return map;
  }, [order]);

  const rings = useMemo(
    () =>
      Array.from({ length: RINGS }, (_, index) => {
        const ring = RINGS - index; // 10 in the middle, 1 at the edge
        const outer = ((RINGS - ring + 1) / RINGS) * TARGET_RADIUS;
        const inner = ((RINGS - ring) / RINGS) * TARGET_RADIUS;
        return { ring, inner, outer };
      }),
    [],
  );

  useEffect(() => {
    if (!lastShot) {
      anim.current = null;
      return;
    }
    anim.current = {
      startedAt: performance.now(),
      to: facePoint(lastShot.x, lastShot.y, new THREE.Vector3()),
      aimed: facePoint(lastShot.aimX, lastShot.aimY, new THREE.Vector3()),
    };
  }, [lastShot, roundId]);

  useFrame(() => {
    const state = anim.current;
    if (flight.current) {
      if (!state) {
        flight.current.visible = false;
      } else {
        const t = (performance.now() - state.startedAt) / FLIGHT_MS;
        if (t >= 1) {
          flight.current.visible = false;
        } else {
          flight.current.visible = true;
          landed.current.copy(BOW_ORIGIN).lerp(state.to, t);
          // The arrow leaves along the line of aim and is carried across to
          // where it lands, so the wind is visible as a curve, not a jump.
          const carry = (1 - t) * (1 - t);
          landed.current.x += (state.aimed.x - state.to.x) * carry;
          landed.current.y += (state.aimed.y - state.to.y) * carry;
          // a little lift early in the flight, gone by the time it lands
          landed.current.y += Math.sin(Math.PI * t) * 0.35 * (1 - t);
          flight.current.position.copy(landed.current);
          flight.current.lookAt(state.to);
        }
      }
    }
    if (crosshair.current) {
      if (!liveAim) {
        crosshair.current.visible = false;
      } else {
        crosshair.current.visible = true;
        facePoint(liveAim.x, liveAim.y, point.current);
        point.current.z = TARGET_Z + 0.12;
        crosshair.current.position.copy(point.current);
      }
    }
  });

  return (
    <group>
      <WindSock wind={wind} />

      {/* stand */}
      <mesh position={[0, (TARGET_Y - TARGET_RADIUS) / 2, TARGET_Z - 0.1]}>
        <boxGeometry args={[0.16, TARGET_Y - TARGET_RADIUS, 0.16]} />
        <meshStandardMaterial color="#111111" />
      </mesh>

      {/* face */}
      <mesh position={[0, TARGET_Y, TARGET_Z - 0.04]}>
        <circleGeometry args={[TARGET_RADIUS + 0.09, 48]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      {rings.map(({ ring, inner, outer }) => (
        <mesh
          key={ring}
          position={[0, TARGET_Y, TARGET_Z + ring * 0.002]}
        >
          <ringGeometry args={[inner, outer, 48]} />
          <meshStandardMaterial color={ringColor(ring)} />
        </mesh>
      ))}
      {/* ring separators, so the scoring bands read at a distance */}
      {rings.map(({ ring, outer }) => (
        <mesh key={`edge-${ring}`} position={[0, TARGET_Y, TARGET_Z + 0.03]}>
          <ringGeometry args={[outer - 0.007, outer, 48]} />
          <meshBasicMaterial color="#111111" transparent opacity={0.28} />
        </mesh>
      ))}

      {/* arrows already in the face */}
      {order.map((player) =>
        (shots[player.id] ?? []).map((shot, index) => {
          const spot = facePoint(shot.x, shot.y, new THREE.Vector3());
          return (
            <Arrow
              key={`${roundId}-${player.id}-${index}`}
              color={colorByPlayer[player.id] ?? ACCENT}
              position={[spot.x, spot.y, TARGET_Z + 0.02]}
            />
          );
        }),
      )}

      {/* the arrow in flight */}
      <group ref={flight} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.024, 0.024, 0.7, 8]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      </group>

      {/* live crosshair for whoever is drawing */}
      <group ref={crosshair} visible={false}>
        <mesh>
          <ringGeometry args={[0.1, 0.13, 24]} />
          <meshBasicMaterial color={liveColor} transparent opacity={0.9} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.02, 0.035, 12]} />
          <meshBasicMaterial color={liveColor} />
        </mesh>
      </group>
    </group>
  );
}
