"use client";

type ShadowLightProps = {
  position: [number, number, number];
  intensity: number;
  coverage?: number;
};

export function ShadowLight({
  position,
  intensity,
  coverage = 12,
}: ShadowLightProps) {
  return (
    <directionalLight
      position={position}
      intensity={intensity}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.00035}
      shadow-normalBias={0.035}
      shadow-camera-near={0.4}
      shadow-camera-far={48}
      shadow-camera-left={-coverage}
      shadow-camera-right={coverage}
      shadow-camera-top={coverage}
      shadow-camera-bottom={-coverage}
    />
  );
}
