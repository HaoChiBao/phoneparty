"use client";

import { useCallback, useMemo, useState } from "react";
import type { GamePadProps } from "@/games/types";
import { powerToScore, useRoundState } from "./logic";
import { SwingHint } from "./SwingHint";
import {
  isAimedDown,
  type RestPose,
  useSwingDetector,
} from "./swing";
import {
  loadSensitivity,
  saveSensitivity,
  SENSITIVITY,
  tuneFromSensitivity,
} from "./tune";

export function HammerPad({
  sendAction,
  players,
  selfId,
  actionsByPlayer,
  motionReady,
  sample,
}: GamePadProps) {
  const controllers = useMemo(
    () => players.filter((player) => player.role === "controller"),
    [players],
  );
  const round = useRoundState(controllers, actionsByPlayer);
  const self = controllers.find((player) => player.id === selfId) ?? null;
  const accent = self?.color ?? "#0057FF";
  const mySwing = selfId ? round.swings[selfId] : undefined;
  const myTurn = Boolean(selfId) && round.current?.id === selfId;

  const [armed, setArmed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sensitivity, setSensitivity] = useState(loadSensitivity);
  const [rest, setRest] = useState<RestPose | null>(null);
  const [practice, setPractice] = useState<{ power: number; peak: number } | null>(
    null,
  );

  const tune = useMemo(() => tuneFromSensitivity(sensitivity), [sensitivity]);
  const aimedDown = isAimedDown(sample, rest, tune);
  const waitingToSwing = myTurn && !mySwing && motionReady && !testing;
  const screenReady = armed && waitingToSwing;

  const onSwing = useCallback(
    (power: number, peak: number) => {
      if (testing) {
        setPractice({ power, peak });
        return;
      }
      setArmed(false);
      sendAction("swing", { power });
    },
    [sendAction, testing],
  );

  const { phase, liveMag } = useSwingDetector({
    active: motionReady && (testing || (waitingToSwing && armed)),
    armed: testing || armed,
    aimedDown,
    tune,
    reportLive: testing,
    onSwing,
  });

  function setSensitivityAndSave(value: number) {
    setSensitivity(saveSensitivity(value));
  }

  function calibrateRest() {
    if (!sample) return;
    setRest({ beta: sample.beta, gamma: sample.gamma });
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {screenReady ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#16a34a] px-5 py-8 text-white">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/80">
            Ready
          </p>
          <div className="flex flex-col items-center gap-4">
            <p className="text-5xl font-bold tracking-tight">Swing</p>
            <p className="max-w-xs text-center text-[15px] leading-5 text-white/90">
              {phase === "capturing"
                ? "Got it…"
                : "Phone is live. Swing down like a mallet."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="h-12 w-full max-w-xs border border-white text-[15px] font-medium"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {!motionReady ? (
        <p className="text-center text-sm text-black/60">
          Tap <span className="font-medium text-black">Enable motion</span> below
          to take your swing.
        </p>
      ) : round.done && !testing ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            Round over
          </p>
          <p className="text-3xl font-bold tracking-tight">
            {round.winner
              ? round.winner.id === selfId
                ? "You win"
                : `${round.winner.name} wins`
              : "No score"}
          </p>
          <button
            type="button"
            onClick={() => sendAction("restart")}
            className="h-12 w-full bg-accent text-[15px] font-medium text-white"
          >
            New round
          </button>
        </>
      ) : mySwing && !testing ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            Your swing
          </p>
          <p className="text-6xl font-bold tracking-tight">{mySwing.score}</p>
          <p className="text-center text-sm text-black/55">
            {round.current
              ? `${round.current.name} is up next.`
              : "Waiting for the others…"}
          </p>
        </>
      ) : myTurn && !testing ? (
        <>
          <p
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            Your turn
          </p>
          <SwingHint size={172} accent={accent} />
          <p
            className="text-center text-[15px] font-medium"
            style={{ color: aimedDown ? accent : "#111111" }}
          >
            Hold the phone like a hammer, then tap Ready.
          </p>
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="h-14 w-full bg-[#16a34a] text-[15px] font-medium text-white"
          >
            Ready
          </button>
        </>
      ) : !testing ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">
            Waiting
          </p>
          <p className="text-2xl font-bold tracking-tight">
            {round.current ? `${round.current.name} is up` : "Getting ready…"}
          </p>
          <p className="text-center text-sm text-black/55">
            Everyone swings once. Highest score wins.
          </p>
        </>
      ) : null}

      {testing ? (
        <div className="flex w-full max-w-xs flex-col gap-3 border border-black/15 p-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
            Test
          </p>
          <p className="text-sm text-black/60">
            Practice swings do not count. Calibrate the rest pose, then tune
            how hard a hit has to be.
          </p>
          <button
            type="button"
            onClick={calibrateRest}
            disabled={!sample}
            className="h-11 border border-black text-[15px] font-medium disabled:opacity-40"
          >
            Calibrate rest pose
          </button>
          <p className="text-center text-xs text-black/45">
            {rest
              ? `Rest β ${rest.beta.toFixed(0)}°  γ ${rest.gamma.toFixed(0)}°`
              : "Hold the phone how you will swing, then calibrate."}
          </p>
          <label className="block">
            <span className="flex justify-between text-[11px] text-black/55">
              <span>Sensitivity</span>
              <span>{sensitivity.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={SENSITIVITY.min}
              max={SENSITIVITY.max}
              step={SENSITIVITY.step}
              value={sensitivity}
              onChange={(event) =>
                setSensitivityAndSave(Number(event.target.value))
              }
              className="mt-1 w-full accent-[#0057FF]"
            />
          </label>
          <p className="text-center font-mono text-[11px] text-black/55">
            live {liveMag.toFixed(1)} m/s²
            {sample
              ? `  ·  β ${sample.beta.toFixed(0)} γ ${sample.gamma.toFixed(0)}`
              : ""}
          </p>
          {practice ? (
            <p className="text-center text-sm font-medium">
              Practice {powerToScore(practice.power)}
              <span className="ml-2 text-black/45">
                peak {practice.peak.toFixed(1)}
              </span>
            </p>
          ) : (
            <p className="text-center text-xs text-black/45">
              Swing now to read a score. Higher sensitivity = lighter hits
              count more.
            </p>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setArmed(false);
          setTesting((on) => !on);
        }}
        className={
          testing
            ? "h-11 w-full max-w-xs bg-black text-[15px] font-medium text-white"
            : "h-11 w-full max-w-xs border border-black text-[15px] font-medium"
        }
      >
        {testing ? "Test mode on" : "Test mode"}
      </button>

      <div className="flex flex-wrap justify-center gap-2">
        {round.order.map((player) => {
          const record = round.swings[player.id];
          const isSelf = player.id === selfId;
          return (
            <span
              key={player.id}
              className={
                isSelf
                  ? "px-2 py-1 text-[11px] font-medium text-white"
                  : "border px-2 py-1 text-[11px]"
              }
              style={
                isSelf
                  ? { background: player.color }
                  : { borderColor: player.color }
              }
            >
              {isSelf ? "You" : player.name} · {record ? record.score : "—"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
