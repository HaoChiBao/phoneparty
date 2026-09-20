"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameDefinition } from "@/games/types";
import { motionLabelsFor } from "@/games/types";
import {
  clearActionTune,
  loadActionTune,
  saveActionTune,
  type ActionTune,
} from "@/lib/actionTune";
import {
  clearClips,
  deleteClip,
  estimateFromClips,
  estimateToTune,
  listClips,
  makeClip,
  saveClip,
  shareOrDownloadClips,
  useMotionCapture,
  type MotionClip,
} from "@/lib/motionRecord";

export function MotionRecordPad({
  game,
  motionReady,
  onCapturingChange,
}: {
  game: GameDefinition;
  motionReady: boolean;
  onCapturingChange: (on: boolean) => void;
}) {
  const labels = motionLabelsFor(game);
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [labelId, setLabelId] = useState(labels[0]?.id ?? "move");
  const [clips, setClips] = useState<MotionClip[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [applied, setApplied] = useState<ActionTune | null>(null);
  const [openClipId, setOpenClipId] = useState<string | null>(null);
  const { live, snapshot } = useMotionCapture(capturing);
  const savingRef = useRef(false);

  const label = labels.find((item) => item.id === labelId) ?? labels[0];

  useEffect(() => {
    setLabelId(labels[0]?.id ?? "move");
  }, [game.id]);

  useEffect(() => {
    onCapturingChange(capturing);
  }, [capturing, onCapturingChange]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listClips().then((rows) => {
      if (!cancelled) setClips(rows);
    });
    setApplied(loadActionTune(game.id, labelId));
    return () => {
      cancelled = true;
    };
  }, [open, game.id, labelId]);

  const labeled = useMemo(
    () => clips.filter((clip) => clip.gameId === game.id && clip.labelId === labelId),
    [clips, game.id, labelId],
  );
  const estimate = useMemo(
    () => estimateFromClips(labeled, game.id, labelId),
    [labeled, game.id, labelId],
  );

  useEffect(() => {
    if (capturing && live.elapsedMs >= 4000) {
      void stopAndSave();
    }
  }, [capturing, live.elapsedMs]);

  function startCapture() {
    if (!motionReady || !label) return;
    setMessage(null);
    setConfirmClear(false);
    setCapturing(true);
  }

  async function stopAndSave() {
    if (!capturing || !label || savingRef.current) return;
    savingRef.current = true;
    setCapturing(false);
    const frames = snapshot();
    if (frames.length < 8) {
      savingRef.current = false;
      setMessage("Too short — hold Record, then do the move.");
      return;
    }
    const clip = makeClip({
      gameId: game.id,
      labelId: label.id,
      label: label.title,
      frames,
    });
    try {
      await saveClip(clip);
      setClips(await listClips());
      setMessage(
        `Saved ${label.title}: peak ${clip.stats.peakMag.toFixed(1)} at ${clip.stats.actionAtMs.toFixed(0)}ms`,
      );
    } catch {
      setMessage("Could not save that clip.");
    } finally {
      savingRef.current = false;
    }
  }

  function discard() {
    savingRef.current = false;
    setCapturing(false);
    setMessage("Discarded.");
  }

  async function remove(id: string) {
    await deleteClip(id);
    setClips(await listClips());
  }

  async function clearLabel() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    await clearClips(game.id, labelId);
    setClips(await listClips());
    setConfirmClear(false);
    setMessage("Cleared this label.");
  }

  function applyEstimate() {
    if (!estimate) return;
    const tune = estimateToTune(estimate);
    saveActionTune(tune);
    setApplied(tune);
    setMessage(
      `Using ${estimate.clipCount} ${label?.title ?? "clips"}: start ${tune.startMag.toFixed(1)}, min peak ${tune.minPeak.toFixed(1)}, action at ${tune.actionAtMs.toFixed(0)}ms`,
    );
  }

  function revertEstimate() {
    clearActionTune(game.id, labelId);
    setApplied(null);
    setMessage("Back to the default detector.");
  }

  async function exportLabel() {
    if (!labeled.length || !label) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `phoneparty-${label.id}-${stamp}.json`;
    try {
      await shareOrDownloadClips(labeled, filename);
      setMessage(`Exported ${labeled.length} ${label.title} clip${labeled.length === 1 ? "" : "s"}.`);
    } catch {
      setMessage("Export was cancelled.");
    }
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          setOpen((on) => !on);
          setConfirmClear(false);
        }}
        className={
          open
            ? "h-11 bg-black text-[15px] font-medium text-white"
            : "h-11 border border-black text-[15px] font-medium"
        }
      >
        {open ? "Recording on" : "Record movement"}
      </button>

      {open ? (
        <div className="flex flex-col gap-3 border border-black/15 p-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            {label?.title ?? "Movement"}
          </p>
          <p className="text-sm text-black/60">
            Record the raw phone numbers for this game’s move. Saved clips stay
            on this phone; export them when you want the files.
          </p>
          {labels.length > 1 ? (
            <div className="flex flex-wrap gap-1">
              {labels.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setLabelId(item.id);
                    setConfirmClear(false);
                  }}
                  className={
                    item.id === labelId
                      ? "bg-accent px-2 py-1 text-[11px] text-white"
                      : "border border-black/15 px-2 py-1 text-[11px]"
                  }
                >
                  {item.title}
                </button>
              ))}
            </div>
          ) : null}
          {!motionReady ? (
            <p className="text-center text-sm text-black/55">
              Enable motion first.
            </p>
          ) : (
            <button
              type="button"
              onClick={startCapture}
              className="h-12 bg-accent text-[15px] font-medium text-white"
            >
              Record {label?.title}
            </button>
          )}
          <p className="text-center text-xs text-black/45">
            {labeled.length} saved
            {labeled[0]
              ? ` · last peak ${labeled[0].stats.peakMag.toFixed(1)}`
              : ""}
          </p>
          {estimate ? (
            <div className="border border-black/10 px-2 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-black/40">
                Estimate
              </p>
              <p className="mt-1 font-mono text-[11px] leading-4 text-black/80">
                n {estimate.clipCount}
                <br />
                peak {estimate.medianPeak.toFixed(1)} ({estimate.p25Peak.toFixed(1)}–
                {estimate.p75Peak.toFixed(1)})
                <br />
                action at {estimate.actionAtMs.toFixed(0)} ms after motion starts
                <br />
                start {estimate.suggestedStartMag.toFixed(1)} · min peak{" "}
                {estimate.suggestedMinPeak.toFixed(1)}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={applyEstimate}
                  className="h-9 flex-1 bg-accent text-[12px] font-medium text-white"
                >
                  Use for this game
                </button>
                {applied ? (
                  <button
                    type="button"
                    onClick={revertEstimate}
                    className="h-9 border border-black/20 px-2 text-[12px]"
                  >
                    Default
                  </button>
                ) : null}
              </div>
              {applied ? (
                <p className="mt-1 text-[11px] text-black/45">
                  Detector uses {applied.clipCount} clips · start{" "}
                  {applied.startMag.toFixed(1)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-center text-xs text-black/45">
              Save a few {label?.title ?? "moves"} to estimate when the action
              hits.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!labeled.length}
              onClick={() => void exportLabel()}
              className="h-10 flex-1 border border-black text-[13px] font-medium disabled:opacity-40"
            >
              Export JSON
            </button>
            <button
              type="button"
              disabled={!labeled.length}
              onClick={() => void clearLabel()}
              className="h-10 flex-1 border border-black/20 text-[13px] font-medium disabled:opacity-40"
            >
              {confirmClear ? "Confirm clear" : "Clear"}
            </button>
          </div>
          {message ? (
            <p className="text-center text-xs text-black/55">{message}</p>
          ) : null}
          {labeled.length ? (
            <ul className="max-h-48 overflow-y-auto text-[11px] leading-4">
              {labeled.map((clip, index) => {
                const peak = clip.frames.length
                  ? clip.frames.reduce(
                      (best, frame) => (frame.mag > best.mag ? frame : best),
                      clip.frames[0],
                    )
                  : null;
                const expanded = openClipId === clip.id;
                return (
                  <li key={clip.id} className="border-t border-black/10 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenClipId(expanded ? null : clip.id)
                        }
                        className="min-w-0 flex-1 text-left font-mono text-black/70"
                      >
                        {labeled.length - index}. peak {clip.stats.peakMag.toFixed(1)} ·{" "}
                        {clip.stats.actionAtMs.toFixed(0)}ms ·{" "}
                        {(clip.durationMs / 1000).toFixed(1)}s · {clip.stats.n}f
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(clip.id)}
                        className="text-black/40"
                      >
                        Delete
                      </button>
                    </div>
                    {expanded && peak ? (
                      <p className="mt-1 font-mono text-[11px] leading-4 text-black/55">
                        t {peak.t}ms mag {peak.mag.toFixed(2)}
                        <br />
                        α {peak.alpha.toFixed(1)} β {peak.beta.toFixed(1)} γ{" "}
                        {peak.gamma.toFixed(1)}
                        <br />
                        ax {peak.ax.toFixed(2)} ay {peak.ay.toFixed(2)} az{" "}
                        {peak.az.toFixed(2)}
                        {peak.rx != null ? (
                          <>
                            <br />
                            rx {peak.rx.toFixed(1)} ry {(peak.ry ?? 0).toFixed(1)}{" "}
                            rz {(peak.rz ?? 0).toFixed(1)}
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {capturing ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black px-5 py-8 text-white">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/70">
            Recording · {label?.title}
          </p>
          <div className="flex flex-col items-center gap-3 font-mono">
            <p className="text-6xl font-bold tracking-tight">
              {live.mag.toFixed(1)}
            </p>
            <p className="text-[15px] text-white/80">
              peak {live.peak.toFixed(1)} · {(live.elapsedMs / 1000).toFixed(1)}s ·{" "}
              {live.frames}f
            </p>
            <p className="text-center text-[12px] leading-4 text-white/70">
              α {live.alpha.toFixed(1)} β {live.beta.toFixed(1)} γ{" "}
              {live.gamma.toFixed(1)}
              <br />
              ax {live.ax.toFixed(1)} ay {live.ay.toFixed(1)} az {live.az.toFixed(1)}
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={() => void stopAndSave()}
              className="h-12 bg-white text-[15px] font-medium text-black"
            >
              Stop & save
            </button>
            <button
              type="button"
              onClick={discard}
              className="h-12 border border-white text-[15px] font-medium"
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
