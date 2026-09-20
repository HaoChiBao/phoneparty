"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalibratedPose, GameActionState, Player } from "@/lib/protocol";
import { scoreFromAim } from "./aim";

export const ARROWS_PER_PLAYER = 3;

export type Shot = {
  playerId: string;
  x: number;
  y: number;
  score: number;
  timestamp: number;
};

export type RoundState = {
  roundId: number;
  order: Player[];
  shots: Record<string, Shot[]>;
  zeroByPlayer: Record<string, CalibratedPose>;
  current: Player | null;
  arrowsLeft: number;
  done: boolean;
  ranking: { player: Player; total: number }[];
  winner: Player | null;
  lastShot: Shot | null;
};

/** Same ordering rule as the other turn games: join order, ties by id. */
export function turnOrder(controllers: Player[]) {
  return [...controllers].sort(
    (a, b) => a.connectedAt - b.connectedAt || a.id.localeCompare(b.id),
  );
}

export function totalFor(shots: Shot[] | undefined) {
  return (shots ?? []).reduce((sum, shot) => sum + shot.score, 0);
}

function readNumber(value: unknown, limit: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(Math.max(value, -limit), limit);
}

function readAim(data: unknown) {
  if (!data || typeof data !== "object") return null;
  // Far off the face is a legal miss; anything wilder is a bad payload.
  const x = readNumber((data as { x?: unknown }).x, 8);
  const y = readNumber((data as { y?: unknown }).y, 8);
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

function nextUp(order: Player[], shots: Record<string, Shot[]>) {
  return (
    order.find((player) => (shots[player.id]?.length ?? 0) < ARROWS_PER_PLAYER) ??
    null
  );
}

type Progress = {
  roundId: number;
  shots: Record<string, Shot[]>;
  zeroByPlayer: Record<string, CalibratedPose>;
  lastShot: Shot | null;
};

export const EMPTY_PROGRESS: Progress = {
  roundId: 0,
  shots: {},
  zeroByPlayer: {},
  lastShot: null,
};

export function applyActions(
  previous: Progress,
  actions: GameActionState[],
  order: Player[],
): Progress {
  let next = previous;
  for (const action of actions) {
    if (action.type === "restart") {
      next = {
        roundId: next.roundId + 1,
        shots: {},
        zeroByPlayer: {},
        lastShot: null,
      };
      continue;
    }

    if (action.type === "draw") {
      // The pose the archer zeroed on, so the TV can draw their live crosshair.
      const pose = readPose(action.data);
      if (!pose) continue;
      next = {
        ...next,
        zeroByPlayer: { ...next.zeroByPlayer, [action.playerId]: pose },
      };
      continue;
    }

    if (action.type !== "loose") continue;
    const aim = readAim(action.data);
    if (!aim) continue;
    // Only the archer whose turn it is, and only while they have arrows left.
    if (nextUp(order, next.shots)?.id !== action.playerId) continue;
    const shot: Shot = {
      playerId: action.playerId,
      x: aim.x,
      y: aim.y,
      score: scoreFromAim(aim.x, aim.y),
      timestamp: action.timestamp,
    };
    const fired = [...(next.shots[action.playerId] ?? []), shot];
    const zeroByPlayer = { ...next.zeroByPlayer };
    // The draw is spent; the archer re-zeroes for the next arrow.
    delete zeroByPlayer[action.playerId];
    next = {
      roundId: next.roundId,
      shots: { ...next.shots, [action.playerId]: fired },
      zeroByPlayer,
      lastShot: shot,
    };
  }
  return next;
}

/**
 * Reduces the live action stream into a round. `actionsByPlayer` keeps only the
 * newest action per player, so new events are spotted by a rising timestamp.
 * A phone that joins mid-round starts with an empty scoreboard until the next
 * round; the TV has been in the room throughout.
 */
export function useRoundState(
  controllers: Player[],
  actionsByPlayer: Record<string, GameActionState>,
): RoundState {
  const order = useMemo(() => turnOrder(controllers), [controllers]);
  const orderRef = useRef(order);
  const seen = useRef<Record<string, number>>({});
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);

  // Declared first so the order is current before actions are applied below.
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    const fresh = Object.values(actionsByPlayer)
      .filter((action) => action.timestamp > (seen.current[action.playerId] ?? 0))
      .sort((a, b) => a.timestamp - b.timestamp);
    if (fresh.length === 0) return;
    for (const action of fresh) {
      seen.current[action.playerId] = action.timestamp;
    }
    setProgress((current) => applyActions(current, fresh, orderRef.current));
  }, [actionsByPlayer]);

  return useMemo(() => {
    const current = nextUp(order, progress.shots);
    const done = order.length > 0 && current === null;
    const ranking = order
      .map((player) => ({ player, total: totalFor(progress.shots[player.id]) }))
      .filter((entry) => (progress.shots[entry.player.id]?.length ?? 0) > 0)
      .sort((a, b) => b.total - a.total);
    return {
      roundId: progress.roundId,
      order,
      shots: progress.shots,
      zeroByPlayer: progress.zeroByPlayer,
      current,
      arrowsLeft: current
        ? ARROWS_PER_PLAYER - (progress.shots[current.id]?.length ?? 0)
        : 0,
      done,
      ranking,
      winner: done && ranking.length > 0 ? ranking[0].player : null,
      lastShot: progress.lastShot,
    };
  }, [order, progress]);
}
