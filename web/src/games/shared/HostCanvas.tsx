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

const FIELD_SRC = "/field.jpg";

// CSS background-size:cover never stretches. An <img> with width+height 100%
// uses object-fit:fill until the file's aspect is known, which is why the
// field looked stretched on first load and normal after a reload (cached).
const wrapStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  backgroundColor: "#87c4ef",
  backgroundImage: `url(${FIELD_SRC})`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center center",
  backgroundSize: "cover",
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

export function HostCanvas({ children }: { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

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
    <div ref={wrap} style={wrapStyle}>
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
          }}
        >
          <FitView />
          {children}
        </Canvas>
      ) : null}
    </div>
  );
}
