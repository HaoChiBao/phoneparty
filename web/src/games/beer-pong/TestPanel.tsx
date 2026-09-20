"use client";

import type { CalibratedPose, GyroSample, Player } from "@/lib/protocol";
import type { ThrowReadout } from "./throwMath";
import { TUNE_RANGE, type ThrowTune } from "./tune";

export type LastThrowInfo = {
  name: string;
  speed: number;
  arcDeg: number;
  power: number;
  targetX: number;
  targetZ: number;
  result: "air" | "sink" | "bounce" | "miss";
  cupId?: string;
};

function fmt(value: number, digits = 2) {
  return value.toFixed(digits);
}

function Slider({
  field,
  tune,
  onChange,
}: {
  field: keyof ThrowTune;
  tune: ThrowTune;
  onChange: (field: keyof ThrowTune, value: number) => void;
}) {
  const range = TUNE_RANGE[field];
  const suffix = field === "arc" ? `${Math.round((tune[field] * 180) / Math.PI)}°` : fmt(tune[field]);
  return (
    <label className="block">
      <span className="flex justify-between text-[11px] text-black/55">
        <span>{range.label}</span>
        <span>{suffix}</span>
      </span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={tune[field]}
        onChange={(event) => onChange(field, Number(event.target.value))}
        className="mt-1 w-full accent-[#0057FF]"
      />
    </label>
  );
}

export function TestPanel({
  testing,
  onToggle,
  controllers,
  focusId,
  onFocus,
  sample,
  calib,
  aim,
  tune,
  onTune,
  onResetTune,
  onResetCups,
  lastThrow,
}: {
  testing: boolean;
  onToggle: () => void;
  controllers: Player[];
  focusId: string | null;
  onFocus: (id: string) => void;
  sample?: GyroSample;
  calib?: CalibratedPose;
  aim: ThrowReadout | null;
  tune: ThrowTune;
  onTune: (field: keyof ThrowTune, value: number) => void;
  onResetTune: () => void;
  onResetCups: () => void;
  lastThrow: LastThrowInfo | null;
}) {
  return (
    <div className="pointer-events-auto absolute bottom-24 left-5 z-20 w-[260px] max-h-[min(70dvh,36rem)] overflow-y-auto rounded-2xl bg-white/95 px-3 py-3 text-[12px] leading-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Test</p>
        <button
          type="button"
          onClick={onToggle}
          className={
            testing
              ? "bg-accent px-2 py-1 text-[11px] text-white"
              : "border border-black/20 px-2 py-1 text-[11px]"
          }
        >
          {testing ? "On" : "Off"}
        </button>
      </div>
      {!testing ? (
        <p className="mt-2 text-black/50">
          Turn this on to shoot anytime, tweak throw feel, and watch how the phone maps onto the table.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-black/55">
            A straight flick aims at the middle of the other rack. Gyro twist and a light
            phone move add a small nudge. Calibrate before throwing.
          </p>
          {controllers.length > 1 ? (
            <div className="flex flex-wrap gap-1">
              {controllers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onFocus(player.id)}
                  className={
                    player.id === focusId
                      ? "bg-accent px-2 py-0.5 text-[11px] text-white"
                      : "border border-black/15 px-2 py-0.5 text-[11px]"
                  }
                >
                  {player.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-black/45">
              {controllers[0]?.name ?? "Join a phone. One is enough in test."}
            </p>
          )}
          <div className="font-mono text-[11px] text-black/80">
            <p>
              raw α {fmt(sample?.alpha ?? 0, 1)} β {fmt(sample?.beta ?? 0, 1)} γ{" "}
              {fmt(sample?.gamma ?? 0, 1)}
            </p>
            <p>
              xyz {fmt(sample?.x ?? 0)} {fmt(sample?.y ?? 0)} {fmt(sample?.z ?? 0)}
            </p>
            <p>
              calib α {fmt(calib?.alpha ?? 0, 1)} β {fmt(calib?.beta ?? 0, 1)} γ{" "}
              {fmt(calib?.gamma ?? 0, 1)}
            </p>
            <p>
              rel yaw {fmt(aim?.yaw ?? 0, 1)} pitch {fmt(aim?.pitch ?? 0, 1)} roll{" "}
              {fmt(aim?.roll ?? 0, 1)}
            </p>
            <p>
              nudge {fmt(aim?.lateral ?? 0)} , {fmt(aim?.depth ?? 0)}
            </p>
            <p>
              target {fmt(aim?.targetX ?? 0)} , {fmt(aim?.targetZ ?? 0)}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {(Object.keys(TUNE_RANGE) as (keyof ThrowTune)[]).map((field) => (
              <Slider key={field} field={field} tune={tune} onChange={onTune} />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onResetTune}
              className="border border-black/20 px-2 py-1 text-[11px]"
            >
              Default feel
            </button>
            <button
              type="button"
              onClick={onResetCups}
              className="border border-black/20 px-2 py-1 text-[11px]"
            >
              Reset cups
            </button>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-black/40">Last throw</p>
            {lastThrow ? (
              <p className="mt-1 font-mono text-[11px] text-black/80">
                {lastThrow.name} {fmt(lastThrow.speed)} m/s {Math.round(lastThrow.arcDeg)}° ×
                {fmt(lastThrow.power)}
                <br />
                aim {fmt(lastThrow.targetX)} , {fmt(lastThrow.targetZ)}
                <br />
                {lastThrow.result}
                {lastThrow.cupId ? ` ${lastThrow.cupId}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-black/45">No throw yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
