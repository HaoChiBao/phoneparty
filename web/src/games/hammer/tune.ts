import { loadActionTune } from "@/lib/actionTune";
import { SWING, type SwingTune } from "./swing";

const STORAGE_KEY = "phoneparty.hammer.sensitivity";

export const SENSITIVITY = {
  min: 0.5,
  max: 2,
  step: 0.05,
  default: 1,
} as const;

export function clampSensitivity(value: number) {
  if (!Number.isFinite(value)) return SENSITIVITY.default;
  return Math.min(SENSITIVITY.max, Math.max(SENSITIVITY.min, value));
}

export function loadSensitivity() {
  if (typeof window === "undefined") return SENSITIVITY.default;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return SENSITIVITY.default;
  return clampSensitivity(Number(raw));
}

export function saveSensitivity(value: number) {
  const next = clampSensitivity(value);
  window.localStorage.setItem(STORAGE_KEY, String(next));
  return next;
}

/** Higher sensitivity lowers the swing threshold so a lighter hit still scores. */
export function tuneFromSensitivity(sensitivity: number): SwingTune {
  const s = clampSensitivity(sensitivity);
  const estimate = loadActionTune("hammer", "hit");
  const start = estimate?.startMag ?? SWING.startMag;
  const minPeak = estimate?.minPeak ?? SWING.minPeak;
  return {
    ...SWING,
    startMag: start / s,
    minPeak: minPeak / s,
  };
}
