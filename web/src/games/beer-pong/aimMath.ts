import * as THREE from "three";
import { setRelativeQuaternion } from "@/lib/orientation";
import type { CalibratedPose, GyroSample } from "@/lib/protocol";
import { TABLE } from "./layout";
import { aimOnTable } from "./physics";
import type { ThrowTune } from "./tune";

export type AimReadout = {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  hit: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
};

const ORIGIN_X = 0.25;
const ORIGIN_Y = 1.85;
const ORIGIN_Y_SCALE = 0.2;
const ORIGIN_Z = 2.7;
const ORIGIN_Z_SCALE = 0.15;

export function createAimScratch() {
  return {
    quaternion: new THREE.Quaternion(),
    calibQ: new THREE.Quaternion(),
    origin: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    hit: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    euler: new THREE.Euler(),
  };
}

export type AimScratch = ReturnType<typeof createAimScratch>;

export function computeAim(
  sample: GyroSample,
  calib: CalibratedPose | null,
  tune: ThrowTune,
  scratch: AimScratch,
  view?: { position: THREE.Vector3; quaternion: THREE.Quaternion },
): AimReadout {
  setRelativeQuaternion(scratch.quaternion, sample, calib, scratch.calibQ);
  scratch.direction
    .set(0, -tune.tilt, -1)
    .normalize()
    .applyQuaternion(scratch.quaternion);
  scratch.direction.x *= tune.aimGain;
  scratch.direction.z *= tune.aimGain;
  scratch.direction.normalize();
  if (view) {
    scratch.direction.applyQuaternion(view.quaternion);
    scratch.origin.copy(view.position);
    scratch.offset.set(
      sample.x * ORIGIN_X * tune.posGain,
      sample.y * ORIGIN_Y_SCALE * tune.posGain,
      sample.z * ORIGIN_Z_SCALE * tune.posGain,
    );
    scratch.offset.applyQuaternion(view.quaternion);
    scratch.origin.add(scratch.offset);
  } else {
    scratch.origin.set(
      sample.x * ORIGIN_X * tune.posGain,
      ORIGIN_Y + sample.y * ORIGIN_Y_SCALE * tune.posGain,
      ORIGIN_Z + sample.z * ORIGIN_Z_SCALE * tune.posGain,
    );
  }
  aimOnTable(scratch.origin, scratch.direction, scratch.hit);
  scratch.hit.x = THREE.MathUtils.clamp(
    scratch.hit.x,
    -TABLE.length / 2 - 0.15,
    TABLE.length / 2 + 0.15,
  );
  scratch.hit.z = THREE.MathUtils.clamp(
    scratch.hit.z,
    -TABLE.width / 2 - 0.12,
    TABLE.width / 2 + 0.12,
  );
  scratch.euler.setFromQuaternion(scratch.quaternion, "YXZ");
  return {
    origin: scratch.origin,
    direction: scratch.direction,
    hit: scratch.hit,
    yaw: THREE.MathUtils.radToDeg(scratch.euler.y),
    pitch: THREE.MathUtils.radToDeg(scratch.euler.x),
    roll: THREE.MathUtils.radToDeg(scratch.euler.z),
  };
}

export type AimSnapshot = {
  yaw: number;
  pitch: number;
  roll: number;
  hitX: number;
  hitZ: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  originX: number;
  originY: number;
  originZ: number;
};

export function snapshotAim(readout: AimReadout): AimSnapshot {
  return {
    yaw: readout.yaw,
    pitch: readout.pitch,
    roll: readout.roll,
    hitX: readout.hit.x,
    hitZ: readout.hit.z,
    dirX: readout.direction.x,
    dirY: readout.direction.y,
    dirZ: readout.direction.z,
    originX: readout.origin.x,
    originY: readout.origin.y,
    originZ: readout.origin.z,
  };
}
