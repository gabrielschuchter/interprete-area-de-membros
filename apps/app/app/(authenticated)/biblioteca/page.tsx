import { Suspense } from "react";
import {
  LibraryExperience,
  type LibraryFilterValues,
} from "@/components/library/library-experience";
import { LibraryResults } from "@/components/library/library-results";
import { LibraryResultsSkeleton } from "@/components/library/library-results-skeleton";
import { requireMemberId } from "@/lib/learning";
import { getLibraryCategories } from "@/lib/library";

interface LibraryPageProperties {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const readFilters = (
  params: Record<string, string | string[] | undefined>
): LibraryFilterValues => ({
  category: firstValue(params.category) ?? "",
  difficulty: firstValue(params.difficulty) ?? "",
  kind: firstValue(params.kind) ?? "",
  language: firstValue(params.language) ?? "",
  q: firstValue(params.q) ?? "",
  sort: firstValue(params.sort) === "relevant" ? "relevant" : "recent",
});

const LibraryPage = async ({ searchParams }: LibraryPageProperties) => {
  const [params, memberId, categories] = await Promise.all([
    searchParams,
    requireMemberId(),
    getLibraryCategories(),
  ]);
  const filters = readFilters(params);
  const rawPage = Number.parseInt(firstValue(params.page) ?? "1", 10);
  const currentPage =
    Number.isSafeInteger(rawPage) && rawPage > 0
      ? Math.min(rawPage, 10_000)
      : 1;

  return (
    <div className="min-h-full bg-[#F1EBE8]">
      <LibraryExperience categories={categories} initialFilters={filters}>
        <Suspense fallback={<LibraryResultsSkeleton />}>
          <LibraryResults
            currentPage={currentPage}
            filters={filters}
            memberId={memberId}
          />
        </Suspense>
      </LibraryExperience>
    </div>
  );
};

export default LibraryPage;
