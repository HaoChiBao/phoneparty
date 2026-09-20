"use client";

import type { GyroSample, Player } from "@/lib/protocol";

/** Clip the square art just after the board so the post runs off the TV. */
const CLIP = "1024 / 520";

export function GameSign({
  title,
  players,
  gyroByPlayer,
  onKick,
}: {
  title: string;
  players: Player[];
  gyroByPlayer: Record<string, GyroSample>;
  onKick: (playerId: string) => void;
}) {
  return (
    <div
      className="pointer-events-none absolute bottom-3 right-0 z-[6] w-[min(26rem,40vw)] overflow-hidden"
      style={{ aspectRatio: CLIP }}
    >
      <img
        src="/game-sign.png"
        alt=""
        className="absolute left-0 top-0 w-full select-none"
      />
      <div
        className="absolute flex flex-col items-center justify-center text-center"
        style={{ top: "28%", left: "20%", right: "19%", height: "52%" }}
      >
        <p className="text-[clamp(1rem,2.1vw,1.35rem)] font-bold leading-none tracking-tight text-black">
          {title}
        </p>
        {players.length === 0 ? (
          <p className="mt-2 text-[clamp(11px,1.25vw,13px)] leading-4 text-black/65">
            Waiting for a phone…
          </p>
        ) : (
          <div className="pointer-events-auto mt-2 flex w-full flex-col gap-1">
            <p className="text-[10px] uppercase tracking-[0.16em] text-black/50">
              {players.length === 1 ? "1 player" : `${players.length} players`}
            </p>
            {players.map((player, index) => {
              const motion = gyroByPlayer[player.id];
              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between gap-2 text-left text-[clamp(10px,1.15vw,12px)] leading-4 text-black"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">Player {index + 1}</span>
                    <span className="text-black/55"> · {player.name}</span>
                    {motion ? (
                      <span className="ml-1 font-mono text-[10px] text-black/45">
                        {motion.x.toFixed(2)} {motion.y.toFixed(2)}{" "}
                        {motion.z.toFixed(2)}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => onKick(player.id)}
                    className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-black/45 underline decoration-black/30 underline-offset-2"
                  >
                    Kick
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
