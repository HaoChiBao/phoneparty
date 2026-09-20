"use client";

import { QRCodeSVG } from "qrcode.react";
import type { Player } from "@/lib/protocol";

export function HostHud({
  code,
  joinUrl,
  players,
  connected,
  error,
}: {
  code: string;
  joinUrl: string;
  players: Player[];
  connected: boolean;
  error: string | null;
}) {
  const controllers = players.filter((player) => player.role === "controller");

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5 text-[#f4f1e6]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#c4f542]">
            Phone Party
          </p>
          <h1 className="mt-1 font-sans text-4xl font-semibold tracking-tight">
            {code}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-[#d7d3c4]">
            Scan the code with a phone. Point at the wall, then calibrate.
          </p>
          <p className="mt-3 text-xs text-[#9d9a8c]">
            {connected ? "Realtime connected" : "Connecting to session…"}
            {error ? ` · ${error}` : ""}
          </p>
        </div>
        <div className="pointer-events-auto rounded-2xl bg-[#f4f1e6] p-3 text-[#14150f] shadow-xl">
          <QRCodeSVG value={joinUrl} size={132} includeMargin={false} />
          <p className="mt-2 max-w-[132px] text-center text-[11px] leading-4">
            {joinUrl.replace(/^https?:\/\//, "")}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {controllers.length === 0 ? (
          <span className="rounded-full border border-[#3a3d31] bg-[#14150f]/80 px-3 py-1 text-xs">
            Waiting for a phone…
          </span>
        ) : (
          controllers.map((player) => (
            <span
              key={player.id}
              className="rounded-full px-3 py-1 text-xs text-[#14150f]"
              style={{ background: player.color }}
            >
              {player.name}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
