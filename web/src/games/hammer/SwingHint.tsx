"use client";

/**
 * Looping hint for the hammer motion: hold the phone flat with the rear camera
 * facing the floor, then drive it straight down without tilting. Plain SVG +
 * CSS so it renders on the phone pad and on the TV overlay without a canvas.
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
      aria-label="Hold the phone flat with the camera facing the floor and push it straight down"
      style={{ display: "block" }}
    >
      <style>{`
        @keyframes hammer-drop {
          0%   { transform: translateY(0);
                 animation-timing-function: cubic-bezier(.5,0,.9,.35); }
          22%  { transform: translateY(0);
                 animation-timing-function: cubic-bezier(.5,0,.9,.35); }
          44%  { transform: translateY(54px);
                 animation-timing-function: ease-out; }
          54%  { transform: translateY(47px);
                 animation-timing-function: ease-in-out; }
          82%  { transform: translateY(0); }
          100% { transform: translateY(0); }
        }
        @keyframes hammer-trail {
          0%, 20%  { opacity: 0; }
          32%      { opacity: 1; }
          46%,100% { opacity: 0; }
        }
        @keyframes hammer-impact {
          0%, 42%  { opacity: 0; transform: scale(0.5); }
          48%      { opacity: 1; transform: scale(1); }
          66%,100% { opacity: 0; transform: scale(1.5); }
        }
        .hammer-phone  { animation: hammer-drop 2.4s infinite; }
        .hammer-trail  { animation: hammer-trail 2.4s linear infinite; }
        .hammer-burst  { animation: hammer-impact 2.4s ease-out infinite;
                         transform-origin: 80px 104px; }
        @media (prefers-reduced-motion: reduce) {
          .hammer-phone, .hammer-trail, .hammer-burst { animation: none; }
          .hammer-trail, .hammer-burst { opacity: 0; }
        }
      `}</style>

      {/* straight-down guides: the phone never rotates */}
      <g className="hammer-trail" stroke={accent} strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M44 56 l0 18" opacity="0.45" />
        <path d="M116 56 l0 18" opacity="0.45" />
        <path d="M80 58 l0 22" />
        <path d="M72 72 l8 9 8-9" />
      </g>

      <g className="hammer-phone">
        <rect x="52" y="30" width="56" height="20" rx="5" fill="#111111" />
        {/* the rear camera, on the underside, pointed at the floor */}
        <circle cx="62" cy="52" r="3.4" fill={accent} />
        <rect x="70" y="35" width="20" height="10" rx="2" fill="#ffffff" opacity="0.18" />
      </g>

      <g className="hammer-burst">
        <circle cx="80" cy="104" r="13" fill="none" stroke={accent} strokeWidth="3" />
      </g>

      <line x1="14" y1="108" x2="146" y2="108" stroke="#111111" strokeWidth="2" opacity="0.35" />
    </svg>
  );
}
