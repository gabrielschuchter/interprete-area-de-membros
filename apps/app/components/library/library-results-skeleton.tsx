import { Skeleton } from "@repo/design-system/components/ui/skeleton";

const LibraryResultSkeletonCard = () => (
  <article
    aria-hidden="true"
    className="flex min-h-[186px] min-w-0 gap-[14px] rounded-lg border border-[#E2D6D1] bg-white p-4 md:gap-5 md:p-5"
  >
    <Skeleton className="h-[98px] w-[72px] shrink-0 rounded-sm bg-[#E2D6D1] md:h-[146px] md:w-[108px] lg:h-[124px] lg:w-[92px]" />
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <Skeleton className="h-5 w-1/3 rounded-sm bg-[#E2D6D1]" />
      <Skeleton className="h-4 w-2/3 rounded-sm bg-[#E2D6D1]" />
      <Skeleton className="h-6 w-full rounded-sm bg-[#E2D6D1]" />
      <Skeleton className="h-4 w-4/5 rounded-sm bg-[#E2D6D1]" />
      <Skeleton className="mt-auto h-11 w-36 rounded-md bg-[#E2D6D1]" />
    </div>
  </article>
);

export const LibraryResultsSkeleton = () => (
  <output
    aria-busy="true"
    aria-label="Carregando materiais"
    className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] gap-4"
  >
    <span className="sr-only">Carregando materiais</span>
    {[0, 1, 2, 3].map((index) => (
      <LibraryResultSkeletonCard key={index} />
    ))}
  </output>
);
