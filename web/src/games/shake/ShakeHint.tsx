"use client";

/**
 * Looping hint for the shake: hold the phone flat with the rear camera at the
 * ground, then shake it left and right. Plain SVG + CSS so it renders on the
 * phone pad and on the TV overlay without a canvas.
 */
export function ShakeHint({
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
      aria-label="Hold the phone flat with the camera at the ground and shake it left and right"
      style={{ display: "block" }}
    >
      <style>{`
        @keyframes shake-side {
          0%, 100% { transform: translateX(-17px) rotate(-5deg); }
          50%      { transform: translateX(17px) rotate(5deg); }
        }
        @keyframes shake-puff {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 1; }
        }
        .shake-phone { animation: shake-side 0.46s ease-in-out infinite; }
        .shake-puff  { animation: shake-puff 0.46s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .shake-phone, .shake-puff { animation: none; }
        }
      `}</style>

      {/* left and right cues */}
      <g className="shake-puff" stroke={accent} strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M30 60 l-11 0 M24 54 l-6 6 l6 6" />
        <path d="M130 60 l11 0 M136 54 l6 6 l-6 6" />
      </g>

      <g className="shake-phone">
        {/* seen from above: the phone is flat, camera looking down */}
        <rect x="64" y="40" width="32" height="46" rx="6" fill="#111111" />
        <rect x="68" y="45" width="24" height="30" rx="3" fill="#ffffff" opacity="0.2" />
        <circle cx="80" cy="81" r="3.2" fill={accent} />
      </g>

      {/* the ground the camera is pointed at */}
      <line x1="16" y1="104" x2="144" y2="104" stroke="#111111" strokeWidth="2" opacity="0.35" />
      <path
        d="M80 90 l0 9 M76 95 l4 4 l4 -4"
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
    </svg>
  );
}
