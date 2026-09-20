"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type * as THREE from "three";

/** Eye line stays high so the lower target sits mid-frame when the camera pulls in. */
const CAMERA_Y = 2.2;

/** Wide enough to read the whole lane; the target is a distant disc. */
const OUT = { fov: 55, z: 6.5 };
/** Down the sight, once the archer is drawing. */
const IN = { fov: 24, z: 0.6 };
/** How long the view holds in close after a release, to watch it land. */
const WATCH_MS = 1500;

/**
 * Pulls in when the archer taps Ready and drifts back out once the arrow has
 * landed, so the room sees the range at full size between shots.
 */
export function RangeCamera({
  drawing,
  shotKey,
}: {
  drawing: boolean;
  shotKey: string;
}) {
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const shotAt = useRef(0);

  useEffect(() => {
    // Empty on the first render, so a fresh scene does not open zoomed in.
    if (shotKey) shotAt.current = performance.now();
  }, [shotKey]);

  useFrame((state, delta) => {
    const cam = camera.current;
    if (!cam) return;
    const watching = shotAt.current > 0 && performance.now() - shotAt.current < WATCH_MS;
    const target = drawing || watching ? IN : OUT;
    // Frame-rate independent smoothing, so the move looks the same at 30 or 120fps.
    const k = 1 - Math.pow(0.0016, delta);
    cam.aspect = state.size.width / Math.max(state.size.height, 1);
    cam.fov += (target.fov - cam.fov) * k;
    cam.position.z += (target.z - cam.position.z) * k;
    cam.updateProjectionMatrix();
  });

  return (
    <PerspectiveCamera
      ref={camera}
      makeDefault
      position={[0, CAMERA_Y, OUT.z]}
      fov={OUT.fov}
    />
  );
}
