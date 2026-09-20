"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Player } from "@/lib/protocol";
import { BELL_SCORE, scoreHeight, type SwingRecord } from "./logic";

const BASE_Y = 0.85;
const TOP_Y = 7.05;
const BELL_Y = 7.95;
const MALLET_REST = 1.15;

const SLAM_MS = 160;
const HOLD_MS = 260;
const FALL_MS = 540;
const RING_MS = 820;

export function heightForScore(score: number) {
  return BASE_Y + (TOP_Y - BASE_Y) * scoreHeight(score);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInQuad(t: number) {
  return t * t;
}

type TowerProps = {
  order: Player[];
  swings: Record<string, SwingRecord>;
  lastSwing: SwingRecord | null;
  roundId: number;
  accent: string;
};

export function Tower({
  order,
  swings,
  lastSwing,
  roundId,
  accent,
}: TowerProps) {
  const puck = useRef<THREE.Mesh>(null);
  const mallet = useRef<THREE.Group>(null);
  const bell = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const anim = useRef<{ startedAt: number; score: number; rise: number } | null>(
    null,
  );

  const colorByPlayer = useMemo(() => {
    const map: Record<string, string> = {};
    for (const player of order) map[player.id] = player.color;
    return map;
  }, [order]);

  const puckColor = lastSwing
    ? (colorByPlayer[lastSwing.playerId] ?? accent)
    : "#111111";

  useEffect(() => {
    if (!lastSwing) {
      anim.current = null;
      return;
    }
    const frac = scoreHeight(lastSwing.score);
    anim.current = {
      startedAt: performance.now(),
      score: lastSwing.score,
      rise: 380 + 460 * frac,
    };
  }, [lastSwing, roundId]);

  const ticks = useMemo(
    () => Array.from({ length: 10 }, (_, index) => (index + 1) / 10),
    [],
  );

  useFrame(() => {
    const state = anim.current;
    const now = performance.now();
    let puckY = BASE_Y;
    let malletAngle = MALLET_REST;
    let bellScale = 1;
    let ringScale = 0;
    let ringOpacity = 0;

    if (state) {
      const target = heightForScore(state.score);
      if (now - state.startedAt < SLAM_MS) {
        const t = (now - state.startedAt) / SLAM_MS;
        malletAngle = MALLET_REST * (1 - easeInQuad(t));
      } else {
        const u = now - state.startedAt - SLAM_MS;
        malletAngle = MALLET_REST * easeOutCubic(Math.min(u / 520, 1));
        if (u < state.rise) {
          puckY = BASE_Y + (target - BASE_Y) * easeOutCubic(u / state.rise);
        } else if (u < state.rise + HOLD_MS) {
          puckY = target;
        } else if (u < state.rise + HOLD_MS + FALL_MS) {
          const v = (u - state.rise - HOLD_MS) / FALL_MS;
          puckY = target + (BASE_Y - target) * easeInQuad(v);
        }
        if (state.score >= BELL_SCORE) {
          const since = u - state.rise;
          if (since > 0 && since < RING_MS) {
            const decay = 1 - since / RING_MS;
            bellScale = 1 + 0.22 * decay * Math.abs(Math.sin(since / 55));
            ringScale = 0.4 + 1.7 * (since / RING_MS);
            ringOpacity = 0.85 * decay;
          }
        }
      }
    }

    if (puck.current) puck.current.position.y = puckY;
    if (mallet.current) mallet.current.rotation.z = malletAngle;
    if (bell.current) bell.current.scale.setScalar(bellScale);
    if (ring.current) {
      ring.current.visible = ringOpacity > 0.01;
      ring.current.scale.setScalar(Math.max(ringScale, 0.001));
    }
    if (ringMaterial.current) ringMaterial.current.opacity = ringOpacity;
  });

  return (
    <group>
      {/* plinth */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[2.8, 0.7, 1.8]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[2.9, 0.06, 1.9]} />
        <meshStandardMaterial color={accent} />
      </mesh>

      {/* rail */}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[0.95, 7, 0.3]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      {ticks.map((fraction) => {
        const major = Math.round(fraction * 10) % 5 === 0;
        return (
          <mesh
            key={fraction}
            position={[0, heightForScore(fraction * 100), 0.17]}
          >
            <boxGeometry args={[major ? 0.7 : 0.42, 0.035, 0.02]} />
            <meshBasicMaterial color={major ? accent : "#ffffff"} />
          </mesh>
        );
      })}

      {/* puck */}
      <mesh ref={puck} position={[0, BASE_Y, 0.26]}>
        <boxGeometry args={[0.86, 0.3, 0.34]} />
        <meshStandardMaterial
          color={puckColor}
          emissive={puckColor}
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* bell */}
      <group ref={bell} position={[0, BELL_Y, 0]}>
        <mesh>
          <sphereGeometry args={[0.42, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
          <meshStandardMaterial
            color={accent}
            metalness={0.35}
            roughness={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 10]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      </group>
      <mesh ref={ring} position={[0, BELL_Y, 0.3]} visible={false}>
        <ringGeometry args={[0.5, 0.6, 32]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color={accent}
          transparent
          opacity={0}
        />
      </mesh>

      {/* one marker per finished player, so the best swing stays on the rail */}
      {order.map((player, index) => {
        const record = swings[player.id];
        if (!record) return null;
        const side = index % 2 === 0 ? -1 : 1;
        return (
          <group
            key={`${roundId}-${player.id}`}
            position={[side * 0.82, heightForScore(record.score), 0.2]}
          >
            <mesh>
              <boxGeometry args={[0.5, 0.09, 0.16]} />
              <meshStandardMaterial
                color={player.color}
                emissive={player.color}
                emissiveIntensity={0.4}
              />
            </mesh>
          </group>
        );
      })}

      {/* mallet */}
      <group ref={mallet} position={[-2.1, 0.75, 0.9]} rotation={[0, 0, MALLET_REST]}>
        <mesh position={[0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.08, 1.25, 12]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
        <mesh position={[1.32, 0, 0]}>
          <boxGeometry args={[0.46, 0.46, 0.46]} />
          <meshStandardMaterial color={puckColor} metalness={0.2} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}
