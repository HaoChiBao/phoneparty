"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createRoom } from "@/lib/realtime";

export function HomeLobby() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function hostParty() {
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom();
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
        Open a 3D room on the TV. Phones join with a QR code and aim with the
        gyro.
      </p>

      <div className="mt-10 flex flex-col gap-3">
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
