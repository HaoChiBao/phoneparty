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
  stillMax: 3.5, // m/s^2 that still counts as holding the hammer steady
  stillMs: 280,
  startMag: 12, // m/s^2 that opens a capture window
  captureMs: 500,
  minPeak: 12, // maps to power 0
  maxPeak: 45, // maps to power 1
} as const;

export type SwingPhase = "idle" | "aim" | "steady" | "ready" | "capturing";

export function isAimedDown(sample: GyroSample | null) {
  if (!sample) return false;
  return (
    Math.abs(sample.beta) < SWING.aimBetaMax &&
    Math.abs(sample.gamma) < SWING.aimGammaMax
  );
}

export function peakToPower(peak: number) {
  const span = SWING.maxPeak - SWING.minPeak;
  return Math.min(Math.max((peak - SWING.minPeak) / span, 0), 1);
}

type Vec3 = { x: number; y: number; z: number };

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
      const now = Date.now();

      if (phaseRef.current === "capturing") {
        capture.current.peak = Math.max(capture.current.peak, mag);
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

      if (phaseRef.current === "ready" && mag >= SWING.startMag) {
        capture.current = { startedAt: now, peak: mag };
        toPhase("capturing");
        return;
      }

      if (mag < SWING.stillMax) {
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
