import { ACTION_TUNE_EVENT, loadActionTune } from "@/lib/actionTune";

export type FlickPayload = {
  power: number;
  peak: number;
};

const START = 11;
const HOLD = 7;
const MIN_PEAK = 12.5;
const COOLDOWN_MS = 850;

let cachedFlickTune: ReturnType<typeof loadActionTune> | undefined;

if (typeof window !== "undefined") {
  window.addEventListener(ACTION_TUNE_EVENT, () => {
    cachedFlickTune = undefined;
  });
}

export function flickGates() {
  if (cachedFlickTune === undefined) {
    cachedFlickTune = loadActionTune("beer-pong", "flick");
  }
  const tune = cachedFlickTune;
  return {
    start: tune?.startMag ?? START,
    hold: HOLD,
    minPeak: tune?.minPeak ?? MIN_PEAK,
    cooldown: COOLDOWN_MS,
  };
}

export function createFlickState() {
  return {
    armed: false,
    peak: 0,
    started: 0,
    lastFire: 0,
  };
}

export type FlickState = ReturnType<typeof createFlickState>;

export function readFlickAccel(event: DeviceMotionEvent) {
  const linear = event.acceleration;
  if (linear && (linear.x != null || linear.y != null || linear.z != null)) {
    return {
      x: linear.x ?? 0,
      y: linear.y ?? 0,
      z: linear.z ?? 0,
    };
  }
  const g = event.accelerationIncludingGravity;
  if (!g || (g.x == null && g.y == null && g.z == null)) return null;
  const x = g.x ?? 0;
  const y = g.y ?? 0;
  const z = g.z ?? 0;
  const mag = Math.hypot(x, y, z) || 1;
  const gravity = 9.81;
  return {
    x: x - (x / mag) * gravity,
    y: y - (y / mag) * gravity,
    z: z - (z / mag) * gravity,
  };
}

export function stepFlick(
  state: FlickState,
  accel: { x: number; y: number; z: number },
  now: number,
): FlickPayload | null {
  const mag = Math.hypot(accel.x, accel.y, accel.z);
  const gates = flickGates();
  if (now - state.lastFire < gates.cooldown) {
    state.armed = false;
    state.peak = 0;
    return null;
  }
  if (mag >= gates.start) {
    if (!state.armed) {
      state.armed = true;
      state.started = now;
      state.peak = mag;
    } else if (mag > state.peak) {
      state.peak = mag;
    }
    return null;
  }
  if (!state.armed || mag > gates.hold) return null;
  const elapsed = now - state.started;
  const peak = state.peak;
  state.armed = false;
  state.peak = 0;
  if (peak < gates.minPeak || elapsed < 40 || elapsed > 900) return null;
  state.lastFire = now;
  return {
    peak,
    power: Math.min(2.2, Math.max(0.4, (peak - 8) / 12)),
  };
}

export function swipeFlick(
  startY: number,
  endY: number,
  startMs: number,
  endMs: number,
): FlickPayload | null {
  const dy = startY - endY;
  const dt = Math.max(endMs - startMs, 1);
  if (dy < 70 || dt > 500) return null;
  const speed = dy / dt;
  return {
    peak: dy,
    power: Math.min(2.2, Math.max(0.45, 0.35 + speed * 1.4)),
  };
}
