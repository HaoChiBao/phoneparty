"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GamePadProps } from "@/games/types";
import type { CalibratedPose } from "@/lib/protocol";
import { useServerClock } from "./clock";
import { secondsLeft, useRoundState } from "./logic";
import {
  PAW,
  pawFromSample,
  useSmoothedPaw,
  useSwipeDetector,
  type Paw,
} from "./pointer";
import { FIELD, LEAD_IN_MS } from "./school";
import { SwipeHint } from "./SwipeHint";

export function FishingPad({
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
  const { now } = useServerClock(actionsByPlayer);
  const round = useRoundState(controllers, actionsByPlayer, now);
  const self = controllers.find((player) => player.id === selfId) ?? null;
  const accent = self?.color ?? "#0057FF";

  const zero = selfId ? round.zeroByPlayer[selfId] : undefined;
  const rawPaw = useMemo(() => pawFromSample(sample, zero ?? null), [sample, zero]);
  const paw = useSmoothedPaw(rawPaw, Boolean(zero), zero);
  const pawRef = useRef<Paw>(paw);

  useEffect(() => {
    pawRef.current = paw;
  }, [paw]);

  const mine = selfId ? (round.countByPlayer[selfId] ?? 0) : 0;
  const fishing = round.phase === "fishing";

  const onSwipe = useCallback(() => {
    // The paw position rides along, so the catch is resolved against where the
    // bear was actually pointing when the jab landed.
    sendAction("swipe", { x: pawRef.current.x, y: pawRef.current.y });
  }, [sendAction]);

  const live = useSwipeDetector({
    active: motionReady && fishing && Boolean(zero) && !capturingMotion,
    onSwipe,
  });

  function ready() {
    if (!sample) return;
    const pose: CalibratedPose = {
      alpha: sample.alpha,
      beta: sample.beta,
      gamma: sample.gamma,
      x: 0,
      y: 0,
      z: 0,
    };
    sendAction("ready", pose);
  }

  if (!motionReady) {
    return (
      <p className="text-center text-sm text-black/60">
        Tap <span className="font-medium text-black">Enable motion</span> below
        to fish.
      </p>
    );
  }

  const seconds = Math.round(secondsLeft(round.startedAt, now));
  const countdown = Math.max(1, Math.ceil((round.startedAt + LEAD_IN_MS - now) / 1000));
  const strength = Math.min(live / PAW.swipeAccel, 1);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {round.phase === "over" ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            Run over
          </p>
          <p className="text-5xl font-bold tracking-tight">{mine}</p>
          <p className="text-sm text-black/55">
            {round.winners.some((player) => player.id === selfId)
              ? round.winners.length > 1
                ? "A tie for most fish"
                : "Most fish — you win"
              : `${round.winners[0]?.name ?? "Nobody"} took the run`}
          </p>
          <button
            type="button"
            onClick={() => sendAction("restart")}
            className="h-12 w-full bg-accent text-[15px] font-medium text-white"
          >
            New run
          </button>
        </>
      ) : !zero ? (
        <>
          <p
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            {round.phase === "idle" ? "Salmon run" : "Jump in"}
          </p>
          <SwipeHint size={168} accent={accent} />
          <p className="max-w-[16rem] text-center text-sm leading-5 text-black/55">
            Point the phone&apos;s <span className="font-medium text-black">camera</span> at
            the TV, then tap Ready — that centres your paw. Move to track a
            salmon and jab the phone down to swipe.
          </p>
          <button
            type="button"
            onClick={ready}
            disabled={!sample}
            className="h-12 w-full bg-accent text-[15px] font-medium text-white disabled:opacity-40"
          >
            {sample ? "Ready" : "Waiting for sensors…"}
          </button>
        </>
      ) : round.phase === "countdown" ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            Paws up
          </p>
          <p className="text-6xl font-bold tabular-nums tracking-tight">
            {countdown}
          </p>
          <p className="text-sm text-black/55">Watch the TV.</p>
        </>
      ) : (
        <>
          <p
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            Fishing · {seconds}s
          </p>
          <p className="text-6xl font-bold tracking-tight">{mine}</p>

          {/* where the paw is sitting, so a bear can tell it is tracking */}
          <div
            className="relative overflow-hidden border-2"
            style={{
              borderColor: accent,
              width: 176,
              height: (176 * FIELD.height) / FIELD.width,
            }}
          >
            <div
              className="absolute h-4 w-4 rounded-full"
              style={{
                background: accent,
                left: `calc(50% + ${(paw.x / (FIELD.width / 2)) * 50}% - 8px)`,
                top: `calc(50% - ${(paw.y / (FIELD.height / 2)) * 50}% - 8px)`,
              }}
            />
          </div>

          <p className="text-center text-[15px] font-medium">
            Jab the phone straight down
          </p>
          <div className="h-1.5 w-44 bg-black/10">
            <div
              className="h-1.5 transition-[width] duration-100"
              style={{ width: `${strength * 100}%`, background: accent }}
            />
          </div>
          <button
            type="button"
            onClick={ready}
            className="text-xs text-black/40 underline"
          >
            Re-centre the paw
          </button>
        </>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {round.ranking.map(({ player, count }) => {
          const isSelf = player.id === selfId;
          return (
            <span
              key={player.id}
              className={
                isSelf
                  ? "px-2 py-1 text-[11px] font-medium text-white"
                  : "border px-2 py-1 text-[11px]"
              }
              style={
                isSelf ? { background: player.color } : { borderColor: player.color }
              }
            >
              {isSelf ? "You" : player.name} · {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}
