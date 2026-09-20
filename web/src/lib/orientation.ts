import * as THREE from "three";
import type { CalibratedPose, GyroSample } from "./protocol";

// q1 is the DeviceOrientationControls screen-to-camera correction (-90° X).
// Relative pose is used as the wand world rotation, so identity aims at the
// wall. A 180° Y "front" term on both sample and calib conjugates tilt and
// inverts phone motion — do not put that in this map. Point the front of the
// phone at the TV, then calibrate.

const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const euler = new THREE.Euler();

export function setDeviceQuaternion(
  out: THREE.Quaternion,
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
) {
  euler.set(
    THREE.MathUtils.degToRad(betaDeg),
    THREE.MathUtils.degToRad(alphaDeg),
    THREE.MathUtils.degToRad(-gammaDeg),
    "YXZ",
  );
  out.setFromEuler(euler);
  out.multiply(q1);
  return out;
}

export function setRelativeQuaternion(
  out: THREE.Quaternion,
  sample: GyroSample,
  calib: CalibratedPose | null,
  scratch: THREE.Quaternion,
) {
  setDeviceQuaternion(out, sample.alpha, sample.beta, sample.gamma);
  if (!calib) return out;
  setDeviceQuaternion(scratch, calib.alpha, calib.beta, calib.gamma);
  out.premultiply(scratch.invert());
  return out;
}

export function emptyPosition() {
  return { x: 0, y: 0, z: 0 };
}

export function readOrientationEvent(event: DeviceOrientationEvent): GyroSample {
  return {
    alpha: event.alpha ?? 0,
    beta: event.beta ?? 0,
    gamma: event.gamma ?? 0,
    ...emptyPosition(),
    timestamp: Date.now(),
  };
}

export type PositionState = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  lastMs: number;
};

const worldAccel = new THREE.Vector3();

export function createPositionState(): PositionState {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, lastMs: 0 };
}

export function resetPosition(state: PositionState) {
  state.x = 0;
  state.y = 0;
  state.z = 0;
  state.vx = 0;
  state.vy = 0;
  state.vz = 0;
  state.lastMs = 0;
}

export function stepPosition(
  state: PositionState,
  accel: { x: number; y: number; z: number },
  now: number,
  worldQuat: THREE.Quaternion,
) {
  const dt = state.lastMs ? Math.min((now - state.lastMs) / 1000, 0.04) : 1 / 60;
  state.lastMs = now;
  worldAccel.set(accel.x, accel.y, accel.z).applyQuaternion(worldQuat);
  const dead = 0.2;
  if (Math.abs(worldAccel.x) < dead) worldAccel.x = 0;
  if (Math.abs(worldAccel.y) < dead) worldAccel.y = 0;
  if (Math.abs(worldAccel.z) < dead) worldAccel.z = 0;
  state.vx = state.vx * 0.88 + worldAccel.x * dt;
  state.vy = state.vy * 0.88 + worldAccel.y * dt;
  state.vz = state.vz * 0.88 + worldAccel.z * dt;
  const scale = 2.6;
  state.x = THREE.MathUtils.clamp(state.x + state.vx * dt * scale, -1.6, 1.6);
  state.y = THREE.MathUtils.clamp(state.y + state.vy * dt * scale, -1.0, 1.2);
  state.z = THREE.MathUtils.clamp(state.z + state.vz * dt * scale, -1.4, 1.0);
  return state;
}

export function readLinearAcceleration(event: DeviceMotionEvent) {
  const linear = event.acceleration;
  if (linear && (linear.x != null || linear.y != null || linear.z != null)) {
    return {
      x: linear.x ?? 0,
      y: linear.y ?? 0,
      z: linear.z ?? 0,
    };
  }
  return null;
}

type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

type MotionConstructor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

export async function requestMotionPermission() {
  const DOE = DeviceOrientationEvent as OrientationConstructor;
  const DME = DeviceMotionEvent as MotionConstructor;
  if (typeof DOE.requestPermission === "function") {
    const state = await DOE.requestPermission();
    if (state !== "granted") {
      throw new Error("Motion permission was denied");
    }
  }
  if (typeof DME.requestPermission === "function") {
    const state = await DME.requestPermission();
    if (state !== "granted") {
      throw new Error("Motion permission was denied");
    }
  }
}
