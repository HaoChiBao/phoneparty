"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { listGames } from "@/games/catalog";
import { DEFAULT_GAME_ID } from "@/lib/protocol";
import { createRoom } from "@/lib/realtime";

export function HomeLobby() {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [code, setCode] = useState("");
  const [gameId, setGameId] = useState(DEFAULT_GAME_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const games = listGames().filter(
    (game) => game.id !== "range" && game.id !== "sandbox",
  );

  async function hostParty() {
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

  function joinParty(event: FormEvent) {
    event.preventDefault();
    const next = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (next.length < 4) {
      setError("Enter the 4-character room code");
      return;
    }
    router.push(`/c/${next}`);
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
        className={`absolute inset-x-0 bottom-0 z-10 flex justify-center overflow-y-auto px-6 pb-8 pt-4 transition-opacity duration-500 motion-reduce:transition-none ${
          entered
            ? "opacity-100 delay-300"
            : "pointer-events-none opacity-0 delay-0"
        }`}
      >
        <div className="w-full max-w-lg rounded-2xl bg-white/92 p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            Phone remote
          </p>
          <p className="mt-2 text-[17px] leading-6 text-black/70">
            Pick a game, open it on the TV, then join with a phone. Aim with the
            front of the phone (the camera side).
          </p>

          <div className="mt-5 flex flex-col gap-2">
            {games.map((game) => {
              const selected = game.id === gameId;
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => setGameId(game.id)}
                  className={
                    selected
                      ? "border border-accent bg-accent px-4 py-3 text-left text-white"
                      : "border border-black/15 bg-white px-4 py-3 text-left"
                  }
                >
                  <span className="block text-[15px] font-medium">{game.title}</span>
                  <span
                    className={`mt-1 block text-sm ${selected ? "text-white/80" : "text-black/50"}`}
                  >
                    {game.blurb}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={hostParty}
              disabled={busy}
              className="h-12 bg-accent px-5 text-[15px] font-medium text-white disabled:opacity-50"
            >
              {busy ? "Opening room…" : "Host a room"}
            </button>
            <form onSubmit={joinParty} className="flex gap-2">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={6}
                aria-label="Room code"
                className="h-12 w-full border border-black/15 bg-white px-4 tracking-[0.28em] outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="h-12 border border-black px-5 text-[15px] font-medium"
              >
                Join
              </button>
            </form>
            {error && <p className="text-sm text-accent">{error}</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
