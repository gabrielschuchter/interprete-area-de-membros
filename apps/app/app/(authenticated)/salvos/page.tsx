import { Button } from "@repo/design-system/components/ui/button";
import {
  BookmarkIcon,
  BookOpenIcon,
  FileTextIcon,
  ListChecksIcon,
} from "lucide-react";
import Link from "next/link";
import { toggleLearningBookmark } from "@/app/(authenticated)/biblioteca/actions";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { ExerciseFavoriteControl } from "@/components/exercises/exercise-favorite-control";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { getMemberExerciseFavorites } from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";
import { getPersonalLibraryItems } from "@/lib/library";
import type { SavedContentFilter } from "./saved-filters";
import { SavedFilters } from "./saved-filters";

interface SavedPageProperties {
  readonly searchParams: Promise<{
    readonly tipo?: string;
  }>;
}

type SavedRowCategory = Exclude<SavedContentFilter, "todos">;

interface SavedRow {
  readonly category: SavedRowCategory;
  readonly href: string;
  readonly id: string;
  readonly label: string;
  readonly questionId?: string;
  readonly savedAt: Date;
  readonly source: string;
  readonly targetId?: string;
  readonly targetType?: string;
  readonly title: string;
}

const savedFilter = (value: string | undefined): SavedContentFilter =>
  value === "aulas" || value === "materiais" || value === "questoes"
    ? value
    : "todos";

const SavedPage = async ({ searchParams }: SavedPageProperties) => {
  const [memberId, query] = await Promise.all([
    requireMemberId(),
    searchParams,
  ]);
  const [libraryItems, favorites] = await Promise.all([
    getPersonalLibraryItems(memberId),
    getMemberExerciseFavorites(memberId, undefined, "after", 20),
  ]);
  const selected = savedFilter(query.tipo);
  const counts = {
    todos: libraryItems.length + favorites.totalCount,
    aulas: libraryItems.filter(
      (item) =>
        item.targetType === "COURSE" ||
        item.targetType === "MODULE" ||
        item.targetType === "LESSON"
    ).length,
    materiais: libraryItems.filter(
      (item) =>
        item.targetType === "LIBRARY_ITEM" || item.targetType === "ASSET"
    ).length,
    questoes: favorites.totalCount,
  } satisfies Record<SavedContentFilter, number>;

  const libraryRows: SavedRow[] = libraryItems.map((item) => ({
    category:
      item.targetType === "LIBRARY_ITEM" || item.targetType === "ASSET"
        ? "materiais"
        : "aulas",
    href: item.href,
    id: `library:${item.id}`,
    label: item.label,
    savedAt: item.savedAt,
    source: `${item.targetType === "LIBRARY_ITEM" ? "Biblioteca" : "Cursos"} · ${item.category ?? item.label}`,
    targetId: item.targetId,
    targetType: item.targetType,
    title: item.title,
  }));
  const questionRows: SavedRow[] = favorites.items.map((favorite) => {
    const question = favorite.question;
    const list = question.listItems[0]?.list;
    return {
      category: "questoes",
      href: `/exercicios/favoritas/${encodeURIComponent(question.id)}`,
      id: `question:${favorite.id}`,
      label: "Questão",
      questionId: question.id,
      savedAt: favorite.createdAt,
      source: `Exercícios · ${list?.title ?? list?.bank.title ?? "Questão"}`,
      title:
        question.versions[0]?.statement ??
        "Esta questão não está mais disponível.",
    };
  });
  const rows = [...libraryRows, ...questionRows]
    .filter((row) => selected === "todos" || row.category === selected)
    .sort((left, right) => right.savedAt.getTime() - left.savedAt.getTime());
  const totalCount = counts[selected];
  const emptyState = (() => {
    if (rows.length > 0) {
      return null;
    }

    if (selected !== "todos" && counts.todos > 0) {
      return (
        <section
          aria-live="polite"
          className="border-[#E2D6D1] border-b py-10 text-center"
        >
          <p className="font-display text-2xl text-[#40222F]">
            Nada salvo nesta categoria.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/salvos">Ver todos os salvos</Link>
          </Button>
        </section>
      );
    }

    return (
      <section className="mt-3 flex flex-col gap-6 rounded-md border border-[#E2D6D1] bg-white p-6 sm:flex-row sm:items-center sm:p-10">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-md bg-[#F1E7E3] text-[#8C1535]">
          <BookmarkIcon aria-hidden="true" className="size-8" />
        </span>
        <div className="max-w-2xl">
          <h2 className="font-display font-semibold text-2xl text-[#40222F]">
            Você ainda não salvou nada.
          </h2>
          <p className="mt-3 text-[#7A5A69] text-sm leading-6">
            Use o marcador Salvar em aulas, materiais e questões para
            encontrá-los aqui.
          </p>
          <Button asChild className="mt-5">
            <Link href="/estudar">Explorar Estudar</Link>
          </Button>
        </div>
      </section>
    );
  })();

  return (
    <main className="mx-auto min-h-[calc(100svh-56px)] w-full max-w-[1080px] px-5 pt-5 pb-14 sm:px-8 sm:pt-8 sm:pb-24 lg:px-12 lg:pt-12 lg:pb-[120px]">
      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <p className="brand-eyebrow tracking-[.14em]">Sua coleção</p>
          <svg
            aria-hidden="true"
            className="shrink-0"
            fill="none"
            height="10"
            viewBox="0 0 96 10"
            width="64"
          >
            <path d="M0 5H34M62 5H96" stroke="#BFA9A3" strokeWidth="1" />
            <path d="M48 1L52 5L48 9L44 5Z" fill="#BFA9A3" />
            <circle cx="38" cy="5" fill="#BFA9A3" r="1.2" />
            <circle cx="58" cy="5" fill="#BFA9A3" r="1.2" />
          </svg>
        </div>
        <h1 className="mt-4 font-display font-semibold text-[#40222F] text-[36px] leading-[1.08] tracking-[-.02em] sm:text-[52px] sm:leading-[1.05]">
          Salvos
        </h1>
        <p className="mt-3 text-muted-foreground leading-7">
          Aulas, materiais e questões que você guardou ficam juntos aqui.
        </p>
      </header>

      <section aria-label="Conteúdos salvos" className="mt-8">
        <SavedFilters counts={counts} selected={selected} />
        <div
          aria-live="polite"
          className="flex min-h-12 items-center justify-end font-data text-muted-foreground text-xs uppercase tracking-[.08em]"
        >
          {totalCount} {totalCount === 1 ? "ITEM SALVO" : "ITENS SALVOS"}
        </div>

        {rows.length > 0 ? (
          <ul aria-label="Itens salvos" className="divide-y divide-[#E2D6D1]">
            {rows.map((row) => {
              const Icon = {
                aulas: BookOpenIcon,
                materiais: FileTextIcon,
                questoes: ListChecksIcon,
              }[row.category];
              return (
                <li key={row.id}>
                  <article className="flex flex-wrap items-center gap-x-[18px] gap-y-3 py-[18px]">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#F1E4E1] text-[#8C1535]">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-[5px] sm:flex-[1_1_320px]">
                      <span className="inline-flex h-6 w-fit items-center rounded border border-[#E2D6D1] bg-white px-[9px] text-[#40222F] text-[11.5px] leading-none">
                        {row.label}
                      </span>
                      <h2 className="font-display font-semibold text-[#40222F] text-[19px] leading-[1.35]">
                        <IntentLink
                          className="hover:text-[#8C1535] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535]"
                          href={row.href}
                        >
                          {row.title}
                        </IntentLink>
                      </h2>
                      <p className="text-[#7A5A69] text-[13px] leading-[1.4]">
                        {row.source}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        asChild
                        className="h-11 border-2 border-[#8C1535] px-[22px]"
                        variant="outline"
                      >
                        <IntentLink href={row.href}>Abrir</IntentLink>
                      </Button>
                      {row.questionId ? (
                        <ExerciseFavoriteControl
                          className="h-11 px-3 text-[#8C1535] text-sm"
                          initialBookmarked
                          questionId={row.questionId}
                          savedLabel="Salvo"
                        />
                      ) : (
                        <SingleFlightForm
                          action={toggleLearningBookmark}
                          className="shrink-0"
                        >
                          <input
                            name="targetType"
                            type="hidden"
                            value={row.targetType}
                          />
                          <input
                            name="targetId"
                            type="hidden"
                            value={row.targetId}
                          />
                          <input name="desired" type="hidden" value="off" />
                          <SingleFlightSubmit
                            aria-label={`Remover ${row.title} dos salvos`}
                            className="h-11 px-3 text-[#8C1535] text-sm"
                            pendingLabel="Salvando…"
                            size="sm"
                            variant="ghost"
                          >
                            <BookmarkIcon
                              aria-hidden="true"
                              className="size-[18px]"
                              fill="currentColor"
                            />
                            Salvo
                          </SingleFlightSubmit>
                        </SingleFlightForm>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          emptyState
        )}

        {favorites.hasNext &&
        selected !== "aulas" &&
        selected !== "materiais" ? (
          <div className="mt-5 flex justify-center">
            <Button asChild variant="outline">
              <Link href="/exercicios/favoritas">
                Ver todas as questões salvas ({favorites.totalCount})
              </Link>
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
};

export default SavedPage;
