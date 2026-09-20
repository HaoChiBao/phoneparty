"use client";

/**
 * Line the hook over a salmon, tap to latch, then mash the screen to reel it in.
 */
export function HookHint({
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
      aria-label="Point the camera at the TV, put the hook on a fish, then tap and mash to reel"
      style={{ display: "block" }}
    >
      <style>{`
        @keyframes fish-swim {
          0%   { transform: translateX(40px); }
          100% { transform: translateX(-48px); }
        }
        @keyframes hook-track {
          0%, 40% { transform: translate(10px, -8px); }
          55%, 100% { transform: translate(-4px, 2px); }
        }
        @keyframes tap-pulse {
          0%, 58% { opacity: 0; transform: scale(0.6); }
          68%     { opacity: 1; transform: scale(1); }
          88%,100%{ opacity: 0; transform: scale(1.35); }
        }
        .fish-swim  { animation: fish-swim 3.4s linear infinite; }
        .hook-track { animation: hook-track 3.4s ease-in-out infinite; }
        .tap-pulse  { animation: tap-pulse 3.4s ease-out infinite;
                      transform-origin: 80px 108px; }
        @media (prefers-reduced-motion: reduce) {
          .fish-swim, .hook-track, .tap-pulse { animation: none; }
          .tap-pulse { opacity: 0; }
        }
      `}</style>

      <rect x="6" y="12" width="148" height="86" rx="6" fill="#12415e" />
      <rect x="6" y="12" width="148" height="28" fill="#2f7fa8" opacity="0.35" />

      <g className="fish-swim">
        <image
          href="/fishing/fish-medium.png"
          x="78"
          y="38"
          width="22"
          height="38"
          preserveAspectRatio="xMidYMid meet"
          transform="rotate(-90 89 57)"
        />
      </g>

      <g className="hook-track">
        <line x1="74" y1="12" x2="74" y2="44" stroke={accent} strokeWidth="2" />
        <image
          href="/fishing/hook.png"
          x="62"
          y="40"
          width="24"
          height="24"
          preserveAspectRatio="xMidYMid meet"
        />
        <circle cx="74" cy="52" r="14" fill="none" stroke={accent} strokeWidth="2" />
      </g>

      <rect x="48" y="102" width="64" height="14" rx="2" fill={accent} />
      <text
        x="80"
        y="112"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="8"
        fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
      >
        Hook
      </text>
      <g className="tap-pulse">
        <circle cx="80" cy="108" r="18" fill="none" stroke={accent} strokeWidth="2" />
      </g>
    </svg>
  );
}
