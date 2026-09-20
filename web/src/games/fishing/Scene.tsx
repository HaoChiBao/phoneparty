"use client";

import { useMemo } from "react";
import { HostCanvas } from "@/games/shared/HostCanvas";
import type { GameSceneProps } from "@/games/types";
import { useServerClock } from "./clock";
import { LEAD_IN_MS } from "./school";
import { River } from "./River";
import { secondsLeft, useRoundState } from "./logic";

export function FishingScene({
  controllers,
  gyroByPlayer,
  actionsByPlayer,
}: GameSceneProps) {
  const { now, offset } = useServerClock(actionsByPlayer);
  const round = useRoundState(controllers, actionsByPlayer, now);

  const splash = useMemo(() => {
    const last = round.lastCatch;
    if (!last) return null;
    return { x: last.x, y: last.y, time: round.startedAt + LEAD_IN_MS + last.atMs };
  }, [round.lastCatch, round.startedAt]);

  const seconds = secondsLeft(round.startedAt, now);
  const countdown = round.phase === "countdown"
    ? Math.max(1, Math.ceil((round.startedAt + LEAD_IN_MS - now) / 1000))
    : 0;

  return (
    <>
      <HostCanvas backgroundSrc="/fishing/bckgrndwave.png">
        <River
          controllers={controllers}
          school={round.school}
          busyIds={round.busyIds}
          fights={round.phase === "fishing" || round.phase === "countdown" ? round.fights : {}}
          zeroByPlayer={round.zeroByPlayer}
          gyroByPlayer={gyroByPlayer}
          splash={splash}
          startedAt={round.startedAt}
          offset={offset}
        />
      </HostCanvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex justify-center px-5 pt-24">
        <div className="flex items-end gap-6">
          <div className="rounded-2xl bg-white/92 px-5 py-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
              {round.phase === "over" ? "Time" : "Left"}
            </p>
            <p className="text-5xl font-bold tabular-nums tracking-tight">
              {round.phase === "idle" ? "30" : Math.round(seconds)}
            </p>
          </div>
          {round.ranking.length > 0 ? (
            <div className="flex flex-wrap items-end gap-x-8 gap-y-1 pb-1">
              {round.ranking.map(({ player, count }) => (
                <p
                  key={player.id}
                  className="text-4xl font-bold tracking-tight tabular-nums"
                  style={{ color: player.color }}
                >
                  {count}
                  <span className="ml-2 text-lg font-medium opacity-70">
                    {player.name}
                  </span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex justify-end px-5 pb-16">
        <div className="max-w-lg rounded-2xl bg-white/92 px-6 py-4 text-right">
          {round.phase === "idle" ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                Salmon run
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                {controllers.length === 0
                  ? "Waiting for a phone…"
                  : "Ready"}
              </p>
            </>
          ) : round.phase === "countdown" ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                Ready
              </p>
              <p className="mt-1 text-6xl font-bold tabular-nums tracking-tight">
                {countdown}
              </p>
            </>
          ) : round.phase === "fishing" ? (
            <p className="text-2xl font-bold tracking-tight">
              {round.caught.length} caught
            </p>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                Run over
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {round.winners.length === 0
                  ? "Nobody caught a thing"
                  : round.winners.length > 1
                    ? `${round.winners.map((p) => p.name).join(" & ")} tie`
                    : `${round.winners[0].name} wins`}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
