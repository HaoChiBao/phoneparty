"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { setRelativeQuaternion } from "@/lib/orientation";
import type { CalibratedPose, GyroSample } from "@/lib/protocol";

/** Tunables for aiming. Retune here after a real-phone pass. */
export const AIM = {
  // Tilt that moves the aim from the bullseye to the edge of the target face.
  degreesToEdge: 10,
  // How long the shot must stay steady before the arrow looses.
  holdSeconds: 5,
  // Aim drift, in degrees per second, that still counts as steady.
  steadyDegPerSec: 16,
  // A shaky moment costs this many times the time it would have gained.
  decay: 2.5,
  tickMs: 50,
  // Smooth sensor noise without making deliberate aiming feel laggy.
  smoothingSeconds: 0.11,
  // Ignore one-frame sensor spikes while preserving a quick real adjustment.
  maxCursorUnitsPerSecond: 9,
} as const;

export type Aim = { x: number; y: number; xDeg: number; yDeg: number };

export const CENTER_AIM: Aim = { x: 0, y: 0, xDeg: 0, yDeg: 0 };

/** Below this the aim is pointing behind the archer. */
const MIN_FORWARD = 0.05;
/** Target radii out: comfortably off the face. */
const BEHIND = 4;

const quat = new THREE.Quaternion();
const scratch = new THREE.Quaternion();
const dir = new THREE.Vector3();

export function smoothAim(previous: Aim, next: Aim, dt: number): Aim {
  const step = Math.max(0, Math.min(dt, 0.1));
  const alpha = 1 - Math.exp(-step / AIM.smoothingSeconds);
  const maxDelta = AIM.maxCursorUnitsPerSecond * step;
  const move = (from: number, to: number) =>
    from + THREE.MathUtils.clamp(to - from, -maxDelta, maxDelta) * alpha;
  const x = move(previous.x, next.x);
  const y = move(previous.y, next.y);
  return {
    x,
    y,
    xDeg: x * AIM.degreesToEdge,
    yDeg: y * AIM.degreesToEdge,
  };
}

/** Low-pass the phone's aim before it reaches a cursor or a scored arrow. */
export function useSmoothedAim(aim: Aim, active: boolean, resetKey: unknown): Aim {
  const [smoothed, setSmoothed] = useState<Aim>(aim);
  const filtered = useRef(aim);
  const lastAt = useRef(0);
  const latestAim = useRef(aim);

  useEffect(() => {
    latestAim.current = aim;
  }, [aim]);

  useEffect(() => {
    const next = latestAim.current;
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
    const next = smoothAim(filtered.current, aim, dt);
    filtered.current = next;
    setSmoothed(next);
  }, [aim, active]);

  return active ? smoothed : aim;
}

/**
 * Where the BACK of the phone points, relative to the pose captured when the
 * player tapped Ready. With only the -90 degree X correction in
 * setDeviceQuaternion, local -Z IS the back of the phone: in the earth frame it
 * is (0, -cos beta, -sin beta), so upright (beta 90) points at the TV and flat
 * (beta 0) points at the floor. The relative frame already lines up with world
 * space, so no axis flips are needed here — and none should be added, for the
 * reason orientation.ts spells out.
 *
 * Returns the offset in degrees and as a fraction of the target radius, where
 * 1 is the outer edge of the face.
 */
export function aimFromSample(
  sample: GyroSample | null,
  zero: CalibratedPose | null,
): Aim {
  if (!sample || !zero) return CENTER_AIM;
  setRelativeQuaternion(quat, sample, zero, scratch);
  dir.set(0, 0, -1).applyQuaternion(quat);
  const forward = -dir.z;
  if (forward <= MIN_FORWARD) {
    // Aimed behind the archer. Turned exactly backwards the lateral components
    // are both zero, which would read as a dead-centre bullseye, so this is
    // forced out to a definite miss instead.
    const lateral = Math.hypot(dir.x, dir.y);
    if (lateral < 1e-6) return { x: 0, y: -BEHIND, xDeg: 0, yDeg: -90 };
    return {
      x: (dir.x / lateral) * BEHIND,
      y: (dir.y / lateral) * BEHIND,
      xDeg: (dir.x / lateral) * 90,
      yDeg: (dir.y / lateral) * 90,
    };
  }
  const xDeg = THREE.MathUtils.radToDeg(Math.atan2(dir.x, forward));
  const yDeg = THREE.MathUtils.radToDeg(Math.atan2(dir.y, forward));
  return {
    x: xDeg / AIM.degreesToEdge,
    y: yDeg / AIM.degreesToEdge,
    xDeg,
    yDeg,
  };
}

/** Ten rings: 10 in the middle, 1 at the edge, 0 off the face. */
export function scoreFromAim(x: number, y: number) {
  const radius = Math.hypot(x, y);
  // The epsilon keeps an arrow exactly on the rim worth 1 instead of the
  // float noise of a hypot rounding it to a miss.
  if (!Number.isFinite(radius) || radius > 1 + 1e-9) return 0;
  return 11 - Math.min(Math.max(Math.ceil(radius * 10), 1), 10);
}

export type HoldState = { hold: number; steady: boolean };

const IDLE_HOLD: HoldState = { hold: 0, steady: false };

function vibrateHold(durationMs: number) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(durationMs);
  } catch {
    // Haptics are optional; a browser restriction must not interrupt the shot.
  }
}

/**
 * Fills while the aim sits still and drains when it wanders. Runs on its own
 * tick rather than on sensor events so the bar moves at a steady rate whatever
 * the device's sample rate is.
 */
export function useSteadyHold({
  active,
  aimRef,
  onRelease,
}: {
  active: boolean;
  aimRef: RefObject<Aim>;
  onRelease: (aim: Aim) => void;
}) {
  const [state, setState] = useState<HoldState>(IDLE_HOLD);
  const releaseRef = useRef(onRelease);

  useEffect(() => {
    releaseRef.current = onRelease;
  }, [onRelease]);

  useEffect(() => {
    if (!active) return;
    const step = AIM.tickMs / 1000;
    let hold = 0;
    let previous = aimRef.current;
    let released = false;
    let pulseIn = 0;
    let wasSteady = false;

    const id = setInterval(() => {
      if (released) return;
      const aim = aimRef.current;
      const drift =
        Math.hypot(aim.xDeg - previous.xDeg, aim.yDeg - previous.yDeg) / step;
      previous = aim;
      const steady = drift <= AIM.steadyDegPerSec;
      hold = steady
        ? Math.min(hold + step, AIM.holdSeconds)
        : Math.max(hold - step * AIM.decay, 0);
      setState({ hold, steady });
      if (!released && hold >= AIM.holdSeconds) {
        released = true;
        vibrateHold(0);
        releaseRef.current(aim);
        return;
      }
      if (steady) {
        pulseIn -= step;
        if (pulseIn <= 0) {
          // Light taps build from every 600ms to every 180ms near release.
          // Keep each pulse short so it does not shake the player's aim.
          vibrateHold(12);
          pulseIn = 0.6 - 0.42 * (hold / AIM.holdSeconds);
        }
      } else {
        if (wasSteady) vibrateHold(0);
        pulseIn = 0;
      }
      wasSteady = steady;
    }, AIM.tickMs);

    return () => {
      clearInterval(id);
      vibrateHold(0);
    };
  }, [active, aimRef]);

  // Masked rather than reset inside the effect, so a turn that ends mid-draw
  // cannot leave a half-full bar on screen.
  return active ? state : IDLE_HOLD;
}
