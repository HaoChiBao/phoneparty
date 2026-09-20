export function LoadingScreen({ progress = 0 }: { progress?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="absolute inset-0 z-50 flex h-full flex-col items-center justify-center bg-[#7eb8e6]">
      <img
        src="/bearlympics.png"
        alt="Bearlympics"
        className="w-[min(72vw,28rem)] object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.22)]"
      />
      <div className="mt-10 h-1 w-[min(42vw,16rem)] overflow-hidden rounded-full bg-black/15">
        <div
          className="h-full bg-black transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-black/55">
        Loading {pct}%
      </p>
    </div>
  );
}
