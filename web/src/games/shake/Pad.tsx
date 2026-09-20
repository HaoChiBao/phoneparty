"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GamePadProps } from "@/games/types";
import {
  ROUND_MS,
  useRoundClock,
  useRoundState,
} from "./logic";
import { isGripped, useShakeDetector } from "./shake";
import { ShakeHint } from "./ShakeHint";

/** The running total goes out at most this often; the server caps bursts anyway. */
const SEND_EVERY_MS = 140;

export function ShakePad({
  sendAction,
  players,
  selfId,
  actionsByPlayer,
  motionReady,
  sample,
  capturingMotion = false,
}: GamePadProps) {
  const controllers = useMemo(
    () => players.filter((player) => player.role === "controller"),
    [players],
  );
  const round = useRoundState(controllers, actionsByPlayer);
  const { phase, secondsLeft, countdown } = useRoundClock(round.startedAt);
  const self = controllers.find((player) => player.id === selfId) ?? null;
  const accent = self?.color ?? "#0057FF";

  const joined = Boolean(selfId) && round.joined.includes(selfId ?? "");
  const gripped = isGripped(sample);
  const myApples = selfId ? (round.apples[selfId] ?? 0) : 0;

  // The recorder owns the motion while it captures, so a practice shake must
  // not score.
  const shaking = phase === "shaking" && joined && motionReady && !capturingMotion;

  const lastSent = useRef(0);
  const pending = useRef(0);

  const onStroke = useCallback(
    (strokes: number) => {
      pending.current = strokes;
      const now = Date.now();
      if (now - lastSent.current < SEND_EVERY_MS) return;
      lastSent.current = now;
      // A running total, not one message per stroke: a dropped or rate-limited
      // update costs nothing because the next one carries the whole count.
      sendAction("shake", { strokes });
    },
    [sendAction],
  );

  const { strokes, rate } = useShakeDetector({
    active: shaking,
    gripped,
    onStroke,
  });

  // Make sure the last strokes of the round land, even if they fell inside the
  // send window when time ran out.
  useEffect(() => {
    if (phase !== "over" || !joined || pending.current === 0) return;
    sendAction("shake", { strokes: pending.current });
    pending.current = 0;
  }, [phase, joined, sendAction]);

  if (!motionReady) {
    return (
      <p className="text-center text-sm text-black/60">
        Tap <span className="font-medium text-black">Enable motion</span> below
        to shake the tree.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {phase === "over" ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            Time
          </p>
          <p className="text-3xl font-bold tracking-tight">
            {round.winners.some((player) => player.id === selfId)
              ? round.winners.length > 1
                ? "You tie"
                : "You win"
              : round.winners.length > 0
                ? `${round.winners[0].name} wins`
                : "Nothing fell"}
          </p>
          <p className="text-sm text-black/55">You shook loose {myApples}.</p>
          <button
            type="button"
            onClick={() => sendAction("restart")}
            className="h-12 w-full bg-accent text-[15px] font-medium text-white"
          >
            Shake again
          </button>
        </>
      ) : phase === "shaking" ? (
        joined ? (
          <>
            <p
              className="text-[11px] uppercase tracking-[0.22em]"
              style={{ color: accent }}
            >
              {secondsLeft} seconds left
            </p>
            <p className="text-7xl font-bold tabular-nums tracking-tight">
              {Math.max(strokes, myApples)}
            </p>
            <p className="text-sm text-black/55">apples</p>
            <div className="h-2 w-48 bg-black/10">
              <div
                className="h-2 transition-[width] duration-150"
                style={{
                  width: `${Math.min(rate / 8, 1) * 100}%`,
                  background: accent,
                }}
              />
            </div>
            <p
              className="text-center text-[15px] font-medium"
              style={{ color: gripped ? accent : "#111111" }}
            >
              {gripped ? `${rate.toFixed(1)} shakes a second` : "Lay the phone flat, camera down"}
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold tracking-tight">
              {secondsLeft}s left
            </p>
            <button
              type="button"
              onClick={() => sendAction("ready")}
              className="h-12 w-full bg-accent text-[15px] font-medium text-white"
            >
              Join this round
            </button>
          </>
        )
      ) : phase === "countdown" ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            Get ready
          </p>
          <p className="text-7xl font-bold tabular-nums tracking-tight">
            {countdown || "GO"}
          </p>
          {joined ? (
            <p
              className="text-center text-[15px] font-medium"
              style={{ color: gripped ? accent : "#111111" }}
            >
              {gripped ? "Hold it flat — here we go" : "Lay the phone flat, camera down"}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => sendAction("ready")}
              className="h-12 w-full bg-accent text-[15px] font-medium text-white"
            >
              Join this round
            </button>
          )}
        </>
      ) : (
        <>
          <p
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            {ROUND_MS / 1000} seconds
          </p>
          <ShakeHint size={168} accent={accent} />
          <p className="max-w-[16rem] text-center text-sm leading-5 text-black/55">
            Hold the phone <span className="font-medium text-black">flat</span>,
            camera facing the ground, then shake it left and right. Fastest bear
            shakes down the most apples.
          </p>
          <button
            type="button"
            onClick={() => sendAction("ready")}
            className="h-12 w-full bg-accent text-[15px] font-medium text-white"
          >
            {round.joined.length > 0 ? "Join this round" : "Ready"}
          </button>
        </>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {round.order.map((player) => {
          const isSelf = player.id === selfId;
          const inRound = round.joined.includes(player.id);
          return (
            <span
              key={player.id}
              className={
                isSelf
                  ? "px-2 py-1 text-[11px] font-medium text-white"
                  : "border px-2 py-1 text-[11px]"
              }
              style={
                isSelf
                  ? { background: player.color }
                  : { borderColor: player.color, opacity: inRound ? 1 : 0.5 }
              }
            >
              {isSelf ? "You" : player.name} · {round.apples[player.id] ?? 0}
            </span>
          );
        })}
      </div>
    </div>
  );
}
