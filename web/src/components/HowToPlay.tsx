"use client";

import { useState } from "react";

export function HowToPlay({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center px-5">
      <div className="pointer-events-auto relative w-full max-w-md bg-white/95 px-6 py-5 text-center">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 text-[11px] uppercase tracking-[0.18em] text-black/45"
        >
          Close
        </button>
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
          How to play
        </p>
        <p className="mt-2 text-2xl font-bold tracking-tight">{title}</p>
        <p className="mt-3 text-sm leading-5 text-black/60">{body}</p>
      </div>
    </div>
  );
}
