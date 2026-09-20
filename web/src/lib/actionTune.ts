export const ACTION_TUNE_EVENT = "phoneparty-action-tune";

export type ActionTune = {
  gameId: string;
  labelId: string;
  startMag: number;
  minPeak: number;
  actionAtMs: number;
  peakMag: number;
  clipCount: number;
  updatedAt: number;
};

function storageKey(gameId: string, labelId: string) {
  return `phoneparty.action-tune.${gameId}.${labelId}`;
}

export function loadActionTune(
  gameId: string,
  labelId: string,
): ActionTune | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(gameId, labelId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActionTune;
    if (
      !parsed ||
      typeof parsed.startMag !== "number" ||
      typeof parsed.minPeak !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveActionTune(tune: ActionTune) {
  window.localStorage.setItem(
    storageKey(tune.gameId, tune.labelId),
    JSON.stringify(tune),
  );
  window.dispatchEvent(new Event(ACTION_TUNE_EVENT));
}

export function clearActionTune(gameId: string, labelId: string) {
  window.localStorage.removeItem(storageKey(gameId, labelId));
  window.dispatchEvent(new Event(ACTION_TUNE_EVENT));
}
