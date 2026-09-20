"use client";

/** Tunables for the wind. Retune here after a real-phone pass. */
export const WIND = {
  // Most the wind can push an arrow, as a fraction of the target radius.
  maxDrift: 0.85,
  // Gusts lift and drop the arrow less than they blow it sideways.
  verticalShare: 0.35,
  // Above 1 biases toward gentle days, so a monster gust stays a surprise.
  calmBias: 1.15,
} as const;

export type Wind = {
  x: number;
  y: number;
  speed: number;
  /** Degrees, 0 pointing right across the face. */
  angleDeg: number;
};

export const STILL_AIR: Wind = { x: 0, y: 0, speed: 0, angleDeg: 0 };

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

/**
 * The wind for one arrow. Derived from the round, the archer and the arrow
 * number rather than rolled at random, so the TV and every phone agree on it
 * without another socket event — the same reason turn order is derived rather
 * than broadcast. The archer aims INTO it: an arrow lands at aim + wind.
 */
export function windFor(roundId: number, playerId: string, arrow: number): Wind {
  const random = mulberry32(hash32(`${roundId}:${playerId}:${arrow}`));
  const angle = random() * Math.PI * 2;
  const drift = Math.pow(random(), WIND.calmBias) * WIND.maxDrift;
  const x = Math.cos(angle) * drift;
  const y = Math.sin(angle) * drift * WIND.verticalShare;
  return {
    x,
    y,
    speed: Math.hypot(x, y),
    angleDeg: (Math.atan2(y, x) * 180) / Math.PI,
  };
}

/** 0 to 1, for sizing a gust indicator. */
export function windStrength(wind: Wind) {
  return Math.min(wind.speed / WIND.maxDrift, 1);
}

/** Short label for a HUD, e.g. "2.4 left · lifting". */
export function windLabel(wind: Wind) {
  if (wind.speed < 0.02) return "still air";
  const across = `${(Math.abs(wind.x) * 10).toFixed(1)} ${wind.x >= 0 ? "right" : "left"}`;
  if (Math.abs(wind.y) < 0.02) return across;
  return `${across} · ${wind.y >= 0 ? "lifting" : "dropping"}`;
}
