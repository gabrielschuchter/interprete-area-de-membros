import { Skeleton } from "@repo/design-system/components/ui/skeleton";

const LibraryLoading = () => (
  <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
    <div className="max-w-3xl">
      <Skeleton className="h-3 w-56" />
      <Skeleton className="mt-6 h-20 w-full max-w-2xl" />
      <Skeleton className="mt-6 h-5 w-full max-w-xl" />
    </div>
    <div className="mt-12 flex gap-3">
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-10 w-28" />
    </div>
    <section className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {["one", "two", "three", "four", "five", "six"].map((item) => (
        <div className="paper-surface min-h-56 space-y-4 border p-6" key={item}>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </section>
  </main>
);

export default LibraryLoading;
