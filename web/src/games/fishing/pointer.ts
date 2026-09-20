"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { setRelativeQuaternion } from "@/lib/orientation";
import type { CalibratedPose, GyroSample } from "@/lib/protocol";
import { FIELD } from "./school";

/** Tunables for the hook cursor. Retune here after a real-phone pass. */
export const HOOK = {
  // Tilt that carries the hook from the middle to the edge of the river.
  degreesToEdge: 20,
  smoothingSeconds: 0.12,
  maxCursorUnitsPerSecond: 15,
} as const;

const quat = new THREE.Quaternion();
const scratch = new THREE.Quaternion();
const dir = new THREE.Vector3();

export type Paw = { x: number; y: number };

export const MIDDLE: Paw = { x: 0, y: 0 };

export function smoothPaw(previous: Paw, next: Paw, dt: number): Paw {
  const step = Math.max(0, Math.min(dt, 0.1));
  const alpha = 1 - Math.exp(-step / HOOK.smoothingSeconds);
  const maxDelta = HOOK.maxCursorUnitsPerSecond * step;
  const move = (from: number, to: number) =>
    from + THREE.MathUtils.clamp(to - from, -maxDelta, maxDelta) * alpha;
  return { x: move(previous.x, next.x), y: move(previous.y, next.y) };
}

/** The filtered hook is used for both the phone preview and catch coordinate. */
export function useSmoothedPaw(paw: Paw, active: boolean, resetKey: unknown): Paw {
  const [smoothed, setSmoothed] = useState<Paw>(paw);
  const filtered = useRef(paw);
  const lastAt = useRef(0);
  const latestPaw = useRef(paw);

  useEffect(() => {
    latestPaw.current = paw;
  }, [paw]);

  useEffect(() => {
    const next = latestPaw.current;
    filtered.current = next;
    lastAt.current = performance.now();
    const frame = requestAnimationFrame(() => setSmoothed(next));
    return () => cancelAnimationFrame(frame);
  }, [active, resetKey]);

  useEffect(() => {
    if (!active) return;
    const now = performance.now();
    const dt = lastAt.current ? (now - lastAt.current) / 1000 : 1 / 60;
    lastAt.current = now;
    const next = smoothPaw(filtered.current, paw, dt);
    filtered.current = next;
    setSmoothed(next);
  }, [paw, active]);

  return active ? smoothed : paw;
}

/**
 * Where the back of the phone points, in river units. Local -Z is the back of
 * the phone — in the earth frame it is (0, -cos beta, -sin beta), so pointing
 * the camera at the TV and re-centring puts the hook in the middle. The relative
 * frame already lines up with world space; no axis flips, per orientation.ts.
 */
export function pawFromSample(
  sample: GyroSample | null,
  zero: CalibratedPose | null,
): Paw {
  if (!sample || !zero) return MIDDLE;
  setRelativeQuaternion(quat, sample, zero, scratch);
  dir.set(0, 0, -1).applyQuaternion(quat);
  const half = FIELD.height / 2;
  const forward = -dir.z;
  if (forward <= 0.05) {
    const lateral = Math.hypot(dir.x, dir.y);
    if (lateral < 1e-6) return { x: 0, y: -half };
    return {
      x: THREE.MathUtils.clamp(
        (dir.x / lateral) * FIELD.width,
        -FIELD.width / 2,
        FIELD.width / 2,
      ),
      y: THREE.MathUtils.clamp((dir.y / lateral) * FIELD.height, -half, half),
    };
  }
  const xDeg = THREE.MathUtils.radToDeg(Math.atan2(dir.x, forward));
  const yDeg = THREE.MathUtils.radToDeg(Math.atan2(dir.y, forward));
  return {
    x: THREE.MathUtils.clamp(
      (xDeg / HOOK.degreesToEdge) * (FIELD.width / 2),
      -FIELD.width / 2,
      FIELD.width / 2,
    ),
    y: THREE.MathUtils.clamp((yDeg / HOOK.degreesToEdge) * half, -half, half),
  };
}
