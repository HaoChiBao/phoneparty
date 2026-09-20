import * as THREE from "three";
import { setRelativeQuaternion } from "@/lib/orientation";
import type { CalibratedPose, GyroSample } from "@/lib/protocol";
import { CUP, FRONT_X, TABLE, liveCups, type CupSlot, type TeamId } from "./layout";
import type { ThrowTune } from "./tune";

const scratchQ = new THREE.Quaternion();
const scratchCalib = new THREE.Quaternion();
const scratchEuler = new THREE.Euler();

const MAX_LATERAL = 0.2;
const MAX_DEPTH = 0.24;

export type FlickVec = {
  power: number;
  peak: number;
  ax: number;
  ay: number;
  az: number;
};

export type ThrowReadout = {
  yaw: number;
  pitch: number;
  roll: number;
  lateral: number;
  depth: number;
  targetX: number;
  targetZ: number;
};

export function enemyTeam(team: TeamId): TeamId {
  return team === "a" ? "b" : "a";
}

export function rackCenter(cups: CupSlot[], team: TeamId) {
  const live = liveCups(cups, team);
  if (live.length === 0) {
    const sign = team === "a" ? -1 : 1;
    return { x: sign * FRONT_X, z: 0 };
  }
  let x = 0;
  let z = 0;
  for (const cup of live) {
    x += cup.x;
    z += cup.z;
  }
  return { x: x / live.length, z: z / live.length };
}

export function relativeTwist(sample: GyroSample, calib: CalibratedPose) {
  setRelativeQuaternion(scratchQ, sample, calib, scratchCalib);
  scratchEuler.setFromQuaternion(scratchQ, "YXZ");
  return {
    yaw: THREE.MathUtils.radToDeg(scratchEuler.y),
    pitch: THREE.MathUtils.radToDeg(scratchEuler.x),
    roll: THREE.MathUtils.radToDeg(scratchEuler.z),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function throwNudge(
  sample: GyroSample | undefined,
  calib: CalibratedPose,
  team: TeamId,
  cups: CupSlot[],
  flick: FlickVec,
  tune: ThrowTune,
): ThrowReadout {
  const twist = sample ? relativeTwist(sample, calib) : { yaw: 0, pitch: 0, roll: 0 };
  const px = sample?.x ?? 0;
  const pz = sample?.z ?? 0;
  const flickScale = 0.7 + 0.3 * clamp(flick.power, 0.4, 2.2);
  let lateral =
    -twist.yaw * 0.007 * tune.aimGain +
    px * 0.06 * tune.posGain +
    flick.ax * 0.007;
  let depth =
    -twist.pitch * 0.008 * tune.tilt +
    pz * 0.06 * tune.posGain +
    (flick.ay * 0.004 + flick.az * 0.005);
  lateral = clamp(lateral * flickScale, -MAX_LATERAL, MAX_LATERAL);
  depth = clamp(depth * flickScale, -MAX_DEPTH, MAX_DEPTH);
  const center = rackCenter(cups, enemyTeam(team));
  const facing = team === "a" ? 1 : -1;
  return {
    ...twist,
    lateral,
    depth,
    targetX: center.x + depth * facing,
    targetZ: center.z + lateral * facing,
  };
}

export function throwTarget(readout: ThrowReadout) {
  return new THREE.Vector3(
    readout.targetX,
    TABLE.height + CUP.height + 0.008,
    readout.targetZ,
  );
}

export function parseFlick(data: unknown): FlickVec {
  if (typeof data !== "object" || data === null) {
    return { power: 1, peak: 0, ax: 0, ay: 0, az: 0 };
  }
  const raw = data as Record<string, unknown>;
  const num = (key: string, fallback = 0) => {
    const value = Number(raw[key]);
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    power: clamp(num("power", 1), 0.3, 2.4),
    peak: num("peak"),
    ax: clamp(num("ax"), -40, 40),
    ay: clamp(num("ay"), -40, 40),
    az: clamp(num("az"), -40, 40),
  };
}

export function sampleFromThrow(
  data: unknown,
  fallback?: GyroSample,
): GyroSample | undefined {
  if (typeof data !== "object" || data === null) return fallback;
  const raw = data as Record<string, unknown>;
  const num = (key: string) => {
    const value = Number(raw[key]);
    return Number.isFinite(value) ? value : null;
  };
  const alpha = num("alpha");
  const beta = num("beta");
  const gamma = num("gamma");
  if (alpha === null && beta === null && gamma === null) return fallback;
  return {
    alpha: alpha ?? fallback?.alpha ?? 0,
    beta: beta ?? fallback?.beta ?? 0,
    gamma: gamma ?? fallback?.gamma ?? 0,
    x: num("x") ?? fallback?.x ?? 0,
    y: num("y") ?? fallback?.y ?? 0,
    z: num("z") ?? fallback?.z ?? 0,
    timestamp: num("timestamp") ?? fallback?.timestamp ?? Date.now(),
  };
}

export function throwPayload(
  flick: FlickVec,
  sample: GyroSample | null,
): Record<string, number> {
  return {
    power: flick.power,
    peak: flick.peak,
    ax: flick.ax,
    ay: flick.ay,
    az: flick.az,
    alpha: sample?.alpha ?? 0,
    beta: sample?.beta ?? 0,
    gamma: sample?.gamma ?? 0,
    x: sample?.x ?? 0,
    y: sample?.y ?? 0,
    z: sample?.z ?? 0,
    timestamp: sample?.timestamp ?? Date.now(),
  };
}
