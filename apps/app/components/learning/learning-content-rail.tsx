import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  BookmarkIcon,
  BookOpenIcon,
  PlayIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toggleLearningBookmark } from "@/app/(authenticated)/biblioteca/actions";

export interface LearningRailCard {
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

const OverlayDescription = ({
  description,
}: {
  readonly description?: string | null;
}) =>
  description ? (
    <p className="mt-2 line-clamp-3 hidden max-h-0 text-primary-foreground/85 text-sm leading-5 opacity-0 transition-all duration-300 group-hover:max-h-20 group-hover:opacity-100 group-focus-visible:max-h-20 group-focus-visible:opacity-100 lg:block">
      {description}
    </p>
  ) : null;

const MobileDescription = ({
  description,
}: {
  readonly description?: string | null;
}) =>
  description ? (
    <p className="line-clamp-3 border-white/15 border-t px-4 py-3 text-primary-foreground/85 text-sm leading-5 lg:hidden">
      {description}
    </p>
  ) : null;

export const LearningContentRail = ({
  cards,
  description,
  headingId,
  title,
}: LearningContentRailProperties) => {
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
        <span
          aria-hidden="true"
          className="hidden shrink-0 text-brand-action-text sm:block"
        >
          Deslize para explorar
        </span>
      </div>
      <ul className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-5 pb-4 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
        {cards.map((card) => (
          <li
            className="w-[76vw] max-w-[22rem] shrink-0 snap-start sm:w-[20rem]"
            key={card.href}
          >
            <div className="group relative">
              <Link
                aria-label={`Abrir ${card.title}${card.meta ? ` · ${card.meta}` : ""}${card.description ? ` · ${card.description}` : ""}`}
                className="relative block overflow-hidden border bg-brand-depth text-primary-foreground shadow-[var(--shadow-paper)] outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-brand-action focus-visible:ring-offset-2"
                href={card.href}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,rgba(91,13,61,0.96),rgba(143,29,64,0.78))]">
                  {card.coverUrl ? (
                    <Image
                      alt=""
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04] group-focus-visible:scale-[1.04]"
                      fill
                      loading="lazy"
                      sizes="(min-width: 1024px) 320px, 76vw"
                      src={card.coverUrl}
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_70%_20%,rgba(191,115,143,0.34),transparent_48%),linear-gradient(135deg,rgba(91,13,61,0.96),rgba(31,24,30,0.96))]">
                      {card.label === "Gravação" ? (
                        <PlayIcon
                          aria-hidden="true"
                          className="size-10 text-primary-foreground/75"
                        />
                      ) : (
                        <BookOpenIcon
                          aria-hidden="true"
                          className="size-10 text-primary-foreground/75"
                        />
                      )}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/10 opacity-75 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
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
                      <p className="mt-1 font-data text-primary-foreground/80 text-xs">
                        {card.meta}
                      </p>
                    )}
                    <OverlayDescription description={card.description} />
                    {typeof card.progress === "number" && (
                      <div className="mt-4 h-1 overflow-hidden bg-white/30">
                        <div
                          className="h-full bg-brand-action"
                          style={{
                            width: `${Math.max(0, Math.min(100, card.progress))}%`,
                          }}
                        />
                      </div>
                    )}
                    <span className="mt-3 inline-flex items-center gap-2 font-medium text-sm">
                      Continuar{" "}
                      <ArrowRightIcon
                        aria-hidden="true"
                        className="size-4 transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1"
                      />
                    </span>
                  </div>
                </div>
                <MobileDescription description={card.description} />
              </Link>
              {card.bookmark && (
                <form
                  action={toggleLearningBookmark}
                  className="absolute top-3 right-3 z-10"
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
                    className="border-white/30 bg-black/65 text-white hover:bg-black/85"
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
        ))}
      </ul>
    </section>
  );
};
