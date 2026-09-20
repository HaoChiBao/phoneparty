"use client";

import { useState } from "react";
import type { GamePadProps } from "@/games/types";

export function BeerPongPad({ sendAction, sample }: GamePadProps) {
  const [testing, setTesting] = useState(false);

  function toggleTest() {
    const next = !testing;
    setTesting(next);
    sendAction("test", { on: next });
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <button
        type="button"
        onClick={() => sendAction("throw")}
        className="h-14 bg-accent text-[15px] font-medium text-white"
      >
        Throw
      </button>
      <button
        type="button"
        onClick={toggleTest}
        className={
          testing
            ? "h-11 bg-black text-[15px] font-medium text-white"
            : "h-11 border border-black text-[15px] font-medium"
        }
      >
        {testing ? "Test mode on" : "Test mode"}
      </button>
      {testing ? (
        <>
          <button
            type="button"
            onClick={() => sendAction("resetCups")}
            className="h-11 border border-black/20 text-[15px] font-medium"
          >
            Reset cups
          </button>
          <p className="text-center text-xs leading-4 text-black/45">
            Free throw. Watch the TV for aim math and sliders.
          </p>
          {sample ? (
            <p className="text-center font-mono text-[11px] text-black/55">
              α {sample.alpha.toFixed(1)} β {sample.beta.toFixed(1)} γ {sample.gamma.toFixed(1)}
              <br />
              xyz {sample.x.toFixed(2)} {sample.y.toFixed(2)} {sample.z.toFixed(2)}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-center text-xs leading-4 text-black/45">
          Point at the far cups on the TV. Throw on your turn.
        </p>
      )}
    </div>
  );
}
