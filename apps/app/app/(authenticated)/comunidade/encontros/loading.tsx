import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { CommunityNavigation } from "@/components/community/community-navigation";

const CommunityMeetingsLoading = () => (
  <main className="community-page min-h-svh bg-background">
    <div className="community-shell mx-auto w-full">
      <CommunityNavigation active="meetings" />
      <section
        aria-busy="true"
        aria-label="Carregando encontros"
        className="mx-auto mt-8 w-full max-w-5xl"
      >
        <span className="sr-only">Carregando encontros</span>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-3 h-5 w-80 max-w-full" />
        <Skeleton className="mt-10 h-5 w-36" />
        <div className="mt-4 grid gap-3">
          {[1, 2, 3].map((item) => (
            <Skeleton className="h-24 w-full rounded-md" key={item} />
          ))}
        </div>
      </section>
    </div>
  </main>
);

export default CommunityMeetingsLoading;
