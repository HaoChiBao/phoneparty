"use client";

import { PerspectiveCamera } from "@react-three/drei";
import type { ReactNode } from "react";
import { HostCanvas } from "@/games/shared/HostCanvas";
import { ShadowLight } from "@/games/shared/ShadowLight";
import type { GameSceneProps } from "@/games/types";
import { Grove } from "./Grove";
import { useRoundClock, useRoundState } from "./logic";

function Stage({ span, children }: { span: number; children: ReactNode }) {
  // Pull back as the grove widens so every tree stays on screen.
  const distance = 9.4 + span * 1.15;
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 3.4, distance]} fov={46} />
      <ambientLight intensity={0.78} />
      <ShadowLight position={[6, 12, 8]} intensity={1.25} coverage={18} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#6fa35a" />
      </mesh>
      {children}
    </>
  );
}

export function ShakeScene({ controllers, actionsByPlayer }: GameSceneProps) {
  const round = useRoundState(controllers, actionsByPlayer);
  const { phase, secondsLeft, countdown } = useRoundClock(round.startedAt);
  const leaders = round.winners.map((player) => player.id);
  const playing = round.order.filter((player) =>
    round.joined.includes(player.id),
  );

  return (
    <>
      <HostCanvas>
        <Stage span={Math.max(playing.length, 1)}>
          <Grove
            order={playing}
            apples={round.apples}
            leaders={phase === "over" ? leaders : []}
          />
        </Stage>
      </HostCanvas>

      {/* the counter, up top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex justify-center px-5 pt-24">
        <div className="flex flex-col items-center gap-3 text-center">
          {phase === "shaking" ? (
            <div className="rounded-2xl bg-white/92 px-6 py-3">
              <p className="text-5xl font-bold tabular-nums tracking-tight">
                {secondsLeft}
                <span className="ml-2 text-base font-normal text-black/45">
                  seconds left
                </span>
              </p>
            </div>
          ) : phase === "countdown" ? (
            <div className="rounded-2xl bg-white/92 px-6 py-3">
              <p className="text-5xl font-bold tabular-nums tracking-tight text-accent">
                {countdown || "GO"}
              </p>
            </div>
          ) : null}
          {playing.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-1">
              {round.ranking.map((entry) => {
                const winning =
                  phase === "over" && leaders.includes(entry.player.id);
                return (
                  <p
                    key={entry.player.id}
                    className="text-4xl font-bold tracking-tight tabular-nums"
                    style={{
                      color: entry.player.color,
                      opacity: winning || phase !== "over" ? 1 : 0.45,
                    }}
                  >
                    {entry.apples}
                    <span className="ml-2 text-lg font-medium opacity-70">
                      {entry.player.name}
                    </span>
                  </p>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {round.order.length === 0 || phase === "over" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex justify-end px-5 pb-16">
          <div className="max-w-lg rounded-2xl bg-white/92 px-6 py-4 text-right">
            {round.order.length === 0 ? (
              <>
                <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                  Shake
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  Waiting for a phone…
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                  Time
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {round.winners.length === 0
                    ? "Nothing fell"
                    : round.winners.length > 1
                      ? `${round.winners.map((p) => p.name).join(" and ")} tie`
                      : `${round.winners[0].name} wins`}
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
