"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { GamePadProps } from "@/games/types";
import { createFlickState, readFlickAccel, stepFlick, swipeFlick } from "./flick";
import { throwPayload } from "./throwMath";
import { derivePongSync, flightCopy, LIVE_GREEN } from "./view";

export function BeerPongPad({
  sendAction,
  sample,
  calib,
  onCalibrate,
  motionReady,
  capturingMotion = false,
  players,
  selfId,
  actionsByPlayer,
}: GamePadProps) {
  const [wantTest, setWantTest] = useState(false);
  const [pendingThrow, setPendingThrow] = useState(false);
  const [status, setStatus] = useState("Enable motion, then calibrate at the TV.");
  const flick = useRef(createFlickState());
  const swipe = useRef<{ y: number; t: number } | null>(null);
  const sendRef = useRef(sendAction);
  sendRef.current = sendAction;
  const sampleRef = useRef(sample);
  sampleRef.current = sample;

  const view = useMemo(
    () => derivePongSync(players, actionsByPlayer),
    [players, actionsByPlayer],
  );
  const ready = Boolean(calib);
  const testing = wantTest || view.testing;
  const myTurn = Boolean(selfId) && view.shooterId === selfId;
  const canThrow =
    ready &&
    motionReady &&
    !capturingMotion &&
    (testing || (myTurn && view.phase === "aim" && !pendingThrow));
  const live = canThrow && !testing;

  useEffect(() => {
    if (!pendingThrow) return;
    if (view.phase === "flight") return;
    if (view.phase === "aim" && view.lastResult && view.lastResult !== "air") {
      setPendingThrow(false);
      return;
    }
    const timer = window.setTimeout(() => setPendingThrow(false), 1600);
    return () => window.clearTimeout(timer);
  }, [pendingThrow, view.phase, view.lastResult, view.shooterId]);

  function fire(power: number, peak: number, ax: number, ay: number, az: number) {
    if (!ready) {
      setStatus("Calibrate at the TV first.");
      return;
    }
    if (!testing && !(myTurn && view.phase === "aim")) {
      setStatus(
        view.shooterName ? `Wait. ${view.shooterName} is up.` : "Wait for your turn.",
      );
      return;
    }
    setPendingThrow(true);
    sendRef.current(
      "throw",
      throwPayload({ power, peak, ax, ay, az }, sampleRef.current),
    );
    setStatus(`Flick ${peak.toFixed(0)}`);
  }

  useEffect(() => {
    if (!motionReady) setStatus("Enable motion, then calibrate at the TV.");
    else if (!ready) setStatus("Your turn needs a calibrate at the TV.");
    else if (testing) setStatus("Test. Flick anytime.");
    else if (view.phase === "waiting") setStatus("Waiting for two phones.");
    else if (view.phase === "over") setStatus(view.message || "Game over.");
    else if (view.phase === "flight") setStatus(flightCopy(view));
    else if (myTurn) setStatus("You are up. Flick toward the cups.");
    else setStatus(view.shooterName ? `${view.shooterName} is up.` : "Wait for your turn.");
  }, [motionReady, ready, testing, view, myTurn]);

  useEffect(() => {
    if (!canThrow) return;
    const onMotion = (event: DeviceMotionEvent) => {
      const accel = readFlickAccel(event);
      if (!accel) return;
      const result = stepFlick(flick.current, accel, Date.now());
      if (result) fire(result.power, result.peak, result.ax, result.ay, result.az);
    };
    window.addEventListener("devicemotion", onMotion, true);
    return () => window.removeEventListener("devicemotion", onMotion, true);
  }, [canThrow, myTurn, ready, testing, view.phase, capturingMotion]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!canThrow) return;
    swipe.current = { y: event.clientY, t: Date.now() };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Desktop automation and some browsers skip capture.
    }
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (capturingMotion) {
      swipe.current = null;
      return;
    }
    const start = swipe.current;
    swipe.current = null;
    if (!start || !canThrow) return;
    const result = swipeFlick(start.y, event.clientY, start.t, Date.now());
    if (result) fire(result.power, result.peak, result.ax, result.ay, result.az);
  }

  function toggleTest() {
    const next = !testing;
    setWantTest(next);
    setPendingThrow(false);
    sendAction("test", { on: next });
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      {live ? (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-between px-5 py-8 text-white"
          style={{ background: LIVE_GREEN }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipe.current = null;
          }}
        >
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/80">
              Your throw
            </p>
            <p className="mt-2 text-sm tabular-nums text-white/85">
              {view.aLeft} – {view.bLeft}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <p className="text-5xl font-bold tracking-tight">Flick</p>
            <p className="max-w-xs text-center text-[15px] leading-5 text-white/90">
              {view.redemption
                ? "Redemption. Throw toward the cups."
                : view.overtime
                  ? "Overtime. Throw toward the cups."
                  : "You are the live phone. Flick, or swipe up."}
            </p>
          </div>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={onCalibrate}
            className="h-12 w-full max-w-xs border border-white text-[15px] font-medium"
          >
            Recalibrate
          </button>
        </div>
      ) : null}

      {myTurn && view.phase === "aim" && !testing && !pendingThrow && !ready ? (
        <div className="flex flex-col items-center gap-3 border border-black px-4 py-5 text-center">
          <p
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: LIVE_GREEN }}
          >
            Your turn
          </p>
          <p className="text-2xl font-bold tracking-tight">Calibrate first</p>
          <p className="text-sm text-black/55">
            Point the front of the phone at the TV, then calibrate. The screen
            turns green when you can flick.
          </p>
          <button
            type="button"
            onClick={onCalibrate}
            disabled={!motionReady}
            className="h-12 w-full bg-accent text-[15px] font-medium text-white disabled:opacity-40"
          >
            {motionReady ? "Calibrate at the TV" : "Enable motion first"}
          </button>
        </div>
      ) : !live ? (
        <div className="flex flex-col items-center gap-2 px-2 py-3 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">
            {testing
              ? "Test"
              : view.phase === "waiting"
                ? "Room"
                : view.phase === "over"
                  ? "Game"
                  : view.phase === "flight"
                    ? "Shot"
                    : myTurn
                      ? "Your turn"
                      : "Waiting"}
          </p>
          <p className="text-2xl font-bold tracking-tight">
            {testing
              ? "Flick anytime"
              : view.phase === "waiting"
                ? "Need another phone"
                : view.phase === "over"
                  ? view.message || "Game over"
                  : view.phase === "flight"
                    ? flightCopy(view)
                    : myTurn && !motionReady
                      ? "Enable motion"
                      : view.shooterName
                        ? `${view.shooterName} is up`
                        : "Getting ready"}
          </p>
          <p className="text-sm text-black/55">{status}</p>
        </div>
      ) : null}

      {!ready && !(myTurn && view.phase === "aim" && !testing) ? (
        <button
          type="button"
          onClick={onCalibrate}
          disabled={!motionReady}
          className="h-12 bg-accent text-[15px] font-medium text-white disabled:opacity-40"
        >
          {motionReady ? "Calibrate at the TV" : "Enable motion first"}
        </button>
      ) : null}

      {testing ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Flick to throw"
          className="flex h-36 touch-none flex-col items-center justify-center px-4 text-white"
          style={{ background: ready ? LIVE_GREEN : "#0057FF" }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipe.current = null;
          }}
        >
          <p className="text-lg font-medium">{ready ? "Flick" : "Calibrate first"}</p>
          <p className="mt-1 text-center text-xs leading-4 text-white/80">
            {ready
              ? "Test throws do not wait for turn order."
              : "Calibrate before a test flick."}
          </p>
        </div>
      ) : null}

      <p className="text-center text-xs leading-4 text-black/45">
        {view.aLeft} – {view.bLeft}
        {view.redemption ? " · Redemption" : view.overtime ? " · Overtime" : ""}
      </p>
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
        <button
          type="button"
          onClick={() => sendAction("resetCups")}
          className="h-11 border border-black/20 text-[15px] font-medium"
        >
          Reset cups
        </button>
      ) : null}
    </div>
  );
}
