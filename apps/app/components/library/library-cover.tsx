import { cn } from "@repo/design-system/lib/utils";

const COVER_BY_CATEGORY: Readonly<Record<string, string>> = {
  "Bioestatística e interpretação": "/library/illustrations/biostatistics.svg",
  "Busca bibliográfica": "/library/illustrations/literature-search.svg",
  "Certeza da evidência e GRADE": "/library/illustrations/grade.svg",
  "Diretrizes e decisão clínica":
    "/library/illustrations/clinical-guidelines.svg",
  "Epidemiologia e desenhos de estudo":
    "/library/illustrations/epidemiology.svg",
  "Fundamentos e perguntas clínicas":
    "/library/illustrations/pico-foundations.svg",
  "Leitura crítica e risco de viés": "/library/illustrations/risk-of-bias.svg",
  "Nutrição baseada em evidências":
    "/library/illustrations/nutrition-evidence.svg",
  "Protocolos e registro": "/library/illustrations/protocols.svg",
  "Relato científico": "/library/illustrations/scientific-report.svg",
  "Revisões sistemáticas e meta-análises":
    "/library/illustrations/systematic-reviews.svg",
};

interface LibraryCoverProperties {
  readonly category: string | null;
  readonly className?: string;
  readonly compact?: boolean;
  readonly coverUrl?: string | null;
  readonly title?: string;
}

export const libraryCoverSource = (category: string | null) =>
  (category && COVER_BY_CATEGORY[category]) ||
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
    loading="lazy"
    referrerPolicy={coverUrl ? "no-referrer" : undefined}
    src={coverUrl || libraryCoverSource(category)}
    width={compact ? 44 : 92}
  />
);
