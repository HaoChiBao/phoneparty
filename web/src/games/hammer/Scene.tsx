"use client";

import { PerspectiveCamera } from "@react-three/drei";
import type { ReactNode } from "react";
import { HostCanvas } from "@/games/shared/HostCanvas";
import type { GameSceneProps } from "@/games/types";
import { useRoundState } from "./logic";
import { Orchard } from "./Orchard";

const ACCENT = "#0057FF";

function Stage({ children }: { children: ReactNode }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[-0.6, 3.3, 12.2]} fov={48} />
      <hemisphereLight color="#eef4ff" groundColor="#6a8f4e" intensity={0.85} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 10, 4]} intensity={1.15} />
      <pointLight position={[-3, 5, 3]} intensity={8} color="#ffd9a8" distance={16} />
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
          <Orchard
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
                Apples
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
                {round.winner ? `${round.winner.name} wins` : "No apples"}
                {round.winner ? (
                  <span className="ml-3 text-black/45">
                    {round.swings[round.winner.id]?.score ?? 0} apples
                  </span>
                ) : null}
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
