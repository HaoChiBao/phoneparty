"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { readLinearAcceleration, setRelativeQuaternion } from "@/lib/orientation";
import type { CalibratedPose, GyroSample } from "@/lib/protocol";
import { FIELD } from "./school";

/** Tunables for the paw. Retune here after a real-phone pass. */
export const PAW = {
  // Tilt that carries the paw from the middle to the edge of the river.
  degreesToEdge: 20,
  // Downward jab, in m/s^2, that counts as a swipe.
  swipeAccel: 11,
  // It has to settle below this before another swipe can fire, so one jab is
  // one swipe. Not a cooldown: a fresh jab still counts immediately.
  resetAccel: 4.5,
} as const;

const quat = new THREE.Quaternion();
const scratch = new THREE.Quaternion();
const dir = new THREE.Vector3();

export type Paw = { x: number; y: number };

export const MIDDLE: Paw = { x: 0, y: 0 };

/**
 * Where the back of the phone points, in river units. Local -Z is the back of
 * the phone — in the earth frame it is (0, -cos beta, -sin beta), so pointing
 * the camera at the TV and re-centring puts the paw in the middle. The relative
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
    // Turned away from the TV. Exactly backwards both lateral terms are zero,
    // which would park the paw in the middle of the river where the salmon
    // are, so it is pushed off the edge instead.
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
      (xDeg / PAW.degreesToEdge) * (FIELD.width / 2),
      -FIELD.width / 2,
      FIELD.width / 2,
    ),
    y: THREE.MathUtils.clamp((yDeg / PAW.degreesToEdge) * half, -half, half),
  };
}

type Vec3 = { x: number; y: number; z: number };

function readAccel(event: DeviceMotionEvent, gravity: Vec3): Vec3 | null {
  const linear = readLinearAcceleration(event);
  if (linear) return linear;
  const raw = event.accelerationIncludingGravity;
  if (!raw) return null;
  const x = raw.x ?? 0;
  const y = raw.y ?? 0;
  const z = raw.z ?? 0;
  const keep = 0.86;
  gravity.x = gravity.x * keep + x * (1 - keep);
  gravity.y = gravity.y * keep + y * (1 - keep);
  gravity.z = gravity.z * keep + z * (1 - keep);
  return { x: x - gravity.x, y: y - gravity.y, z: z - gravity.z };
}

/**
 * Downward acceleration, whatever way the phone is held. The low-passed
 * gravity reading gives the "up" axis in the device's own frame, so the swipe
 * works upright, angled, or flat — and it is immune to Safari and Chrome
 * disagreeing on the sign of the accelerometer, since a flipped frame flips
 * both the reference and the reading.
 */
export function downwardAccel(accel: Vec3, up: Vec3) {
  const length = Math.hypot(up.x, up.y, up.z);
  if (length < 1) return 0;
  return -(accel.x * up.x + accel.y * up.y + accel.z * up.z) / length;
}

/**
 * Fires once per downward jab of the phone. Edge triggered: the motion has to
 * settle before the next one counts, so a single swipe cannot register twice.
 */
export function useSwipeDetector({
  active,
  onSwipe,
}: {
  active: boolean;
  onSwipe: () => void;
}) {
  const [live, setLive] = useState(0);
  const swipeRef = useRef(onSwipe);
  const armed = useRef(true);
  const gravity = useRef<Vec3>({ x: 0, y: 0, z: 0 });
  const up = useRef<Vec3>({ x: 0, y: 0, z: 0 });
  const shown = useRef(0);

  useEffect(() => {
    swipeRef.current = onSwipe;
  }, [onSwipe]);

  useEffect(() => {
    if (!active) return;
    armed.current = true;
    gravity.current = { x: 0, y: 0, z: 0 };
    up.current = { x: 0, y: 0, z: 0 };

    const onMotion = (event: DeviceMotionEvent) => {
      const raw = event.accelerationIncludingGravity;
      if (raw) {
        const keep = 0.9;
        up.current.x = up.current.x * keep + (raw.x ?? 0) * (1 - keep);
        up.current.y = up.current.y * keep + (raw.y ?? 0) * (1 - keep);
        up.current.z = up.current.z * keep + (raw.z ?? 0) * (1 - keep);
      }
      const accel = readAccel(event, gravity.current);
      if (!accel) return;
      const down = downwardAccel(accel, up.current);

      if (armed.current && down >= PAW.swipeAccel) {
        armed.current = false;
        swipeRef.current();
      } else if (!armed.current && down < PAW.resetAccel) {
        armed.current = true;
      }

      // Throttled so the strength bar does not re-render on every sample.
      const now = Date.now();
      if (now - shown.current > 100) {
        shown.current = now;
        setLive(Math.max(down, 0));
      }
    };

    window.addEventListener("devicemotion", onMotion, true);
    return () => {
      window.removeEventListener("devicemotion", onMotion, true);
    };
  }, [active]);

  return active ? live : 0;
}
