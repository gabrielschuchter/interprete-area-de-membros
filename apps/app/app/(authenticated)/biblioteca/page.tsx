import type { Metadata } from "next";
import { Suspense } from "react";
import {
  LibraryExperience,
  type LibraryFilterValues,
} from "@/components/library/library-experience";
import { LibraryMostAccessed } from "@/components/library/library-most-accessed";
import { LibraryResults } from "@/components/library/library-results";
import { LibraryResultsSkeleton } from "@/components/library/library-results-skeleton";
import { requireMemberId } from "@/lib/learning";
import { getLibraryCategories } from "@/lib/library";
import { libraryCategoryGroup } from "@/lib/library-categories";

interface LibraryPageProperties {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const readFilters = (
  params: Record<string, string | string[] | undefined>
): LibraryFilterValues => ({
  category: (() => {
    const category = firstValue(params.category);
    return category ? libraryCategoryGroup(category) : "";
  })(),
  difficulty: firstValue(params.difficulty) ?? "",
  q: firstValue(params.q) ?? "",
  titulos: firstValue(params.titulos) === "pt" ? "pt" : "",
});

const LibraryPage = async ({ searchParams }: LibraryPageProperties) => {
  const [params, memberId, categories] = await Promise.all([
    searchParams,
    requireMemberId(),
    getLibraryCategories(),
  ]);
  const filters = readFilters(params);
  const showingDefaultShelf = !(
    filters.q ||
    filters.category ||
    filters.difficulty
  );

  return (
    <div className="min-h-full bg-[#F1EBE8]">
      <LibraryExperience
        categories={categories}
        highlights={
          showingDefaultShelf ? (
            <Suspense fallback={null}>
              <LibraryMostAccessed memberId={memberId} />
            </Suspense>
          ) : null
        }
        initialFilters={filters}
      >
        <Suspense fallback={<LibraryResultsSkeleton />}>
          <LibraryResults filters={filters} memberId={memberId} />
        </Suspense>
      </LibraryExperience>
    </div>
  );
};

export default LibraryPage;

export const metadata: Metadata = { title: "Biblioteca | Interprete" };
