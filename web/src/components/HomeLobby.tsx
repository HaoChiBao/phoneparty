"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const fieldRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"intro" | "overlay" | "done">("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = phase === "done";

  useEffect(() => {
    const video = fieldRef.current;
    if (!video) return;
    const play = video.play();
    if (play) play.catch(() => setPhase("overlay"));
  }, []);

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
      <video
        ref={fieldRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src="/landing.mp4"
        poster="/landing-poster.jpg"
        muted
        playsInline
        autoPlay
        preload="auto"
        onEnded={() => setPhase((current) => (current === "intro" ? "overlay" : current))}
      />

      {phase === "overlay" ? (
        <video
          className="pointer-events-none absolute bottom-[3vh] left-1/2 z-[9] h-auto w-[min(52vw,30rem)] -translate-x-1/2"
          src="/landing-overlay.webm"
          muted
          playsInline
          autoPlay
          preload="auto"
          onEnded={() => setPhase("done")}
          onError={() => setPhase("done")}
        />
      ) : null}

      <img
        src="/bearlympics.png"
        alt="Bearlympics"
        className={`pointer-events-none absolute left-1/2 z-10 origin-top object-contain mix-blend-screen drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition-[top,width,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          done
            ? "top-[7%] w-[min(86vw,46rem)] -translate-x-1/2 opacity-100"
            : "-top-[28%] w-[min(42vw,20rem)] -translate-x-1/2 opacity-0"
        }`}
      />

      <div
        className={`absolute inset-x-0 bottom-0 z-10 flex justify-end transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          done ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
      >
        <div className="relative -bottom-[8vh] -right-[1vw] w-[min(58vw,36rem)] origin-bottom rotate-[-5deg] skew-x-[-5deg]">
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
                disabled={busy || !done}
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
      </div>
    </main>
  );
}
