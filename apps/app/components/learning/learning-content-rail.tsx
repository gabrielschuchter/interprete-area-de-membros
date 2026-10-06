"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  BookmarkIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  PlayIcon,
} from "lucide-react";
import Image from "next/image";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toggleLearningBookmark } from "@/app/(authenticated)/biblioteca/actions";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";

export interface LearningRailCard {
  readonly actionLabel?: string | null;
  readonly bookmark?: {
    readonly saved: boolean;
    readonly targetId: string;
    readonly targetType:
      | "LIBRARY_ITEM"
      | "COURSE"
      | "MODULE"
      | "LESSON"
      | "ASSET";
  };
  readonly coverUrl?: string | null;
  readonly description?: string | null;
  readonly disabled?: boolean;
  readonly href: string;
  readonly label?: string | null;
  readonly meta?: string | null;
  readonly progress?: number | null;
  readonly title: string;
}

interface LearningContentRailProperties {
  readonly cards: readonly LearningRailCard[];
  readonly description?: string | null;
  readonly headingId: string;
  readonly title: string;
}

const cardActionLabel = (card: LearningRailCard) => {
  if (card.actionLabel) {
    return card.actionLabel;
  }
  if (card.disabled) {
    return "Aguarde a liberação";
  }
  if (typeof card.progress === "number") {
    if (card.progress >= 100) {
      return "Revisar";
    }
    return card.progress > 0 ? "Continuar" : "Começar";
  }
  return card.meta?.includes("aulas") ? "Começar" : "Abrir";
};

const fallbackCoverForLabel = (label?: string | null) => {
  if (label === "Gravação") {
    return "/brand/learning/evidence-screen.png";
  }
  if (label === "Exercícios") {
    return "/brand/learning/reading-notes.png";
  }
  if (label === "Biblioteca") {
    return "/brand/library/study-books.png";
  }
  return "/brand/learning/reading-notes.png";
};

const LearningRailCardTarget = ({
  ariaLabel,
  children,
  disabled,
  href,
}: {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly disabled: boolean;
  readonly href: string;
}) =>
  disabled ? (
    <div className="relative block cursor-default overflow-hidden rounded-sm border bg-brand-depth text-primary-foreground opacity-90 shadow-[var(--shadow-paper)]">
      {children}
    </div>
  ) : (
    <IntentLink
      aria-label={ariaLabel}
      className="relative block overflow-hidden rounded-sm border bg-brand-depth text-primary-foreground shadow-[var(--shadow-paper)] outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-brand-action focus-visible:ring-offset-2 motion-reduce:transition-none"
      href={href}
    >
      {children}
    </IntentLink>
  );

const OverlayDescription = ({
  description,
  revealOnDesktop,
}: {
  readonly description?: string | null;
  readonly revealOnDesktop: boolean;
}) =>
  description ? (
    <p
      className={`mt-2 line-clamp-3 hidden text-primary-foreground/90 text-sm leading-5 transition-[max-height,opacity] duration-300 motion-reduce:transition-none ${
        revealOnDesktop
          ? "max-h-20 opacity-100 lg:block"
          : "max-h-0 opacity-0 group-focus-within:max-h-20 group-focus-within:opacity-100 group-hover:max-h-20 group-hover:opacity-100 lg:block"
      }`}
    >
      {description}
    </p>
  ) : null;

const MobileDescription = ({
  description,
}: {
  readonly description?: string | null;
}) =>
  description ? (
    <p className="line-clamp-3 border-white/15 border-t px-4 py-3 text-primary-foreground/90 text-sm leading-5 lg:hidden">
      {description}
    </p>
  ) : null;

const LearningRailCardView = ({
  card,
}: {
  readonly card: LearningRailCard;
}) => {
  const fallbackCover = fallbackCoverForLabel(card.label);
  const progressValue =
    typeof card.progress === "number" && Number.isFinite(card.progress)
      ? Math.round(Math.max(0, Math.min(100, card.progress)))
      : null;
  const [failedCoverSources, setFailedCoverSources] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const imageSource = [card.coverUrl, fallbackCover].find(
    (source): source is string =>
      typeof source === "string" && !failedCoverSources.has(source)
  );

  return (
    <li className="w-[82vw] max-w-[22rem] shrink-0 snap-start sm:w-[20rem]">
      <div className="group relative">
        <LearningRailCardTarget
          ariaLabel={`Abrir ${card.title}${card.meta ? ` · ${card.meta}` : ""}${card.description ? ` · ${card.description}` : ""}`}
          disabled={Boolean(card.disabled)}
          href={card.href}
        >
          <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,rgba(91,13,61,0.96),rgba(143,29,64,0.78))]">
            {imageSource ? (
              <Image
                alt=""
                className="object-cover transition-transform duration-500 group-focus-within:scale-[1.04] group-hover:scale-[1.04] motion-reduce:transition-none"
                fill
                loading="lazy"
                onError={() =>
                  setFailedCoverSources(
                    (failedSources) => new Set([...failedSources, imageSource])
                  )
                }
                sizes="(min-width: 1024px) 320px, 82vw"
                src={imageSource}
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(191,115,143,0.34),transparent_48%),linear-gradient(135deg,rgba(91,13,61,0.96),rgba(31,24,30,0.96))]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10 opacity-90 transition-opacity duration-300 group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none" />
            <div className="absolute top-4 left-4 z-0 text-white/25">
              {card.label === "Gravação" ? (
                <PlayIcon aria-hidden="true" className="size-8" />
              ) : (
                <BookOpenIcon aria-hidden="true" className="size-8" />
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
              {card.label && (
                <Badge
                  className="mb-3 border-white/35 bg-black/30 text-white"
                  variant="outline"
                >
                  {card.label}
                </Badge>
              )}
              <h3 className="font-display text-xl leading-tight sm:text-2xl">
                {card.title}
              </h3>
              {card.meta && (
                <p className="mt-1 font-data text-primary-foreground/85 text-xs">
                  {card.meta}
                </p>
              )}
              <OverlayDescription
                description={card.description}
                revealOnDesktop={Boolean(card.disabled)}
              />
              {progressValue !== null && (
                <div
                  aria-label={`Progresso de ${card.title}`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={progressValue}
                  aria-valuetext={`${progressValue}%`}
                  className="mt-4 h-1 overflow-hidden bg-white/30"
                  role="progressbar"
                >
                  <div
                    className="h-full bg-brand-action"
                    style={{
                      width: `${progressValue}%`,
                    }}
                  />
                </div>
              )}
              <span className="mt-3 inline-flex items-center gap-2 font-medium text-sm">
                {cardActionLabel(card)}
                {card.disabled ? (
                  <Clock3Icon aria-hidden="true" className="size-4" />
                ) : (
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-4 transition-transform group-focus-within:translate-x-1 group-hover:translate-x-1 motion-reduce:transition-none"
                  />
                )}
              </span>
            </div>
          </div>
          <MobileDescription description={card.description} />
        </LearningRailCardTarget>
        {card.bookmark && !card.disabled && (
          <form
            action={toggleLearningBookmark}
            className="absolute top-3 right-3 z-20"
          >
            <input
              name="targetType"
              type="hidden"
              value={card.bookmark.targetType}
            />
            <input
              name="targetId"
              type="hidden"
              value={card.bookmark.targetId}
            />
            <input
              name="desired"
              type="hidden"
              value={card.bookmark.saved ? "off" : "on"}
            />
            <Button
              aria-label={
                card.bookmark.saved
                  ? "Remover da biblioteca pessoal"
                  : "Salvar na biblioteca pessoal"
              }
              className="size-11 border-white/30 bg-black/70 text-white hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-white"
              size="icon"
              type="submit"
              variant="outline"
            >
              <BookmarkIcon
                aria-hidden="true"
                className="size-4"
                fill={card.bookmark.saved ? "currentColor" : "none"}
              />
            </Button>
          </form>
        )}
      </div>
    </li>
  );
};

export const LearningContentRail = ({
  cards,
  description,
  headingId,
  title,
}: LearningContentRailProperties) => {
  const viewportRef = useRef<HTMLUListElement>(null);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollControls = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const computedStyle = window.getComputedStyle(viewport);
    const leadingPadding = Number.parseFloat(computedStyle.paddingLeft) || 0;
    const trailingPadding = Number.parseFloat(computedStyle.paddingRight) || 0;
    const maxScrollLeft = Math.max(
      0,
      viewport.scrollWidth - viewport.clientWidth
    );

    setCanScrollPrevious(viewport.scrollLeft - leadingPadding > 1);
    setCanScrollNext(maxScrollLeft - viewport.scrollLeft - trailingPadding > 1);
  }, []);

  const scroll = useCallback((direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    viewport.scrollBy({
      behavior: reduceMotion ? "auto" : "smooth",
      left: direction * viewport.clientWidth * 0.82,
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    updateScrollControls();
    viewport.addEventListener("scroll", updateScrollControls, {
      passive: true,
    });
    window.addEventListener("resize", updateScrollControls);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollControls);
    resizeObserver?.observe(viewport);
    for (const card of viewport.children) {
      resizeObserver?.observe(card);
    }
    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((records) => {
            for (const record of records) {
              for (const card of record.addedNodes) {
                if (card instanceof Element) {
                  resizeObserver?.observe(card);
                }
              }
            }
            updateScrollControls();
          });
    mutationObserver?.observe(viewport, { childList: true });

    return () => {
      viewport.removeEventListener("scroll", updateScrollControls);
      window.removeEventListener("resize", updateScrollControls);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [updateScrollControls]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex items-end justify-between gap-4 border-b pb-3">
        <div className="min-w-0">
          <h2
            className="font-display text-2xl leading-tight sm:text-3xl"
            id={headingId}
          >
            {title}
          </h2>
          {description && (
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="relative">
        {canScrollPrevious && (
          <Button
            aria-controls={`${headingId}-cards`}
            aria-label={`Mostrar conteúdos anteriores em ${title}`}
            className="learning-rail-arrow absolute top-1/2 left-1 z-20 size-11 -translate-y-1/2 rounded-full border bg-background/95 shadow-lg backdrop-blur-sm transition-opacity motion-reduce:transition-none"
            onClick={() => scroll(-1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeftIcon aria-hidden="true" className="size-5" />
          </Button>
        )}
        {canScrollNext && (
          <Button
            aria-controls={`${headingId}-cards`}
            aria-label={`Mostrar próximos conteúdos em ${title}`}
            className="learning-rail-arrow absolute top-1/2 right-1 z-20 size-11 -translate-y-1/2 rounded-full border bg-background/95 shadow-lg backdrop-blur-sm transition-opacity motion-reduce:transition-none"
            onClick={() => scroll(1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRightIcon aria-hidden="true" className="size-5" />
          </Button>
        )}
        <ul
          aria-label={`Conteúdos: ${title}`}
          className="learning-rail-viewport -mx-5 flex snap-x snap-proximity gap-4 overflow-x-auto overscroll-x-contain px-5 pb-4 sm:-mx-8 sm:px-8 sm:pb-5 lg:-mx-12 lg:px-12"
          id={`${headingId}-cards`}
          ref={viewportRef}
        >
          {cards.map((card) => (
            <LearningRailCardView card={card} key={card.href} />
          ))}
        </ul>
      </div>
    </section>
  );
};
