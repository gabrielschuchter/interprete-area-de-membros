import { Skeleton } from "@repo/design-system/components/ui/skeleton";

const CommunityLoading = () => (
  <div
    aria-busy="true"
    className="community-page mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:px-10"
    data-route-loading
  >
    <header className="max-w-3xl animate-pulse space-y-4">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-14 w-4/5 max-w-2xl" />
      <Skeleton className="h-5 w-full max-w-xl" />
    </header>

    <section className="community-composer mt-5 animate-pulse p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <Skeleton className="h-5 w-56 max-w-full" />
      </div>
      <Skeleton className="mt-5 h-10 w-44" />
    </section>

    <div className="mt-8 animate-pulse space-y-4">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex flex-wrap gap-2 border-border border-b pb-5">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <Skeleton className="h-9 w-20 rounded-full" key={item} />
        ))}
      </div>
    </div>

    <div className="community-content-grid mt-8 grid gap-8 xl:grid-cols-[minmax(0,780px)_minmax(280px,320px)] xl:justify-between xl:gap-8">
      <section aria-label="Carregando feed" className="min-w-0 animate-pulse">
        <div className="border-border border-b pb-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-8 w-72 max-w-full" />
        </div>
        <div className="divide-y border-border border-y">
          {[1, 2, 3].map((item) => (
            <article className="space-y-5 py-8" key={item}>
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-48 max-w-[55vw]" />
                </div>
              </div>
              <Skeleton className="h-8 w-4/5 max-w-full" />
              <Skeleton className="h-16 w-full" />
              {item === 2 ? (
                <Skeleton className="aspect-[16/7] w-full" />
              ) : null}
              <div className="flex gap-2 border-border border-t pt-4">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-20" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside
        aria-label="Carregando contexto"
        className="animate-pulse space-y-6"
      >
        {[1, 2, 3, 4].map((item) => (
          <section className="border-border border-t pt-4" key={item}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-4 h-12 w-full" />
            {item === 2 ? (
              <div className="mt-4 flex -space-x-2">
                {[1, 2, 3, 4, 5].map((avatar) => (
                  <Skeleton
                    className="size-8 rounded-full border-2 border-background"
                    key={avatar}
                  />
                ))}
              </div>
            ) : null}
            {item === 3 ? (
              <div className="mt-4 space-y-3">
                {[1, 2, 3].map((row) => (
                  <Skeleton className="h-5 w-full" key={row} />
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </aside>
    </div>
    <span className="sr-only">Aguarde enquanto o feed é carregado.</span>
  </div>
);

export default CommunityLoading;
