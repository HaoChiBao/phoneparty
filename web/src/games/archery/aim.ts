"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { setRelativeQuaternion } from "@/lib/orientation";
import type { CalibratedPose, GyroSample } from "@/lib/protocol";

/** Tunables for aiming. Retune here after a real-phone pass. */
export const AIM = {
  // Tilt that moves the aim from the bullseye to the edge of the target face.
  degreesToEdge: 14,
  // How long the shot must stay steady before the arrow looses.
  holdSeconds: 5,
  // Aim drift, in degrees per second, that still counts as steady.
  steadyDegPerSec: 16,
  // A shaky moment costs this many times the time it would have gained.
  decay: 2.5,
  tickMs: 50,
} as const;

export type Aim = { x: number; y: number; xDeg: number; yDeg: number };

export const CENTER_AIM: Aim = { x: 0, y: 0, xDeg: 0, yDeg: 0 };

const quat = new THREE.Quaternion();
const scratch = new THREE.Quaternion();
const dir = new THREE.Vector3();

/**
 * Where the BACK of the phone points, relative to the pose captured when the
 * player tapped Ready. The shared pipeline aims out the phone's front face
 * (Wand.tsx uses local -Z) because those games point the screen at the TV. An
 * archer holds the phone with the screen toward themselves, so this aims out
 * the back — local +Z — then flips into TV space, where the target sits down -Z.
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
  dir.set(0, 0, 1).applyQuaternion(quat);
  // 180 degrees about Y, so the phone's back looks into the screen.
  // Y is negated too: the relative frame reports pitch opposite to the earth
  // frame, where the back direction is (0, -cos beta, -sin beta) — upright
  // (beta 90) points at the TV and flat (beta 0) points at the floor. Without
  // this, tipping the phone up would drop the aim.
  const x = -dir.x;
  const y = -dir.y;
  // Clamped so aiming past 90 degrees stays far off target instead of
  // wrapping back through the bullseye.
  const forward = Math.max(-(-dir.z), 0.05);
  const xDeg = THREE.MathUtils.radToDeg(Math.atan2(x, forward));
  const yDeg = THREE.MathUtils.radToDeg(Math.atan2(y, forward));
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

    const id = setInterval(() => {
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
        releaseRef.current(aim);
      }
    }, AIM.tickMs);

    return () => clearInterval(id);
  }, [active, aimRef]);

  // Masked rather than reset inside the effect, so a turn that ends mid-draw
  // cannot leave a half-full bar on screen.
  return active ? state : IDLE_HOLD;
}
