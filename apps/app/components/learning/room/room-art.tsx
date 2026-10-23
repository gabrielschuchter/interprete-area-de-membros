// Line drawing of a temple front, from docs/sala-de-aula/handoff/assets.
// Purely decorative: every use sits behind aria-hidden content.
export const RoomTemple = ({ className }: { readonly className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    focusable="false"
    preserveAspectRatio="xMaxYMax meet"
    viewBox="0 0 320 180"
  >
    <g
      stroke="#E9C48E"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeOpacity=".3"
      strokeWidth="1.2"
    >
      <path d="M84 62L180 22L276 62Z" />
      <path d="M92 62H268M88 70H272M88 92H272" />
      <path d="M96 92V150M124 92V150M152 92V150M180 92V150M208 92V150M236 92V150M264 92V150" />
      <path d="M84 150H276M78 158H282M72 166H288" />
    </g>
  </svg>
);
