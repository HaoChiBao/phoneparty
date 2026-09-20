"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GamePadProps } from "@/games/types";
import type { CalibratedPose } from "@/lib/protocol";
import { AIM, aimFromSample, scoreFromAim, useSteadyHold, type Aim } from "./aim";
import { AimHint } from "./AimHint";
import { ARROWS_PER_PLAYER, totalFor, useRoundState } from "./logic";

export function ArcheryPad({
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

  const myTurn = Boolean(selfId) && round.current?.id === selfId;
  const myShots = selfId ? (round.shots[selfId] ?? []) : [];
  const shotsLeft = ARROWS_PER_PLAYER - myShots.length;

  // The pose the archer zeroed on when they tapped Ready. Tagged with the round
  // and arrow it belongs to, so a draw is spent the moment the turn moves on —
  // no effect needed to clean it up, and every arrow re-centres, which stops
  // sensor drift accumulating across a turn.
  const [draw, setDraw] = useState<{
    pose: CalibratedPose;
    roundId: number;
    shotCount: number;
  } | null>(null);
  const drawn =
    draw !== null &&
    myTurn &&
    !round.done &&
    draw.roundId === round.roundId &&
    draw.shotCount === myShots.length;
  const zero = drawn ? draw.pose : null;
  const aim = useMemo(() => aimFromSample(sample, zero), [sample, zero]);
  const aimRef = useRef<Aim>(aim);

  useEffect(() => {
    aimRef.current = aim;
  }, [aim]);

  const onRelease = useCallback(
    (shot: Aim) => {
      // Cleared here rather than waiting for the loose to come back from the
      // server, or the hold would refill and fire a second arrow in the gap.
      setDraw(null);
      sendAction("loose", { x: shot.x, y: shot.y });
    },
    [sendAction],
  );

  const drawing = drawn && motionReady && !capturingMotion;
  const { hold, steady } = useSteadyHold({
    active: drawing,
    aimRef,
    onRelease,
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
    setDraw({ pose, roundId: round.roundId, shotCount: myShots.length });
    sendAction("draw", pose);
  }

  const progress = Math.round((hold / AIM.holdSeconds) * 100);
  const preview = scoreFromAim(aim.x, aim.y);

  if (!motionReady) {
    return (
      <p className="text-center text-sm text-black/60">
        Tap <span className="font-medium text-black">Enable motion</span> below
        to shoot.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {round.done ? (
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
      ) : !myTurn ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">
            Waiting
          </p>
          <p className="text-2xl font-bold tracking-tight">
            {round.current ? `${round.current.name} is up` : "Getting ready…"}
          </p>
          <p className="text-center text-sm text-black/55">
            Three arrows each. Highest total wins.
          </p>
        </>
      ) : drawing ? (
        <>
          <p
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            Aiming · arrow {myShots.length + 1} of {ARROWS_PER_PLAYER}
          </p>

          {/* live aim, seen from behind the bow */}
          <div
            className="relative h-40 w-40 overflow-hidden rounded-full border-2"
            style={{ borderColor: accent }}
          >
            <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/15" />
            <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/25" />
            <div
              className="absolute left-1/2 top-1/2 h-4 w-4 rounded-full"
              style={{
                background: accent,
                transform: `translate(calc(-50% + ${clampPx(aim.x)}px), calc(-50% + ${clampPx(-aim.y)}px))`,
              }}
            />
          </div>

          <p
            className="text-center text-[15px] font-medium"
            style={{ color: steady ? accent : "#111111" }}
          >
            {steady ? "Steady — hold it" : "Too shaky"}
          </p>
          <div className="h-1.5 w-44 bg-black/10">
            <div
              className="h-1.5"
              style={{ width: `${progress}%`, background: accent }}
            />
          </div>
          <p className="text-xs tracking-wide text-black/40">
            {(AIM.holdSeconds - hold).toFixed(1)}s · aiming at {preview || "a miss"}
          </p>
        </>
      ) : (
        <>
          <p
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            Your turn · {shotsLeft} left
          </p>
          <AimHint size={168} accent={accent} />
          <p className="max-w-[16rem] text-center text-sm leading-5 text-black/55">
            Point the <span className="font-medium text-black">back</span> of the
            phone at the TV — screen facing you — then tap Ready. Tilt to aim and
            hold still for {AIM.holdSeconds} seconds to loose.
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
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {round.order.map((player) => {
          const isSelf = player.id === selfId;
          const fired = round.shots[player.id] ?? [];
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
              {isSelf ? "You" : player.name} · {totalFor(fired)}
              <span className={isSelf ? "opacity-70" : "opacity-45"}>
                {` (${fired.length}/${ARROWS_PER_PLAYER})`}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Aim offset to pixels inside the 160px sight, clamped just past the rim. */
function clampPx(value: number) {
  return Math.max(Math.min(value, 1.35), -1.35) * 64;
}
