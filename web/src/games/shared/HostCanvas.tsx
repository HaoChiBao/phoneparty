"use client";

import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";

export function HostCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0">
      <Canvas
        className="h-full w-full"
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
      >
        {children}
      </Canvas>
    </div>
  );
}
