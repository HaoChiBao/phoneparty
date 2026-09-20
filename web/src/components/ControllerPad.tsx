"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import * as THREE from "three";
import {
  createPositionState,
  readLinearAcceleration,
  readOrientationEvent,
  requestMotionPermission,
  resetPosition,
  setRelativeQuaternion,
  stepPosition,
} from "@/lib/orientation";
import { getGame } from "@/games/catalog";
import type { GyroSample } from "@/lib/protocol";
import { usePartySocket } from "@/lib/usePartySocket";

export function ControllerPad({ code }: { code: string }) {
  const {
    socketRef,
    connected,
    error,
    players,
    selfId,
    gameId,
    actionsByPlayer,
    sendGameAction,
  } = usePartySocket(code, "controller");
  const [motionReady, setMotionReady] = useState(false);
  const [motionError, setMotionError] = useState<string | null>(null);
  const [sample, setSample] = useState<GyroSample | null>(null);
  const latest = useRef<GyroSample | null>(null);
  const position = useRef(createPositionState());
  const worldQuat = useRef(new THREE.Quaternion());
  const scratch = useRef(new THREE.Quaternion());
  const self = players.find((player) => player.id === selfId);
  const accent = self?.color ?? "#0057FF";
  const game = getGame(gameId);
  const PadExtra = game.PadExtra;
  const hideAimPad = Boolean(game.hideAimPad);
  const lastAction = selfId ? actionsByPlayer[selfId] : undefined;

  function publish(next: GyroSample) {
    latest.current = next;
    setSample(next);
    socketRef.current?.emit("gyro", next);
  }

  useEffect(() => {
    if (!motionReady) return;

    const onOrient = (event: DeviceOrientationEvent) => {
      const next = readOrientationEvent(event);
      const pos = position.current;
      next.x = pos.x;
      next.y = pos.y;
      next.z = pos.z;
      setRelativeQuaternion(worldQuat.current, next, null, scratch.current);
      publish(next);
    };

    const onMotion = (event: DeviceMotionEvent) => {
      const accel = readLinearAcceleration(event);
      if (!accel) return;
      const now = Date.now();
      stepPosition(position.current, accel, now, worldQuat.current);
      const prev = latest.current;
      publish({
        alpha: prev?.alpha ?? 0,
        beta: prev?.beta ?? 0,
        gamma: prev?.gamma ?? 0,
        x: position.current.x,
        y: position.current.y,
        z: position.current.z,
        timestamp: now,
      });
    };

    window.addEventListener("deviceorientation", onOrient, true);
    window.addEventListener("devicemotion", onMotion, true);
    return () => {
      window.removeEventListener("deviceorientation", onOrient, true);
      window.removeEventListener("devicemotion", onMotion, true);
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
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    const next: GyroSample = {
      alpha: 0,
      beta: (ny - 0.5) * 80,
      gamma: (0.5 - nx) * 80,
      x: (nx - 0.5) * 1.4,
      y: (0.5 - ny) * 1,
      z: 0,
      timestamp: Date.now(),
    };
    position.current.x = next.x;
    position.current.y = next.y;
    position.current.z = next.z;
    publish(next);
    setMotionReady(true);
  }

  function calibrate() {
    const pose = latest.current;
    if (!pose) return;
    resetPosition(position.current);
    const next: GyroSample = {
      ...pose,
      x: 0,
      y: 0,
      z: 0,
      timestamp: Date.now(),
    };
    publish(next);
    socketRef.current?.emit("calibrate", {
      alpha: next.alpha,
      beta: next.beta,
      gamma: next.gamma,
      x: 0,
      y: 0,
      z: 0,
    });
  }

  return (
    <div className="flex min-h-dvh flex-col justify-between bg-white px-5 py-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
          {game.title}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">{code}</h1>
        <p className="mt-2 text-sm text-black/60">
          {!connected
            ? "Joining the room…"
            : hideAimPad
              ? "You are in the room. Enable motion, then follow the prompt below."
              : "You are in the room. Enable motion, point the front of the phone at the TV, then calibrate."}
        </p>
        {(error || motionError) && (
          <p className="mt-3 text-sm text-accent">{error ?? motionError}</p>
        )}
      </header>

      <div className="flex flex-col items-center gap-5">
        {!hideAimPad ? (
          <>
            <button
              type="button"
              aria-label="Aim pad"
              className="h-40 w-[88px] touch-none border-2 bg-white"
              onPointerMove={aimFromPointer}
              onPointerDown={aimFromPointer}
              style={{
                borderColor: accent,
                transform: sample
                  ? `translate(${sample.x * 18}px, ${-sample.y * 18}px) rotate(${sample.gamma * 0.8}deg)`
                  : undefined,
              }}
            >
              <div
                className="mx-auto mt-3 h-3 w-3 rounded-full"
                style={{ background: accent }}
              />
            </button>
            <p className="text-center text-xs tracking-wide text-black/40">
              {sample
                ? `gyro ${sample.beta.toFixed(0)}° ${sample.gamma.toFixed(0)}°`
                : "No gyro yet"}
              <br />
              {sample
                ? `xyz ${sample.x.toFixed(2)}  ${sample.y.toFixed(2)}  ${sample.z.toFixed(2)}`
                : "No position yet"}
            </p>
          </>
        ) : null}
        {PadExtra ? (
          <PadExtra
            sendAction={sendGameAction}
            lastAction={lastAction}
            actionsByPlayer={actionsByPlayer}
            players={players}
            selfId={selfId}
            motionReady={motionReady}
            sample={sample}
          />
        ) : null}
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
        ) : hideAimPad ? null : (
          <button
            type="button"
            onClick={calibrate}
            className="h-12 border border-black text-[15px] font-medium"
          >
            Calibrate at the TV
          </button>
        )}
        <p className="text-center text-xs text-black/40">
          {hideAimPad
            ? "Hold the phone flat with the rear camera facing the floor. iPhones need HTTPS and a tap before sensors stream."
            : "Aim with the front of the phone, the camera-facing side. iPhones need HTTPS and a tap before sensors stream. On a computer, drag the remote."}
        </p>
      </div>
    </div>
  );
}
