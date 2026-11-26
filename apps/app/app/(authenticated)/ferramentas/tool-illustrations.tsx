import type { ReactNode } from "react";

const GOLD = "#E9C48E";
const SAND = "#D9A86B";
const RED = "#E2565A";
const ROSE = "#E9C3C4";
const TAN = "#C9A57A";

/** Objeto de cada ferramenta, desenhado dentro do nicho em arco (viewBox 120x72). */
const objects: Record<string, ReactNode> = {
  goals: (
    <>
      <path d="M50 14h20M50 60h20" />
      <path d="M52 14c0 13 16 15 16 23 0 8-16 10-16 23" />
      <path d="M68 14c0 13-16 15-16 23 0 8 16 10 16 23" />
      <path d="M55 58c2-7 8-7 10 0z" fill={SAND} stroke="none" />
      <path d="M60 37v13" stroke={SAND} />
    </>
  ),
  calendar: (
    <>
      <rect height="40" rx="2" width="32" x="44" y="20" />
      <path d="M44 30h32M52 16v8M68 16v8" />
      <path
        d="M51 38h3M58.5 38h3M66 38h3M51 45h3M58.5 45h3M51 52h3"
        stroke={SAND}
        strokeWidth="2.4"
      />
      <path d="M66 45h3" stroke={RED} strokeWidth="2.4" />
    </>
  ),
  timer: (
    <>
      <circle cx="60" cy="38" r="20" />
      <path d="M55 15h10M60 15v3" />
      <path d="M60 38V26M60 38l8 5" />
      <path d="M60 21v2M60 53v2M43 38h2M75 38h2" stroke={SAND} />
      <circle cx="60" cy="38" fill={RED} r="1.6" stroke="none" />
    </>
  ),
  rob2: (
    <>
      <path d="M60 16v44M50 60h20" />
      <path d="M40 25h40" />
      <path d="M40 25l-6 14M40 25l6 14M80 25l-6 14M80 25l6 14" />
      <path d="M33 39h14a7 7 0 0 1-14 0zM73 39h14a7 7 0 0 1-14 0z" />
      <circle cx="60" cy="16" fill={SAND} r="2.4" stroke="none" />
      <path d="M37 41h6" stroke={RED} />
    </>
  ),
  grade: (
    <>
      <rect fill={TAN} height="10" rx="1" width="38" x="41" y="50" />
      <rect fill={RED} height="10" rx="1" width="32" x="45" y="40" />
      <rect fill={ROSE} height="10" rx="1" width="35" x="43" y="30" />
      <path
        d="M48 50v10M54 40v10M50 30v10"
        stroke="#410230"
        strokeOpacity=".45"
      />
    </>
  ),
};

/**
 * Miniatura em nicho, na linguagem da bancada do topo: arco escuro com
 * degradê vinho, prateleira e um objeto em dourado.
 */
export const ToolIllustration = ({
  active,
  id,
}: {
  readonly active: boolean;
  readonly id: string;
}) => (
  <svg
    aria-hidden="true"
    className="h-full w-full"
    fill="none"
    preserveAspectRatio="xMidYMid slice"
    viewBox="0 0 120 72"
  >
    <path
      d="M30 72V32a30 30 0 0 1 60 0v40z"
      fill="#000"
      fillOpacity={active ? 0.3 : 0.22}
      stroke={GOLD}
      strokeOpacity=".3"
    />
    <path d="M24 61h72" stroke={GOLD} strokeOpacity=".55" strokeWidth="1.4" />
    <g
      stroke={GOLD}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    >
      {objects[id]}
    </g>
  </svg>
);
