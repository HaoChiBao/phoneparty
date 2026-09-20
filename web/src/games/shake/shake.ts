"use client";

import { useEffect, useRef, useState } from "react";
import { readLinearAcceleration } from "@/lib/orientation";
import type { GyroSample } from "@/lib/protocol";

/** Tunables for the shake. Retune here after a real-phone pass. */
export const SHAKE = {
  // Flat with the screen up puts the rear camera on the ground. beta/gamma are
  // used instead of gravity because Safari and Chrome disagree on the sign of
  // accelerationIncludingGravity but agree on orientation angles.
  gripBetaMax: 50,
  gripGammaMax: 50,
  // Sideways acceleration, m/s^2, that makes a stroke count. Below this the
  // bear is only holding the trunk.
  strokeAccel: 9,
  // It has to cross back under this before the next stroke counts, so one
  // push of the trunk is one stroke.
  resetAccel: 3.5,
  // Two strokes closer together than this are one jolt, not a shake.
  minStrokeGapMs: 70,
  // Window the on-screen rate is averaged over.
  rateWindowMs: 1400,
} as const;

/** The phone is flat, camera pointed at the ground. */
export function isGripped(sample: GyroSample | null) {
  if (!sample) return false;
  return (
    Math.abs(sample.beta) < SHAKE.gripBetaMax &&
    Math.abs(sample.gamma) < SHAKE.gripGammaMax
  );
}

export type Vec3 = { x: number; y: number; z: number };

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
 * The sideways part of a motion: acceleration with the vertical component
 * removed. Using the low-passed gravity reading as the vertical reference
 * means a left-right shake reads the same however the phone is turned in the
 * hand, and it survives Safari and Chrome disagreeing on the accelerometer's
 * sign, since a flipped frame flips the reference and the reading together.
 */
export function lateralAccel(accel: Vec3, up: Vec3) {
  const length = Math.hypot(up.x, up.y, up.z);
  if (length < 1) return { x: 0, y: 0, z: 0, size: 0 };
  const ux = up.x / length;
  const uy = up.y / length;
  const uz = up.z / length;
  const along = accel.x * ux + accel.y * uy + accel.z * uz;
  const x = accel.x - along * ux;
  const y = accel.y - along * uy;
  const z = accel.z - along * uz;
  return { x, y, z, size: Math.hypot(x, y, z) };
}

export type ShakeReading = { strokes: number; rate: number };

const RESTING: ShakeReading = { strokes: 0, rate: 0 };

/**
 * Counts strokes of the trunk. A stroke is one sideways push past the
 * threshold, and the motion has to settle before the next one counts, so a
 * single shove cannot register twice and a faster bear simply lands more
 * strokes in the thirty seconds.
 */
export function useShakeDetector({
  active,
  gripped,
  onStroke,
}: {
  active: boolean;
  gripped: boolean;
  onStroke: (strokes: number) => void;
}) {
  const [reading, setReading] = useState<ShakeReading>(RESTING);
  const strokes = useRef(0);
  const armed = useRef(true);
  const lastStrokeAt = useRef(0);
  const recent = useRef<number[]>([]);
  const gravity = useRef<Vec3>({ x: 0, y: 0, z: 0 });
  const up = useRef<Vec3>({ x: 0, y: 0, z: 0 });
  const grippedRef = useRef(gripped);
  const strokeRef = useRef(onStroke);
  const shown = useRef(0);

  useEffect(() => {
    grippedRef.current = gripped;
  }, [gripped]);

  useEffect(() => {
    strokeRef.current = onStroke;
  }, [onStroke]);

  useEffect(() => {
    if (!active) return;
    strokes.current = 0;
    armed.current = true;
    lastStrokeAt.current = 0;
    recent.current = [];
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
      const side = lateralAccel(accel, up.current);
      const now = Date.now();

      if (
        armed.current &&
        grippedRef.current &&
        side.size >= SHAKE.strokeAccel &&
        now - lastStrokeAt.current >= SHAKE.minStrokeGapMs
      ) {
        armed.current = false;
        lastStrokeAt.current = now;
        strokes.current += 1;
        recent.current.push(now);
        strokeRef.current(strokes.current);
      } else if (!armed.current && side.size < SHAKE.resetAccel) {
        armed.current = true;
      }

      // Throttled: the meter does not need to redraw on every sample.
      if (now - shown.current > 120) {
        shown.current = now;
        const cutoff = now - SHAKE.rateWindowMs;
        recent.current = recent.current.filter((at) => at >= cutoff);
        setReading({
          strokes: strokes.current,
          rate: (recent.current.length / SHAKE.rateWindowMs) * 1000,
        });
      }
    };

    window.addEventListener("devicemotion", onMotion, true);
    return () => {
      window.removeEventListener("devicemotion", onMotion, true);
    };
  }, [active]);

  // Masked rather than reset inside the effect, so a finished round cannot
  // leave a stale count on screen.
  return active ? reading : RESTING;
}
