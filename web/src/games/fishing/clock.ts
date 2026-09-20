"use client";

import { useEffect, useRef, useState } from "react";
import type { GameActionState } from "@/lib/protocol";

/**
 * The room's clock, estimated from server-stamped actions.
 *
 * Phones and the TV do not share a wall clock, and the round is timed, so every
 * client needs the same notion of "now". Each action carries the server's
 * timestamp: the gap between that and the local clock is skew plus one-way
 * latency, so the LARGEST gap seen is the least-delayed sample and the best
 * estimate of skew alone.
 */
export function useServerClock(actionsByPlayer: Record<string, GameActionState>) {
  const [offset, setOffset] = useState(0);
  const best = useRef(Number.NEGATIVE_INFINITY);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const local = Date.now();
    let improved = false;
    for (const action of Object.values(actionsByPlayer)) {
      const delta = action.timestamp - local;
      if (delta > best.current) {
        best.current = delta;
        improved = true;
      }
    }
    if (improved) setOffset(best.current);
  }, [actionsByPlayer]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 100);
    return () => clearInterval(id);
  }, [offset]);

  return { now, offset };
}
