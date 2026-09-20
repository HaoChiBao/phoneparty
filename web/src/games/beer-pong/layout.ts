export const TABLE = {
  length: 2.44,
  width: 0.7,
  height: 0.76,
  thickness: 0.05,
} as const;

export const CUP = {
  height: 0.12,
  rimRadius: 0.047,
  baseRadius: 0.03,
  innerRadius: 0.037,
} as const;

export const BALL = {
  radius: 0.02,
} as const;

export const GRAVITY = 9.6;
export const RACK_SPACING = 0.098;
export const FRONT_X = 0.58;
export const START_CUPS = 6;

export type TeamId = "a" | "b";

export type CupSlot = {
  id: string;
  team: TeamId;
  x: number;
  z: number;
  live: boolean;
};

function rowOffsets(rows: number, spacing: number) {
  const step = spacing * Math.sqrt(3) / 2;
  const spots: { along: number; side: number }[] = [];
  for (let row = 0; row < rows; row++) {
    const count = row + 1;
    const along = row * step;
    for (let i = 0; i < count; i++) {
      spots.push({ along, side: (i - (count - 1) / 2) * spacing });
    }
  }
  return spots;
}

function rowsForCount(count: number) {
  if (count >= 10) return 4;
  if (count >= 6) return 3;
  if (count >= 3) return 2;
  return 1;
}

export function rackPositions(team: TeamId, count: number): { x: number; z: number }[] {
  const rows = rowsForCount(count);
  const spots = rowOffsets(rows, RACK_SPACING).slice(0, count);
  const sign = team === "a" ? -1 : 1;
  return spots.map((spot) => ({
    x: sign * (FRONT_X + spot.along),
    z: spot.side,
  }));
}

export function placeRacks(count = START_CUPS): CupSlot[] {
  const cups: CupSlot[] = [];
  for (const team of ["a", "b"] as const) {
    rackPositions(team, count).forEach((spot, index) => {
      cups.push({
        id: `${team}-${index}`,
        team,
        x: spot.x,
        z: spot.z,
        live: true,
      });
    });
  }
  return cups;
}

export function liveCups(cups: CupSlot[], team?: TeamId) {
  return cups.filter((cup) => cup.live && (team ? cup.team === team : true));
}

export function compactRack(cups: CupSlot[], team: TeamId): CupSlot[] {
  const remaining = liveCups(cups, team);
  const spots = rackPositions(team, remaining.length);
  let i = 0;
  return cups.map((cup) => {
    if (cup.team !== team || !cup.live) return cup;
    const spot = spots[i++];
    return spot ? { ...cup, x: spot.x, z: spot.z } : cup;
  });
}

export const RERACK_AT = new Set([3]);

export function maybeRerack(cups: CupSlot[], team: TeamId) {
  const left = liveCups(cups, team).length;
  return RERACK_AT.has(left) ? compactRack(cups, team) : cups;
}

export function launchPoint(team: TeamId, aimZ = 0) {
  const sign = team === "a" ? -1 : 1;
  const half = TABLE.width / 2 - 0.08;
  return {
    x: sign * (TABLE.length / 2 - 0.18),
    y: TABLE.height + 0.52,
    z: Math.max(-half, Math.min(half, aimZ)),
  };
}
