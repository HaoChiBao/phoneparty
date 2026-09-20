"use client";

/**
 * Looping hint for the archery motion: the phone's BACK faces the TV (screen
 * toward you), tilt to move the aim, then hold it still while the ring fills.
 */
export function AimHint({
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
      aria-label="Point the back of the phone at the TV, tilt to aim, then hold still"
      style={{ display: "block" }}
    >
      <style>{`
        @keyframes archery-tilt {
          0%    { transform: rotate(-9deg) translateX(-5px); }
          26%   { transform: rotate(7deg) translateX(5px); }
          46%   { transform: rotate(-3deg) translateX(-2px); }
          60%,100% { transform: rotate(0deg) translateX(0); }
        }
        @keyframes archery-crosshair {
          0%    { transform: translate(-16px, 7px); }
          26%   { transform: translate(14px, -6px); }
          46%   { transform: translate(-6px, 3px); }
          60%,100% { transform: translate(0, 0); }
        }
        @keyframes archery-fill {
          0%, 58%  { stroke-dashoffset: 132; }
          92%,100% { stroke-dashoffset: 0; }
        }
        @keyframes archery-loose {
          0%, 90%  { opacity: 0; transform: scale(0.4); }
          96%      { opacity: 1; transform: scale(1); }
          100%     { opacity: 0; transform: scale(1.5); }
        }
        .archery-phone { animation: archery-tilt 4.5s ease-in-out infinite;
                         transform-origin: 80px 96px; }
        .archery-cross { animation: archery-crosshair 4.5s ease-in-out infinite; }
        .archery-fill  { animation: archery-fill 4.5s linear infinite;
                         stroke-dasharray: 132; transform: rotate(-90deg);
                         transform-origin: 80px 42px; }
        .archery-hit   { animation: archery-loose 4.5s ease-out infinite;
                         transform-origin: 80px 42px; }
        @media (prefers-reduced-motion: reduce) {
          .archery-phone, .archery-cross, .archery-fill, .archery-hit {
            animation: none;
          }
          .archery-fill { stroke-dashoffset: 0; }
          .archery-hit  { opacity: 0; }
        }
      `}</style>

      {/* target face */}
      <circle cx="80" cy="42" r="26" fill="#ffffff" stroke="#111111" strokeWidth="1.5" />
      <circle cx="80" cy="42" r="17" fill="none" stroke="#111111" strokeWidth="1" opacity="0.35" />
      <circle cx="80" cy="42" r="9" fill={accent} opacity="0.18" />
      {/* the hold ring filling around it */}
      <circle
        className="archery-fill"
        cx="80" cy="42" r="21"
        fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round"
      />
      <g className="archery-cross">
        <circle cx="80" cy="42" r="4.5" fill="none" stroke={accent} strokeWidth="2" />
        <circle cx="80" cy="42" r="1.3" fill={accent} />
      </g>
      <g className="archery-hit">
        <circle cx="80" cy="42" r="9" fill="none" stroke={accent} strokeWidth="2.5" />
      </g>

      {/* the phone, screen toward you, back pointing up at the TV */}
      <g className="archery-phone">
        <rect x="68" y="80" width="24" height="34" rx="4" fill="#111111" />
        <rect x="71" y="84" width="18" height="24" rx="2" fill="#ffffff" opacity="0.22" />
        <path
          d="M80 78 l0 -6 M76 74 l4 -4 l4 4"
          fill="none" stroke={accent} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
