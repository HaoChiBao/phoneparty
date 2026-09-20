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

  function aimFromPointer(event: PointerEvent<HTMLDivElement>) {
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
    <div
      className="flex min-h-dvh flex-col justify-between bg-[#14150f] px-5 py-6 text-[#f4f1e6]"
      style={{ background: `radial-gradient(circle at top, ${self?.color ?? "#c4f542"}22, #14150f 42%)` }}
    >
      <header>
        <p className="text-xs uppercase tracking-[0.28em] text-[#c4f542]">
          Controller
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{code}</h1>
        <p className="mt-2 text-sm text-[#d7d3c4]">
          {connected
            ? "You are in the session. Enable motion, point at the TV, then calibrate."
            : "Joining the session…"}
        </p>
        {(error || motionError) && (
          <p className="mt-3 text-sm text-[#ff6b8a]">{error ?? motionError}</p>
        )}
      </header>

      <div className="flex flex-col items-center gap-6">
        <button
          type="button"
          aria-label="Aim pad"
          className="h-36 w-20 touch-none rounded-[1.6rem] border-2 bg-[#1c1d16] shadow-inner"
          onPointerMove={aimFromPointer}
          onPointerDown={aimFromPointer}
          style={{
            borderColor: self?.color ?? "#c4f542",
            transform: sample
              ? `rotate(${sample.gamma * 0.8}deg) rotateX(${sample.beta * 0.25}deg)`
              : undefined,
          }}
        >
          <div
            className="mx-auto mt-3 h-4 w-4 rounded-full"
            style={{ background: self?.color ?? "#c4f542" }}
          />
        </button>
        <p className="font-mono text-xs text-[#9d9a8c]">
          {sample
            ? `α ${sample.alpha.toFixed(0)}  β ${sample.beta.toFixed(0)}  γ ${sample.gamma.toFixed(0)}`
            : "No gyro yet"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {!motionReady ? (
          <button
            type="button"
            onClick={enableMotion}
            className="rounded-full bg-[#c4f542] px-5 py-4 text-base font-semibold text-[#14150f]"
          >
            Enable motion
          </button>
        ) : (
          <button
            type="button"
            onClick={calibrate}
            className="rounded-full bg-[#f4f1e6] px-5 py-4 text-base font-semibold text-[#14150f]"
          >
            Calibrate at the TV
          </button>
        )}
        <p className="text-center text-xs text-[#9d9a8c]">
          iPhones need HTTPS and a tap before the gyro will stream. On a
          computer, drag on the remote to aim.
        </p>
      </div>
    </div>
  );
}
