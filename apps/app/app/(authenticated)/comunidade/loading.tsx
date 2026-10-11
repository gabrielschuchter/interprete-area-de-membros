import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { CommunityHero } from "@/components/community/community-hero";

const CommunityLoading = () => (
  <div
    aria-busy="true"
    className="community-page min-h-svh bg-background"
    data-route-loading
  >
    <div className="community-shell mx-auto w-full">
      <CommunityHero />
      <div className="community-content-grid">
        <div className="community-discovery-toolbar">
          <nav aria-label="Carregando navegação da comunidade">
            <div className="flex min-h-11 items-center gap-5">
              {[1, 2, 3].map((item) => (
                <Skeleton
                  className={item === 2 ? "h-4 w-[9.5rem]" : "h-4 w-20"}
                  key={item}
                />
              ))}
            </div>
          </nav>
          <div aria-hidden="true" className="community-feed-nav">
            <Skeleton className="h-10 w-40 rounded" />
            <Skeleton className="h-10 w-32 rounded" />
          </div>
        </div>

        <aside
          aria-label="Carregando contexto"
          className="community-right-rail"
        >
          <div className="community-rail__search">
            <Skeleton className="h-11 w-full rounded" />
          </div>
          <section className="community-rail__block community-rail__presence">
            <Skeleton className="h-3 w-24" />
            <div className="mt-4 flex gap-2">
              {[1, 2, 3, 4, 5].map((item) => (
                <Skeleton className="size-8 rounded-full" key={item} />
              ))}
            </div>
          </section>
          <section className="community-rail__block community-rail__spaces">
            <Skeleton className="h-3 w-32" />
            <div className="mt-4 space-y-4">
              {[1, 2].map((item) => (
                <Skeleton className="h-8 w-full" key={item} />
              ))}
            </div>
          </section>
        </aside>

        <div
          aria-hidden="true"
          className="community-composer flex min-h-16 items-center gap-3 px-4"
        >
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-56 max-w-[70%]" />
        </div>

        <section
          aria-label="Carregando publicações"
          className="community-feed-area min-w-0"
        >
          <div className="community-feed-list">
            {[1, 2, 3].map((item) => (
              <article className="community-post-card animate-pulse" key={item}>
                <div className="flex items-center gap-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="mt-4 h-7 w-4/5 max-w-full" />
                <Skeleton className="mt-3 h-12 w-full" />
                <div className="mt-4 flex gap-3">
                  <Skeleton className="h-11 w-24" />
                  <Skeleton className="h-11 w-20" />
                  <Skeleton className="h-11 w-16" />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <span className="sr-only">Aguarde enquanto o feed é carregado.</span>
    </div>
  </div>
);

export default CommunityLoading;
