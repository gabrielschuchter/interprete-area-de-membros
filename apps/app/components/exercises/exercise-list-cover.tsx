import Image from "next/image";
import { useId } from "react";

type CoverKind = "pico" | "curve" | "cohort" | "book";

const kindForList = (
  title: string,
  bankTitle: string,
  slug: string
): CoverKind => {
  const value = `${title} ${bankTitle} ${slug}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase();
  if (
    value.includes("pratica baseada em evidencia") ||
    value.includes("pico")
  ) {
    return "pico";
  }
  if (value.includes("bioestatistica")) {
    return "curve";
  }
  if (value.includes("epidemiologia")) {
    return "cohort";
  }
  return "book";
};

const coverAssets: Partial<Record<CoverKind, string>> = {
  pico: "/exercises/covers/pratica-baseada-em-evidencias.svg",
  curve: "/exercises/covers/bioestatistica.svg",
  cohort: "/exercises/covers/epidemiologia.svg",
};

export const ExerciseListCover = ({
  bankTitle,
  className = "h-[104px] sm:h-28",
  coverUrl,
  listSlug,
  title,
}: {
  readonly bankTitle: string;
  readonly className?: string;
  readonly coverUrl: string | null;
  readonly listSlug: string;
  readonly title: string;
}) => {
  const reactId = useId();
  const patternId = `exercise-cover-${reactId.replace(/:/gu, "")}`;
  const safeCoverUrl = (() => {
    if (!coverUrl) {
      return null;
    }
    try {
      const url = new URL(coverUrl);
      return url.protocol === "https:" || url.protocol === "http:"
        ? coverUrl.replace(/["\\\n\r]/gu, "")
        : null;
    } catch {
      return null;
    }
  })();
  const kind = kindForList(title, bankTitle, listSlug);

  if (safeCoverUrl) {
    return (
      <Image
        alt={`Capa da lista: ${title}`}
        className={`${className} block w-full bg-[#EADBD6] object-cover`}
        height={112}
        src={safeCoverUrl}
        unoptimized
        width={320}
      />
    );
  }

  const coverAsset = coverAssets[kind];
  if (coverAsset) {
    return (
      <Image
        alt={`Capa da lista: ${title}`}
        className={`${className} block w-full bg-[#EADBD6] object-cover`}
        height={112}
        src={coverAsset}
        unoptimized
        width={320}
      />
    );
  }

  return (
    <svg
      aria-label={`Ilustração da lista ${title}`}
      className={`${className} block w-full bg-[#EADBD6]`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      viewBox="0 0 320 112"
    >
      <defs>
        <pattern
          height="16"
          id={patternId}
          patternUnits="userSpaceOnUse"
          width="16"
        >
          <circle cx="2" cy="2" fill="#BFA9A3" opacity=".7" r="1" />
        </pattern>
      </defs>
      <rect fill={`url(#${patternId})`} height="112" width="320" />
      <g
        fill="none"
        stroke="#8C1535"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity=".9"
        strokeWidth="1.6"
        transform="translate(160 56) scale(1.05)"
      >
        <path d="M-2 -21H20V15H1C-2 15 -4 17 -4 20V-18C-4 -20 -3 -21 -2 -21Z" />
        <path d="M-4 -17H-20V19C-20 17 -18 15 -15 15H-4M2 -15H15M2 -8H15M2 -1H12" />
      </g>
      <path d="M20 100H300" opacity=".8" stroke="#BFA9A3" strokeWidth=".8" />
    </svg>
  );
};
