import { Button } from "@repo/design-system/components/ui/button";
import { PlusIcon } from "lucide-react";
import { IntentLink as Link } from "@/app/(authenticated)/components/intent-link";
import {
  CommunityGroupFilters,
  type CommunityGroupScope,
} from "@/components/community/community-group-filters";
import { CommunityGroupsDirectorySections } from "@/components/community/community-groups-directory-sections";
import { CommunityNavigation } from "@/components/community/community-navigation";
import { getCommunitySpaceDirectoryPage } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

interface StudyGroupsPageProperties {
  readonly searchParams: Promise<{
    readonly discoverCursor?: string;
    readonly mineCursor?: string;
    readonly q?: string;
    readonly scope?: string;
  }>;
}

const parseScope = (value: string | undefined): CommunityGroupScope =>
  value === "mine" || value === "discover" ? value : "all";

const StudyGroupsPage = async ({ searchParams }: StudyGroupsPageProperties) => {
  const [memberId, filters] = await Promise.all([
    requireMemberId(),
    searchParams,
  ]);
  const query = filters.q?.trim().slice(0, 100) ?? "";
  const scope = parseScope(filters.scope);
  const [mine, discover] = await Promise.all([
    scope === "discover"
      ? Promise.resolve(null)
      : getCommunitySpaceDirectoryPage(memberId, {
          cursor: filters.mineCursor,
          query,
          section: "mine",
        }),
    scope === "mine"
      ? Promise.resolve(null)
      : getCommunitySpaceDirectoryPage(memberId, {
          cursor: filters.discoverCursor,
          query,
          section: "discover",
        }),
  ]);

  return (
    <main className="community-groups-page mx-auto w-full max-w-[1248px] px-5 py-5 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
      <CommunityNavigation active="groups" />
      <header className="community-groups-page__header mt-7 flex flex-col gap-5 border-border border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="community-groups-page__intro min-w-0">
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">
            Grupos de estudo
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6 sm:text-base">
            Pequenas turmas dentro da comunidade, cada uma com seu propósito.
          </p>
        </div>
        <Button
          asChild
          className="community-groups-page__create min-h-11 shrink-0"
        >
          <Link href="/comunidade/grupos/novo">
            <PlusIcon aria-hidden="true" /> Criar grupo de estudo
          </Link>
        </Button>
      </header>
      <CommunityGroupFilters initialQuery={query} initialScope={scope} />
      <CommunityGroupsDirectorySections
        discover={discover}
        discoverCursor={filters.discoverCursor}
        memberId={memberId}
        mine={mine}
        mineCursor={filters.mineCursor}
        query={query}
        scope={scope}
      />
    </main>
  );
};

export default StudyGroupsPage;
