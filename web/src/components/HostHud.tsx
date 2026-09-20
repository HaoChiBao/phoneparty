"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { listGames } from "@/games/catalog";
import type { GyroSample, Player } from "@/lib/protocol";

export function HostHud({
  code,
  joinUrl,
  players,
  connected,
  error,
  gyroByPlayer,
  gameId,
  onSelectGame,
  onKick,
}: {
  code: string;
  joinUrl: string;
  players: Player[];
  connected: boolean;
  error: string | null;
  gyroByPlayer: Record<string, GyroSample>;
  gameId: string;
  onSelectGame: (gameId: string) => void;
  onKick: (playerId: string) => void;
}) {
  const controllers = players.filter((player) => player.role === "controller");
  const games = listGames().filter(
    (game) => game.id !== "range" && game.id !== "sandbox",
  );
  const currentGame = games.find((game) => game.id === gameId);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (controllers.length >= 2) setOpen(false);
  }, [controllers.length]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5">
      <div className="flex items-start justify-between gap-4">
        {open ? (
          <>
            <div className="rounded-sm bg-white/90 px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
                  TV room
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="pointer-events-auto text-[11px] uppercase tracking-[0.18em] text-black/45"
                >
                  Hide
                </button>
              </div>
              <h1 className="mt-1 text-4xl font-bold tracking-tight">{code}</h1>
              <p className="mt-2 max-w-xs text-sm text-black/60">
                Scan the QR with a phone. Two phones max.
              </p>
              <p className="mt-2 text-xs text-black/45">
                {connected ? "Realtime connected" : "Connecting…"}
                {error ? ` · ${error}` : ""}
              </p>
              <div className="pointer-events-auto mt-3 flex flex-wrap gap-2">
                {games.map((game) => {
                  const selected = game.id === gameId;
                  return (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => onSelectGame(game.id)}
                      className={
                        selected
                          ? "bg-accent px-2 py-1 text-xs text-white"
                          : "border border-black/20 bg-white px-2 py-1 text-xs"
                      }
                    >
                      {game.title}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="pointer-events-auto border border-black bg-white p-3">
              {joinUrl ? (
                <QRCodeSVG
                  value={joinUrl}
                  size={140}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  includeMargin={false}
                />
              ) : (
                <div className="h-[140px] w-[140px] bg-black/5" />
              )}
              <p className="mt-2 max-w-[140px] text-center text-[11px] leading-4 text-black/55">
                Phone controller
              </p>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto rounded-sm bg-white/90 px-3 py-2 text-left"
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
              Room
            </p>
            <p className="text-xl font-bold tracking-tight">{code}</p>
            <p className="text-xs text-black/45">
              {currentGame?.title ?? "Game"}
              {error ? ` · ${error}` : ""}
            </p>
          </button>
        )}
      </div>
      <div className="pointer-events-auto flex flex-wrap gap-2 pb-1">
        {controllers.length === 0 ? (
          <span className="bg-white/90 px-3 py-1 text-xs text-black/55">
            Waiting for a phone…
          </span>
        ) : (
          controllers.map((player) => {
            const motion = gyroByPlayer[player.id];
            return (
              <span
                key={player.id}
                className="inline-flex items-center gap-2 px-3 py-1 text-xs text-white"
                style={{ background: player.color }}
              >
                {player.name}
                {motion
                  ? `  ${motion.x.toFixed(2)} ${motion.y.toFixed(2)} ${motion.z.toFixed(2)}`
                  : ""}
                <button
                  type="button"
                  onClick={() => onKick(player.id)}
                  className="underline decoration-white/70 underline-offset-2"
                >
                  Kick
                </button>
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
