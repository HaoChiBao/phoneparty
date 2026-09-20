"use client";

/** Clip the square art just after the board so the post runs off the TV. */
const CLIP = "1024 / 520";

export function GameSign({
  title,
  body,
  code,
}: {
  title: string;
  body: string;
  code: string;
}) {
  return (
    <div
      className="pointer-events-none absolute -bottom-5 right-0 z-[6] w-[min(26rem,40vw)] overflow-hidden"
      style={{ aspectRatio: CLIP }}
    >
      <img
        src="/game-sign.png"
        alt=""
        className="absolute left-0 top-0 w-full select-none"
      />
      <div
        className="absolute flex flex-col items-center justify-center text-center"
        style={{ top: "28%", left: "20%", right: "19%", height: "52%" }}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-black/50">
          {code}
        </p>
        <p className="mt-0.5 text-[clamp(1rem,2.1vw,1.35rem)] font-bold leading-none tracking-tight text-black">
          {title}
        </p>
        <p className="mt-1.5 max-h-full overflow-hidden text-[clamp(10px,1.15vw,12px)] leading-4 text-black/70">
          {body}
        </p>
      </div>
    </div>
  );
}
