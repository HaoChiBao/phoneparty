"use client";

import { Canvas, useThree } from "@react-three/fiber";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { useCanvasReady } from "./canvasReady";

const FIELD_VIDEO = "/game_bg.mp4";

// object-fit:cover on the video matches the old CSS background-size:cover, so
// the field never stretches when the TV aspect does not match the clip.
const wrapStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  backgroundColor: "#87c4ef",
};

function applyPerspectiveAspect(camera: THREE.Camera, width: number, height: number) {
  if (width < 2 || height < 2) return;
  if (!(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return;
  const cam = camera as THREE.PerspectiveCamera;
  const aspect = width / height;
  if (Math.abs(cam.aspect - aspect) < 1e-5) return;
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
}

/** Keep the drawing buffer and camera aspect matched to the TV, not the default 300×150 canvas. */
function FitView() {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const setSize = useThree((state) => state.setSize);

  useLayoutEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;

    const fit = () => {
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      if (width < 2 || height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      gl.setPixelRatio(dpr);
      gl.setSize(width, height);
      setSize(width, height);
      gl.domElement.style.width = "100%";
      gl.domElement.style.height = "100%";
      gl.domElement.style.display = "block";
      applyPerspectiveAspect(camera, width, height);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, [gl, camera, setSize]);

  return null;
}

function FieldVideo() {
  const video = useRef<HTMLVideoElement>(null);

  useLayoutEffect(() => {
    const el = video.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.volume = 0;
    void el.play().catch(() => {});
  }, []);

  return (
    <video
      ref={video}
      src={FIELD_VIDEO}
      autoPlay
      muted
      loop
      playsInline
      disablePictureInPicture
      controls={false}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
    />
  );
}

export function HostCanvas({
  children,
  backgroundSrc,
}: {
  children: ReactNode;
  backgroundSrc?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const reportReady = useCanvasReady();

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;

    const measure = () => {
      if (el.clientWidth >= 2 && el.clientHeight >= 2) setReady(true);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  return (
    <div
      ref={wrap}
      style={{
        ...wrapStyle,
        ...(backgroundSrc
          ? {
              backgroundImage: `url(${backgroundSrc})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
              backgroundSize: "cover",
            }
          : {}),
      }}
    >
      {backgroundSrc ? null : <FieldVideo />}
      {ready ? (
        <Canvas
          className="absolute inset-0 block h-full w-full bg-transparent"
          resize={{ debounce: 0, scroll: false }}
          dpr={[1, 2]}
          gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            background: "transparent",
          }}
          onCreated={({ gl, scene, camera, size }) => {
            gl.setClearColor(0x000000, 0);
            scene.background = null;
            applyPerspectiveAspect(camera, size.width, size.height);
            reportReady?.();
          }}
        >
          <FitView />
          {children}
        </Canvas>
      ) : null}
    </div>
  );
}
