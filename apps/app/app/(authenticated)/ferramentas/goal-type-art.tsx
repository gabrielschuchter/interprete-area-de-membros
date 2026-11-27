import { type ReactNode, useId } from "react";
import type { CountGoalKind, GoalMode } from "@/lib/study-count-goals-model";
import { goalArtModel } from "@/lib/study-goal-art-model";
import { ArchHourglass } from "./arch-hourglass";
import "./tools-bancada.css";

const BOOK_COLORS = ["#C8333F", "#C9A57A", "#7A2446", "#E2565A", "#8C1535"];
const BOOK_HEIGHTS = [78, 66, 84, 72, 70];
const SHELF_Y = 204;
const CENTER_Y = 106;

/** Nicho em arco, igual ao da ampulheta, para receber a ilustração do tipo. */
const Niche = ({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) => {
  const id = useId().replace(/:/g, "");
  const arch = "M8 220 V80 C8 30 50 6 80 6 C110 6 152 30 152 80 V220 Z";
  return (
    <svg
      aria-label={label}
      className="h-full w-full"
      role="img"
      viewBox="0 0 160 220"
    >
      <defs>
        <linearGradient id={`${id}-wall`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#4A0E2C" />
          <stop offset="1" stopColor="#22040F" />
        </linearGradient>
        <radialGradient cx="0.5" cy="0.15" id={`${id}-glow`} r="0.7">
          <stop offset="0" stopColor="#F5C7A0" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#B8425A" stopOpacity="0.18" />
          <stop offset="1" stopColor="#22040F" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-arch`}>
          <path d={arch} />
        </clipPath>
      </defs>
      <path d={arch} fill={`url(#${id}-wall)`} />
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
        <rect fill="#5A2233" height="7" width="160" y={SHELF_Y} />
        <rect fill="#3B1222" height="9" width="160" y="211" />
      </g>
      <path
        d="M8 220 V80 C8 30 50 6 80 6 C110 6 152 30 152 80 V220"
        fill="none"
        stroke="#7A1E3E"
        strokeWidth="2"
      />
      {children}
    </svg>
  );
};

const Ticket = ({
  cells,
  filled,
  studied,
  target,
}: {
  readonly cells: number;
  readonly filled: number;
  readonly studied: number;
  readonly target: number;
}) => {
  const id = useId().replace(/:/g, "");
  const rows = Math.ceil(cells / 5);
  const height = 50 + rows * 12;
  const top = CENTER_Y - height / 2;
  const holesTop = 13 + (height - 13 - rows * 12) / 2 + 6;
  return (
    <g transform={`rotate(-6 80 ${CENTER_Y}) translate(30 ${top})`}>
      <defs>
        <mask id={`${id}-notch`}>
          <rect fill="#fff" height={height} width="100" />
          <circle cx="0" cy={height / 2} fill="#000" r="7" />
          <circle cx="100" cy={height / 2} fill="#000" r="7" />
        </mask>
      </defs>
      <g mask={`url(#${id}-notch)`}>
        <rect fill="#F0E4D8" height={height} width="100" />
        <rect fill="#C8333F" height="13" width="100" />
        <text
          className="font-data"
          fill="#F0E4D8"
          fontSize="7"
          letterSpacing="1.6"
          x="10"
          y="9.5"
        >
          AUDITÓRIO
        </text>
        <line
          stroke="#7A2446"
          strokeDasharray="3 2"
          strokeOpacity="0.5"
          x1="74"
          x2="74"
          y1="13"
          y2={height}
        />
        {Array.from({ length: cells }, (_, index) => {
          const done = index < filled;
          return (
            <circle
              cx={14 + (index % 5) * 12}
              cy={holesTop + Math.floor(index / 5) * 12}
              fill={done ? "#2A0614" : "none"}
              key={`hole-${index.toString()}`}
              r="4.5"
              stroke={done ? "#A9783F" : "#7A2446"}
              strokeDasharray={done ? undefined : "2 1.5"}
              strokeOpacity={done ? 1 : 0.55}
              strokeWidth="1"
            />
          );
        })}
        <text
          className="font-display"
          fill="#5A1A3A"
          fontSize="15"
          fontWeight="600"
          textAnchor="middle"
          x="87"
          y={(13 + height) / 2 + 2}
        >
          {studied}
        </text>
        <text
          className="font-data"
          fill="#7A2446"
          fontSize="6"
          textAnchor="middle"
          x="87"
          y={(13 + height) / 2 + 11}
        >
          DE {target || "—"}
        </text>
      </g>
    </g>
  );
};

const Shelf = ({
  cells,
  filled,
}: {
  readonly cells: number;
  readonly filled: number;
}) => {
  const gap = 3;
  const width = Math.max(
    4,
    Math.min(18, Math.floor((96 - gap * (cells - 1)) / cells))
  );
  const total = cells * width + (cells - 1) * gap;
  const startX = 80 - (total + 10) / 2;
  const bookendX = startX + total + 4;
  return (
    <g>
      {Array.from({ length: cells }, (_, index) => {
        const read = index < filled;
        const height = BOOK_HEIGHTS[index % BOOK_HEIGHTS.length] ?? 70;
        const x = startX + index * (width + gap);
        const y = SHELF_Y - height;
        return (
          <g key={`book-${index.toString()}`}>
            <rect
              fill={read ? BOOK_COLORS[index % BOOK_COLORS.length] : "#FFE3C8"}
              fillOpacity={read ? 1 : 0.04}
              height={height}
              stroke={read ? "none" : "#F0E4D8"}
              strokeDasharray={read ? undefined : "3 2"}
              strokeOpacity={0.45}
              width={width}
              x={x}
              y={y}
            />
            {read ? (
              <>
                <rect
                  fill="#D9A86B"
                  height="2"
                  width={Math.max(0, width - 6)}
                  x={x + 3}
                  y={y + 10}
                />
                <rect
                  fill="#D9A86B"
                  height="2"
                  width={Math.max(0, width - 6)}
                  x={x + 3}
                  y={SHELF_Y - 14}
                />
                <rect
                  fill="#000"
                  fillOpacity="0.15"
                  height={height}
                  width="2"
                  x={x}
                  y={y}
                />
              </>
            ) : null}
          </g>
        );
      })}
      <rect
        fill="#D9A86B"
        height="56"
        transform={`rotate(14 ${bookendX} ${SHELF_Y})`}
        width="6"
        x={bookendX}
        y={SHELF_Y - 56}
      />
    </g>
  );
};

const AnswerSheet = ({
  cells,
  filled,
  reached,
}: {
  readonly cells: number;
  readonly filled: number;
  readonly reached: boolean;
}) => {
  const rows = Math.ceil(cells / 5);
  const height = 22 + rows * 9;
  const top = CENTER_Y - height / 2;
  return (
    <g>
      <g transform={`rotate(4 80 ${CENTER_Y}) translate(36 ${top})`}>
        <rect fill="#F0E4D8" height={height} width="88" />
        <rect fill="#7A2446" height="12" width="88" />
        <text
          className="font-data"
          fill="#F0E4D8"
          fontSize="6.5"
          letterSpacing="1.4"
          x="6"
          y="8.5"
        >
          GABARITO
        </text>
        {Array.from({ length: rows }, (_, row) => (
          <g key={`row-${row.toString()}`}>
            <text
              className="font-data"
              fill="#7A2446"
              fillOpacity="0.7"
              fontSize="5"
              x="5"
              y={20 + row * 9}
            >
              {String(row + 1).padStart(2, "0")}
            </text>
            {Array.from({ length: 5 }, (_, col) => {
              const index = row * 5 + col;
              if (index >= cells) {
                return null;
              }
              const done = index < filled;
              return (
                <circle
                  cx={26 + col * 11}
                  cy={18 + row * 9}
                  fill={done ? "#5A1A3A" : "none"}
                  key={`cell-${index.toString()}`}
                  r="3"
                  stroke={done ? "#5A1A3A" : "#7A2446"}
                  strokeOpacity={done ? 1 : 0.45}
                  strokeWidth="0.8"
                />
              );
            })}
          </g>
        ))}
      </g>
      {reached ? null : (
        <g transform="translate(96 136) rotate(-38)">
          <rect fill="#D9A86B" height="7" width="39" />
          <rect fill="#C8333F" height="7" width="5" x="39" />
        </g>
      )}
    </g>
  );
};

/** Carimbo de meta batida, por cima da ilustração de qualquer tipo. */
const Stamp = () => (
  <svg
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 h-full w-full"
    viewBox="0 0 160 220"
  >
    <g transform="translate(120 168) rotate(-14)">
      <g className="bancada-stamp">
        <circle fill="#6E0F29" r="17" stroke="#D9A86B" strokeWidth="2.5" />
        <circle
          fill="none"
          r="14"
          stroke="#F0C98A"
          strokeDasharray="2 2"
          strokeWidth="1"
        />
        <text
          fill="#F0C98A"
          fontSize="16"
          fontWeight="600"
          textAnchor="middle"
          y="5.5"
        >
          ✓
        </text>
      </g>
    </g>
  </svg>
);

const ART_TEXT: Record<CountGoalKind, string> = {
  LESSONS: "Ingresso do auditório: cada furo é uma aula vista",
  READINGS: "Prateleira: cada livro colorido é uma leitura feita",
  EXERCISES: "Gabarito: cada bolinha preenchida é uma questão respondida",
};

export const GoalTypeArt = ({
  className,
  flowing,
  glow,
  hourglassLabel,
  mode,
  reached,
  remaining,
  studied,
  target,
}: {
  readonly className?: string;
  readonly flowing: boolean;
  readonly glow: number;
  readonly hourglassLabel: string;
  readonly mode: GoalMode;
  readonly reached: boolean;
  /** Fração de areia que falta na ampulheta (0 a 1). */
  readonly remaining: number;
  readonly studied: number;
  readonly target: number;
}) => {
  let art: ReactNode;
  if (mode === "MINUTES") {
    art = (
      <ArchHourglass
        className="h-full w-full"
        flowing={flowing}
        glow={glow}
        label={hourglassLabel}
        remaining={remaining}
      />
    );
  } else {
    const model = goalArtModel(mode, studied, target);
    const label = `${ART_TEXT[mode]} (${studied} de ${target || "—"})`;
    let content: ReactNode;
    if (mode === "LESSONS") {
      content = (
        <Ticket
          cells={model.cells}
          filled={model.filled}
          studied={studied}
          target={target}
        />
      );
    } else if (mode === "READINGS") {
      content = <Shelf cells={model.cells} filled={model.filled} />;
    } else {
      content = (
        <AnswerSheet
          cells={model.cells}
          filled={model.filled}
          reached={reached}
        />
      );
    }
    art = <Niche label={label}>{content}</Niche>;
  }
  return (
    <div className={`relative ${className ?? ""}`}>
      {art}
      {reached ? <Stamp /> : null}
    </div>
  );
};
