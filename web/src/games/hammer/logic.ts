"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameActionState, Player } from "@/lib/protocol";

export const MAX_SCORE = 100;
export const BELL_SCORE = 95;

export type SwingRecord = {
  playerId: string;
  power: number;
  score: number;
  timestamp: number;
};

export type RoundState = {
  roundId: number;
  order: Player[];
  swings: Record<string, SwingRecord>;
  current: Player | null;
  done: boolean;
  ranking: { player: Player; score: number }[];
  winner: Player | null;
  lastSwing: SwingRecord | null;
};

/**
 * Every client derives the round from the same two inputs: the room's player
 * list and the broadcast action stream. The server stays game agnostic.
 */
export function turnOrder(controllers: Player[]) {
  return [...controllers].sort(
    (a, b) => a.connectedAt - b.connectedAt || a.id.localeCompare(b.id),
  );
}

export function powerToScore(power: number) {
  return Math.round(clamp01(power) * MAX_SCORE);
}

export function scoreHeight(score: number) {
  return clamp01(score / MAX_SCORE);
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function readPower(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const value = (data as { power?: unknown }).power;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return clamp01(value);
}

function nextUp(order: Player[], swings: Record<string, SwingRecord>) {
  return order.find((player) => !swings[player.id]) ?? null;
}

export type Progress = {
  roundId: number;
  swings: Record<string, SwingRecord>;
  lastSwing: SwingRecord | null;
};

export const EMPTY_PROGRESS: Progress = {
  roundId: 0,
  swings: {},
  lastSwing: null,
};

export function applyActions(
  previous: Progress,
  actions: GameActionState[],
  order: Player[],
): Progress {
  let next = previous;
  for (const action of actions) {
    if (action.type === "restart") {
      next = { roundId: next.roundId + 1, swings: {}, lastSwing: null };
      continue;
    }
    if (action.type !== "swing") continue;
    const power = readPower(action.data);
    if (power === null) continue;
    // One swing each, and only the player whose turn it is may take it.
    if (nextUp(order, next.swings)?.id !== action.playerId) continue;
    const record: SwingRecord = {
      playerId: action.playerId,
      power,
      score: powerToScore(power),
      timestamp: action.timestamp,
    };
    next = {
      roundId: next.roundId,
      swings: { ...next.swings, [action.playerId]: record },
      lastSwing: record,
    };
  }
  return next;
}

/**
 * Reduces the live action stream into a round. `actionsByPlayer` only keeps the
 * newest action per player, so new events are detected by a rising timestamp.
 * A phone that joins mid-round has no history of earlier swings and will show
 * an empty scoreboard until the next round; the TV has been there throughout.
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
    const ranking = order
      .map((player) => ({
        player,
        score: progress.swings[player.id]?.score ?? -1,
      }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score);
    const current = nextUp(order, progress.swings);
    const done = order.length > 0 && current === null;
    return {
      roundId: progress.roundId,
      order,
      swings: progress.swings,
      current,
      done,
      ranking,
      winner: done && ranking.length > 0 ? ranking[0].player : null,
      lastSwing: progress.lastSwing,
    };
  }, [order, progress]);
}
