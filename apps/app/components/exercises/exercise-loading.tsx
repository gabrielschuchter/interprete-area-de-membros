type ExerciseLoadingVariant =
  | "favorites"
  | "home"
  | "history"
  | "list"
  | "result"
  | "session";

const skeletonKeys = ["one", "two", "three", "four", "five", "six"] as const;

const Skeleton = ({ className = "" }: { readonly className?: string }) => (
  <span
    aria-hidden="true"
    className={`block animate-pulse rounded-sm bg-muted motion-reduce:animate-none ${className}`}
  />
);

const LoadingRows = ({ count = 4 }: { readonly count?: number }) => (
  <div className="divide-y border-y">
    {skeletonKeys.slice(0, count).map((key) => (
      <div className="flex gap-4 py-6" key={key}>
        <Skeleton className="size-10 shrink-0" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    ))}
  </div>
);

export const ExerciseLoading = ({
  variant,
}: {
  readonly variant: ExerciseLoadingVariant;
}) => {
  let frameClass = "py-8 md:py-12";
  if (variant === "session") {
    frameClass = "pt-[140px] pb-8 md:pt-12";
  } else if (variant === "result") {
    frameClass = "pt-[68px] pb-8 md:pt-12";
  }
  const widthClass = variant === "home" ? "max-w-[1080px]" : "max-w-[900px]";

  return (
    <main className={`mx-auto w-full px-5 md:px-8 ${frameClass} ${widthClass}`}>
      <output aria-busy="true" className="sr-only">
        Carregando Exercícios…
      </output>
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 w-3/4 max-w-lg" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-4/5 max-w-xl" />
      </div>

      {variant === "home" && (
        <>
          <div className="mt-8 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_96px]">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
          <section aria-label="Listas para praticar" className="mt-12">
            <Skeleton className="mb-6 h-8 w-64" />
            <div className="grid gap-5 md:grid-cols-2 min-[1250px]:grid-cols-3">
              {skeletonKeys.slice(0, 3).map((key) => (
                <article
                  className="overflow-hidden rounded-md border bg-card"
                  key={key}
                >
                  <Skeleton className="h-32 rounded-none" />
                  <div className="space-y-4 p-5">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-6 w-4/5" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-11 w-32" />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {variant === "session" && (
        <>
          <div className="mt-8 flex justify-between gap-4">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-11 w-28" />
          </div>
          <Skeleton className="mt-4 h-2 w-full" />
          <article className="mt-6 space-y-6 rounded-md border bg-card p-5 md:p-8">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-16 w-full max-w-2xl" />
            {skeletonKeys.slice(0, 4).map((key) => (
              <Skeleton className="h-16 w-full" key={key} />
            ))}
            <Skeleton className="h-11 w-44" />
          </article>
        </>
      )}

      {variant === "result" && (
        <>
          <article className="mt-8 space-y-5 rounded-md border bg-card p-6 md:p-8">
            <Skeleton className="h-16 w-56" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </article>
          <section className="mt-8 space-y-5">
            <Skeleton className="h-8 w-64" />
            <LoadingRows count={6} />
          </section>
        </>
      )}

      {variant === "list" && (
        <article className="mt-8 overflow-hidden rounded-md border bg-card">
          <Skeleton className="h-40 rounded-none" />
          <div className="space-y-5 p-6 md:p-8">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-12 w-full md:w-48" />
          </div>
        </article>
      )}

      {(variant === "history" || variant === "favorites") && (
        <section className="mt-8">
          <Skeleton className="mb-5 h-4 w-48" />
          <LoadingRows />
        </section>
      )}
    </main>
  );
};
