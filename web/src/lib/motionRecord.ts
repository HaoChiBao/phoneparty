"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readLinearAcceleration } from "@/lib/orientation";
import type { ActionTune } from "@/lib/actionTune";

const DB_NAME = "phoneparty";
const STORE = "motionClips";
const DB_VERSION = 1;
const MAX_MS = 4000;
const MAX_FRAMES = 600;
const STILL_MAG = 3.5;

export type MotionFrame = {
  t: number;
  alpha: number;
  beta: number;
  gamma: number;
  ax: number;
  ay: number;
  az: number;
  mag: number;
  agx?: number;
  agy?: number;
  agz?: number;
  rx?: number;
  ry?: number;
  rz?: number;
};

export type ClipStats = {
  peakMag: number;
  peakAtMs: number;
  meanMag: number;
  actionStartMs: number;
  actionAtMs: number;
  n: number;
};

export type MotionClip = {
  id: string;
  gameId: string;
  labelId: string;
  label: string;
  recordedAt: number;
  durationMs: number;
  frames: MotionFrame[];
  stats: ClipStats;
};

export type ActionEstimate = {
  gameId: string;
  labelId: string;
  clipCount: number;
  medianPeak: number;
  p25Peak: number;
  p75Peak: number;
  actionAtMs: number;
  suggestedStartMag: number;
  suggestedMinPeak: number;
};

export type LiveMotion = {
  mag: number;
  peak: number;
  alpha: number;
  beta: number;
  gamma: number;
  ax: number;
  ay: number;
  az: number;
  frames: number;
  elapsedMs: number;
};

const EMPTY_LIVE: LiveMotion = {
  mag: 0,
  peak: 0,
  alpha: 0,
  beta: 0,
  gamma: 0,
  ax: 0,
  ay: 0,
  az: 0,
  frames: 0,
  elapsedMs: 0,
};

const memoryClips: MotionClip[] = [];
let dbFailed = false;

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readAccel(event: DeviceMotionEvent) {
  const linear = readLinearAcceleration(event);
  if (linear) return linear;
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

export function summarizeFrames(frames: MotionFrame[]): ClipStats {
  if (!frames.length) {
    return {
      peakMag: 0,
      peakAtMs: 0,
      meanMag: 0,
      actionStartMs: 0,
      actionAtMs: 0,
      n: 0,
    };
  }
  let peakMag = 0;
  let peakAtMs = frames[0].t;
  let sum = 0;
  let actionStartMs = frames[0].t;
  let foundStart = false;
  for (const frame of frames) {
    sum += frame.mag;
    if (frame.mag > peakMag) {
      peakMag = frame.mag;
      peakAtMs = frame.t;
    }
    if (!foundStart && frame.mag >= STILL_MAG) {
      actionStartMs = frame.t;
      foundStart = true;
    }
  }
  return {
    peakMag,
    peakAtMs,
    meanMag: sum / frames.length,
    actionStartMs,
    actionAtMs: Math.max(0, peakAtMs - actionStartMs),
    n: frames.length,
  };
}

export function makeClip(input: {
  gameId: string;
  labelId: string;
  label: string;
  frames: MotionFrame[];
}): MotionClip {
  const frames = input.frames.map((frame) => ({ ...frame }));
  const stats = summarizeFrames(frames);
  const durationMs = frames.length ? frames[frames.length - 1].t : 0;
  return {
    id: newId(),
    gameId: input.gameId,
    labelId: input.labelId,
    label: input.label,
    recordedAt: Date.now(),
    durationMs,
    frames,
    stats,
  };
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

export function estimateFromClips(
  clips: MotionClip[],
  gameId: string,
  labelId: string,
): ActionEstimate | null {
  const subset = clips.filter(
    (clip) => clip.gameId === gameId && clip.labelId === labelId && clip.stats.peakMag > 0,
  );
  if (!subset.length) return null;
  const peaks = subset.map((clip) => clip.stats.peakMag).sort((a, b) => a - b);
  const actionAts = subset.map((clip) => clip.stats.actionAtMs).sort((a, b) => a - b);
  const medianPeak = percentile(peaks, 0.5);
  const p25Peak = percentile(peaks, 0.25);
  const suggestedMinPeak = Math.min(40, Math.max(8, p25Peak * 0.9));
  const suggestedStartMag = Math.min(
    suggestedMinPeak,
    Math.max(5, medianPeak * 0.42),
  );
  return {
    gameId,
    labelId,
    clipCount: subset.length,
    medianPeak,
    p25Peak,
    p75Peak: percentile(peaks, 0.75),
    actionAtMs: percentile(actionAts, 0.5),
    suggestedStartMag,
    suggestedMinPeak,
  };
}

export function estimateToTune(estimate: ActionEstimate): ActionTune {
  return {
    gameId: estimate.gameId,
    labelId: estimate.labelId,
    startMag: estimate.suggestedStartMag,
    minPeak: estimate.suggestedMinPeak,
    actionAtMs: estimate.actionAtMs,
    peakMag: estimate.medianPeak,
    clipCount: estimate.clipCount,
    updatedAt: Date.now(),
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
  });
}

export async function listClips(): Promise<MotionClip[]> {
  if (typeof indexedDB === "undefined" || dbFailed) {
    return [...memoryClips];
  }
  try {
    const rows = await withStore("readonly", (store) => store.getAll());
    const clips = (rows as MotionClip[]) ?? [];
    clips.sort((a, b) => b.recordedAt - a.recordedAt);
    return clips;
  } catch {
    dbFailed = true;
    return [...memoryClips];
  }
}

export async function saveClip(clip: MotionClip) {
  if (typeof indexedDB === "undefined" || dbFailed) {
    memoryClips.unshift(clip);
    return;
  }
  try {
    await withStore("readwrite", (store) => store.put(clip));
  } catch {
    dbFailed = true;
    memoryClips.unshift(clip);
  }
}

export async function deleteClip(id: string) {
  const index = memoryClips.findIndex((clip) => clip.id === id);
  if (index >= 0) memoryClips.splice(index, 1);
  if (typeof indexedDB === "undefined" || dbFailed) return;
  try {
    await withStore("readwrite", (store) => store.delete(id));
  } catch {
    dbFailed = true;
  }
}

export async function clearClips(gameId?: string, labelId?: string) {
  if (!gameId) {
    memoryClips.length = 0;
    if (typeof indexedDB === "undefined" || dbFailed) return;
    try {
      await withStore("readwrite", (store) => store.clear());
    } catch {
      dbFailed = true;
    }
    return;
  }
  const all = await listClips();
  const keep = all.filter(
    (clip) =>
      clip.gameId !== gameId || (labelId ? clip.labelId !== labelId : false),
  );
  memoryClips.length = 0;
  memoryClips.push(...keep);
  if (typeof indexedDB === "undefined" || dbFailed) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      store.clear();
      for (const clip of keep) store.put(clip);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("clear failed"));
    });
  } catch {
    dbFailed = true;
  }
}

export function clipExportPayload(clips: MotionClip[]) {
  return {
    app: "phoneparty",
    kind: "motion-clips",
    exportedAt: Date.now(),
    clips,
  };
}

export async function shareOrDownloadClips(clips: MotionClip[], filename: string) {
  const payload = clipExportPayload(clips);
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const file = new File([blob], filename, { type: "application/json" });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (navigator.share && nav.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fall through to a file download.
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useMotionCapture(active: boolean) {
  const framesRef = useRef<MotionFrame[]>([]);
  const orientRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const peakRef = useRef(0);
  const startedRef = useRef(0);
  const lastUi = useRef(0);
  const [live, setLive] = useState<LiveMotion>(EMPTY_LIVE);

  useEffect(() => {
    if (!active) {
      setLive(EMPTY_LIVE);
      return;
    }

    framesRef.current = [];
    peakRef.current = 0;
    startedRef.current = 0;
    lastUi.current = 0;

    const onOrient = (event: DeviceOrientationEvent) => {
      orientRef.current = {
        alpha: event.alpha ?? 0,
        beta: event.beta ?? 0,
        gamma: event.gamma ?? 0,
      };
    };

    const onMotion = (event: DeviceMotionEvent) => {
      const accel = readAccel(event);
      if (!accel) return;
      const now = performance.now();
      if (!startedRef.current) startedRef.current = now;
      const t = now - startedRef.current;
      if (t > MAX_MS || framesRef.current.length >= MAX_FRAMES) {
        setLive((prev) =>
          prev.elapsedMs >= MAX_MS
            ? prev
            : {
                ...prev,
                elapsedMs: t,
                frames: framesRef.current.length,
                peak: peakRef.current,
              },
        );
        return;
      }
      const mag = Math.hypot(accel.x, accel.y, accel.z);
      if (mag > peakRef.current) peakRef.current = mag;
      const grav = event.accelerationIncludingGravity;
      const rot = event.rotationRate;
      const orient = orientRef.current;
      const frame: MotionFrame = {
        t: Math.round(t),
        alpha: orient.alpha,
        beta: orient.beta,
        gamma: orient.gamma,
        ax: accel.x,
        ay: accel.y,
        az: accel.z,
        mag,
      };
      if (grav && (grav.x != null || grav.y != null || grav.z != null)) {
        frame.agx = grav.x ?? 0;
        frame.agy = grav.y ?? 0;
        frame.agz = grav.z ?? 0;
      }
      if (rot && (rot.alpha != null || rot.beta != null || rot.gamma != null)) {
        frame.rx = rot.alpha ?? 0;
        frame.ry = rot.beta ?? 0;
        frame.rz = rot.gamma ?? 0;
      }
      framesRef.current.push(frame);
      if (now - lastUi.current > 80) {
        lastUi.current = now;
        setLive({
          mag,
          peak: peakRef.current,
          alpha: orient.alpha,
          beta: orient.beta,
          gamma: orient.gamma,
          ax: accel.x,
          ay: accel.y,
          az: accel.z,
          frames: framesRef.current.length,
          elapsedMs: t,
        });
      }
    };

    window.addEventListener("deviceorientation", onOrient, true);
    window.addEventListener("devicemotion", onMotion, true);
    return () => {
      window.removeEventListener("deviceorientation", onOrient, true);
      window.removeEventListener("devicemotion", onMotion, true);
    };
  }, [active]);

  const snapshot = useCallback(() => framesRef.current.slice(), []);

  return { live, snapshot };
}
