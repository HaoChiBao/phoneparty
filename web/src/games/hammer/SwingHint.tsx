"use client";

/**
 * Looping hint for the hammer motion: hold the phone flat with the rear camera
 * facing the floor, then swing it straight down. Plain SVG + CSS so it renders
 * on the phone pad and on the TV overlay without a 3D canvas.
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
      aria-label="Hold the phone flat with the camera facing the floor, then swing down"
      style={{ display: "block" }}
    >
      <style>{`
        @keyframes hammer-swing {
          0%, 8%   { transform: rotate(-62deg); }
          38%      { transform: rotate(-62deg); }
          52%      { transform: rotate(4deg); }
          60%      { transform: rotate(-6deg); }
          68%, 100%{ transform: rotate(-62deg); }
        }
        @keyframes hammer-impact {
          0%, 50%  { opacity: 0; transform: scale(0.6); }
          56%      { opacity: 1; transform: scale(1); }
          72%, 100%{ opacity: 0; transform: scale(1.35); }
        }
        @keyframes hammer-arc {
          0%, 38%  { stroke-dashoffset: 92; opacity: 0.25; }
          52%      { stroke-dashoffset: 0; opacity: 1; }
          70%, 100%{ stroke-dashoffset: 0; opacity: 0; }
        }
        .hammer-arm   { animation: hammer-swing 2.4s cubic-bezier(.4,0,.2,1) infinite;
                        transform-origin: 28px 104px; }
        .hammer-burst { animation: hammer-impact 2.4s ease-out infinite;
                        transform-origin: 112px 100px; }
        .hammer-arc   { animation: hammer-arc 2.4s ease-in-out infinite;
                        stroke-dasharray: 92; }
        @media (prefers-reduced-motion: reduce) {
          .hammer-arm, .hammer-burst, .hammer-arc { animation: none; }
          .hammer-arc { stroke-dashoffset: 0; }
        }
      `}</style>

      <path
        className="hammer-arc"
        d="M104 26 A 76 76 0 0 1 122 96"
        fill="none"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <g className="hammer-arm">
        <line
          x1="28"
          y1="104"
          x2="104"
          y2="104"
          stroke="#111111"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* the phone is the hammer head; the dot is the rear camera, aimed down */}
        <rect
          x="94"
          y="88"
          width="34"
          height="24"
          rx="5"
          fill="#111111"
        />
        <circle cx="121" cy="107" r="3.4" fill={accent} />
      </g>
      <g className="hammer-burst">
        <circle cx="112" cy="100" r="14" fill="none" stroke={accent} strokeWidth="3" />
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
