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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex justify-end px-5 pb-16">
        <div className="flex max-w-lg flex-col items-end gap-3 text-right">
          {round.order.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-x-8 gap-y-1">
              {round.order.map((player) => {
                const record = round.swings[player.id];
                const isCurrent = round.current?.id === player.id;
                return (
                  <p
                    key={player.id}
                    className="text-4xl font-bold tracking-tight tabular-nums"
                    style={{
                      color: player.color,
                      opacity: isCurrent || round.done ? 1 : 0.55,
                    }}
                  >
                    {record ? record.score : "0"}
                    <span className="ml-2 text-lg font-medium opacity-70">
                      {player.name}
                    </span>
                  </p>
                );
              })}
            </div>
          ) : null}

          <div className="rounded-2xl bg-white/92 px-6 py-4">
            {round.order.length === 0 ? (
              <>
                <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                  Apples
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  Waiting for a phone…
                </p>
              </>
            ) : round.done ? (
              <>
                <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                  Round over
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {round.winner ? `${round.winner.name} wins` : "No apples"}
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
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {round.current?.name}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
