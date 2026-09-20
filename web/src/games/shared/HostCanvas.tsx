"use client";

import { useTexture } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, type ReactNode } from "react";
import * as THREE from "three";

function FieldBackdrop() {
  const texture = useTexture("/field.jpg");
  texture.colorSpace = THREE.SRGBColorSpace;
  return <primitive attach="background" object={texture} />;
}

export function HostCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0">
      <Canvas
        className="h-full w-full"
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <FieldBackdrop />
        </Suspense>
        {children}
      </Canvas>
    </div>
  );
}
