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
      setError(err instanceof Error ? err.message : "Could not start a party");
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
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-xs uppercase tracking-[0.32em] text-[#c4f542]">
        Wii-style phone remote
      </p>
      <h1 className="mt-4 text-5xl font-semibold tracking-tight text-[#f4f1e6] sm:text-6xl">
        Phone Party
      </h1>
      <p className="mt-4 max-w-md text-base leading-7 text-[#d7d3c4]">
        Host a 3D room on the TV. Phones join with a QR code and steer a pointer
        with the gyro.
      </p>
      <div className="mt-10 flex flex-col gap-3">
        <button
          type="button"
          onClick={hostParty}
          disabled={busy}
          className="rounded-full bg-[#c4f542] px-5 py-4 text-base font-semibold text-[#14150f] disabled:opacity-60"
        >
          {busy ? "Opening room…" : "Host a party"}
        </button>
        <form onSubmit={joinParty} className="flex gap-2">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ROOM"
            maxLength={6}
            className="w-full rounded-full border border-[#3a3d31] bg-[#1c1d16] px-5 py-3 font-mono tracking-[0.3em] text-[#f4f1e6] outline-none focus:border-[#c4f542]"
          />
          <button
            type="submit"
            className="rounded-full border border-[#3a3d31] px-5 py-3 text-sm font-medium text-[#f4f1e6]"
          >
            Join
          </button>
        </form>
        {error && <p className="text-sm text-[#ff6b8a]">{error}</p>}
      </div>
    </main>
  );
}
