"use client";

import type { LibraryBookmarkTargetType } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { BookOpenIcon, ExternalLinkIcon, PlayCircleIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { LibraryBookmarkButton } from "@/components/library/library-bookmark-button";
import { LibraryCover } from "@/components/library/library-cover";
import type { PersonalLibraryCard } from "@/lib/library";

type PersonalFilter = "all" | "materials" | "courses" | "lessons";

const groupFor = (
  targetType: LibraryBookmarkTargetType
): Exclude<PersonalFilter, "all"> => {
  if (targetType === "LIBRARY_ITEM") {
    return "materials";
  }
  if (targetType === "COURSE" || targetType === "MODULE") {
    return "courses";
  }
  return "lessons";
};

const groupLabel = (item: PersonalLibraryCard) => {
  const group = groupFor(item.targetType);
  if (group === "materials") {
    return `MATERIAL · ${item.category ?? "BIBLIOTECA"}`;
  }
  return group === "courses" ? "CURSO · APRENDER" : "AULA · APRENDER";
};

const countLabel = (count: number) =>
  `${count.toString().padStart(2, "0")} ${count === 1 ? "ITEM SALVO" : "ITENS SALVOS"}`;

interface PersonalLibraryGridProperties {
  readonly items: readonly PersonalLibraryCard[];
}

export const PersonalLibraryGrid = ({
  items,
}: PersonalLibraryGridProperties) => {
  const [allItems, setAllItems] = useState(items);
  const [filter, setFilter] = useState<PersonalFilter>("all");
  const filterId = useId();

  useEffect(() => setAllItems(items), [items]);

  const visibleItems = useMemo(
    () =>
      allItems.filter(
        (item) => filter === "all" || groupFor(item.targetType) === filter
      ),
    [allItems, filter]
  );

  const setItemSaved = (item: PersonalLibraryCard, saved: boolean) => {
    setAllItems((current) => {
      if (saved) {
        if (current.some((entry) => entry.id === item.id)) {
          return current;
        }
        return [...current, item].sort(
          (left, right) => right.savedAt.valueOf() - left.savedAt.valueOf()
        );
      }
      return current.filter((entry) => entry.id !== item.id);
    });
  };

  return (
    <section
      aria-label="Conteúdos salvos"
      className="mt-7 max-w-[760px] md:mt-10"
    >
      <div className="grid gap-2 md:grid-cols-[200px_minmax(0,1fr)] md:items-end md:gap-4">
        <div className="grid gap-1.5">
          <label
            className="font-semibold text-[#7A5A69] text-xs"
            htmlFor={filterId}
          >
            Mostrar
          </label>
          <select
            className="h-12 rounded-md border border-[#E2D6D1] bg-white px-3 text-[#40222F] text-sm focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2"
            id={filterId}
            onChange={(event) =>
              setFilter(event.currentTarget.value as PersonalFilter)
            }
            value={filter}
          >
            <option value="all">Todos os itens</option>
            <option value="materials">Materiais</option>
            <option value="courses">Cursos</option>
            <option value="lessons">Aulas</option>
          </select>
        </div>
        <p
          aria-atomic="true"
          aria-live="polite"
          className="font-data text-[#7A5A69] text-[11px] tracking-[.12em] md:pb-3 md:text-right"
        >
          {countLabel(visibleItems.length)}
        </p>
      </div>

      <ul aria-label="Itens salvos" className="mt-4 border-[#40222F] border-t">
        {visibleItems.map((item) => {
          const group = groupFor(item.targetType);
          return (
            <li
              className="border-[#E2D6D1] border-b py-4 md:py-[18px]"
              key={item.id}
            >
              <article className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-start gap-x-[14px] gap-y-3 md:grid-cols-[44px_minmax(0,1fr)_auto] md:gap-4">
                {group === "materials" ? (
                  <LibraryCover
                    category={item.category}
                    compact
                    coverUrl={item.coverUrl}
                    title={item.title}
                  />
                ) : (
                  <div className="grid h-[59px] w-[44px] shrink-0 place-items-center rounded-sm bg-[linear-gradient(140deg,#410230,#8C1535)] text-white">
                    {group === "courses" ? (
                      <BookOpenIcon aria-hidden="true" className="size-5" />
                    ) : (
                      <PlayCircleIcon aria-hidden="true" className="size-5" />
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-data text-[#7A5A69] text-[10px] uppercase leading-[1.5] tracking-[.1em]">
                    {groupLabel(item)}
                  </p>
                  <h2 className="mt-0.5 break-words font-display font-semibold text-[#40222F] text-[18px] leading-[1.3]">
                    <Link
                      className="hover:text-[#8C1535] focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2"
                      href={item.href}
                      prefetch={false}
                    >
                      {item.title}
                    </Link>
                  </h2>
                </div>
                <div className="col-span-2 flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 md:col-span-1 md:row-span-2 md:justify-end">
                  <a
                    aria-label={`Abrir ${item.title} em nova aba`}
                    className="inline-flex h-11 min-w-[88px] items-center justify-center gap-2 rounded-md border-2 border-[#8C1535] px-4 font-semibold text-[#8C1535] text-sm transition-colors hover:bg-[#8C1535]/5 focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2"
                    href={item.openHref}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Abrir{" "}
                    <ExternalLinkIcon aria-hidden="true" className="size-4" />
                  </a>
                  <LibraryBookmarkButton
                    initialSaved
                    onSavedChange={(saved) => setItemSaved(item, saved)}
                    targetId={item.targetId}
                    targetType={item.targetType}
                    variant="personal"
                  />
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      {visibleItems.length === 0 && (
        <div className="border-[#E2D6D1] border-b py-8 text-[#7A5A69] text-sm">
          Nenhum item salvo nesta seleção.
          <Button
            className="ml-2 h-11 text-[#8C1535]"
            onClick={() => setFilter("all")}
            variant="ghost"
          >
            Mostrar todos os itens
          </Button>
        </div>
      )}
    </section>
  );
};
