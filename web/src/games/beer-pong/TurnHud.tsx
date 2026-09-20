"use client";

import type { Player } from "@/lib/protocol";
import { currentId, liveCups, teamName, type Match } from "./rules";
import type { LastThrowInfo } from "./TestPanel";
import { LIVE_GREEN } from "./view";

export function TurnHud({
  match,
  controllers,
  testing,
  shooterCalibrated,
  lastThrow,
}: {
  match: Match;
  controllers: Player[];
  testing: boolean;
  shooterCalibrated: boolean;
  lastThrow: LastThrowInfo | null;
}) {
  const shooterId = currentId(match);
  const shooter = controllers.find((player) => player.id === shooterId);
  const aLeft = liveCups(match.cups, "a").length;
  const bLeft = liveCups(match.cups, "b").length;
  const aName = teamName(match, controllers, "a") || "Blue";
  const bName = teamName(match, controllers, "b") || "Black";
  const accent = shooter?.color ?? "#0057FF";
  const joined = controllers.length;

  let title = match.message;
  let detail = "";
  if (testing) {
    title = "Test";
  } else if (match.phase === "waiting") {
    title = "Waiting";
    detail = joined === 1 ? "1 of 2 phones" : "";
  } else if (match.phase === "flight") {
    title = shooter?.name ?? "Throw";
    detail =
      lastThrow?.result === "sink" || (lastThrow?.result === "bounce" && lastThrow.cupId)
        ? "In the cup"
        : lastThrow?.result === "bounce"
          ? "On the table"
          : lastThrow?.result === "miss"
            ? "Miss"
            : "";
  } else if (match.phase === "over") {
    title = match.message;
  } else if (match.redemption) {
    title = shooter?.name ?? "Redemption";
    detail = "Redemption";
  } else if (match.overtime) {
    title = shooter?.name ?? "Overtime";
    detail = "Overtime";
  } else if (shooter) {
    title = shooter.name;
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-5 z-10 flex justify-center px-4">
        <div className="flex items-end gap-6">
          <p className="text-5xl font-bold tabular-nums tracking-tight text-accent">
            {aLeft}
            <span className="ml-2 text-lg font-medium opacity-70">{aName}</span>
          </p>
          <p className="text-5xl font-bold tabular-nums tracking-tight">
            {bLeft}
            <span className="ml-2 text-lg font-medium text-black/45">{bName}</span>
          </p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 flex justify-end px-5">
        <div className="min-w-[16rem] rounded-2xl bg-white/92 px-5 py-3 text-right">
          <div
            className="ml-auto mb-2 h-1 w-12 rounded-full"
            style={{
              background:
                !testing && match.phase === "aim" && shooterCalibrated
                  ? LIVE_GREEN
                  : accent,
            }}
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-black/40">
            {testing
              ? "Test"
              : match.phase === "waiting"
                ? "Room"
                : match.phase === "over"
                  ? "Game"
                  : match.phase === "flight"
                    ? "Shot"
                    : "Turn"}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{title}</p>
          {detail ? (
            <p className="mt-1 text-sm text-black/55">{detail}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
