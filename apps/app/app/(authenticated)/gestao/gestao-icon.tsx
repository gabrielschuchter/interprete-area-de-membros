import type { CSSProperties, ReactNode } from "react";

/**
 * Ícones do conjunto dos quadros da Gestão (viewBox 24, traço, cantos
 * arredondados). Os caminhos foram copiados dos quadros para manter a mesma
 * silhueta; não misture com outro conjunto na mesma tela.
 */
const glyphs = {
  "chevron-right": (
    <>
      <path d="M9 6l6 6-6 6" />
    </>
  ),
  "chevron-down": (
    <>
      <path d="M6 9l6 6 6-6" />
    </>
  ),
  "chevron-up": (
    <>
      <path d="M6 15l6-6 6 6" />
    </>
  ),
  "chevron-left": (
    <>
      <path d="M15 6l-6 6 6 6" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  grid: (
    <>
      <rect height="7" rx="1" width="7" x="3" y="3" />
      <rect height="7" rx="1" width="7" x="14" y="3" />
      <rect height="7" rx="1" width="7" x="3" y="14" />
      <rect height="7" rx="1" width="7" x="14" y="14" />
    </>
  ),
  book: (
    <>
      <path d="M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2z" />
      <path d="M22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 20a6 6 0 0 0-3-5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  home: (
    <>
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13 7l4 4" />
    </>
  ),
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.1" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5" />
    </>
  ),
  grip: (
    <>
      <circle cx="9" cy="6" r="1.2" />
      <circle cx="15" cy="6" r="1.2" />
      <circle cx="9" cy="12" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <circle cx="9" cy="18" r="1.2" />
      <circle cx="15" cy="18" r="1.2" />
    </>
  ),
  video: (
    <>
      <rect height="12" rx="2" width="13" x="3" y="6" />
      <path d="M16 10l5-3v10l-5-3z" />
    </>
  ),
  check: (
    <>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12M18 6L6 18" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5M12 15.5v.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  "play-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l5 3.5-5 3.5z" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  calendar: (
    <>
      <rect height="16" rx="2" width="18" x="3" y="5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  archive: (
    <>
      <rect height="5" rx="1" width="18" x="3" y="4" />
      <path d="M5 9v10h14V9M10 13h4" />
    </>
  ),
  lock: (
    <>
      <rect height="10" rx="2" width="14" x="5" y="11" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  columns: (
    <>
      <path d="M5 4v16M10 4v16" />
      <path d="M15 5l4.5 15" />
    </>
  ),
  star: (
    <>
      <path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
    </>
  ),
  checklist: (
    <>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" />
    </>
  ),
  cap: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-3-6.2M20 4v4h-4" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l5 5v13H6z" />
      <path d="M14 3v5h5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </>
  ),
  "wifi-off": (
    <>
      <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18" />
    </>
  ),
  bookmark: (
    <>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </>
  ),
  play: (
    <>
      <path d="M8 5l11 7-11 7z" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h8M16 6h4M4 12h3M11 12h9M4 18h10M18 18h2" />
      <circle cx="14" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  bold: (
    <>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
    </>
  ),
  italic: (
    <>
      <path d="M10 5h8M6 19h8M14 5l-4 14" />
    </>
  ),
  heading: (
    <>
      <path d="M4 6v12M12 6v12M4 12h8M16 10a2.5 2.5 0 0 1 4.5 1.5c0 2-4.5 3.5-4.5 6.5h5" />
    </>
  ),
  "list-bullets": (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </>
  ),
  "list-numbers": (
    <>
      <path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v4M4 12h3l-3 3.5h3M4 17.5h3l-1.5 1.5L7 21H4" />
    </>
  ),
  quote: (
    <>
      <path d="M5 18v-5a5 5 0 0 1 5-5v3a2 2 0 0 0-2 2h2v5zM14 18v-5a5 5 0 0 1 5-5v3a2 2 0 0 0-2 2h2v5z" />
    </>
  ),
  image: (
    <>
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-8 9" />
    </>
  ),
  code: (
    <>
      <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type GestaoIconName = keyof typeof glyphs;

interface GestaoIconProperties {
  readonly className?: string;
  readonly name: GestaoIconName;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly style?: CSSProperties;
}

export const GestaoIcon = ({
  className,
  name,
  size = 18,
  strokeWidth = 1.5,
  style,
}: GestaoIconProperties) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={strokeWidth}
    style={{ flex: "none", ...style }}
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
  >
    {glyphs[name]}
  </svg>
);
