"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalibratedPose, GameActionState, Player } from "@/lib/protocol";
import {
  buildSchool,
  fishUnderHook,
  LEAD_IN_MS,
  pointsFor,
  reelsFor,
  ROUND_MS,
  type Fish,
  type FishKind,
} from "./school";

export type Phase = "idle" | "countdown" | "fishing" | "over";

export type Catch = {
  fishId: number;
  playerId: string;
  kind: FishKind;
  /** Milliseconds into the round, on the server's clock. */
  atMs: number;
  x: number;
  y: number;
};

export type Fight = {
  playerId: string;
  fishId: number;
  reels: number;
  hookedAt: number;
  x: number;
  y: number;
};

export type RoundState = {
  roundId: number;
  phase: Phase;
  /** Server timestamp of the action that started the round, 0 when idle. */
  startedAt: number;
  school: Fish[];
  caught: Catch[];
  caughtIds: ReadonlySet<number>;
  busyIds: ReadonlySet<number>;
  fights: Record<string, Fight>;
  countByPlayer: Record<string, number>;
  catchesByPlayer: Record<string, number>;
  zeroByPlayer: Record<string, CalibratedPose>;
  ranking: { player: Player; count: number; catches: number }[];
  winners: Player[];
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
  fights: Record<string, Fight>;
  zeroByPlayer: Record<string, CalibratedPose>;
};

export const EMPTY_PROGRESS: Progress = {
  roundId: 0,
  startedAt: 0,
  caught: [],
  fights: {},
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

function busyIds(progress: Progress) {
  const ids = new Set(progress.caught.map((entry) => entry.fishId));
  for (const fight of Object.values(progress.fights)) ids.add(fight.fishId);
  return ids;
}

function roundElapsed(startedAt: number, timestamp: number) {
  if (!startedAt) return null;
  const elapsed = timestamp - startedAt - LEAD_IN_MS;
  if (elapsed < 0 || elapsed > ROUND_MS) return null;
  return elapsed;
}

function readReels(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const n = (data as { n?: unknown }).n;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

/**
 * Hooks and reels are resolved against SERVER timestamps, which every client
 * sees the same value for, rather than any local clock — so the TV and all the
 * phones agree on who latched a fish first and when it came up.
 *
 * Reel sends a running click count, like Shake's stroke total, so the server
 * dropping a burst still lands the clicks the phone actually made.
 */
export function applyActions(
  previous: Progress,
  actions: GameActionState[],
): Progress {
  let next = previous;
  let school = buildSchool(next.roundId);
  for (const action of actions) {
    if (action.type === "restart") {
      next = {
        roundId: next.roundId + 1,
        startedAt: 0,
        caught: [],
        fights: {},
        zeroByPlayer: {},
      };
      school = buildSchool(next.roundId);
      continue;
    }

    if (action.type === "ready") {
      const pose = readPose(action.data);
      if (!pose) continue;
      next = {
        ...next,
        startedAt: next.startedAt || action.timestamp,
        zeroByPlayer: { ...next.zeroByPlayer, [action.playerId]: pose },
      };
      continue;
    }

    if (action.type === "hook") {
      if (next.fights[action.playerId]) continue;
      const paw = readPaw(action.data);
      if (!paw) continue;
      const elapsed = roundElapsed(next.startedAt, action.timestamp);
      if (elapsed === null) continue;
      const fish = fishUnderHook(school, elapsed, paw.x, paw.y, busyIds(next));
      if (!fish) continue;
      next = {
        ...next,
        fights: {
          ...next.fights,
          [action.playerId]: {
            playerId: action.playerId,
            fishId: fish.id,
            reels: 0,
            hookedAt: elapsed,
            x: paw.x,
            y: paw.y,
          },
        },
      };
      continue;
    }

    if (action.type !== "reel") continue;
    const fight = next.fights[action.playerId];
    if (!fight) continue;
    const elapsed = roundElapsed(next.startedAt, action.timestamp);
    if (elapsed === null) continue;
    const fish = school.find((entry) => entry.id === fight.fishId);
    if (!fish) continue;
    const counted = readReels(action.data);
    const reels = counted === null ? fight.reels + 1 : Math.max(fight.reels, counted);
    if (reels >= reelsFor(fish)) {
      const fights = { ...next.fights };
      delete fights[action.playerId];
      next = {
        ...next,
        fights,
        caught: [
          ...next.caught,
          {
            fishId: fish.id,
            playerId: action.playerId,
            kind: fish.kind,
            atMs: elapsed,
            x: fight.x,
            y: fight.y,
          },
        ],
      };
    } else {
      next = {
        ...next,
        fights: {
          ...next.fights,
          [action.playerId]: { ...fight, reels },
        },
      };
    }
  }
  return next;
}

/**
 * Reduces the live action stream into a round. Like the other games, state is
 * derived on every client rather than broadcast, so the server stays generic.
 */
export function useRoundState(
  controllers: Player[],
  actionsByPlayer: Record<string, GameActionState>,
  now: number,
): RoundState {
  const seen = useRef<Record<string, number>>({});
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const school = useMemo(() => buildSchool(progress.roundId), [progress.roundId]);

  useEffect(() => {
    const fresh = Object.values(actionsByPlayer)
      .filter((action) => action.timestamp > (seen.current[action.playerId] ?? 0))
      .sort(
        (a, b) =>
          a.timestamp - b.timestamp || a.playerId.localeCompare(b.playerId),
      );
    if (fresh.length === 0) return;
    for (const action of fresh) {
      seen.current[action.playerId] = action.timestamp;
    }
    setProgress((current) => applyActions(current, fresh));
  }, [actionsByPlayer]);

  return useMemo(() => {
    const countByPlayer: Record<string, number> = {};
    const catchesByPlayer: Record<string, number> = {};
    for (const entry of progress.caught) {
      const fish = school.find((item) => item.id === entry.fishId);
      const points = fish ? pointsFor(fish) : 1;
      countByPlayer[entry.playerId] = (countByPlayer[entry.playerId] ?? 0) + points;
      catchesByPlayer[entry.playerId] = (catchesByPlayer[entry.playerId] ?? 0) + 1;
    }
    const ranking = [...controllers]
      .map((player) => ({
        player,
        count: countByPlayer[player.id] ?? 0,
        catches: catchesByPlayer[player.id] ?? 0,
      }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          b.catches - a.catches ||
          a.player.connectedAt - b.player.connectedAt ||
          a.player.id.localeCompare(b.player.id),
      );
    const top = ranking[0]?.count ?? 0;
    const caughtIds = new Set(progress.caught.map((entry) => entry.fishId));
    const busy = busyIds(progress);
    return {
      roundId: progress.roundId,
      phase: phaseAt(progress.startedAt, now),
      startedAt: progress.startedAt,
      school,
      caught: progress.caught,
      caughtIds,
      busyIds: busy,
      fights: progress.fights,
      countByPlayer,
      catchesByPlayer,
      zeroByPlayer: progress.zeroByPlayer,
      ranking,
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
