"use client";

import type { Player } from "@/lib/protocol";
import { currentId, liveCups, teamName, type Match } from "./rules";
import type { LastThrowInfo } from "./TestPanel";

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
  let detail = "Need 2 phones to start";
  if (testing) {
    title = "Test";
    detail = "Flick anytime. The TV stays on this table.";
  } else if (match.phase === "waiting") {
    title = "Waiting";
    detail = joined === 1 ? "1 of 2 phones in. Join one more." : "Need 2 phones to start";
  } else if (match.phase === "flight") {
    title = shooter?.name ?? "Throw";
    detail =
      lastThrow?.result === "sink" || (lastThrow?.result === "bounce" && lastThrow.cupId)
        ? "In the cup"
        : lastThrow?.result === "bounce"
          ? "On the table"
          : lastThrow?.result === "miss"
            ? "Miss"
            : "Ball in the air";
  } else if (match.phase === "over") {
    title = match.message;
    detail = "Next game in a few seconds";
  } else if (shooter && !shooterCalibrated) {
    title = shooter.name;
    detail = "Calibrate at the TV, then flick";
  } else if (match.redemption) {
    title = shooter?.name ?? "Redemption";
    detail = "Redemption. Flick the phone to throw.";
  } else if (match.overtime) {
    title = shooter?.name ?? "Overtime";
    detail = "Overtime. Flick the phone to throw.";
  } else if (shooter) {
    title = shooter.name;
    detail = "Flick the phone to throw";
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-5 z-10 flex justify-center px-4">
        <div className="flex items-center gap-5 bg-white/92 px-5 py-2.5">
          <div className="min-w-[5.5rem] text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Blue</p>
            <p className="text-sm font-medium">{aName}</p>
          </div>
          <p className="text-3xl font-bold tabular-nums tracking-tight">
            {aLeft}
            <span className="mx-2 text-black/20">–</span>
            {bLeft}
          </p>
          <div className="min-w-[5.5rem]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/45">Black</p>
            <p className="text-sm font-medium">{bName}</p>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 flex justify-center px-4">
        <div className="min-w-[16rem] bg-white/92 px-5 py-3 text-center">
          <div className="mx-auto mb-2 h-1 w-12" style={{ background: accent }} />
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
          <p className="mt-1 text-sm text-black/55">{detail}</p>
        </div>
      </div>
    </>
  );
}
