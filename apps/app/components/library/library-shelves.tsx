"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { cn } from "@repo/design-system/lib/utils";
import {
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { LibraryBookmarkButton } from "@/components/library/library-bookmark-button";
import { libraryCategoryGroups } from "@/lib/library-categories";
import {
  libraryAccessLabel,
  libraryDifficultyLabel,
  libraryLanguageLabel,
} from "@/lib/library-presentation";
import {
  type LibraryShelf,
  type LibraryShelfItem,
  libraryCoverPalette,
  libraryCoverTitleSize,
  libraryDisplayTitle,
  libraryShortAuthors,
} from "@/lib/library-shelves";

const KIND_LABEL = {
  ARTICLE: "Artigo",
  GUIDE: "Guia",
  LINK: "Link",
  PDF: "PDF",
  VIDEO: "Vídeo",
} as const;

const SCROLL_SHARE = 0.8;
const EDGE_ZONE_MAX = 180;
const EDGE_ZONE_SHARE = 0.22;
const EDGE_SCROLL_SPEED = 11;

/** Largura (px) da capa grande no desktop; o título escala a partir dela. */
const LARGE_COVER_WIDTH = 220;

const kicker = (item: LibraryShelfItem) =>
  [KIND_LABEL[item.kind], item.year].filter(Boolean).join(" · ");

/**
 * Capa do livro. O título vem impresso nela, sempre no mesmo padrão
 * tipográfico, mesmo para itens que tenham imagem de capa cadastrada.
 */
const BookCover = ({
  className,
  item,
  large = false,
  saved = false,
  title,
}: {
  readonly className?: string;
  readonly item: LibraryShelfItem;
  readonly large?: boolean;
  readonly saved?: boolean;
  readonly title: string;
}) => {
  const palette = libraryCoverPalette(item.id);
  const size = libraryCoverTitleSize(title, large);
  const short = libraryShortAuthors(item.authors);

  return (
    <span
      className={cn(
        "relative block overflow-hidden rounded-[2px_6px_6px_2px]",
        className
      )}
      style={{
        background: palette.background,
        color: palette.foreground,
        ...(large ? { containerType: "inline-size" as const } : {}),
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0",
          large ? "w-3.5" : "w-2.5 max-md:w-2"
        )}
        style={{ background: palette.spine }}
      />
      <span
        className={cn(
          "absolute font-data uppercase opacity-85",
          large
            ? "top-5 right-[7.3cqw] left-[12.7cqw] text-[10px] tracking-[.16em]"
            : "top-3.5 right-3 left-5 text-[9px] tracking-[.14em] max-md:top-3 max-md:left-4 max-md:text-[8.5px]"
        )}
      >
        {kicker(item)}
      </span>
      <span
        className={cn(
          "absolute flex items-center text-left font-display font-semibold leading-[1.12] tracking-[-.01em]",
          large
            ? "top-[23.6cqw] right-[7.3cqw] bottom-[25.5cqw] left-[12.7cqw]"
            : "top-10 right-3 bottom-11 left-5 max-md:top-9 max-md:left-4"
        )}
        style={{
          fontSize: large ? `${(size / LARGE_COVER_WIDTH) * 100}cqw` : size,
        }}
      >
        <span
          className={cn(
            "[overflow-wrap:anywhere]",
            large ? "line-clamp-8" : "line-clamp-6"
          )}
        >
          {title}
        </span>
      </span>
      <span
        className={cn(
          "absolute flex items-center gap-1.5",
          large
            ? "right-[7.3cqw] bottom-5 left-[12.7cqw]"
            : "right-3 bottom-3.5 left-5 max-md:left-4"
        )}
      >
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rotate-45"
          style={{ background: palette.ornament }}
        />
        <span
          className={cn(
            "min-w-0 truncate font-data tracking-[.06em]",
            large ? "text-[10px]" : "text-[9px]"
          )}
        >
          {short}
        </span>
      </span>
      {saved && <SavedRibbon large={large} />}
    </span>
  );
};

const SavedRibbon = ({ large = false }: { readonly large?: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "absolute top-0 z-10 bg-[#D62839] [clip-path:polygon(0_0,100%_0,100%_100%,50%_74%,0_100%)]",
      large ? "right-5 h-7 w-4" : "right-3 h-[22px] w-3"
    )}
  />
);

const Shelf = ({
  defaultExpanded,
  isSaved,
  onOpen,
  shelf,
  translateTitles,
}: {
  readonly defaultExpanded: boolean;
  readonly isSaved: (item: LibraryShelfItem) => boolean;
  readonly onOpen: (shelfId: string, itemId: string) => void;
  readonly shelf: LibraryShelf;
  readonly translateTitles: boolean;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const railRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(0);
  const frameRef = useRef(0);
  const headingId = `${shelf.id}-titulo`;
  const count = shelf.items.length;

  useEffect(
    () => () => {
      speedRef.current = 0;
      cancelAnimationFrame(frameRef.current);
    },
    []
  );

  const tick = () => {
    const rail = railRef.current;
    if (!rail || speedRef.current === 0) {
      frameRef.current = 0;
      return;
    }
    rail.scrollLeft += speedRef.current;
    frameRef.current = requestAnimationFrame(tick);
  };

  /** Mouse perto das bordas da estante rola a esteira, mais rápido quanto mais perto. */
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (
      event.pointerType !== "mouse" ||
      expanded ||
      !rail ||
      rail.scrollWidth <= rail.clientWidth ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      speedRef.current = 0;
      return;
    }
    const rect = rail.getBoundingClientRect();
    const zone = Math.min(EDGE_ZONE_MAX, rect.width * EDGE_ZONE_SHARE);
    const x = event.clientX - rect.left;
    let speed = 0;
    if (x < zone) {
      speed = -(1 - x / zone) * EDGE_SCROLL_SPEED;
    } else if (x > rect.width - zone) {
      speed = (1 - (rect.width - x) / zone) * EDGE_SCROLL_SPEED;
    }
    speedRef.current = speed;
    if (speed !== 0 && frameRef.current === 0) {
      frameRef.current = requestAnimationFrame(tick);
    }
  };

  const stopAutoScroll = () => {
    speedRef.current = 0;
  };

  const scroll = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (rail) {
      rail.scrollBy({
        behavior: "smooth",
        left: direction * rail.clientWidth * SCROLL_SHARE,
      });
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="relative mt-5 scroll-mt-24 overflow-hidden rounded-lg bg-[linear-gradient(100deg,#410230_0%,#5a0c2f_55%,#8C1535_100%)] text-[#F1EBE8] md:min-h-[270px]"
      id={shelf.id}
    >
      {/* Arte decorativa da estante: imagem estática local, carregada sob demanda. */}
      {/* biome-ignore lint/performance/noImgElement: arte estática local, sem otimizador. */}
      <img
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-2 h-[84px] w-auto opacity-90 md:top-auto md:right-3 md:bottom-0 md:h-full md:max-h-[300px]"
        decoding="async"
        height={896}
        loading="lazy"
        src={shelf.art}
        width={600}
      />
      <div className="relative min-w-0 pt-5 md:pr-[230px]">
        <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-0 px-4 max-md:pr-[120px] md:px-6">
          <h2
            className="font-display font-semibold text-[19px] leading-[1.15] tracking-[-.01em] md:text-2xl"
            id={headingId}
          >
            {shelf.label}
          </h2>
          <span className="font-data text-[#dcd0cf] text-[11px] md:text-xs">
            {count === 1 ? "1 item" : `${count} itens`}
          </span>
          {count > 4 && (
            <button
              aria-expanded={expanded}
              className="min-h-11 font-data text-[#F1EBE8] text-[11px] underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-[#F1EBE8] focus-visible:outline-offset-2 md:text-xs"
              onClick={() => setExpanded((open) => !open)}
              type="button"
            >
              {expanded ? "recolher ↑" : "ver todos →"}
            </button>
          )}
        </div>
        <div
          className="group/rail relative mt-1.5"
          onPointerLeave={stopAutoScroll}
          onPointerMove={onPointerMove}
        >
          {!expanded && (
            <>
              <button
                aria-label={`Voltar em ${shelf.label}`}
                className="absolute top-24 left-2.5 z-10 hidden size-11 items-center justify-center rounded-full bg-[#F1EBE8] text-[#410230] opacity-0 transition-opacity hover:bg-[#EBD3D7] focus-visible:opacity-100 group-hover/rail:opacity-100 md:flex"
                onClick={() => scroll(-1)}
                type="button"
              >
                <ChevronLeftIcon aria-hidden="true" className="size-5" />
              </button>
              <button
                aria-label={`Avançar em ${shelf.label}`}
                className="absolute top-24 right-2.5 z-10 hidden size-11 items-center justify-center rounded-full bg-[#F1EBE8] text-[#410230] opacity-0 transition-opacity hover:bg-[#EBD3D7] focus-visible:opacity-100 group-hover/rail:opacity-100 md:flex"
                onClick={() => scroll(1)}
                type="button"
              >
                <ChevronRightIcon aria-hidden="true" className="size-5" />
              </button>
            </>
          )}
          <div
            className={cn(
              "pt-1.5",
              !expanded &&
                "overflow-x-auto overscroll-x-contain [scrollbar-width:none] max-md:snap-x max-md:snap-proximity [&::-webkit-scrollbar]:hidden"
            )}
            ref={railRef}
          >
            <ul
              className={cn(
                "flex px-2 md:px-3.5",
                expanded
                  ? "flex-wrap"
                  : "relative w-max min-w-full pb-2 after:absolute after:inset-x-0 after:bottom-0 after:h-2 after:border-[#b98a6e] after:border-t-2 after:bg-[#3a0526] after:content-[''] md:pb-2.5 md:after:h-2.5"
              )}
            >
              {shelf.items.map((item) => {
                const title = libraryDisplayTitle(item, translateTitles);
                return (
                  <li className="shrink-0 snap-start" key={item.id}>
                    <button
                      aria-label={`${title}, ${KIND_LABEL[item.kind]}${item.year ? `, ${item.year}` : ""}`}
                      className={cn(
                        "group/tile relative flex h-[204px] w-[148px] flex-col justify-end px-2.5 focus-visible:outline-2 focus-visible:outline-[#F1EBE8] focus-visible:-outline-offset-2 md:h-[236px] md:w-[184px] md:px-3.5",
                        expanded
                          ? "pb-2 after:absolute after:inset-x-0 after:bottom-0 after:h-2 after:border-[#b98a6e] after:border-t-2 after:bg-[#3a0526] after:content-[''] md:pb-2.5 md:after:h-2.5"
                          : "pb-0"
                      )}
                      onClick={() => onOpen(shelf.id, item.id)}
                      type="button"
                    >
                      <BookCover
                        className="h-[190px] w-full transition-transform duration-[120ms] ease-[cubic-bezier(.2,0,0,1)] group-hover/tile:-translate-y-3 group-hover/tile:-rotate-[1.5deg] group-focus-visible/tile:-translate-y-3 group-focus-visible/tile:-rotate-[1.5deg] motion-reduce:transition-none md:h-[218px]"
                        item={item}
                        saved={isSaved(item)}
                        title={title}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

const ItemDetails = ({
  item,
  onSavedChange,
  saved,
  translateTitles,
}: {
  readonly item: LibraryShelfItem;
  readonly onSavedChange: (saved: boolean) => void;
  readonly saved: boolean;
  readonly translateTitles: boolean;
}) => {
  const title = libraryDisplayTitle(item, translateTitles);
  const translated = title !== item.title;
  const source = [item.year, item.authors].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-5 md:flex-row md:gap-8">
      <BookCover
        className="h-[200px] w-[144px] shrink-0 md:h-[308px] md:w-[220px]"
        item={item}
        large
        saved={saved}
        title={title}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:pr-6">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <Badge className="h-6 rounded border border-[#E2D6D1] bg-white px-2 font-semibold text-[#8C1535] text-xs">
            {KIND_LABEL[item.kind]}
          </Badge>
          {item.category && (
            <span className="font-data text-[#7A5A69] text-[10px] uppercase leading-[1.5] tracking-[.14em]">
              {libraryCategoryGroups(item.category).join(" · ")}
            </span>
          )}
        </div>
        {source && <p className="text-[#7A5A69] text-xs">{source}</p>}
        <DialogTitle
          className="font-display font-semibold text-[#410230] text-[22px] leading-[1.15] tracking-[-.01em] md:text-[28px]"
          lang={translated ? "pt-BR" : undefined}
        >
          {title}
        </DialogTitle>
        <DialogDescription className="text-[#643151] text-sm leading-[1.55] md:text-base">
          {item.description || "Material da curadoria do Interprete."}
        </DialogDescription>
        <p className="font-data text-[#40222F] text-xs">
          {libraryLanguageLabel(item.language)} ·{" "}
          {libraryDifficultyLabel(item.difficulty)}
          {item.accessType ? ` · ${libraryAccessLabel(item.accessType)}` : ""}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
          <a
            aria-label={`Abrir material: ${title}, em nova aba`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border-2 border-[#8C1535] bg-[#8C1535] px-5 font-semibold text-sm text-white transition-colors hover:bg-[#6f102b] focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2 max-md:flex-1"
            href={`/biblioteca/abrir/${item.id}`}
            rel="noopener noreferrer"
            target="_blank"
            title="Abre em nova aba"
          >
            Abrir material
            <ArrowUpRightIcon aria-hidden="true" className="size-4" />
          </a>
          <LibraryBookmarkButton
            initialSaved={item.isBookmarked}
            key={item.id}
            onSavedChange={onSavedChange}
            targetId={item.id}
            targetType="LIBRARY_ITEM"
          />
        </div>
      </div>
    </div>
  );
};

export const LibraryShelves = ({
  expandAll = false,
  shelves,
  translateTitles,
}: {
  /** Abre as estantes inteiras (todos os livros à vista), ex.: ao filtrar por categoria. */
  readonly expandAll?: boolean;
  readonly shelves: readonly LibraryShelf[];
  readonly translateTitles: boolean;
}) => {
  const [selection, setSelection] = useState<{
    readonly itemId: string;
    readonly shelfId: string;
  } | null>(null);
  const [savedOverrides, setSavedOverrides] = useState<
    Readonly<Record<string, boolean>>
  >({});

  const isSaved = (item: LibraryShelfItem) =>
    savedOverrides[item.id] ?? item.isBookmarked;
  const shelf = selection
    ? shelves.find(({ id }) => id === selection.shelfId)
    : undefined;
  const item = shelf?.items.find(({ id }) => id === selection?.itemId);

  return (
    <>
      {shelves.map((entry) => (
        <Shelf
          defaultExpanded={expandAll}
          isSaved={isSaved}
          key={`${entry.id}-${expandAll}`}
          onOpen={(shelfId, itemId) => setSelection({ itemId, shelfId })}
          shelf={entry}
          translateTitles={translateTitles}
        />
      ))}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelection(null);
          }
        }}
        open={Boolean(item)}
      >
        <DialogContent
          className="top-auto bottom-0 left-0 max-h-[92svh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-t-xl rounded-b-none border-[#E2D6D1] bg-[#F7F3F1] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-none md:top-1/2 md:bottom-auto md:left-1/2 md:max-w-[min(880px,calc(100%-3rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:p-9"
          overlayClassName="bg-[#120910]/60"
          showCloseButton={false}
        >
          {item && (
            <ItemDetails
              item={item}
              onSavedChange={(saved) =>
                setSavedOverrides((current) => ({
                  ...current,
                  [item.id]: saved,
                }))
              }
              saved={isSaved(item)}
              translateTitles={translateTitles}
            />
          )}
          <DialogClose asChild>
            <button
              aria-label="Fechar"
              className="absolute top-2 right-2 flex size-11 items-center justify-center text-[#40222F] focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2"
              type="button"
            >
              <XIcon aria-hidden="true" className="size-5" />
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
};
