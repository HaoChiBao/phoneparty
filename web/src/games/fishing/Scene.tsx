"use client";

import { useMemo } from "react";
import { HostCanvas } from "@/games/shared/HostCanvas";
import type { GameSceneProps } from "@/games/types";
import { useServerClock } from "./clock";
import { fishPosition, LEAD_IN_MS } from "./school";
import { River } from "./River";
import { secondsLeft, useRoundState } from "./logic";

export function FishingScene({
  controllers,
  gyroByPlayer,
  actionsByPlayer,
}: GameSceneProps) {
  const { now, offset } = useServerClock(actionsByPlayer);
  const round = useRoundState(controllers, actionsByPlayer, now);

  const swipeAtByPlayer = useMemo(() => {
    const map: Record<string, number> = {};
    for (const action of Object.values(actionsByPlayer)) {
      if (action.type === "swipe") map[action.playerId] = action.timestamp;
    }
    return map;
  }, [actionsByPlayer]);

  // Splash where the newest salmon was taken.
  const splash = useMemo(() => {
    const last = round.lastCatch;
    if (!last) return null;
    const fish = round.school.find((entry) => entry.id === last.fishId);
    const at = fish ? fishPosition(fish, last.atMs) : null;
    if (!at) return null;
    return { x: at.x, y: at.y, time: round.startedAt + LEAD_IN_MS + last.atMs };
  }, [round.lastCatch, round.school, round.startedAt]);

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
          caughtIds={round.caughtIds}
          zeroByPlayer={round.zeroByPlayer}
          gyroByPlayer={gyroByPlayer}
          swipeAtByPlayer={swipeAtByPlayer}
          splash={splash}
          startedAt={round.startedAt}
          offset={offset}
        />
      </HostCanvas>

      {/* counter across the top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex justify-center px-5 pt-24">
        <div className="flex items-center gap-4 bg-white/92 px-5 py-3">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
              {round.phase === "over" ? "Time" : "Left"}
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight">
              {round.phase === "idle" ? "30" : Math.round(seconds)}
            </p>
          </div>
          <div className="h-10 w-px bg-black/10" />
          <div className="flex flex-wrap items-center gap-2">
            {round.ranking.length === 0 ? (
              <span className="text-sm text-black/45">No bears yet</span>
            ) : (
              round.ranking.map(({ player, count }) => (
                <span
                  key={player.id}
                  className="px-3 py-1 text-sm font-medium text-white"
                  style={{ background: player.color }}
                >
                  {player.name} · {count}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex justify-center px-5 pb-10">
        <div className="flex max-w-2xl flex-col items-center gap-3 bg-white/92 px-6 py-4 text-center">
          {round.phase === "idle" ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                Salmon run
              </p>
              <p className="text-2xl font-bold tracking-tight">
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
              <p className="text-6xl font-bold tabular-nums tracking-tight">
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
              <p className="text-3xl font-bold tracking-tight">
                {round.winners.length === 0
                  ? "Nobody caught a thing"
                  : round.winners.length > 1
                    ? `${round.winners.map((p) => p.name).join(" & ")} tie`
                    : `${round.winners[0].name} wins`}
                {round.winners.length > 0 ? (
                  <span className="ml-3 text-black/45">
                    {round.countByPlayer[round.winners[0].id] ?? 0}
                  </span>
                ) : null}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
