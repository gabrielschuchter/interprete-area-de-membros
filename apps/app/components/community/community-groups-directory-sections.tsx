import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon, PlusIcon, UsersIcon } from "lucide-react";
import { IntentLink as Link } from "@/app/(authenticated)/components/intent-link";
import type { CommunitySpaceDirectoryPage } from "@/lib/community";
import type { CommunityGroupScope } from "./community-group-filters";
import { CommunitySpaceDirectoryCard } from "./community-space-directory-card";

interface CommunityGroupsDirectorySectionsProperties {
  readonly discover: CommunitySpaceDirectoryPage | null;
  readonly discoverCursor?: string;
  readonly memberId: string;
  readonly mine: CommunitySpaceDirectoryPage | null;
  readonly mineCursor?: string;
  readonly query: string;
  readonly scope: CommunityGroupScope;
}

interface DirectoryHrefProperties {
  readonly discoverCursor?: string;
  readonly mineCursor?: string;
  readonly query: string;
  readonly scope: CommunityGroupScope;
}

const directoryHref = ({
  discoverCursor,
  mineCursor,
  query,
  scope,
}: DirectoryHrefProperties) => {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  if (scope !== "all") {
    params.set("scope", scope);
  }
  if (mineCursor) {
    params.set("mineCursor", mineCursor);
  }
  if (discoverCursor) {
    params.set("discoverCursor", discoverCursor);
  }
  const search = params.toString();
  return search ? `/comunidade/grupos?${search}` : "/comunidade/grupos";
};

const MyStudyGroupsSection = ({
  discoverCursor,
  memberId,
  mine,
  query,
  scope,
}: {
  readonly discoverCursor?: string;
  readonly memberId: string;
  readonly mine: CommunitySpaceDirectoryPage;
  readonly query: string;
  readonly scope: CommunityGroupScope;
}) => (
  <section aria-labelledby="my-study-groups" className="mt-8">
    <h2
      className="font-display text-2xl leading-tight sm:text-3xl"
      id="my-study-groups"
    >
      Meus grupos
    </h2>
    {mine.spaces.length > 0 ? (
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {mine.spaces.map((space) => (
          <CommunitySpaceDirectoryCard
            key={space.id}
            memberId={memberId}
            space={space}
          />
        ))}
      </div>
    ) : (
      <div className="mt-4 border border-border border-dashed bg-muted/20 px-5 py-7 sm:px-7">
        <p className="font-medium text-foreground">
          {query
            ? "Nenhum dos seus grupos corresponde à busca."
            : "Você ainda não participa de um grupo de estudo."}
        </p>
        <p className="mt-2 text-muted-foreground text-sm leading-6">
          Descubra um grupo público ou crie um espaço para estudar com a
          comunidade.
        </p>
        <Button asChild className="mt-4 min-h-11" variant="outline">
          <Link href={directoryHref({ query, scope: "discover" })}>
            Descobrir grupos <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </div>
    )}
    {mine.hasMore && mine.nextCursor ? (
      <div className="mt-5 flex justify-center">
        <Button asChild variant="outline">
          <Link
            href={directoryHref({
              discoverCursor,
              mineCursor: mine.nextCursor,
              query,
              scope,
            })}
          >
            Carregar mais grupos <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </div>
    ) : null}
  </section>
);

const DiscoverStudyGroupsSection = ({
  discover,
  memberId,
  mineCursor,
  query,
  scope,
}: {
  readonly discover: CommunitySpaceDirectoryPage;
  readonly memberId: string;
  readonly mineCursor?: string;
  readonly query: string;
  readonly scope: CommunityGroupScope;
}) => (
  <section aria-labelledby="discover-study-groups" className="mt-10">
    <header>
      <h2
        className="font-display text-2xl leading-tight sm:text-3xl"
        id="discover-study-groups"
      >
        Descobrir grupos públicos
      </h2>
      <p className="mt-2 text-muted-foreground text-sm leading-6">
        Qualquer membro da escola pode entrar. Grupos privados só aparecem para
        quem foi convidado.
      </p>
    </header>

    {discover.spaces.length > 0 ? (
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {discover.spaces.map((space) => (
          <CommunitySpaceDirectoryCard
            key={space.id}
            memberId={memberId}
            space={space}
          />
        ))}
        <Link
          className="flex min-h-80 flex-col items-center justify-center rounded-sm border border-brand-structural/40 border-dashed bg-brand-structural/[0.025] px-6 py-10 text-center transition-colors hover:bg-brand-structural/[0.06] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          href="/comunidade/grupos/novo"
        >
          <UsersIcon
            aria-hidden="true"
            className="size-10 text-brand-structural"
          />
          <span className="mt-5 font-display text-xl">Crie o seu grupo</span>
          <span className="mt-2 max-w-xs text-muted-foreground text-sm leading-6">
            Escolha um nome, defina quem entra e convide as pessoas.
          </span>
        </Link>
      </div>
    ) : (
      <div className="mt-4 flex min-h-44 flex-col items-start justify-center border border-border border-dashed bg-muted/20 px-5 py-7 sm:px-7">
        <p className="font-medium text-foreground">
          {query
            ? "Nenhum grupo público corresponde à busca."
            : "Não há grupos públicos para descobrir agora."}
        </p>
        <p className="mt-2 text-muted-foreground text-sm leading-6">
          Você pode tentar outra busca ou criar um grupo para iniciar uma nova
          conversa.
        </p>
        <Button asChild className="mt-4 min-h-11">
          <Link href="/comunidade/grupos/novo">
            <PlusIcon aria-hidden="true" /> Criar grupo de estudo
          </Link>
        </Button>
      </div>
    )}
    {discover.hasMore && discover.nextCursor ? (
      <div className="mt-5 flex justify-center">
        <Button asChild variant="outline">
          <Link
            href={directoryHref({
              discoverCursor: discover.nextCursor,
              mineCursor,
              query,
              scope,
            })}
          >
            Carregar mais grupos <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </div>
    ) : null}
  </section>
);

export const CommunityGroupsDirectorySections = ({
  discover,
  discoverCursor,
  memberId,
  mine,
  mineCursor,
  query,
  scope,
}: CommunityGroupsDirectorySectionsProperties) => (
  <>
    {mine ? (
      <MyStudyGroupsSection
        discoverCursor={discoverCursor}
        memberId={memberId}
        mine={mine}
        query={query}
        scope={scope}
      />
    ) : null}
    {discover ? (
      <DiscoverStudyGroupsSection
        discover={discover}
        memberId={memberId}
        mineCursor={mineCursor}
        query={query}
        scope={scope}
      />
    ) : null}
  </>
);
