import { Skeleton } from "@repo/design-system/components/ui/skeleton";

const MeetingsLoading = () => (
  <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
    <div className="max-w-3xl">
      <Skeleton className="h-3 w-56" />
      <Skeleton className="mt-6 h-20 w-full max-w-2xl" />
      <Skeleton className="mt-6 h-5 w-full max-w-xl" />
    </div>
    <section className="mt-14 grid gap-5 lg:grid-cols-2">
      {["one", "two"].map((item) => (
        <div className="paper-surface space-y-4 border p-6 sm:p-8" key={item}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-10 w-40" />
        </div>
      ))}
    </section>
  </main>
);

export default MeetingsLoading;
