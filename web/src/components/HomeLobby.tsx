"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_GAME_ID } from "@/lib/protocol";
import { createRoom } from "@/lib/realtime";

const PLANKS = [
  {
    label: "Archery",
    gameId: "archery",
    style: { left: "13.9%", top: "15.2%", width: "63.3%", height: "12.9%" },
  },
  {
    label: "Fishing",
    gameId: "fishing",
    style: { left: "27%", top: "34%", width: "62.1%", height: "12.9%" },
  },
  {
    label: "Beer pong",
    gameId: "beer-pong",
    style: { left: "13.1%", top: "52.7%", width: "61.7%", height: "12.9%" },
  },
  {
    label: "Host game",
    gameId: DEFAULT_GAME_ID,
    style: { left: "26.2%", top: "71.1%", width: "62.7%", height: "12.1%" },
  },
] as const;

export function HomeLobby() {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function hostGame(gameId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom(gameId);
      router.push(`/play/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a room");
      setBusy(false);
    }
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-[#7eb8e6]">
      <img
        src="/landing.jpg"
        alt=""
        className="pointer-events-none absolute left-1/2 top-0 max-w-none will-change-transform motion-reduce:transition-none"
        style={{
          height: "max(175dvh, 100vw)",
          width: "auto",
          transform: entered
            ? "translate(-50%, calc(100dvh - 100%))"
            : "translate(-50%, 0)",
          transition: "transform 1.15s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />

      <div
        className="absolute left-1/2 z-10 flex w-full max-w-3xl flex-col items-center px-6 transition-[top,transform] duration-[1150ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{
          top: entered ? "11%" : "50%",
          transform: entered ? "translate(-50%, 0)" : "translate(-50%, -50%)",
        }}
      >
        <img
          src="/bearlympics.png"
          alt="Bearlympics"
          className="h-auto w-[min(78vw,40rem)] object-contain mix-blend-screen drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
        />
        <button
          type="button"
          onClick={() => setEntered(true)}
          tabIndex={entered ? -1 : 0}
          aria-hidden={entered}
          className={`mt-8 h-12 min-w-40 bg-accent px-8 text-[15px] font-medium text-white transition-opacity duration-300 motion-reduce:transition-none ${
            entered ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          Enter
        </button>
      </div>

      <div
        className={`absolute bottom-[2vh] right-[1.5vw] z-10 w-[min(42vw,26rem)] origin-bottom-right transition-opacity duration-500 motion-reduce:transition-none ${
          entered
            ? "opacity-100 delay-300"
            : "pointer-events-none opacity-0"
        }`}
      >
        <div className={`relative ${busy ? "opacity-70" : ""}`}>
          <img
            src="/landing-sign.png"
            alt=""
            className="pointer-events-none h-auto w-full select-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.28)]"
          />
          {PLANKS.map((plank) => (
            <button
              key={plank.label}
              type="button"
              disabled={busy}
              onClick={() => hostGame(plank.gameId)}
              style={plank.style}
              className="absolute cursor-pointer rounded-sm bg-transparent hover:bg-white/10 disabled:cursor-wait"
              aria-label={
                plank.label === "Host game"
                  ? "Host a game"
                  : `Host ${plank.label}`
              }
            />
          ))}
        </div>
        {error && (
          <p className="mt-2 text-right text-sm font-medium text-black">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
