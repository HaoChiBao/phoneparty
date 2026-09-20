"use client";

import { forwardRef, useMemo } from "react";
import * as THREE from "three";

let sharedGrain: THREE.CanvasTexture | null = null;

function getGrainTexture() {
  if (typeof document === "undefined") return null;
  if (sharedGrain) return sharedGrain;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = 188 + Math.floor(Math.random() * 67);
    image.data[i] = n;
    image.data[i + 1] = n;
    image.data[i + 2] = n;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  sharedGrain = new THREE.CanvasTexture(canvas);
  sharedGrain.wrapS = THREE.RepeatWrapping;
  sharedGrain.wrapT = THREE.RepeatWrapping;
  sharedGrain.repeat.set(4, 4);
  sharedGrain.colorSpace = THREE.LinearSRGBColorSpace;
  sharedGrain.needsUpdate = true;
  return sharedGrain;
}

export function useGrainMap() {
  return useMemo(() => getGrainTexture(), []);
}

type MatteMaterialProps = {
  color: string;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
};

export const MatteMaterial = forwardRef<
  THREE.MeshStandardMaterial,
  MatteMaterialProps
>(function MatteMaterial({ color, transparent, opacity, side }, ref) {
  const grain = useGrainMap();
  return (
    <meshStandardMaterial
      ref={ref}
      color={color}
      bumpMap={grain ?? undefined}
      bumpScale={0.08}
      roughness={0.96}
      metalness={0}
      transparent={transparent}
      opacity={opacity}
      side={side}
    />
  );
});
