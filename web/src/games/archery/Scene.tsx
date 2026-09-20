"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HostCanvas } from "@/games/shared/HostCanvas";
import type { GameSceneProps } from "@/games/types";
import { aimFromSample } from "./aim";
import { BowBear, type BowClip } from "./BowBear";
import { ARROWS_PER_PLAYER, totalFor, useRoundState } from "./logic";
import { RangeCamera } from "./RangeCamera";
import { Target, TARGET_Z } from "./Target";
import { windLabel, type Wind } from "./wind";

const ACCENT = "#0057FF";

function Stage({
  drawing,
  shotKey,
  children,
}: {
  drawing: boolean;
  shotKey: string;
  children: ReactNode;
}) {
  return (
    <>
      <RangeCamera drawing={drawing} shotKey={shotKey} />
      <ambientLight intensity={1.05} />
      <directionalLight position={[3, 7, 4]} intensity={1.15} />
      <pointLight position={[0, 4, TARGET_Z + 3]} intensity={6} color={ACCENT} distance={16} />
      {children}
    </>
  );
}

function WindTag({ wind }: { wind: Wind }) {
  const still = wind.speed < 0.02;
  return (
    <div className="flex items-center gap-2 text-xs tracking-wide text-black/55">
      <span className="uppercase tracking-[0.22em] text-black/35">Wind</span>
      {still ? null : (
        <svg
          width="26"
          height="14"
          viewBox="0 0 26 14"
          aria-hidden="true"
          style={{ transform: `rotate(${-wind.angleDeg}deg)` }}
        >
          <path
            d="M1 7 h20 M16 2 l5 5 l-5 5"
            fill="none"
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className="font-medium text-black">{windLabel(wind)}</span>
    </div>
  );
}

export function ArcheryScene({
  controllers,
  gyroByPlayer,
  actionsByPlayer,
}: GameSceneProps) {
  const round = useRoundState(controllers, actionsByPlayer);
  const current = round.current;
  const activeColor = current?.color ?? ACCENT;

  // The archer's live crosshair, from their gyro relative to the pose they
  // zeroed on when they tapped Ready. Cosmetic: the landing point that scores
  // is the one the phone sends with the loose.
  const zero = current ? round.zeroByPlayer[current.id] : undefined;
  const sample = current ? gyroByPlayer[current.id] : undefined;
  const liveAim = useMemo(
    () => (zero && sample ? aimFromSample(sample, zero) : null),
    [zero, sample],
  );
  // Changes once per arrow, which is what tells the camera to hold in close
  // long enough to watch the shot land.
  const shotKey = round.lastShot
    ? `${round.lastShot.playerId}:${round.lastShot.timestamp}`
    : "";
  const drawing = liveAim !== null;
  const currentId = current?.id ?? null;
  const [bowClip, setBowClip] = useState<BowClip>("idle");
  const [bowPlayId, setBowPlayId] = useState(0);
  const prevShot = useRef("");
  const prevCurrent = useRef<string | null>(null);
  const prevDrawing = useRef(false);
  const currentIdRef = useRef(currentId);
  const shooterRef = useRef<string | null>(null);
  currentIdRef.current = currentId;

  useEffect(() => {
    if (shotKey && shotKey !== prevShot.current) {
      prevShot.current = shotKey;
      shooterRef.current = round.lastShot?.playerId ?? null;
      setBowClip("release");
      setBowPlayId((id) => id + 1);
    } else if (drawing && !prevDrawing.current) {
      setBowClip("charge");
      setBowPlayId((id) => id + 1);
    } else if (!drawing && currentId !== prevCurrent.current && bowClip !== "release") {
      setBowClip("idle");
    }
    prevDrawing.current = drawing;
    prevCurrent.current = currentId;
  }, [shotKey, drawing, currentId, bowClip, round.lastShot?.playerId]);

  return (
    <>
      <HostCanvas>
        <Stage drawing={liveAim !== null} shotKey={shotKey}>
          <Target
            order={round.order}
            shots={round.shots}
            lastShot={round.lastShot}
            liveAim={liveAim}
            liveColor={activeColor}
            roundId={round.roundId}
            wind={round.wind}
          />
        </Stage>
      </HostCanvas>
      <BowBear
        clip={bowClip}
        playId={bowPlayId}
        onReleased={() => {
          setBowClip(
            currentIdRef.current === shooterRef.current ? "hold" : "idle",
          );
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex justify-center px-5 pb-10">
        <div className="flex max-w-2xl flex-col items-center gap-3 bg-white/92 px-6 py-4 text-center">
          {round.order.length === 0 ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                Archery
              </p>
              <p className="text-2xl font-bold tracking-tight">
                Waiting for a phone…
              </p>
            </>
          ) : round.done ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                Round over
              </p>
              <p className="text-3xl font-bold tracking-tight">
                {round.winner ? `${round.winner.name} wins` : "No score"}
                {round.winner ? (
                  <span className="ml-3 text-black/45">
                    {totalFor(round.shots[round.winner.id])}
                  </span>
                ) : null}
              </p>
            </>
          ) : liveAim ? (
            <>
              <p
                className="text-[11px] uppercase tracking-[0.22em]"
                style={{ color: activeColor }}
              >
                Drawing · arrow {ARROWS_PER_PLAYER - round.arrowsLeft + 1} of{" "}
                {ARROWS_PER_PLAYER}
              </p>
              <p className="text-3xl font-bold tracking-tight">
                {current?.name} is aiming
              </p>
              <WindTag wind={round.wind} />
            </>
          ) : (
            <>
              <p
                className="text-[11px] uppercase tracking-[0.22em]"
                style={{ color: activeColor }}
              >
                Up now · {round.arrowsLeft} of {ARROWS_PER_PLAYER} left
              </p>
              <p className="text-3xl font-bold tracking-tight">{current?.name}</p>
              <WindTag wind={round.wind} />
            </>
          )}

          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {round.order.map((player) => {
              const fired = round.shots[player.id] ?? [];
              const isCurrent = current?.id === player.id;
              return (
                <span
                  key={player.id}
                  className={
                    isCurrent
                      ? "px-3 py-1 text-xs font-medium text-white"
                      : "border px-3 py-1 text-xs"
                  }
                  style={
                    isCurrent
                      ? { background: player.color }
                      : { borderColor: player.color, color: "#111111" }
                  }
                >
                  {player.name} · {totalFor(fired)}
                  <span className={isCurrent ? "opacity-70" : "opacity-45"}>
                    {` (${fired.length}/${ARROWS_PER_PLAYER})`}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
