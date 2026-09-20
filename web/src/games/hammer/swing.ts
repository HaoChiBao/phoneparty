"use client";

import { useEffect, useRef, useState } from "react";
import { readLinearAcceleration } from "@/lib/orientation";
import type { GyroSample } from "@/lib/protocol";

/** Defaults for the swing detector. Sensitivity scales startMag and minPeak. */
export const SWING = {
  // Flat with the screen up means the rear camera faces the floor. beta/gamma
  // are used instead of gravity because Safari and Chrome disagree on the sign
  // of accelerationIncludingGravity, but agree on orientation angles.
  aimBetaMax: 45,
  aimGammaMax: 45,
  stillMax: 3.5,
  stillMs: 280,
  startMag: 12,
  captureMs: 500,
  minPeak: 12,
  maxPeak: 45,
} as const;

export type SwingTune = {
  aimBetaMax: number;
  aimGammaMax: number;
  stillMax: number;
  stillMs: number;
  startMag: number;
  captureMs: number;
  minPeak: number;
  maxPeak: number;
};

export type RestPose = { beta: number; gamma: number };

export type SwingPhase = "idle" | "aim" | "steady" | "ready" | "capturing";

export function isAimedDown(
  sample: GyroSample | null,
  rest?: RestPose | null,
  tune: SwingTune = SWING,
) {
  if (!sample) return false;
  const beta = rest ? sample.beta - rest.beta : sample.beta;
  const gamma = rest ? sample.gamma - rest.gamma : sample.gamma;
  return Math.abs(beta) < tune.aimBetaMax && Math.abs(gamma) < tune.aimGammaMax;
}

export function peakToPower(peak: number, tune: SwingTune = SWING) {
  const span = tune.maxPeak - tune.minPeak;
  if (span <= 0) return 0;
  return Math.min(Math.max((peak - tune.minPeak) / span, 0), 1);
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
 *
 * When `armed` is true (Ready / Test), skip the hold-still gate and wait for a
 * swing. After a hit, wait until the phone settles so the same swing cannot
 * fire twice. When false, the old still-then-ready path stays.
 */
export function useSwingDetector({
  active,
  armed = false,
  aimedDown,
  tune = SWING,
  reportLive = false,
  onSwing,
}: {
  active: boolean;
  armed?: boolean;
  aimedDown: boolean;
  tune?: SwingTune;
  reportLive?: boolean;
  onSwing: (power: number, peak: number) => void;
}) {
  const [phase, setPhase] = useState<SwingPhase>("idle");
  const [liveMag, setLiveMag] = useState(0);
  const phaseRef = useRef<SwingPhase>("idle");
  const aimedRef = useRef(aimedDown);
  const armedRef = useRef(armed);
  const swingRef = useRef(onSwing);
  const tuneRef = useRef(tune);
  const liveRef = useRef(reportLive);
  const stillSince = useRef(0);
  const lastLiveAt = useRef(0);
  const recovering = useRef(false);
  const capture = useRef({ startedAt: 0, peak: 0 });
  const gravity = useRef<Vec3>({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    aimedRef.current = aimedDown;
  }, [aimedDown]);

  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);

  useEffect(() => {
    swingRef.current = onSwing;
  }, [onSwing]);

  useEffect(() => {
    tuneRef.current = tune;
  }, [tune]);

  useEffect(() => {
    liveRef.current = reportLive;
  }, [reportLive]);

  useEffect(() => {
    if (!active) return;

    const toPhase = (next: SwingPhase) => {
      if (phaseRef.current === next) return;
      phaseRef.current = next;
      setPhase(next);
    };

    stillSince.current = 0;
    recovering.current = false;
    capture.current = { startedAt: 0, peak: 0 };
    gravity.current = { x: 0, y: 0, z: 0 };
    phaseRef.current = armedRef.current ? "ready" : "idle";
    setPhase(phaseRef.current);

    const onMotion = (event: DeviceMotionEvent) => {
      const accel = readAccel(event, gravity.current);
      if (!accel) return;
      const mag = magnitude(accel);
      const now = Date.now();
      const nextTune = tuneRef.current;

      if (liveRef.current && now - lastLiveAt.current > 80) {
        lastLiveAt.current = now;
        setLiveMag(mag);
      }

      if (phaseRef.current === "capturing") {
        capture.current.peak = Math.max(capture.current.peak, mag);
        if (now - capture.current.startedAt < nextTune.captureMs) return;
        const peak = capture.current.peak;
        if (armedRef.current) {
          recovering.current = true;
          toPhase("ready");
        } else {
          toPhase("idle");
        }
        swingRef.current(peakToPower(peak, nextTune), peak);
        return;
      }

      if (armedRef.current) {
        toPhase("ready");
        if (recovering.current) {
          if (mag < nextTune.stillMax) recovering.current = false;
          return;
        }
        if (mag >= nextTune.startMag) {
          capture.current = { startedAt: now, peak: mag };
          toPhase("capturing");
        }
        return;
      }

      if (!aimedRef.current) {
        stillSince.current = 0;
        toPhase("aim");
        return;
      }

      if (phaseRef.current === "ready" && mag >= nextTune.startMag) {
        capture.current = { startedAt: now, peak: mag };
        toPhase("capturing");
        return;
      }

      if (mag < nextTune.stillMax) {
        if (!stillSince.current) stillSince.current = now;
        toPhase(now - stillSince.current >= nextTune.stillMs ? "ready" : "steady");
        return;
      }

      stillSince.current = 0;
      toPhase("steady");
    };

    window.addEventListener("devicemotion", onMotion, true);
    return () => {
      window.removeEventListener("devicemotion", onMotion, true);
    };
  }, [active, armed]);

  return {
    phase: active ? phase : "idle",
    liveMag: active && reportLive ? liveMag : 0,
  };
}
