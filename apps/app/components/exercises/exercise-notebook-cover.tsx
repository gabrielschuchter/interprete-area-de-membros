import Image from "next/image";
import { type CoverKind, kindForList } from "./exercise-list-cover";

const HTTP_URL = /^https?:\/\//u;

const palette: Record<CoverKind, { cover: string; spine: string }> = {
  pico: { cover: "#8C1535", spine: "#6E0F29" },
  curve: { cover: "#410230", spine: "#2B0120" },
  cohort: { cover: "#643151", spine: "#410230" },
  book: { cover: "#410230", spine: "#2B0120" },
};

const Glyph = ({ kind }: { readonly kind: CoverKind }) => {
  if (kind === "pico") {
    return (
      <svg aria-hidden="true" height="88" viewBox="0 0 110 110" width="88">
        <rect
          fill="none"
          height="80"
          stroke="#F0E4D8"
          strokeWidth="2"
          width="80"
          x="15"
          y="15"
        />
        <path d="M55 15v80M15 55h80" stroke="#F0E4D8" strokeWidth="2" />
        <g
          fill="#F0E4D8"
          fontFamily="Georgia, serif"
          fontSize="22"
          textAnchor="middle"
        >
          <text x="35" y="44">
            P
          </text>
          <text x="75" y="44">
            I
          </text>
          <text x="35" y="84">
            C
          </text>
          <text fill="#F7C873" x="75" y="84">
            O
          </text>
        </g>
      </svg>
    );
  }
  if (kind === "curve") {
    return (
      <svg aria-hidden="true" height="88" viewBox="0 0 140 110" width="110">
        <path d="M10 90h120" stroke="#F0E4D8" strokeWidth="2" />
        <path
          d="M14 88C44 88 50 22 70 22S96 88 126 88"
          fill="none"
          stroke="#F0E4D8"
          strokeWidth="2.5"
        />
        <path
          d="M84 46C92 66 100 86 126 88v2H84z"
          fill="#F7C873"
          opacity="0.6"
        />
        <path d="M70 22v68" stroke="#F0E4D8" strokeDasharray="3 3" />
      </svg>
    );
  }
  if (kind === "cohort") {
    return (
      <svg aria-hidden="true" height="88" viewBox="0 0 120 110" width="96">
        <path d="M20 55h90M65 18v78" stroke="#F0E4D8" strokeWidth="2" />
        <g
          fill="#F0E4D8"
          fontFamily="Georgia, serif"
          fontSize="24"
          fontStyle="italic"
          textAnchor="middle"
        >
          <text fill="#F7C873" x="42" y="44">
            a
          </text>
          <text x="88" y="44">
            b
          </text>
          <text x="42" y="84">
            c
          </text>
          <text x="88" y="84">
            d
          </text>
        </g>
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="72"
      stroke="#F0E4D8"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="-24 -24 48 48"
      width="72"
    >
      <path d="M-2 -21H20V15H1C-2 15 -4 17 -4 20V-18C-4 -20 -3 -21 -2 -21Z" />
      <path d="M-4 -17H-20V19C-20 17 -18 15 -15 15H-4M2 -15H15M2 -8H15M2 -1H12" />
    </svg>
  );
};

export const ExerciseNotebookCover = ({
  answered,
  bankTitle,
  coverUrl,
  listSlug,
  state,
  title,
  total,
}: {
  readonly answered: number;
  readonly bankTitle: string;
  readonly coverUrl: string | null;
  readonly listSlug: string;
  readonly state: "new" | "in-progress" | "completed";
  readonly title: string;
  readonly total: number;
}) => {
  const kind = kindForList(title, bankTitle, listSlug);
  const colors = palette[kind];
  const ribbon = 30 + Math.round((answered / Math.max(total, 1)) * 70);
  const hasCustomCover = Boolean(coverUrl && HTTP_URL.test(coverUrl));

  return (
    <span
      className="relative flex h-[150px] items-center justify-center overflow-hidden border-l-[14px]"
      style={{ background: colors.cover, borderLeftColor: colors.spine }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-3.5 h-0.5 bg-[#D9A86B] opacity-80"
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-3.5 h-0.5 bg-[#D9A86B] opacity-80"
      />
      {hasCustomCover && coverUrl ? (
        <Image
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
          height={150}
          src={coverUrl}
          unoptimized
          width={320}
        />
      ) : (
        <Glyph kind={kind} />
      )}
      {state === "in-progress" && (
        <span
          aria-hidden="true"
          className="absolute top-0 right-[18px] w-[18px] bg-[#C8333F] [clip-path:polygon(0_0,100%_0,100%_100%,50%_80%,0_100%)]"
          style={{ height: ribbon }}
        />
      )}
      {state === "new" && (
        <span
          aria-hidden="true"
          className="absolute top-[26px] right-3.5 rotate-[8deg] border-2 border-[#F7C873] px-2 py-1 font-data text-[#F7C873] text-[11px] tracking-[.2em]"
        >
          NOVO
        </span>
      )}
      {state === "completed" && (
        <span
          aria-hidden="true"
          className="absolute top-6 right-3.5 rotate-[8deg] border-2 border-[#F7C873] bg-[#1a0612]/35 px-2 py-1 font-data text-[#F7C873] text-[11px] tracking-[.15em]"
        >
          ◆ CONCLUÍDA
        </span>
      )}
    </span>
  );
};
