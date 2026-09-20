import type { Player } from "@/lib/protocol";
import { liveCups, maybeRerack, placeRacks, type CupSlot, type TeamId } from "./layout";

export type Phase = "waiting" | "aim" | "flight" | "over";

export type Match = {
  phase: Phase;
  cups: CupSlot[];
  order: string[];
  teamOf: Record<string, TeamId>;
  turnIndex: number;
  redemption: TeamId | null;
  overtime: boolean;
  winner: TeamId | null;
  volleyTeam: TeamId | null;
  volleyThrows: number;
  volleyMakes: number;
  endedAt: number;
  message: string;
};

export function emptyMatch(): Match {
  return {
    phase: "waiting",
    cups: placeRacks(),
    order: [],
    teamOf: {},
    turnIndex: 0,
    redemption: null,
    overtime: false,
    winner: null,
    volleyTeam: null,
    volleyThrows: 0,
    volleyMakes: 0,
    endedAt: 0,
    message: "Need 2 phones to start",
  };
}

export function assignTeams(
  controllers: Player[],
  previous: Record<string, TeamId>,
) {
  const teamOf: Record<string, TeamId> = {};
  for (const player of controllers) {
    if (previous[player.id]) teamOf[player.id] = previous[player.id];
  }
  const sorted = [...controllers].sort((a, b) => a.connectedAt - b.connectedAt);
  for (const player of sorted) {
    if (teamOf[player.id]) continue;
    const a = Object.values(teamOf).filter((team) => team === "a").length;
    const b = Object.values(teamOf).filter((team) => team === "b").length;
    teamOf[player.id] = a <= b ? "a" : "b";
  }
  return teamOf;
}

export function buildOrder(controllers: Player[], teamOf: Record<string, TeamId>) {
  const ids = new Set(controllers.map((player) => player.id));
  const a = controllers
    .filter((player) => teamOf[player.id] === "a")
    .map((player) => player.id);
  const b = controllers
    .filter((player) => teamOf[player.id] === "b")
    .map((player) => player.id);
  const order: string[] = [];
  if (a.length >= b.length) {
    for (let i = 0; i < a.length; i++) {
      order.push(a[i]);
      if (b.length) order.push(b[i % b.length]);
    }
  } else {
    for (let i = 0; i < b.length; i++) {
      if (a.length) order.push(a[i % a.length]);
      order.push(b[i]);
    }
  }
  return order.filter((id) => ids.has(id));
}

export function currentId(match: Match) {
  if (!match.order.length) return null;
  return match.order[match.turnIndex % match.order.length] ?? null;
}

function nameOf(controllers: Player[], id: string | null) {
  if (!id) return "Someone";
  return controllers.find((player) => player.id === id)?.name ?? "Someone";
}

export function teamName(match: Match, controllers: Player[], team: TeamId) {
  const names = match.order
    .filter((id) => match.teamOf[id] === team)
    .map((id) => nameOf(controllers, id));
  const unique = [...new Set(names)];
  if (unique.length) return unique.join(" + ");
  return team === "a" ? "Blue" : "Black";
}

function throwLine(match: Match, controllers: Player[], extra = "") {
  const id = currentId(match);
  const prefix = extra ? `${extra} ` : "";
  if (match.redemption) return `${prefix}Redemption. ${nameOf(controllers, id)} throws`;
  if (match.overtime) return `${prefix}Overtime. ${nameOf(controllers, id)} throws`;
  return `${prefix}${nameOf(controllers, id)} throws`;
}

function firstOfTeam(match: Match, team: TeamId) {
  const index = match.order.findIndex((id) => match.teamOf[id] === team);
  return index < 0 ? 0 : index;
}

export function startMatch(controllers: Player[], previousTeams: Record<string, TeamId> = {}): Match {
  const teamOf = assignTeams(controllers, previousTeams);
  const order = buildOrder(controllers, teamOf);
  const next: Match = {
    ...emptyMatch(),
    phase: "aim",
    cups: placeRacks(),
    order,
    teamOf,
    turnIndex: 0,
  };
  next.message = throwLine(next, controllers);
  return next;
}

export function syncPlayers(match: Match, controllers: Player[]): Match {
  if (controllers.length < 2) {
    if (match.phase === "waiting" && match.order.length === 0) return match;
    return emptyMatch();
  }
  if (match.phase === "waiting") return startMatch(controllers);
  if (match.phase === "over") return match;

  const teamOf = assignTeams(controllers, match.teamOf);
  const order = buildOrder(controllers, teamOf);
  if (!order.length) return emptyMatch();
  const current = currentId(match);
  let turnIndex = current ? order.indexOf(current) : 0;
  if (turnIndex < 0) turnIndex = 0;
  const next = { ...match, teamOf, order, turnIndex };
  next.message = throwLine(next, controllers);
  return next;
}

function recordVolley(match: Match, made: boolean): Match {
  const team = match.teamOf[currentId(match) ?? ""];
  if (!team) return match;
  if (match.volleyTeam !== team) {
    return {
      ...match,
      volleyTeam: team,
      volleyThrows: 1,
      volleyMakes: made ? 1 : 0,
    };
  }
  return {
    ...match,
    volleyThrows: match.volleyThrows + 1,
    volleyMakes: match.volleyMakes + (made ? 1 : 0),
  };
}

function clearVolley(match: Match): Match {
  return { ...match, volleyTeam: null, volleyThrows: 0, volleyMakes: 0 };
}

function teamSize(match: Match, team: TeamId) {
  return match.order.filter((id) => match.teamOf[id] === team).length;
}

function advanceTurn(match: Match, controllers: Player[], made: boolean): Match {
  const withVolley = recordVolley(match, made);
  const shooter = currentId(withVolley);
  const team = shooter ? withVolley.teamOf[shooter] : null;
  if (match.redemption && team) {
    const nextIndex = nextOnTeam(withVolley, team);
    const next = { ...clearVolley(withVolley), phase: "aim" as const, turnIndex: nextIndex };
    next.message = throwLine(next, controllers);
    return next;
  }

  const nextIndex = (withVolley.turnIndex + 1) % withVolley.order.length;
  const nextId = withVolley.order[nextIndex];
  const nextTeam = withVolley.teamOf[nextId];
  const ballsBack =
    team &&
    nextTeam !== team &&
    teamSize(withVolley, team) >= 2 &&
    withVolley.volleyThrows >= 2 &&
    withVolley.volleyMakes === withVolley.volleyThrows;

  if (ballsBack) {
    const next = {
      ...clearVolley(withVolley),
      phase: "aim" as const,
      turnIndex: firstOfTeam(withVolley, team),
    };
    next.message = throwLine(next, controllers, "Balls back.");
    return next;
  }

  const next = {
    ...withVolley,
    phase: "aim" as const,
    turnIndex: nextIndex,
    ...(nextTeam !== team ? { volleyTeam: null, volleyThrows: 0, volleyMakes: 0 } : {}),
  };
  next.message = throwLine(next, controllers);
  return next;
}

function nextOnTeam(match: Match, team: TeamId) {
  for (let step = 1; step <= match.order.length; step++) {
    const index = (match.turnIndex + step) % match.order.length;
    if (match.teamOf[match.order[index]] === team) return index;
  }
  return match.turnIndex;
}

function beginRedemption(match: Match, controllers: Player[], trailing: TeamId): Match {
  const next = {
    ...clearVolley(match),
    phase: "aim" as const,
    redemption: trailing,
    turnIndex: firstOfTeam(match, trailing),
  };
  next.message = throwLine(next, controllers);
  return next;
}

function beginOvertime(match: Match, controllers: Player[]): Match {
  const firstTeam = match.redemption ?? "a";
  const next: Match = {
    ...clearVolley(match),
    phase: "aim",
    cups: placeRacks(3),
    redemption: null,
    overtime: true,
    winner: null,
    turnIndex: firstOfTeam(match, firstTeam),
    endedAt: 0,
    message: "",
  };
  next.message = throwLine(next, controllers);
  return next;
}

function finish(match: Match, controllers: Player[], winner: TeamId): Match {
  return {
    ...match,
    phase: "over",
    winner,
    redemption: null,
    endedAt: Date.now(),
    message: `${teamName(match, controllers, winner)} wins`,
  };
}

function closestLiveCup(cups: CupSlot[], team: TeamId, from: CupSlot) {
  const others = liveCups(cups, team).filter((cup) => cup.id !== from.id);
  others.sort((a, b) => {
    const da = (a.x - from.x) ** 2 + (a.z - from.z) ** 2;
    const db = (b.x - from.x) ** 2 + (b.z - from.z) ** 2;
    return da - db;
  });
  return others[0] ?? null;
}

export function applySink(
  match: Match,
  controllers: Player[],
  cupId: string,
  bounce: boolean,
): Match {
  const made = match.cups.find((cup) => cup.id === cupId);
  if (!made) return { ...match, phase: "aim" };

  let cups = match.cups.map((cup) => (cup.id === cupId ? { ...cup, live: false } : cup));
  if (bounce) {
    const extra = closestLiveCup(cups, made.team, made);
    if (extra) {
      cups = cups.map((cup) => (cup.id === extra.id ? { ...cup, live: false } : cup));
    }
  }
  cups = maybeRerack(maybeRerack(cups, "a"), "b");
  const next = { ...match, cups, phase: "aim" as const };

  const aLeft = liveCups(cups, "a").length;
  const bLeft = liveCups(cups, "b").length;

  if (match.redemption) {
    const target = match.redemption === "a" ? "b" : "a";
    const left = target === "a" ? aLeft : bLeft;
    if (left === 0) return beginOvertime(next, controllers);
    return advanceTurn(next, controllers, true);
  }

  if (aLeft === 0 || bLeft === 0) {
    const trailing = aLeft === 0 ? "a" : "b";
    if (!next.order.some((id) => next.teamOf[id] === trailing)) {
      return finish(next, controllers, trailing === "a" ? "b" : "a");
    }
    return beginRedemption(next, controllers, trailing);
  }

  return advanceTurn(next, controllers, true);
}

export function applyMiss(match: Match, controllers: Player[]): Match {
  if (match.redemption) {
    const winner = match.redemption === "a" ? "b" : "a";
    return finish(match, controllers, winner);
  }
  return advanceTurn({ ...match, phase: "aim" }, controllers, false);
}

export function beginFlight(match: Match): Match {
  return { ...match, phase: "flight" };
}

export function rematch(match: Match, controllers: Player[]): Match {
  if (controllers.length < 2) return emptyMatch();
  return startMatch(controllers, match.teamOf);
}

export function syncTestPlayers(match: Match, controllers: Player[]): Match {
  if (controllers.length === 0) {
    return {
      ...emptyMatch(),
      message: "Test. Join a phone to throw.",
    };
  }
  const teamOf = assignTeams(controllers, match.teamOf);
  const order = buildOrder(controllers, teamOf);
  const cups = match.phase === "waiting" ? placeRacks() : match.cups;
  return {
    ...match,
    phase: match.phase === "waiting" || match.phase === "over" ? "aim" : match.phase,
    cups,
    order,
    teamOf,
    turnIndex: Math.min(match.turnIndex, Math.max(0, order.length - 1)),
    redemption: null,
    winner: null,
    endedAt: 0,
    message: "Test. Throw anytime.",
  };
}

export function applyTestSink(match: Match, cupId: string, bounce: boolean): Match {
  const made = match.cups.find((cup) => cup.id === cupId);
  if (!made) return { ...match, phase: "aim", message: "Test. Throw anytime." };
  let cups = match.cups.map((cup) => (cup.id === cupId ? { ...cup, live: false } : cup));
  if (bounce) {
    const extra = closestLiveCup(cups, made.team, made);
    if (extra) {
      cups = cups.map((cup) => (cup.id === extra.id ? { ...cup, live: false } : cup));
    }
  }
  cups = maybeRerack(maybeRerack(cups, "a"), "b");
  return { ...match, cups, phase: "aim", message: "Test. Throw anytime." };
}

export function refillCups(match: Match): Match {
  return {
    ...match,
    cups: placeRacks(),
    phase: match.phase === "flight" ? "aim" : match.phase === "over" ? "aim" : match.phase,
    redemption: null,
    winner: null,
    endedAt: 0,
    overtime: false,
    message: match.order.length ? "Test. Throw anytime." : match.message,
  };
}

export { liveCups };
export type { CupSlot, TeamId };
