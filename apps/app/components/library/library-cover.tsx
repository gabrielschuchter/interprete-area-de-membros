import { cn } from "@repo/design-system/lib/utils";
import { libraryCategoryGroup } from "@/lib/library-categories";

const COVER_BY_GROUP: Readonly<Record<string, string>> = {
  "Bioestatística e interpretação": "/library/illustrations/biostatistics.svg",
  "Busca da evidência": "/library/illustrations/literature-search.svg",
  "Diretrizes e decisão clínica":
    "/library/illustrations/clinical-guidelines.svg",
  "Epidemiologia e desenhos de estudo":
    "/library/illustrations/epidemiology.svg",
  "Fundamentos da PBE": "/library/illustrations/pico-foundations.svg",
  "Leitura crítica e certeza da evidência":
    "/library/illustrations/risk-of-bias.svg",
  "Nutrição baseada em evidências":
    "/library/illustrations/nutrition-evidence.svg",
  "Registros de protocolo": "/library/illustrations/protocols.svg",
  Relato: "/library/illustrations/scientific-report.svg",
  "Revisões sistemáticas": "/library/illustrations/systematic-reviews.svg",
  "Risco de viés": "/library/illustrations/risk-of-bias.svg",
};

/** Categorias antigas que tinham ilustração própria (GRADE). */
const COVER_BY_LEGACY_CATEGORY: Readonly<Record<string, string>> = {
  "Certeza da evidência e GRADE": "/library/illustrations/grade.svg",
  GRADE: "/library/illustrations/grade.svg",
};

interface LibraryCoverProperties {
  readonly category: string | null;
  readonly className?: string;
  readonly compact?: boolean;
  readonly coverUrl?: string | null;
  /** "eager" para capas que entram em cena em movimento (esteira). */
  readonly loading?: "eager" | "lazy";
  readonly title?: string;
}

export const libraryCoverSource = (category: string | null) =>
  (category &&
    (COVER_BY_LEGACY_CATEGORY[category] ??
      COVER_BY_GROUP[libraryCategoryGroup(category)])) ||
  "/library/illustrations/open-book.svg";

const libraryCoverAlt = (
  compact: boolean,
  category: string | null,
  coverUrl?: string | null,
  title?: string
) => {
  if (compact) {
    return "";
  }
  if (coverUrl && title) {
    return `Capa: ${title}`;
  }
  return `Capa do material: ${category ?? "livro aberto"}`;
};

export const LibraryCover = ({
  category,
  className,
  compact = false,
  coverUrl,
  loading = "lazy",
  title,
}: LibraryCoverProperties) => (
  // These SVGs are local static artwork extracted from the approved handoff.
  // biome-ignore lint/performance/noImgElement: SVG art uses its own fixed viewBox and accessible label.
  <img
    alt={libraryCoverAlt(compact, category, coverUrl, title)}
    aria-hidden={compact ? true : undefined}
    className={cn(
      "block shrink-0 rounded-[3px] object-cover",
      compact
        ? "h-[59px] w-[44px]"
        : "h-[98px] w-[72px] md:h-[146px] md:w-[108px] lg:h-[124px] lg:w-[92px]",
      className
    )}
    decoding="async"
    height={compact ? 59 : 124}
    loading={loading}
    referrerPolicy={coverUrl ? "no-referrer" : undefined}
    src={coverUrl || libraryCoverSource(category)}
    width={compact ? 44 : 92}
  />
);
