"use client";

import { useEffect, useRef, useState } from "react";
import { readLinearAcceleration } from "@/lib/orientation";
import type { GyroSample } from "@/lib/protocol";

/** Tunables for the swing detector. Retune here after a real-phone pass. */
export const SWING = {
  // Flat with the screen up means the rear camera faces the floor. beta/gamma
  // are used instead of gravity because Safari and Chrome disagree on the sign
  // of accelerationIncludingGravity, but agree on orientation angles.
  aimBetaMax: 45,
  aimGammaMax: 45,
  stillMax: 3.5, // m/s^2 in any direction that counts as holding still
  stillMs: 280,
  startDown: 8, // m/s^2 STRAIGHT DOWN that opens a capture window
  captureMs: 450,
  minDown: 8, // peak downward m/s^2 that maps to power 0
  maxDown: 35, // peak downward m/s^2 that maps to power 1
} as const;

export type SwingPhase = "idle" | "aim" | "steady" | "ready" | "capturing";

type Vec3 = { x: number; y: number; z: number };

export function isAimedDown(sample: GyroSample | null) {
  if (!sample) return false;
  return (
    Math.abs(sample.beta) < SWING.aimBetaMax &&
    Math.abs(sample.gamma) < SWING.aimGammaMax
  );
}

export function peakToPower(peak: number) {
  const span = SWING.maxDown - SWING.minDown;
  return Math.min(Math.max((peak - SWING.minDown) / span, 0), 1);
}

/**
 * Downward acceleration in m/s^2, from the device frame. Z points out of the
 * screen, so with the phone flat it points at the sky and a downward drive
 * reads as negative Z. Safari and Chrome disagree on the sign of the reported
 * frame, so `sign` is measured per device rather than assumed — see
 * readGravitySign. Upward motion (the lift, or the stop at the bottom) comes
 * back negative and is ignored by the caller.
 */
export function downwardAccel(accel: Vec3, sign: number) {
  return -sign * accel.z;
}

/**
 * +1 where a flat, still phone reports +1g on Z (the spec, and Chrome), -1
 * where it reports -1g (Safari). Only trust it while the phone is near still,
 * when gravity dominates the reading; otherwise keep the last known value.
 */
export function readGravitySign(event: DeviceMotionEvent, current: number) {
  const z = event.accelerationIncludingGravity?.z;
  if (typeof z !== "number" || Math.abs(z) < 5) return current;
  return z > 0 ? 1 : -1;
}

/** Linear acceleration, with a low-passed gravity estimate where a device only
 *  reports accelerationIncludingGravity. */
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

function magnitude(accel: Vec3) {
  return Math.hypot(accel.x, accel.y, accel.z);
}

/**
 * Listens to raw devicemotion and reports one swing. The shared controller
 * pipeline integrates acceleration into a damped position, which throws away
 * exactly the peak this needs, so the pad reads the sensor itself.
 */
export function useSwingDetector({
  active,
  aimedDown,
  onSwing,
}: {
  active: boolean;
  aimedDown: boolean;
  onSwing: (power: number, peak: number) => void;
}) {
  const [phase, setPhase] = useState<SwingPhase>("idle");
  // Always mirrors `phase`, so the sensor callback can read it without a
  // re-subscribe. Only toPhase writes it, which keeps the two in sync.
  const phaseRef = useRef<SwingPhase>("idle");
  const aimedRef = useRef(aimedDown);
  const swingRef = useRef(onSwing);
  const stillSince = useRef(0);
  const capture = useRef({ startedAt: 0, peak: 0 });
  const gravity = useRef<Vec3>({ x: 0, y: 0, z: 0 });
  const gravitySign = useRef(1);

  useEffect(() => {
    aimedRef.current = aimedDown;
  }, [aimedDown]);

  useEffect(() => {
    swingRef.current = onSwing;
  }, [onSwing]);

  useEffect(() => {
    if (!active) return;

    const toPhase = (next: SwingPhase) => {
      if (phaseRef.current === next) return;
      phaseRef.current = next;
      setPhase(next);
    };

    stillSince.current = 0;
    capture.current = { startedAt: 0, peak: 0 };
    gravity.current = { x: 0, y: 0, z: 0 };

    const onMotion = (event: DeviceMotionEvent) => {
      const accel = readAccel(event, gravity.current);
      if (!accel) return;
      const mag = magnitude(accel);
      const down = downwardAccel(accel, gravitySign.current);
      const now = Date.now();

      if (phaseRef.current === "capturing") {
        // Only the downward drive counts. Tilting the phone swings its Z axis
        // away from the floor, and the lift and the stop both read negative,
        // so none of them can pad the score.
        capture.current.peak = Math.max(capture.current.peak, down);
        if (now - capture.current.startedAt < SWING.captureMs) return;
        const peak = capture.current.peak;
        toPhase("idle");
        swingRef.current(peakToPower(peak), peak);
        return;
      }

      if (!aimedRef.current) {
        stillSince.current = 0;
        toPhase("aim");
        return;
      }

      if (phaseRef.current === "ready" && down >= SWING.startDown) {
        capture.current = { startedAt: now, peak: down };
        toPhase("capturing");
        return;
      }

      if (mag < SWING.stillMax) {
        // Flat and still: gravity dominates, so this is when the device's sign
        // convention can be read.
        gravitySign.current = readGravitySign(event, gravitySign.current);
        if (!stillSince.current) stillSince.current = now;
        toPhase(now - stillSince.current >= SWING.stillMs ? "ready" : "steady");
        return;
      }

      stillSince.current = 0;
      toPhase("steady");
    };

    window.addEventListener("devicemotion", onMotion, true);
    return () => {
      window.removeEventListener("devicemotion", onMotion, true);
    };
  }, [active]);

  // Masked rather than reset in the effect: a turn that ends mid-capture must
  // not leave a stale phase on screen.
  return active ? phase : "idle";
}
