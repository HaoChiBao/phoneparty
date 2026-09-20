"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameActionState, Player } from "@/lib/protocol";

export const ROUND_MS = 30_000;
/** Grace after the first Ready so the rest of the room can grab a trunk. */
export const LEAD_IN_MS = 3_000;
/** A stroke sent just after the whistle still counts; the wire has latency. */
export const GRACE_MS = 600;

export type Phase = "idle" | "countdown" | "shaking" | "over";

export type RoundState = {
  roundId: number;
  order: Player[];
  /** Server clock, so every client windows the round identically. */
  startedAt: number | null;
  joined: string[];
  apples: Record<string, number>;
  ranking: { player: Player; apples: number }[];
  winners: Player[];
};

/** Same ordering rule as the other games: join order, ties by id. */
export function playerOrder(controllers: Player[]) {
  return [...controllers].sort(
    (a, b) => a.connectedAt - b.connectedAt || a.id.localeCompare(b.id),
  );
}

export function shakeWindow(startedAt: number) {
  const opens = startedAt + LEAD_IN_MS;
  return { opens, closes: opens + ROUND_MS };
}

export function phaseAt(startedAt: number | null, now: number): Phase {
  if (startedAt === null) return "idle";
  const { opens, closes } = shakeWindow(startedAt);
  if (now < opens) return "countdown";
  if (now < closes) return "shaking";
  return "over";
}

function readStrokes(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const value = (data as { strokes?: unknown }).strokes;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // A cap keeps a bad payload from running away with the round. Thirty seconds
  // of the fastest human shaking lands nowhere near this.
  return Math.min(Math.max(Math.floor(value), 0), 2000);
}

type Progress = {
  roundId: number;
  startedAt: number | null;
  joined: string[];
  apples: Record<string, number>;
};

export const EMPTY_PROGRESS: Progress = {
  roundId: 0,
  startedAt: null,
  joined: [],
  apples: {},
};

export function applyActions(
  previous: Progress,
  actions: GameActionState[],
): Progress {
  let next = previous;
  for (const action of actions) {
    if (action.type === "restart") {
      next = {
        roundId: next.roundId + 1,
        startedAt: null,
        joined: [],
        apples: {},
      };
      continue;
    }

    if (action.type === "ready") {
      const joined = next.joined.includes(action.playerId)
        ? next.joined
        : [...next.joined, action.playerId];
      // The first bear to grab a trunk starts the clock for the whole grove.
      // A late one joins the round already running.
      const startedAt =
        next.startedAt === null ? action.timestamp : next.startedAt;
      next = { ...next, joined, startedAt };
      continue;
    }

    if (action.type !== "shake") continue;
    const strokes = readStrokes(action.data);
    if (strokes === null || next.startedAt === null) continue;
    const { opens, closes } = shakeWindow(next.startedAt);
    // Windowed on the server's clock, so a phone that keeps shaking after the
    // whistle — or starts early — cannot bank the extra.
    if (action.timestamp < opens || action.timestamp > closes + GRACE_MS) {
      continue;
    }
    // The phone sends its running total rather than one message per stroke, so
    // a dropped or rate-limited update costs nothing: the next one carries the
    // whole count. Taking the max keeps it from ever going backwards.
    const best = Math.max(next.apples[action.playerId] ?? 0, strokes);
    next = { ...next, apples: { ...next.apples, [action.playerId]: best } };
  }
  return next;
}

/**
 * Reduces the live action stream into a round. `actionsByPlayer` keeps only the
 * newest action per player, so new events are spotted by a rising timestamp.
 * Every client runs this same reduction, which is why the grove agrees on the
 * scores without the server knowing anything about the game.
 */
export function useRoundState(
  controllers: Player[],
  actionsByPlayer: Record<string, GameActionState>,
): RoundState {
  const order = useMemo(() => playerOrder(controllers), [controllers]);
  const seen = useRef<Record<string, number>>({});
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);

  useEffect(() => {
    const fresh = Object.values(actionsByPlayer)
      .filter((action) => action.timestamp > (seen.current[action.playerId] ?? 0))
      .sort((a, b) => a.timestamp - b.timestamp);
    if (fresh.length === 0) return;
    for (const action of fresh) {
      seen.current[action.playerId] = action.timestamp;
    }
    setProgress((current) => applyActions(current, fresh));
  }, [actionsByPlayer]);

  return useMemo(() => {
    const ranking = order
      .map((player) => ({ player, apples: progress.apples[player.id] ?? 0 }))
      .filter((entry) => progress.joined.includes(entry.player.id))
      .sort((a, b) => b.apples - a.apples);
    const top = ranking[0]?.apples ?? 0;
    return {
      roundId: progress.roundId,
      order,
      startedAt: progress.startedAt,
      joined: progress.joined,
      apples: progress.apples,
      ranking,
      // A dead heat is a shared win rather than a coin toss on sort order.
      winners:
        top > 0
          ? ranking.filter((entry) => entry.apples === top).map((e) => e.player)
          : [],
    };
  }, [order, progress]);
}

/**
 * Round time for rendering. The server clock sets when the round began, but the
 * countdown is driven off a local anchor taken when that start was first seen,
 * so the numbers tick smoothly on a device whose clock is off by seconds.
 */
export function useRoundClock(startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  const anchor = useRef<{ server: number; local: number } | null>(null);

  useEffect(() => {
    if (startedAt === null) {
      anchor.current = null;
      return;
    }
    anchor.current = { server: startedAt, local: performance.now() };
  }, [startedAt]);

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => {
      const at = anchor.current;
      setNow(at ? at.server + (performance.now() - at.local) : Date.now());
    }, 100);
    return () => clearInterval(id);
  }, [startedAt]);

  const phase = phaseAt(startedAt, now);
  if (startedAt === null) {
    return { phase, now, secondsLeft: ROUND_MS / 1000, countdown: 0 };
  }
  const { opens, closes } = shakeWindow(startedAt);
  return {
    phase,
    now,
    secondsLeft: Math.max(0, Math.ceil((closes - now) / 1000)),
    countdown: Math.max(0, Math.ceil((opens - now) / 1000)),
  };
}
