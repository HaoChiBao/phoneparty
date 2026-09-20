import * as THREE from "three";
import type { CalibratedPose, GyroSample } from "./protocol";

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

export function readOrientationEvent(event: DeviceOrientationEvent): GyroSample {
  return {
    alpha: event.alpha ?? 0,
    beta: event.beta ?? 0,
    gamma: event.gamma ?? 0,
    timestamp: Date.now(),
  };
}

type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

export async function requestMotionPermission() {
  const DOE = DeviceOrientationEvent as OrientationConstructor;
  if (typeof DOE.requestPermission === "function") {
    const state = await DOE.requestPermission();
    if (state !== "granted") {
      throw new Error("Motion permission was denied");
    }
  }
}
