"use client";

import { useCallback, useMemo } from "react";
import type { GamePadProps } from "@/games/types";
import { useRoundState } from "./logic";
import { SwingHint } from "./SwingHint";
import { isAimedDown, useSwingDetector } from "./swing";

export function HammerPad({
  sendAction,
  players,
  selfId,
  actionsByPlayer,
  motionReady,
  sample,
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
  const aimedDown = isAimedDown(sample);

  const onSwing = useCallback(
    (power: number) => {
      sendAction("swing", { power });
    },
    [sendAction],
  );

  const phase = useSwingDetector({
    active: motionReady && myTurn && !mySwing,
    aimedDown,
    onSwing,
  });

  const status = !aimedDown
    ? "Lay the phone flat, camera facing the floor"
    : phase === "ready"
      ? "Ready — swing down!"
      : phase === "capturing"
        ? "Swinging…"
        : "Hold it still…";

  return (
    <div className="flex w-full flex-col items-center gap-4">
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
              : "No score"}
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
            Your swing
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
            {status}
          </p>
          <div className="h-1 w-40 bg-black/10">
            <div
              className="h-1 transition-[width] duration-150"
              style={{
                width:
                  phase === "capturing"
                    ? "100%"
                    : phase === "ready"
                      ? "66%"
                      : aimedDown
                        ? "33%"
                        : "0%",
                background: accent,
              }}
            />
          </div>
          {!sample ? (
            <p className="text-center text-xs text-black/40">
              Waiting for phone sensors — this game needs a real phone.
            </p>
          ) : null}
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
            Everyone swings once. Highest score wins.
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
