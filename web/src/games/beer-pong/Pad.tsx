"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { GamePadProps } from "@/games/types";
import { createFlickState, readFlickAccel, stepFlick, swipeFlick } from "./flick";

export function BeerPongPad({
  sendAction,
  sample,
  calib,
  onCalibrate,
  motionReady,
  capturingMotion = false,
}: GamePadProps) {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState("Calibrate at the TV, then flick.");
  const flick = useRef(createFlickState());
  const swipe = useRef<{ y: number; t: number } | null>(null);
  const sendRef = useRef(sendAction);
  sendRef.current = sendAction;
  const ready = Boolean(calib);

  function fire(power: number, peak: number, ax: number, ay: number, az: number) {
    if (!ready) {
      setStatus("Calibrate at the TV first.");
      return;
    }
    sendRef.current("throw", { power, peak, ax, ay, az });
    setStatus(`Flick ${peak.toFixed(0)} · nudge ${ax.toFixed(1)}, ${ay.toFixed(1)}`);
  }

  useEffect(() => {
    if (!ready) setStatus("Calibrate at the TV, then flick.");
    else setStatus("Flick. A straight throw aims at the middle cups.");
  }, [ready]);

  useEffect(() => {
    if (capturingMotion) return;
    const onMotion = (event: DeviceMotionEvent) => {
      const accel = readFlickAccel(event);
      if (!accel) return;
      const result = stepFlick(flick.current, accel, Date.now());
      if (result) fire(result.power, result.peak, result.ax, result.ay, result.az);
    };
    window.addEventListener("devicemotion", onMotion, true);
    return () => window.removeEventListener("devicemotion", onMotion, true);
  }, [capturingMotion, ready]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    swipe.current = { y: event.clientY, t: Date.now() };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Desktop automation and some browsers skip capture.
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (capturingMotion) {
      swipe.current = null;
      return;
    }
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const result = swipeFlick(start.y, event.clientY, start.t, Date.now());
    if (result) fire(result.power, result.peak, result.ax, result.ay, result.az);
  }

  function toggleTest() {
    const next = !testing;
    setTesting(next);
    sendAction("test", { on: next });
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      {!ready ? (
        <button
          type="button"
          onClick={onCalibrate}
          disabled={!motionReady}
          className="h-12 bg-accent text-[15px] font-medium text-white disabled:opacity-40"
        >
          {motionReady ? "Calibrate at the TV" : "Enable motion first"}
        </button>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        aria-label="Flick to throw"
        className="flex h-36 touch-none flex-col items-center justify-center bg-accent px-4 text-white"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        <p className="text-lg font-medium">{ready ? "Flick" : "Calibrate first"}</p>
        <p className="mt-1 text-center text-xs leading-4 text-white/80">
          {ready
            ? "Throw with the phone, or swipe up here."
            : "Hold the phone toward the TV, then calibrate."}
        </p>
      </div>
      <p className="text-center text-xs leading-4 text-black/45">{status}</p>
      <button
        type="button"
        onClick={toggleTest}
        className={
          testing
            ? "h-11 bg-black text-[15px] font-medium text-white"
            : "h-11 border border-black text-[15px] font-medium"
        }
      >
        {testing ? "Test mode on" : "Test mode"}
      </button>
      {testing ? (
        <>
          <button
            type="button"
            onClick={() => sendAction("resetCups")}
            className="h-11 border border-black/20 text-[15px] font-medium"
          >
            Reset cups
          </button>
          {sample ? (
            <p className="text-center font-mono text-[11px] text-black/55">
              α {sample.alpha.toFixed(1)} β {sample.beta.toFixed(1)} γ {sample.gamma.toFixed(1)}
              <br />
              xyz {sample.x.toFixed(2)} {sample.y.toFixed(2)} {sample.z.toFixed(2)}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
