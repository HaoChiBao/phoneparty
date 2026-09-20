"use client";

import { QRCodeSVG } from "qrcode.react";
import type { GyroSample, Player } from "@/lib/protocol";

export function HostHud({
  code,
  joinUrl,
  players,
  connected,
  error,
  gyroByPlayer,
}: {
  code: string;
  joinUrl: string;
  players: Player[];
  connected: boolean;
  error: string | null;
  gyroByPlayer: Record<string, GyroSample>;
}) {
  const controllers = players.filter((player) => player.role === "controller");

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-sm bg-white/90 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            TV room
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight">{code}</h1>
          <p className="mt-2 max-w-xs text-sm text-black/60">
            Scan the QR with a phone. Point at the wall, then calibrate.
          </p>
          <p className="mt-2 text-xs text-black/45">
            {connected ? "Realtime connected" : "Connecting…"}
            {error ? ` · ${error}` : ""}
          </p>
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
      </div>
      <div className="flex flex-wrap gap-2 pb-1">
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
                className="px-3 py-1 text-xs text-white"
                style={{ background: player.color }}
              >
                {player.name}
                {motion
                  ? `  ${motion.x.toFixed(2)} ${motion.y.toFixed(2)} ${motion.z.toFixed(2)}`
                  : ""}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
