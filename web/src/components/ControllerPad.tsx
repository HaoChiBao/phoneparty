"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { readOrientationEvent, requestMotionPermission } from "@/lib/orientation";
import type { GyroSample } from "@/lib/protocol";
import { usePartySocket } from "@/lib/usePartySocket";

export function ControllerPad({ code }: { code: string }) {
  const { socketRef, connected, error, players, selfId } = usePartySocket(
    code,
    "controller",
  );
  const [motionReady, setMotionReady] = useState(false);
  const [motionError, setMotionError] = useState<string | null>(null);
  const [sample, setSample] = useState<GyroSample | null>(null);
  const latest = useRef<GyroSample | null>(null);
  const self = players.find((player) => player.id === selfId);
  const accent = self?.color ?? "#0057FF";

  useEffect(() => {
    if (!motionReady) return;
    const onOrient = (event: DeviceOrientationEvent) => {
      const next = readOrientationEvent(event);
      latest.current = next;
      setSample(next);
      socketRef.current?.emit("gyro", next);
    };
    window.addEventListener("deviceorientation", onOrient, true);
    return () => {
      window.removeEventListener("deviceorientation", onOrient, true);
    };
  }, [motionReady, socketRef]);

  async function enableMotion() {
    try {
      await requestMotionPermission();
      setMotionReady(true);
      setMotionError(null);
    } catch (err) {
      setMotionError(err instanceof Error ? err.message : "Motion unavailable");
    }
  }

  function aimFromPointer(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const next: GyroSample = {
      alpha: 0,
      beta: (0.5 - y) * 80,
      gamma: (x - 0.5) * 80,
      timestamp: Date.now(),
    };
    latest.current = next;
    setSample(next);
    socketRef.current?.emit("gyro", next);
    setMotionReady(true);
  }

  function calibrate() {
    const pose = latest.current;
    if (!pose) return;
    socketRef.current?.emit("calibrate", {
      alpha: pose.alpha,
      beta: pose.beta,
      gamma: pose.gamma,
    });
  }

  return (
    <div className="flex min-h-dvh flex-col justify-between bg-white px-5 py-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
          Phone controller
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">{code}</h1>
        <p className="mt-2 text-sm text-black/60">
          {connected
            ? "You are in the room. Enable motion, point at the TV, then calibrate."
            : "Joining the room…"}
        </p>
        {(error || motionError) && (
          <p className="mt-3 text-sm text-accent">{error ?? motionError}</p>
        )}
      </header>

      <div className="flex flex-col items-center gap-5">
        <button
          type="button"
          aria-label="Aim pad"
          className="h-40 w-[88px] touch-none border-2 bg-white"
          onPointerMove={aimFromPointer}
          onPointerDown={aimFromPointer}
          style={{
            borderColor: accent,
            transform: sample
              ? `rotate(${sample.gamma * 0.8}deg)`
              : undefined,
          }}
        >
          <div
            className="mx-auto mt-3 h-3 w-3 rounded-full"
            style={{ background: accent }}
          />
        </button>
        <p className="text-xs tracking-wide text-black/40">
          {sample
            ? `${sample.beta.toFixed(0)}°  ${sample.gamma.toFixed(0)}°`
            : "No gyro yet"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {!motionReady ? (
          <button
            type="button"
            onClick={enableMotion}
            className="h-12 bg-accent text-[15px] font-medium text-white"
          >
            Enable motion
          </button>
        ) : (
          <button
            type="button"
            onClick={calibrate}
            className="h-12 border border-black text-[15px] font-medium"
          >
            Calibrate at the TV
          </button>
        )}
        <p className="text-center text-xs text-black/40">
          iPhones need HTTPS and a tap before the gyro streams. On a computer,
          drag on the remote to aim.
        </p>
      </div>
    </div>
  );
}
