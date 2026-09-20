import type { GameActionState, Player } from "@/lib/protocol";
import { liveCups } from "./layout";
import {
  applyMiss,
  beginFlight,
  currentId,
  emptyMatch,
  startMatch,
  syncTestPlayers,
  type Match,
  type Phase,
} from "./rules";
import type { LastThrowInfo } from "./TestPanel";

export const PONG_SYNC = "pong";
export const LIVE_GREEN = "#16a34a";
const FLIGHT_HOLD_MS = 4000;

export type PongSync = {
  phase: Phase;
  shooterId: string | null;
  shooterName: string | null;
  aLeft: number;
  bLeft: number;
  testing: boolean;
  redemption: boolean;
  overtime: boolean;
  message: string;
  lastResult: LastThrowInfo["result"] | null;
};

const PHASES: Phase[] = ["waiting", "aim", "flight", "over"];
const RESULTS: LastThrowInfo["result"][] = ["air", "sink", "bounce", "miss"];

export function actionOn(data: unknown, fallback = true) {
  if (typeof data !== "object" || data === null) return fallback;
  if (!("on" in data)) return fallback;
  return Boolean((data as { on?: unknown }).on);
}

export function viewFromMatch(
  match: Match,
  controllers: Player[],
  extras: { testing: boolean; lastResult?: LastThrowInfo["result"] | null },
): PongSync {
  const shooterId = currentId(match);
  const shooter = controllers.find((player) => player.id === shooterId);
  return {
    phase: match.phase,
    shooterId,
    shooterName: shooter?.name ?? null,
    aLeft: liveCups(match.cups, "a").length,
    bLeft: liveCups(match.cups, "b").length,
    testing: extras.testing,
    redemption: Boolean(match.redemption),
    overtime: match.overtime,
    message: match.message,
    lastResult: extras.lastResult ?? null,
  };
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

export function parsePongSync(data: unknown): PongSync | null {
  if (typeof data !== "object" || data === null) return null;
  const raw = data as Record<string, unknown>;
  if (!PHASES.includes(raw.phase as Phase)) return null;
  const lastResult = RESULTS.includes(raw.lastResult as LastThrowInfo["result"])
    ? (raw.lastResult as LastThrowInfo["result"])
    : null;
  return {
    phase: raw.phase as Phase,
    shooterId: asString(raw.shooterId),
    shooterName: asString(raw.shooterName),
    aLeft: asInt(raw.aLeft),
    bLeft: asInt(raw.bLeft),
    testing: Boolean(raw.testing),
    redemption: Boolean(raw.redemption),
    overtime: Boolean(raw.overtime),
    message: asString(raw.message) ?? "",
    lastResult,
  };
}

function latestHostPong(
  actions: Record<string, GameActionState>,
  players: Player[],
) {
  const hosts = new Set(
    players.filter((player) => player.role === "host").map((player) => player.id),
  );
  let best: PongSync | null = null;
  let bestAt = -1;
  for (const action of Object.values(actions)) {
    if (action.type !== PONG_SYNC) continue;
    if (hosts.size && !hosts.has(action.playerId)) continue;
    const parsed = parsePongSync(action.data);
    if (!parsed) continue;
    if (action.timestamp >= bestAt) {
      best = parsed;
      bestAt = action.timestamp;
    }
  }
  return best;
}

function controllersOf(players: Player[]) {
  return [...players]
    .filter((player) => player.role === "controller")
    .sort((a, b) => a.connectedAt - b.connectedAt || a.id.localeCompare(b.id));
}

function latestOfType(
  actions: Record<string, GameActionState>,
  type: string,
) {
  let best: GameActionState | null = null;
  for (const action of Object.values(actions)) {
    if (action.type !== type) continue;
    if (!best || action.timestamp > best.timestamp) best = action;
  }
  return best;
}

export function derivePongSync(
  players: Player[],
  actions: Record<string, GameActionState>,
  now = Date.now(),
): PongSync {
  const fromHost = latestHostPong(actions, players);
  if (fromHost) return fromHost;

  const controllers = controllersOf(players);
  const testing = actionOn(latestOfType(actions, "test")?.data, false);
  if (controllers.length < 2 && !testing) {
    return viewFromMatch(emptyMatch(), controllers, { testing: false });
  }

  let match = testing
    ? syncTestPlayers(emptyMatch(), controllers)
    : startMatch(controllers);
  const throws = Object.values(actions)
    .filter((action) => action.type === "throw")
    .sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < throws.length; i++) {
    const action = throws[i];
    const inFlight = i === throws.length - 1 && now - action.timestamp < FLIGHT_HOLD_MS;
    if (testing) {
      if (inFlight) {
        return {
          ...viewFromMatch(match, controllers, { testing, lastResult: "air" }),
          phase: "flight",
          shooterId: action.playerId,
          shooterName:
            controllers.find((player) => player.id === action.playerId)?.name ?? null,
        };
      }
      continue;
    }
    if (currentId(match) !== action.playerId) continue;
    if (inFlight) {
      return viewFromMatch(beginFlight(match), controllers, {
        testing: false,
        lastResult: "air",
      });
    }
    match = applyMiss(match, controllers);
  }

  return viewFromMatch(match, controllers, { testing });
}

export function flightCopy(view: PongSync) {
  if (view.lastResult === "sink") return "In the cup";
  if (view.lastResult === "bounce") return "On the table";
  if (view.lastResult === "miss") return "Miss";
  return "Ball in the air";
}
