"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalibratedPose, GameActionState, Player } from "@/lib/protocol";
import {
  buildSchool,
  fishUnderPaw,
  LEAD_IN_MS,
  ROUND_MS,
  type Fish,
} from "./school";

export type Phase = "idle" | "countdown" | "fishing" | "over";

export type Catch = {
  fishId: number;
  playerId: string;
  /** Milliseconds into the round, on the server's clock. */
  atMs: number;
};

export type RoundState = {
  roundId: number;
  phase: Phase;
  /** Server timestamp of the action that started the round, 0 when idle. */
  startedAt: number;
  school: Fish[];
  caught: Catch[];
  caughtIds: ReadonlySet<number>;
  countByPlayer: Record<string, number>;
  zeroByPlayer: Record<string, CalibratedPose>;
  ranking: { player: Player; count: number }[];
  winners: Player[];
  /** The most recent catch, for a splash on the TV. */
  lastCatch: Catch | null;
};

function readNumber(value: unknown, limit: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(Math.max(value, -limit), limit);
}

function readPaw(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const x = readNumber((data as { x?: unknown }).x, 40);
  const y = readNumber((data as { y?: unknown }).y, 40);
  if (x === null || y === null) return null;
  return { x, y };
}

function readPose(data: unknown): CalibratedPose | null {
  if (!data || typeof data !== "object") return null;
  const source = data as Record<string, unknown>;
  const alpha = readNumber(source.alpha, 360);
  const beta = readNumber(source.beta, 360);
  const gamma = readNumber(source.gamma, 360);
  if (alpha === null || beta === null || gamma === null) return null;
  return { alpha, beta, gamma, x: 0, y: 0, z: 0 };
}

type Progress = {
  roundId: number;
  startedAt: number;
  caught: Catch[];
  zeroByPlayer: Record<string, CalibratedPose>;
};

export const EMPTY_PROGRESS: Progress = {
  roundId: 0,
  startedAt: 0,
  caught: [],
  zeroByPlayer: {},
};

/** Where the round is at a given server time. */
export function phaseAt(startedAt: number, now: number): Phase {
  if (!startedAt) return "idle";
  const since = now - startedAt;
  if (since < LEAD_IN_MS) return "countdown";
  if (since < LEAD_IN_MS + ROUND_MS) return "fishing";
  return "over";
}

/**
 * Catches are resolved against SERVER timestamps, which every client sees the
 * same value for, rather than any local clock — so the TV and all the phones
 * agree on which salmon a paw took, and on who got there first.
 */
export function applyActions(
  previous: Progress,
  actions: GameActionState[],
  school: Fish[],
): Progress {
  let next = previous;
  for (const action of actions) {
    if (action.type === "restart") {
      next = {
        roundId: next.roundId + 1,
        startedAt: 0,
        caught: [],
        zeroByPlayer: {},
      };
      continue;
    }

    if (action.type === "ready") {
      const pose = readPose(action.data);
      if (!pose) continue;
      next = {
        ...next,
        // The first bear to put a paw up starts the clock for everyone.
        startedAt: next.startedAt || action.timestamp,
        zeroByPlayer: { ...next.zeroByPlayer, [action.playerId]: pose },
      };
      continue;
    }

    if (action.type !== "swipe") continue;
    if (!next.startedAt) continue;
    const paw = readPaw(action.data);
    if (!paw) continue;
    const elapsed = action.timestamp - next.startedAt - LEAD_IN_MS;
    // Nothing counts before the whistle or after time is up.
    if (elapsed < 0 || elapsed > ROUND_MS) continue;
    const taken = new Set(next.caught.map((entry) => entry.fishId));
    const fish = fishUnderPaw(school, elapsed, paw.x, paw.y, taken);
    // A miss costs nothing; the bear just swipes water.
    if (!fish) continue;
    next = {
      ...next,
      caught: [
        ...next.caught,
        { fishId: fish.id, playerId: action.playerId, atMs: elapsed },
      ],
    };
  }
  return next;
}

/**
 * Reduces the live action stream into a round. Like the other games, state is
 * derived on every client rather than broadcast, so the server stays generic.
 * `phase` needs a clock, so it is passed in rather than read here.
 */
export function useRoundState(
  controllers: Player[],
  actionsByPlayer: Record<string, GameActionState>,
  now: number,
): RoundState {
  const seen = useRef<Record<string, number>>({});
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const school = useMemo(() => buildSchool(progress.roundId), [progress.roundId]);
  const schoolRef = useRef(school);

  useEffect(() => {
    schoolRef.current = school;
  }, [school]);

  useEffect(() => {
    const fresh = Object.values(actionsByPlayer)
      .filter((action) => action.timestamp > (seen.current[action.playerId] ?? 0))
      .sort((a, b) => a.timestamp - b.timestamp);
    if (fresh.length === 0) return;
    for (const action of fresh) {
      seen.current[action.playerId] = action.timestamp;
    }
    setProgress((current) => applyActions(current, fresh, schoolRef.current));
  }, [actionsByPlayer]);

  return useMemo(() => {
    const countByPlayer: Record<string, number> = {};
    for (const entry of progress.caught) {
      countByPlayer[entry.playerId] = (countByPlayer[entry.playerId] ?? 0) + 1;
    }
    const ranking = [...controllers]
      .map((player) => ({ player, count: countByPlayer[player.id] ?? 0 }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.player.connectedAt - b.player.connectedAt ||
          a.player.id.localeCompare(b.player.id),
      );
    const top = ranking[0]?.count ?? 0;
    return {
      roundId: progress.roundId,
      phase: phaseAt(progress.startedAt, now),
      startedAt: progress.startedAt,
      school,
      caught: progress.caught,
      caughtIds: new Set(progress.caught.map((entry) => entry.fishId)),
      countByPlayer,
      zeroByPlayer: progress.zeroByPlayer,
      ranking,
      // A tie leaves more than one bear on top.
      winners: top > 0 ? ranking.filter((e) => e.count === top).map((e) => e.player) : [],
      lastCatch: progress.caught[progress.caught.length - 1] ?? null,
    };
  }, [controllers, now, progress, school]);
}

/** Seconds left, for the clock on the TV. */
export function secondsLeft(startedAt: number, now: number) {
  if (!startedAt) return ROUND_MS / 1000;
  const since = now - startedAt - LEAD_IN_MS;
  if (since < 0) return ROUND_MS / 1000;
  return Math.max(0, Math.ceil((ROUND_MS - since) / 1000));
}
