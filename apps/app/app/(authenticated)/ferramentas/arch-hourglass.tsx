import { useId } from "react";
import "./tools-bancada.css";

/**
 * Ampulheta dentro de um arco, com moldura dourada, brilho e poeira. A areia
 * mede `remaining` (0 a 1): 1 = tudo em cima, 0 = tudo embaixo. Usada na
 * ampulheta da meta e no cronômetro.
 */
export const ArchHourglass = ({
  className,
  flowing = false,
  glow = 0.5,
  label,
  remaining,
}: {
  readonly className?: string;
  readonly flowing?: boolean;
  readonly glow?: number;
  readonly label: string;
  readonly remaining: number;
}) => {
  const id = useId().replace(/:/g, "");
  const fraction = Math.max(0, Math.min(1, remaining));
  const topHeight = 74 * fraction;
  const bottomHeight = 74 * (1 - fraction);
  const bottomY = 184 - bottomHeight;

  return (
    <svg
      aria-label={label}
      className={className}
      role="img"
      viewBox="0 0 160 220"
    >
      <defs>
        <linearGradient id={`${id}-wall`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#4A0E2C" />
          <stop offset="1" stopColor="#22040F" />
        </linearGradient>
        <radialGradient cx="0.5" cy="0.15" id={`${id}-glow`} r="0.7">
          <stop offset="0" stopColor="#F5C7A0" stopOpacity={glow} />
          <stop offset="0.5" stopColor="#B8425A" stopOpacity="0.18" />
          <stop offset="1" stopColor="#22040F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#B8864A" />
          <stop offset="0.45" stopColor="#F0C98A" />
          <stop offset="1" stopColor="#A9783F" />
        </linearGradient>
        <clipPath id={`${id}-top`}>
          <path d="M45 36 C45 80 74 92 78 110 H82 C86 92 115 80 115 36 Z" />
        </clipPath>
        <clipPath id={`${id}-bottom`}>
          <path d="M78 110 C74 128 45 140 45 184 H115 C115 140 86 128 82 110 Z" />
        </clipPath>
        <clipPath id={`${id}-arch`}>
          <path d="M8 220 V80 C8 30 50 6 80 6 C110 6 152 30 152 80 V220 Z" />
        </clipPath>
      </defs>
      <path
        d="M8 220 V80 C8 30 50 6 80 6 C110 6 152 30 152 80 V220 Z"
        fill={`url(#${id}-wall)`}
      />
      <g clipPath={`url(#${id}-arch)`}>
        <rect fill={`url(#${id}-glow)`} height="220" width="160" />
        <circle
          className="bancada-dust"
          cx="34"
          cy="70"
          fill="#FFE3C8"
          r="1.2"
        />
        <circle
          className="bancada-dust bancada-dust-2"
          cx="126"
          cy="96"
          fill="#FFE3C8"
          r="1"
        />
        <circle
          className="bancada-dust bancada-dust-3"
          cx="118"
          cy="52"
          fill="#FFE3C8"
          r="1.3"
        />
        <circle
          className="bancada-dust bancada-dust-2"
          cx="28"
          cy="140"
          fill="#FFE3C8"
          r="0.9"
        />
        <rect fill="#5A2233" height="7" width="160" y="204" />
        <rect fill="#3B1222" height="9" width="160" y="211" />
      </g>
      <path
        d="M8 220 V80 C8 30 50 6 80 6 C110 6 152 30 152 80 V220"
        fill="none"
        stroke="#7A1E3E"
        strokeWidth="2"
      />
      <ellipse cx="80" cy="203" fill="#000" opacity="0.35" rx="52" ry="3" />
      <rect
        fill={`url(#${id}-gold)`}
        height="9"
        rx="2"
        width="92"
        x="34"
        y="184"
      />
      <rect
        fill={`url(#${id}-gold)`}
        height="9"
        rx="2"
        width="100"
        x="30"
        y="193"
      />
      <rect
        fill={`url(#${id}-gold)`}
        height="9"
        rx="2"
        width="100"
        x="30"
        y="18"
      />
      <rect
        fill={`url(#${id}-gold)`}
        height="9"
        rx="2"
        width="92"
        x="34"
        y="27"
      />
      <rect fill={`url(#${id}-gold)`} height="148" width="5" x="36" y="36" />
      <rect fill={`url(#${id}-gold)`} height="148" width="5" x="119" y="36" />
      <circle cx="38.5" cy="110" fill="#F0C98A" r="4" />
      <circle cx="121.5" cy="110" fill="#F0C98A" r="4" />
      <path
        d="M45 36 C45 80 74 92 78 110 C74 128 45 140 45 184 H115 C115 140 86 128 82 110 C86 92 115 80 115 36 Z"
        fill="#F0E4D8"
        fillOpacity="0.12"
      />
      <rect
        className="bancada-sand"
        clipPath={`url(#${id}-top)`}
        fill="#E2565A"
        height={topHeight}
        width="80"
        x="40"
        y={110 - topHeight}
      />
      <rect
        className="bancada-sand"
        clipPath={`url(#${id}-bottom)`}
        fill="#C8333F"
        height={bottomHeight}
        width="80"
        x="40"
        y={bottomY}
      />
      {flowing && fraction > 0 && fraction < 1 ? (
        <>
          <line
            className="bancada-stream"
            stroke="#E2565A"
            strokeWidth="1.6"
            x1="80"
            x2="80"
            y1="108"
            y2={bottomY}
          />
          <circle
            className="bancada-grain"
            cx="80"
            cy="114"
            fill="#F5A0A0"
            r="1.3"
          />
          <circle
            className="bancada-grain bancada-grain-2"
            cx="79"
            cy="114"
            fill="#F5A0A0"
            r="1"
          />
        </>
      ) : null}
      <path
        d="M45 36 C45 80 74 92 78 110 C74 128 45 140 45 184 H115 C115 140 86 128 82 110 C86 92 115 80 115 36 Z"
        fill="none"
        stroke="#F0E4D8"
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
      <path
        d="M52 44 C52 70 62 84 70 94"
        fill="none"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeOpacity="0.45"
        strokeWidth="2.5"
      />
      <path
        d="M52 176 C52 156 60 142 68 134"
        fill="none"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeOpacity="0.3"
        strokeWidth="2"
      />
    </svg>
  );
};

/** Areia restante e fluxo da ampulheta do cronômetro a partir da sessão ativa. */
export const timerHourglass = (input: {
  readonly active: {
    readonly durationSeconds?: number | null;
    readonly pausedAt?: string | Date | null;
    readonly runStartedAt?: string | Date | null;
  } | null;
  readonly elapsed: number;
  readonly progress: number;
  readonly stopwatch: boolean;
}) => {
  const { active, elapsed, progress, stopwatch } = input;
  let remaining = 1;
  if (active?.durationSeconds) {
    remaining = 1 - progress;
  } else if (active && stopwatch) {
    remaining = 1 - (elapsed % 3600) / 3600;
  }
  return {
    flowing: Boolean(active?.runStartedAt && !active.pausedAt),
    remaining,
  };
};
