import { Skeleton } from "@repo/design-system/components/ui/skeleton";

const ActivitiesLoading = () => (
  <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
    <div className="max-w-3xl">
      <Skeleton className="h-3 w-56" />
      <Skeleton className="mt-6 h-20 w-full max-w-2xl" />
      <Skeleton className="mt-6 h-5 w-full max-w-xl" />
    </div>
    <section className="mt-14 space-y-4">
      {["one", "two", "three"].map((item) => (
        <div className="paper-surface space-y-4 border p-6 sm:p-8" key={item}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-10 w-36" />
        </div>
      ))}
    </section>
  </main>
);

export default ActivitiesLoading;
