import { Skeleton } from "@repo/design-system/components/ui/skeleton";

const BOOKS = [0, 1, 2, 3, 4, 5];

const LibraryShelfSkeleton = () => (
  <div
    aria-hidden="true"
    className="rounded-lg bg-[linear-gradient(100deg,#410230_0%,#5a0c2f_55%,#8C1535_100%)] pt-5"
  >
    <Skeleton className="mx-4 h-6 w-56 rounded-sm bg-[#F1EBE8]/20 md:mx-6" />
    <div className="relative mt-4 flex gap-5 overflow-hidden px-4 pb-4 md:px-6">
      {BOOKS.map((index) => (
        <Skeleton
          className="h-[190px] w-[124px] shrink-0 rounded-[2px_6px_6px_2px] bg-[#F1EBE8]/15 md:h-[218px] md:w-[148px]"
          key={index}
        />
      ))}
      <span className="absolute inset-x-0 bottom-0 h-2 border-[#b98a6e] border-t-2 bg-[#3a0526]" />
    </div>
  </div>
);

export const LibraryResultsSkeleton = () => (
  <output
    aria-busy="true"
    aria-label="Carregando materiais"
    className="mt-5 grid gap-5"
  >
    <span className="sr-only">Carregando materiais</span>
    <LibraryShelfSkeleton />
    <LibraryShelfSkeleton />
  </output>
);
