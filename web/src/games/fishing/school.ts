"use client";

/**
 * The river, as a pure function of the round number. Every client builds the
 * identical school from the same seed, so the TV and every phone agree on where
 * each fish is without streaming positions over the wire.
 */

/** Play field in world units, 16 by 9. Cursors use the same units. */
export const FIELD = { width: 16, height: 9 } as const;
export const ROUND_MS = 30_000;
/** Grace after the start action so the room can get their hooks up. */
export const LEAD_IN_MS = 3_000;

export type FishKind = "small" | "medium" | "large";

export const KINDS: Record<
  FishKind,
  {
    weight: number;
    size: number;
    sizeJitter: number;
    crossMsMin: number;
    crossMsMax: number;
    reels: number;
    points: number;
    catchRadius: number;
    tint: string;
    src: string;
  }
> = {
  small: {
    weight: 0.55,
    size: 0.58,
    sizeJitter: 0.16,
    crossMsMin: 1500,
    crossMsMax: 3400,
    reels: 6,
    points: 1,
    catchRadius: 0.68,
    tint: "#ffffff",
    src: "/fishing/fish-small.png",
  },
  medium: {
    weight: 0.32,
    size: 0.96,
    sizeJitter: 0.14,
    crossMsMin: 3600,
    crossMsMax: 8200,
    reels: 14,
    points: 2,
    catchRadius: 0.95,
    tint: "#ffffff",
    src: "/fishing/fish-medium.png",
  },
  large: {
    weight: 0.13,
    size: 1.52,
    sizeJitter: 0.18,
    crossMsMin: 7000,
    crossMsMax: 15000,
    reels: 28,
    points: 3,
    catchRadius: 1.28,
    tint: "#ffffff",
    src: "/fishing/fish-large.png",
  },
};

export const SCHOOL = {
  spawnEveryMs: 480,
  spawnJitterMs: 280,
  laneSpread: 3.2,
  bobMin: 0.18,
  bobMax: 0.9,
} as const;

export type Fish = {
  id: number;
  kind: FishKind;
  spawnMs: number;
  crossMs: number;
  /** +1 swims right, -1 swims left. */
  heading: 1 | -1;
  lane: number;
  bob: number;
  bobHz: number;
  phase: number;
  size: number;
};

export type FishAt = { fish: Fish; x: number; y: number };

function hash32(seed: string) {
  let h = 2166136261 >>> 0;
  for (let index = 0; index < seed.length; index += 1) {
    h ^= seed.charCodeAt(index);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function pickKind(random: () => number): FishKind {
  const roll = random();
  if (roll < KINDS.small.weight) return "small";
  if (roll < KINDS.small.weight + KINDS.medium.weight) return "medium";
  return "large";
}

/** Every fish that will appear in a round, in spawn order. */
export function buildSchool(roundId: number, durationMs = ROUND_MS): Fish[] {
  const random = mulberry32(hash32(`river:${roundId}`));
  const school: Fish[] = [];
  let spawnMs = -2200;
  let id = 0;
  while (spawnMs < durationMs) {
    const kind = pickKind(random);
    const spec = KINDS[kind];
    const size = spec.size * lerp(1 - spec.sizeJitter, 1 + spec.sizeJitter, random());
    school.push({
      id,
      kind,
      spawnMs,
      crossMs: lerp(spec.crossMsMin, spec.crossMsMax, random()),
      heading: random() < 0.5 ? -1 : 1,
      lane: (random() * 2 - 1) * SCHOOL.laneSpread,
      bob: lerp(SCHOOL.bobMin, SCHOOL.bobMax, random()),
      bobHz: lerp(0.2, 0.95, random()),
      phase: random() * Math.PI * 2,
      size,
    });
    id += 1;
    spawnMs += SCHOOL.spawnEveryMs + (random() * 2 - 1) * SCHOOL.spawnJitterMs;
  }
  return school;
}

const RIGHT_X = FIELD.width / 2 + 1.6;
const LEFT_X = -FIELD.width / 2 - 1.6;

/** Where a fish is at a moment, or null when it is not in the river yet. */
export function fishPosition(fish: Fish, elapsedMs: number): FishAt | null {
  const t = (elapsedMs - fish.spawnMs) / fish.crossMs;
  if (t < 0 || t > 1) return null;
  const startX = fish.heading > 0 ? LEFT_X : RIGHT_X;
  const endX = fish.heading > 0 ? RIGHT_X : LEFT_X;
  const x = lerp(startX, endX, t);
  const swim = (elapsedMs / 1000) * fish.bobHz * Math.PI * 2 + fish.phase;
  const y = fish.lane + Math.sin(swim) * fish.bob;
  return { fish, x, y };
}

export function fishInRiver(school: Fish[], elapsedMs: number): FishAt[] {
  const live: FishAt[] = [];
  for (const fish of school) {
    const at = fishPosition(fish, elapsedMs);
    if (at) live.push(at);
  }
  return live;
}

export function reelsFor(fish: Fish) {
  return KINDS[fish.kind].reels;
}

export function pointsFor(fish: Fish) {
  return KINDS[fish.kind].points;
}

/**
 * The fish a hook at (x, y) would take: the closest one within reach, skipping
 * any already caught or latched. Ties break on id so every client agrees.
 */
export function fishUnderHook(
  school: Fish[],
  elapsedMs: number,
  x: number,
  y: number,
  busy: ReadonlySet<number>,
): Fish | null {
  let best: { fish: Fish; distance: number } | null = null;
  for (const fish of school) {
    if (busy.has(fish.id)) continue;
    const at = fishPosition(fish, elapsedMs);
    if (!at) continue;
    const reach = KINDS[fish.kind].catchRadius * (fish.size / KINDS[fish.kind].size);
    const distance = Math.hypot(at.x - x, at.y - y);
    if (distance > reach) continue;
    if (
      !best ||
      distance < best.distance - 1e-9 ||
      (Math.abs(distance - best.distance) <= 1e-9 && fish.id < best.fish.id)
    ) {
      best = { fish, distance };
    }
  }
  return best?.fish ?? null;
}
