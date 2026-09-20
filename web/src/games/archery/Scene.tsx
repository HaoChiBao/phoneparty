"use client";

import { Grid, PerspectiveCamera } from "@react-three/drei";
import { useMemo, type ReactNode } from "react";
import { HostCanvas } from "@/games/shared/HostCanvas";
import type { GameSceneProps } from "@/games/types";
import { aimFromSample } from "./aim";
import { AimHint } from "./AimHint";
import { ARROWS_PER_PLAYER, totalFor, useRoundState } from "./logic";
import { Target, TARGET_Z } from "./Target";

const ACCENT = "#0057FF";

function Stage({ children }: { children: ReactNode }) {
  return (
    <>
      <color attach="background" args={["#f4f6fa"]} />
      <fog attach="fog" args={["#f4f6fa", 14, 34]} />
      <PerspectiveCamera makeDefault position={[0, 2.2, 1.2]} fov={40} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 7, 4]} intensity={1.05} />
      <pointLight position={[0, 4, TARGET_Z + 3]} intensity={9} color={ACCENT} distance={16} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[26, 30]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <Grid
        args={[26, 30]}
        cellSize={0.5}
        cellThickness={0.45}
        cellColor="#d7dce6"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#111111"
        fadeDistance={30}
        position={[0, 0.01, 0]}
      />
      {children}
    </>
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

  return (
    <>
      <HostCanvas>
        <Stage>
          <Target
            order={round.order}
            shots={round.shots}
            lastShot={round.lastShot}
            liveAim={liveAim}
            liveColor={activeColor}
            roundId={round.roundId}
          />
        </Stage>
      </HostCanvas>

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
              <p className="text-sm text-black/55">
                Scan the QR, tap Enable motion, then aim with the back of the
                phone.
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
              <p className="text-sm text-black/55">
                Tap <span className="font-medium text-black">New round</span> on
                any phone to shoot again.
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
              <p className="text-sm text-black/55">
                Hold it steady. The arrow looses on its own.
              </p>
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
              <div className="flex items-center gap-4">
                <AimHint size={124} accent={activeColor} />
                <p className="max-w-[17rem] text-left text-sm leading-5 text-black/60">
                  Point the back of the phone at the TV, screen facing you, and
                  tap Ready. Tilt to aim, then hold still.
                </p>
              </div>
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
