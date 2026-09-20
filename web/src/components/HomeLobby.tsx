"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { listGames } from "@/games/catalog";
import { DEFAULT_GAME_ID } from "@/lib/protocol";
import { createRoom } from "@/lib/realtime";

export function HomeLobby() {
  const router = useRouter();
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
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
        Phone remote
      </p>
      <h1 className="mt-3 text-5xl font-bold tracking-tight">Phone Party</h1>
      <p className="mt-4 max-w-sm text-[17px] leading-6 text-black/70">
        Pick a game, open it on the TV, then join with a phone. Aim with the
        front of the phone (the camera side).
      </p>

      <div className="mt-10 flex flex-col gap-2">
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
    </main>
  );
}
