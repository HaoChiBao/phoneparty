"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { GameSign } from "@/components/GameSign";
import { getGame, listAdvancedGames, listFeaturedGames } from "@/games/catalog";
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
  const game = getGame(gameId);
  const featured = listFeaturedGames();
  const advanced = listAdvancedGames();
  const advancedSelected = advanced.some((game) => game.id === gameId);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (advancedSelected) setAdvancedOpen(true);
  }, [advancedSelected]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5">
      <img
        src="/bearlympics.png"
        alt="Bearlympics"
        className="pointer-events-none absolute left-1/2 top-4 z-[1] h-[clamp(3.25rem,7.5vw,6.25rem)] w-auto max-w-[46vw] -translate-x-1/2 object-contain drop-shadow-[0_3px_10px_rgba(0,0,0,0.45)]"
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
            {connected ? "Realtime connected" : "Connecting…"}
            {error ? ` · ${error}` : ""}
          </p>
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {featured.map((game) => {
              const selected = game.id === gameId;
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => onSelectGame(game.id)}
                  className={
                    selected
                      ? "rounded-lg bg-accent px-2 py-1 text-xs text-white"
                      : "rounded-lg border border-white/70 bg-transparent px-2 py-1 text-xs text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
                  }
                >
                  {game.title}
                </button>
              );
            })}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                className={
                  advancedSelected
                    ? "rounded-lg bg-accent px-2 py-1 text-xs text-white"
                    : "rounded-lg border border-white/70 bg-transparent px-2 py-1 text-xs text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
                }
              >
                Advanced {advancedOpen ? "▴" : "▾"}
              </button>
              {advancedOpen ? (
                <div className="absolute left-0 top-full z-20 mt-1 flex min-w-[8.5rem] flex-col gap-1">
                  {advanced.map((game) => {
                    const selected = game.id === gameId;
                    return (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => onSelectGame(game.id)}
                        className={
                          selected
                            ? "rounded-lg bg-accent px-2 py-1 text-left text-xs text-white"
                            : "rounded-lg border border-white/70 bg-transparent px-2 py-1 text-left text-xs text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
                        }
                      >
                        {game.title}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="pointer-events-auto overflow-hidden rounded-2xl border border-black bg-white p-3">
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
      </div>
      <GameSign
        title={game.title}
        body={game.howToPlay ?? game.blurb}
        code={code}
      />
      <div className="pointer-events-auto flex flex-wrap justify-start gap-2 pb-1 pr-[min(27rem,42vw)]">
        {controllers.length === 0 ? (
          <span className="rounded-2xl bg-white/90 px-3 py-1.5 text-xs text-black/55">
            Waiting for a phone…
          </span>
        ) : (
          controllers.map((player) => {
            const motion = gyroByPlayer[player.id];
            return (
              <span
                key={player.id}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-white"
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
