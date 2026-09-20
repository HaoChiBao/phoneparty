"use client";

/**
 * Looping hint: hold the phone like a paw and swing down at the tree.
 * Plain SVG + CSS so it renders on the phone pad and the TV overlay.
 */
export function SwingHint({
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
      aria-label="Hold the phone like a paw, then swing down at the tree"
      style={{ display: "block" }}
    >
      <style>{`
        @keyframes paw-swing {
          0%, 8%   { transform: rotate(-58deg); }
          38%      { transform: rotate(-58deg); }
          52%      { transform: rotate(8deg); }
          60%      { transform: rotate(-4deg); }
          68%, 100%{ transform: rotate(-58deg); }
        }
        @keyframes paw-impact {
          0%, 50%  { opacity: 0; transform: scale(0.6); }
          56%      { opacity: 1; transform: scale(1); }
          72%, 100%{ opacity: 0; transform: scale(1.35); }
        }
        @keyframes paw-apple {
          0%, 50%  { transform: translate(0, 0); opacity: 0; }
          58%      { opacity: 1; }
          100%     { transform: translate(6px, 22px); opacity: 0; }
        }
        .paw-arm    { animation: paw-swing 2.4s cubic-bezier(.4,0,.2,1) infinite;
                      transform-origin: 30px 102px; }
        .paw-burst  { animation: paw-impact 2.4s ease-out infinite;
                      transform-origin: 108px 78px; }
        .paw-apple  { animation: paw-apple 2.4s ease-in infinite; }
        @media (prefers-reduced-motion: reduce) {
          .paw-arm, .paw-burst, .paw-apple { animation: none; }
        }
      `}</style>

      <rect x="100" y="54" width="18" height="60" rx="4" fill="#6b4728" />
      <circle cx="109" cy="40" r="22" fill="#2f7a38" />
      <circle cx="124" cy="48" r="14" fill="#3c8f44" />
      <circle cx="96" cy="48" r="13" fill="#276b31" />

      <path
        className="paw-arm"
        d="M30 102 C 58 100, 82 92, 100 78"
        fill="none"
        stroke="#7a4a28"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <g className="paw-arm">
        <ellipse cx="104" cy="74" rx="14" ry="10" fill="#7a4a28" />
        <ellipse cx="104" cy="76" rx="7" ry="4" fill="#5a3318" />
      </g>
      <g className="paw-burst">
        <circle cx="108" cy="78" r="13" fill="none" stroke={accent} strokeWidth="3" />
      </g>
      <g className="paw-apple">
        <circle cx="118" cy="42" r="4.5" fill={accent} />
        <circle cx="102" cy="36" r="3.5" fill="#c43b32" />
      </g>
      <line
        x1="10"
        y1="114"
        x2="150"
        y2="114"
        stroke="#111111"
        strokeWidth="2"
        opacity="0.35"
      />
    </svg>
  );
}
