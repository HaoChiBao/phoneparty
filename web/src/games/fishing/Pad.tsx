"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GamePadProps } from "@/games/types";
import type { CalibratedPose } from "@/lib/protocol";
import { useServerClock } from "./clock";
import { HookHint } from "./HookHint";
import { secondsLeft, useRoundState } from "./logic";
import { pawFromSample, useSmoothedPaw, type Paw } from "./pointer";
import {
  FIELD,
  fishUnderHook,
  LEAD_IN_MS,
  reelsFor,
  type FishKind,
} from "./school";

const SEND_EVERY_MS = 40;
const KIND_LABEL: Record<FishKind, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

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
  const fight = selfId ? round.fights[selfId] : undefined;
  const hooked = fight
    ? (round.school.find((entry) => entry.id === fight.fishId) ?? null)
    : null;

  const elapsed =
    fishing && round.startedAt ? now - round.startedAt - LEAD_IN_MS : -1;
  const hovering =
    fishing && !fight && elapsed >= 0
      ? fishUnderHook(round.school, elapsed, paw.x, paw.y, round.busyIds)
      : null;

  const pendingReels = useRef(0);
  const lastSentN = useRef(0);
  const lastSentAt = useRef(0);
  const [localReels, setLocalReels] = useState(0);
  const fightFishId = fight?.fishId ?? null;

  useEffect(() => {
    pendingReels.current = 0;
    lastSentN.current = 0;
    lastSentAt.current = 0;
    setLocalReels(0);
  }, [fightFishId]);

  const flushReels = useCallback(() => {
    if (!fight) return;
    const n = pendingReels.current;
    if (n <= lastSentN.current) return;
    lastSentN.current = n;
    lastSentAt.current = Date.now();
    sendAction("reel", { n });
  }, [fight, sendAction]);

  useEffect(() => {
    if (!fight || capturingMotion) return;
    const id = window.setInterval(flushReels, SEND_EVERY_MS);
    return () => window.clearInterval(id);
  }, [capturingMotion, fight, flushReels]);

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

  function hook() {
    if (!hovering || capturingMotion) return;
    sendAction("hook", { x: pawRef.current.x, y: pawRef.current.y });
  }

  function reelClick() {
    if (!fight || capturingMotion) return;
    pendingReels.current += 1;
    setLocalReels(pendingReels.current);
    if (Date.now() - lastSentAt.current >= SEND_EVERY_MS) flushReels();
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
  const need = hooked ? reelsFor(hooked) : 0;
  const shownReels = fight ? Math.max(fight.reels, localReels) : 0;
  const reelProgress = need > 0 ? Math.min(1, shownReels / need) : 0;

  if (fight && hooked && fishing) {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            reelClick();
          }}
          className="flex min-h-[58vh] w-full flex-col items-center justify-center gap-4 text-white"
          style={{ background: accent, touchAction: "none", userSelect: "none" }}
        >
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/80">
            {KIND_LABEL[hooked.kind]} · mash to reel
          </p>
          <p className="text-6xl font-bold tracking-tight">Reel</p>
          <div className="h-2 w-48 bg-white/25">
            <div
              className="h-2 bg-white transition-[width] duration-75"
              style={{ width: `${reelProgress * 100}%` }}
            />
          </div>
          <p className="text-sm text-white/80">
            {shownReels} / {need}
          </p>
        </button>
        <p className="text-sm text-black/55">You · {mine}</p>
      </div>
    );
  }

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
          <HookHint size={168} accent={accent} />
          <p className="max-w-[16rem] text-center text-sm leading-5 text-black/55">
            Point the phone&apos;s <span className="font-medium text-black">camera</span> at
            the TV, then tap Ready. Hover the hook over a fish and tap Hook. Mash
            the screen to reel — bigger fish take more taps.
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
            Hooks up
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

          <div
            className="relative overflow-hidden border-2"
            style={{
              borderColor: hovering ? accent : `${accent}99`,
              width: 176,
              height: (176 * FIELD.height) / FIELD.width,
            }}
          >
            <img
              src="/fishing/hook.png"
              alt=""
              className="absolute h-7 w-7"
              style={{
                left: `calc(50% + ${(paw.x / (FIELD.width / 2)) * 50}% - 14px)`,
                top: `calc(50% - ${(paw.y / (FIELD.height / 2)) * 50}% - 14px)`,
              }}
            />
          </div>

          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              hook();
            }}
            disabled={!hovering || capturingMotion}
            className="h-16 w-full text-[17px] font-medium text-white disabled:bg-black/15 disabled:text-black/35"
            style={{
              background: hovering ? accent : undefined,
              touchAction: "none",
            }}
          >
            {hovering
              ? `Hook · ${KIND_LABEL[hovering.kind]}`
              : "Hover a fish to hook"}
          </button>
          <p className="text-center text-sm text-black/55">
            Small 1pt · medium 2 · large 3. Everyone fishes at once.
          </p>
          <button
            type="button"
            onClick={ready}
            className="text-xs text-black/40 underline"
          >
            Re-centre the hook
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
