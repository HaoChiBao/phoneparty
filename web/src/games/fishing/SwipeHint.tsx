"use client";

/**
 * Looping hint: hold the phone with its camera at the TV, move to put the paw
 * on a salmon, then jab straight down to swipe.
 */
export function SwipeHint({
  size = 168,
  accent = "#0057FF",
}: {
  size?: number;
  accent?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 120"
      width={size}
      height={(size * 120) / 160}
      role="img"
      aria-label="Point the camera at the TV, line the paw up on a fish, then jab down"
      style={{ display: "block" }}
    >
      <style>{`
        @keyframes fish-swim {
          0%   { transform: translateX(46px); }
          100% { transform: translateX(-52px); }
        }
        @keyframes paw-track {
          0%, 46% { transform: translate(14px, -6px); }
          62%     { transform: translate(-6px, 0px); }
          72%     { transform: translate(-6px, 16px); }
          80%     { transform: translate(-6px, 0px); }
          100%    { transform: translate(-16px, -4px); }
        }
        @keyframes paw-splash {
          0%, 70% { opacity: 0; transform: scale(0.4); }
          76%     { opacity: 1; transform: scale(1); }
          90%,100%{ opacity: 0; transform: scale(1.8); }
        }
        .fish-swim   { animation: fish-swim 3.2s linear infinite; }
        .paw-track   { animation: paw-track 3.2s ease-in-out infinite; }
        .paw-splash  { animation: paw-splash 3.2s ease-out infinite;
                       transform-origin: 74px 62px; }
        @media (prefers-reduced-motion: reduce) {
          .fish-swim, .paw-track, .paw-splash { animation: none; }
          .paw-splash { opacity: 0; }
        }
      `}</style>

      <rect x="6" y="18" width="148" height="86" rx="6" fill="#12415e" />
      <rect x="6" y="18" width="148" height="30" fill="#2f7fa8" opacity="0.35" />

      <g className="fish-swim">
        <image
          href="/fishing/fish.png"
          x="79"
          y="43"
          width="22"
          height="38"
          preserveAspectRatio="xMidYMid meet"
          transform="rotate(-90 90 62)"
        />
      </g>

      <g className="paw-track">
        <circle cx="74" cy="56" r="11" fill="#7a4a28" />
        <circle cx="74" cy="57" r="5" fill="#3d2415" />
        <circle cx="66" cy="47" r="2.6" fill="#3d2415" />
        <circle cx="71" cy="44" r="2.6" fill="#3d2415" />
        <circle cx="77" cy="44" r="2.6" fill="#3d2415" />
        <circle cx="82" cy="47" r="2.6" fill="#3d2415" />
        <circle cx="74" cy="56" r="13.5" fill="none" stroke={accent} strokeWidth="2" />
      </g>

      <g className="paw-splash">
        <circle cx="74" cy="62" r="12" fill="none" stroke="#ffffff" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
