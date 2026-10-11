import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon, PlusIcon } from "lucide-react";
import { IntentLink as Link } from "@/app/(authenticated)/components/intent-link";
import { CommunityNavigation } from "@/components/community/community-navigation";
import { getCommunitySpaces } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

const StudyGroupsPage = async () => {
  const memberId = await requireMemberId();
  const spaces = await getCommunitySpaces(memberId);

  return (
    <main className="community-groups-page mx-auto w-full max-w-[1080px] px-5 py-8 sm:px-8 lg:py-12">
      <CommunityNavigation active="explore" mobileView="groups" />
      <header className="mt-7 flex flex-col gap-4 border-border border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">
            Grupos de estudo
          </h1>
          <p className="mt-2 text-muted-foreground text-sm leading-6">
            Conversas organizadas em torno dos grupos da comunidade.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/comunidade/grupos/novo">
            <PlusIcon aria-hidden="true" /> Criar grupo de estudo
          </Link>
        </Button>
      </header>

      {spaces.length === 0 ? (
        <p className="border-b py-6 text-muted-foreground text-sm">
          Nenhum grupo de estudo publicado ainda.
        </p>
      ) : (
        <ul className="divide-y border-border border-y">
          {spaces.map((space) => (
            <li key={space.id}>
              <Link
                className="community-groups-page__item"
                href={"/comunidade/".concat(space.slug)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-sm">
                    {space.title}
                  </span>
                  {space.description ? (
                    <span className="mt-1 line-clamp-2 block text-muted-foreground text-xs leading-5">
                      {space.description}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-3 text-muted-foreground text-xs">
                  <span className="font-data">
                    {space._count.posts}{" "}
                    {space._count.posts === 1 ? "conteúdo" : "conteúdos"}
                  </span>
                  <ArrowRightIcon aria-hidden="true" className="size-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default StudyGroupsPage;
