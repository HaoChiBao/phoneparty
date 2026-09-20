"use client";

import { PerspectiveCamera } from "@react-three/drei";
import type { ReactNode } from "react";
import { HostCanvas } from "@/games/shared/HostCanvas";
import { ShadowLight } from "@/games/shared/ShadowLight";
import type { GameSceneProps } from "@/games/types";
import { Grove } from "./Grove";
import { ROUND_MS, useRoundClock, useRoundState } from "./logic";
import { ShakeHint } from "./ShakeHint";

const ACCENT = "#0057FF";

function Stage({ span, children }: { span: number; children: ReactNode }) {
  // Pull back as the grove widens so every tree stays on screen.
  const distance = 9.4 + span * 1.15;
  return (
    <>
      <color attach="background" args={["#cfe7f2"]} />
      <fog attach="fog" args={["#cfe7f2", 20, 52]} />
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
        <div className="flex flex-col items-center gap-2 bg-white/92 px-6 py-3 text-center">
          {phase === "shaking" ? (
            <p className="text-5xl font-bold tabular-nums tracking-tight">
              {secondsLeft}
              <span className="ml-2 text-base font-normal text-black/45">
                seconds left
              </span>
            </p>
          ) : phase === "countdown" ? (
            <p className="text-5xl font-bold tabular-nums tracking-tight text-accent">
              {countdown || "GO"}
            </p>
          ) : null}
          {playing.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {round.ranking.map((entry) => {
                const winning =
                  phase === "over" && leaders.includes(entry.player.id);
                return (
                  <span
                    key={entry.player.id}
                    className="px-3 py-1 text-sm font-medium text-white"
                    style={{
                      background: entry.player.color,
                      opacity: winning || phase !== "over" ? 1 : 0.45,
                    }}
                  >
                    {entry.player.name} · {entry.apples}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex justify-center px-5 pb-10">
        <div className="flex max-w-2xl flex-col items-center gap-3 bg-white/92 px-6 py-4 text-center">
          {round.order.length === 0 ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                Shake
              </p>
              <p className="text-2xl font-bold tracking-tight">
                Waiting for a phone…
              </p>
              <p className="text-sm text-black/55">
                Scan the QR, tap Enable motion, then grab a trunk.
              </p>
            </>
          ) : phase === "over" ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                Time
              </p>
              <p className="text-3xl font-bold tracking-tight">
                {round.winners.length === 0
                  ? "Nothing fell"
                  : round.winners.length > 1
                    ? `${round.winners.map((p) => p.name).join(" and ")} tie`
                    : `${round.winners[0].name} wins`}
                {round.winners.length > 0 ? (
                  <span className="ml-3 text-black/45">
                    {round.apples[round.winners[0].id] ?? 0} apples
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-black/55">
                Tap <span className="font-medium text-black">Shake again</span>{" "}
                on any phone.
              </p>
            </>
          ) : phase === "shaking" ? (
            <p className="text-2xl font-bold tracking-tight">
              Shake the tree — fastest bear wins
            </p>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                {phase === "countdown"
                  ? "Get a grip on the trunk"
                  : `${ROUND_MS / 1000} seconds`}
              </p>
              <div className="flex items-center gap-4">
                <ShakeHint size={124} accent={ACCENT} />
                <p className="max-w-[17rem] text-left text-sm leading-5 text-black/60">
                  Hold the phone flat with the camera facing the ground, then
                  shake it left and right. Every shake knocks an apple loose.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
