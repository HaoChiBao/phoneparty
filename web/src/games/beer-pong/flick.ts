export type FlickPayload = {
  power: number;
  peak: number;
  ax: number;
  ay: number;
  az: number;
};

const START = 11;
const HOLD = 7;
const MIN_PEAK = 12.5;
const COOLDOWN_MS = 850;

export function createFlickState() {
  return {
    armed: false,
    peak: 0,
    ax: 0,
    ay: 0,
    az: 0,
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
  if (now - state.lastFire < COOLDOWN_MS) {
    state.armed = false;
    state.peak = 0;
    state.ax = 0;
    state.ay = 0;
    state.az = 0;
    return null;
  }
  if (mag >= START) {
    if (!state.armed) {
      state.armed = true;
      state.started = now;
      state.peak = mag;
      state.ax = accel.x;
      state.ay = accel.y;
      state.az = accel.z;
    } else if (mag > state.peak) {
      state.peak = mag;
      state.ax = accel.x;
      state.ay = accel.y;
      state.az = accel.z;
    }
    return null;
  }
  if (!state.armed || mag > HOLD) return null;
  const elapsed = now - state.started;
  const peak = state.peak;
  const ax = state.ax;
  const ay = state.ay;
  const az = state.az;
  state.armed = false;
  state.peak = 0;
  state.ax = 0;
  state.ay = 0;
  state.az = 0;
  if (peak < MIN_PEAK || elapsed < 40 || elapsed > 900) return null;
  state.lastFire = now;
  return {
    peak,
    power: Math.min(2.2, Math.max(0.4, (peak - 8) / 12)),
    ax,
    ay,
    az,
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
    ax: 0,
    ay: 0,
    az: 0,
  };
}
