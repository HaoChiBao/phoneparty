"use client";

import { Grid, PerspectiveCamera } from "@react-three/drei";
import type { ReactNode } from "react";
import { HostCanvas } from "@/games/shared/HostCanvas";
import type { GameSceneProps } from "@/games/types";
import { useRoundState } from "./logic";
import { SwingHint } from "./SwingHint";
import { Tower } from "./Tower";

const ACCENT = "#0057FF";

function Stage({ children }: { children: ReactNode }) {
  return (
    <>
      <color attach="background" args={["#f4f6fa"]} />
      <fog attach="fog" args={["#f4f6fa", 16, 38]} />
      <PerspectiveCamera makeDefault position={[0, 3.9, 12.4]} fov={50} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 9, 6]} intensity={1.1} />
      <pointLight position={[0, 8, 3]} intensity={12} color={ACCENT} distance={18} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[24, 20]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <Grid
        args={[24, 20]}
        cellSize={0.5}
        cellThickness={0.45}
        cellColor="#d7dce6"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#111111"
        fadeDistance={26}
        position={[0, 0.01, 0]}
      />
      {children}
    </>
  );
}

export function HammerScene({ controllers, actionsByPlayer }: GameSceneProps) {
  const round = useRoundState(controllers, actionsByPlayer);
  const activeColor = round.current?.color ?? ACCENT;

  return (
    <>
      <HostCanvas>
        <Stage>
          <Tower
            order={round.order}
            swings={round.swings}
            lastSwing={round.lastSwing}
            roundId={round.roundId}
            accent={ACCENT}
          />
        </Stage>
      </HostCanvas>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex justify-center px-5 pb-10">
        <div className="flex max-w-2xl flex-col items-center gap-3 bg-white/92 px-6 py-4 text-center">
          {round.order.length === 0 ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                Hammer
              </p>
              <p className="text-2xl font-bold tracking-tight">
                Waiting for a phone…
              </p>
              <p className="text-sm text-black/55">
                Scan the QR, tap Enable motion, then swing the phone down like a
                mallet.
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
                    {round.swings[round.winner.id]?.score ?? 0}
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-black/55">
                Tap <span className="font-medium text-black">New round</span> on
                any phone to play again.
              </p>
            </>
          ) : (
            <>
              <p
                className="text-[11px] uppercase tracking-[0.22em]"
                style={{ color: activeColor }}
              >
                Up now
              </p>
              <p className="text-3xl font-bold tracking-tight">
                {round.current?.name}
              </p>
              <div className="flex items-center gap-4">
                <SwingHint size={128} accent={activeColor} />
                <p className="max-w-[16rem] text-left text-sm leading-5 text-black/60">
                  Hold the phone flat with the camera facing the floor, keep it
                  still, then drive it straight down. Tilting does not count.
                </p>
              </div>
            </>
          )}

          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {round.order.map((player) => {
              const record = round.swings[player.id];
              const isCurrent = round.current?.id === player.id;
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
                  {player.name} · {record ? record.score : "—"}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
