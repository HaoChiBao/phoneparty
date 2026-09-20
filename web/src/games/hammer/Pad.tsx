"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GamePadProps } from "@/games/types";
import { ACTION_TUNE_EVENT } from "@/lib/actionTune";
import { useRoundState } from "./logic";
import { SwingHint } from "./SwingHint";
import { isAimedDown, useSwingDetector } from "./swing";
import { loadSensitivity, tuneFromSensitivity } from "./tune";

export function HammerPad({
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
  const self = controllers.find((player) => player.id === selfId) ?? null;
  const accent = self?.color ?? "#0057FF";
  const mySwing = selfId ? round.swings[selfId] : undefined;
  const myTurn = Boolean(selfId) && round.current?.id === selfId;

  const [armed, setArmed] = useState(false);
  const [sensitivity] = useState(loadSensitivity);

  const [tuneRev, setTuneRev] = useState(0);
  const tune = useMemo(
    () => tuneFromSensitivity(sensitivity),
    [sensitivity, tuneRev],
  );

  useEffect(() => {
    const refresh = () => setTuneRev((n) => n + 1);
    window.addEventListener(ACTION_TUNE_EVENT, refresh);
    return () => window.removeEventListener(ACTION_TUNE_EVENT, refresh);
  }, []);
  const aimedDown = isAimedDown(sample, null, tune);
  const waitingToSwing = myTurn && !mySwing && motionReady;
  const screenReady = armed && waitingToSwing;

  const onSwing = useCallback(
    (power: number) => {
      setArmed(false);
      sendAction("swing", { power });
    },
    [sendAction],
  );

  const { phase } = useSwingDetector({
    active: motionReady && !capturingMotion && waitingToSwing && armed,
    armed,
    aimedDown,
    tune,
    reportLive: false,
    onSwing,
  });

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {screenReady ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#16a34a] px-5 py-8 text-white">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/80">
            Ready
          </p>
          <div className="flex flex-col items-center gap-4">
            <p className="text-5xl font-bold tracking-tight">Swing</p>
            <p className="max-w-xs text-center text-[15px] leading-5 text-white/90">
              {phase === "capturing"
                ? "Got it…"
                : "Phone is live. Swing down at the tree."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="h-12 w-full max-w-xs border border-white text-[15px] font-medium"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {!motionReady ? (
        <p className="text-center text-sm text-black/60">
          Tap <span className="font-medium text-black">Enable motion</span> below
          to take your swing.
        </p>
      ) : round.done ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            Round over
          </p>
          <p className="text-3xl font-bold tracking-tight">
            {round.winner
              ? round.winner.id === selfId
                ? "You win"
                : `${round.winner.name} wins`
              : "No apples"}
            {round.winner ? (
              <span className="ml-3 text-black/45">
                {round.swings[round.winner.id]?.score ?? 0}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => sendAction("restart")}
            className="h-12 w-full bg-accent text-[15px] font-medium text-white"
          >
            New round
          </button>
        </>
      ) : mySwing ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            Your apples
          </p>
          <p className="text-6xl font-bold tracking-tight">{mySwing.score}</p>
          <p className="text-center text-sm text-black/55">
            {round.current
              ? `${round.current.name} is up next.`
              : "Waiting for the others…"}
          </p>
        </>
      ) : myTurn ? (
        <>
          <p
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            Your turn
          </p>
          <SwingHint size={172} accent={accent} />
          <p
            className="text-center text-[15px] font-medium"
            style={{ color: aimedDown ? accent : "#111111" }}
          >
            Hold the phone like a paw, then tap Ready.
          </p>
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="h-14 w-full bg-[#16a34a] text-[15px] font-medium text-white"
          >
            Ready
          </button>
        </>
      ) : (
        <>
          <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">
            Waiting
          </p>
          <p className="text-2xl font-bold tracking-tight">
            {round.current ? `${round.current.name} is up` : "Getting ready…"}
          </p>
          <p className="text-center text-sm text-black/55">
            Everyone takes one swing. Most apples wins.
          </p>
        </>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {round.order.map((player) => {
          const record = round.swings[player.id];
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
                isSelf
                  ? { background: player.color }
                  : { borderColor: player.color }
              }
            >
              {isSelf ? "You" : player.name} · {record ? record.score : "—"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
