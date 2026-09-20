export type ThrowTune = {
  tilt: number;
  aimGain: number;
  posGain: number;
  power: number;
  arc: number;
};

export const DEFAULT_TUNE: ThrowTune = {
  tilt: 0.38,
  aimGain: 1,
  posGain: 1,
  power: 1,
  arc: 0.64,
};

export const TUNE_RANGE = {
  tilt: { min: 0.05, max: 1.2, step: 0.01, label: "Pitch nudge" },
  aimGain: { min: 0.3, max: 2.5, step: 0.05, label: "Yaw nudge" },
  posGain: { min: 0, max: 3, step: 0.05, label: "Move nudge" },
  power: { min: 0.4, max: 2, step: 0.05, label: "Throw power" },
  arc: { min: 0.35, max: 1.1, step: 0.01, label: "Throw arc" },
} as const;

export function clampTune(partial: Partial<ThrowTune>): ThrowTune {
  const next = { ...DEFAULT_TUNE, ...partial };
  for (const key of Object.keys(TUNE_RANGE) as (keyof ThrowTune)[]) {
    const range = TUNE_RANGE[key];
    next[key] = Math.min(range.max, Math.max(range.min, next[key]));
  }
  return next;
}
