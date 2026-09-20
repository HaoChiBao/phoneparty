"use client";

/**
 * The river, as a pure function of the round number. Every client builds the
 * identical school from the same seed, so the TV and every phone agree on where
 * each salmon is without streaming fish positions over the wire — the same
 * trick turn order and the archery wind use.
 */

/** Play field in world units, 16 by 9. Cursors use the same units. */
export const FIELD = { width: 16, height: 9 } as const;
export const ROUND_MS = 30_000;
/** Grace after the start action so the room can get their paws up. */
export const LEAD_IN_MS = 3_000;

export const SCHOOL = {
  // Average gap between salmon entering at the right bank.
  spawnEveryMs: 430,
  spawnJitterMs: 260,
  // Seconds to cross the river, right to left.
  crossMsMin: 4200,
  crossMsMax: 7200,
  laneSpread: 3.1,
  bobMin: 0.25,
  bobMax: 0.95,
  sizeMin: 0.78,
  sizeMax: 1.25,
  /** How close the paw has to land. Scaled by the salmon's size. */
  catchRadius: 0.95,
} as const;

export type Fish = {
  id: number;
  spawnMs: number;
  crossMs: number;
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

/** Every salmon that will appear in a round, in spawn order. */
export function buildSchool(roundId: number, durationMs = ROUND_MS): Fish[] {
  const random = mulberry32(hash32(`river:${roundId}`));
  const school: Fish[] = [];
  let spawnMs = -SCHOOL.crossMsMin / 2; // a few already mid-river at the whistle
  let id = 0;
  while (spawnMs < durationMs) {
    school.push({
      id,
      spawnMs,
      crossMs: lerp(SCHOOL.crossMsMin, SCHOOL.crossMsMax, random()),
      lane: (random() * 2 - 1) * SCHOOL.laneSpread,
      bob: lerp(SCHOOL.bobMin, SCHOOL.bobMax, random()),
      bobHz: lerp(0.25, 0.7, random()),
      phase: random() * Math.PI * 2,
      size: lerp(SCHOOL.sizeMin, SCHOOL.sizeMax, random()),
    });
    id += 1;
    spawnMs += SCHOOL.spawnEveryMs + (random() * 2 - 1) * SCHOOL.spawnJitterMs;
  }
  return school;
}

const ENTRY_X = FIELD.width / 2 + 1.4;
const EXIT_X = -FIELD.width / 2 - 1.4;

/** Where a salmon is at a moment, or null when it is not in the river yet. */
export function fishPosition(fish: Fish, elapsedMs: number): FishAt | null {
  const t = (elapsedMs - fish.spawnMs) / fish.crossMs;
  if (t < 0 || t > 1) return null;
  const x = lerp(ENTRY_X, EXIT_X, t);
  const swim = (elapsedMs / 1000) * fish.bobHz * Math.PI * 2 + fish.phase;
  const y = fish.lane + Math.sin(swim) * fish.bob;
  return { fish, x, y };
}

/** Everything swimming right now, nearest the surface first. */
export function fishInRiver(school: Fish[], elapsedMs: number): FishAt[] {
  const live: FishAt[] = [];
  for (const fish of school) {
    const at = fishPosition(fish, elapsedMs);
    if (at) live.push(at);
  }
  return live;
}

/**
 * The salmon a paw landing at (x, y) would take: the closest one within reach,
 * skipping any already caught. Ties break on id so every client agrees.
 */
export function fishUnderPaw(
  school: Fish[],
  elapsedMs: number,
  x: number,
  y: number,
  caught: ReadonlySet<number>,
): Fish | null {
  let best: { fish: Fish; distance: number } | null = null;
  for (const fish of school) {
    if (caught.has(fish.id)) continue;
    const at = fishPosition(fish, elapsedMs);
    if (!at) continue;
    const reach = SCHOOL.catchRadius * fish.size;
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
