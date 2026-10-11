import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  LockKeyholeIcon,
  PlusIcon,
  UsersRoundIcon,
} from "lucide-react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { CommunityNavigation } from "@/components/community/community-navigation";
import { Stagger } from "@/components/motion/motion";
import { getCommunitySpaces } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

const CommunityGroupsPage = async () => {
  const memberId = await requireMemberId();
  const spaces = await getCommunitySpaces(memberId);

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1280px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <CommunityNavigation active="explore" />
        <header className="mt-8 flex flex-col justify-between gap-6 border-border border-b pb-8 sm:flex-row sm:items-end">
          <div className="max-w-3xl">
            <p className="brand-eyebrow">Comunidade · grupos de estudo</p>
            <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              Aprender em conjunto.
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
              Encontre grupos publicados dos quais você pode participar ou
              retome as conversas em que já está.
            </p>
          </div>
          <Button asChild>
            <IntentLink href="/comunidade/grupos/novo">
              <PlusIcon aria-hidden="true" /> Criar grupo
            </IntentLink>
          </Button>
        </header>

        {spaces.length === 0 ? (
          <section className="paper-surface mt-8 border p-7 sm:p-10">
            <p className="brand-eyebrow">Grupos disponíveis</p>
            <h2 className="mt-3 font-display text-2xl">
              Ainda não há grupos publicados para mostrar.
            </h2>
            <p className="mt-2 text-muted-foreground leading-6">
              Quando um grupo for publicado ou você receber um convite, ele
              aparecerá aqui.
            </p>
          </section>
        ) : (
          <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {spaces.map((space) => {
              const isMember =
                space.members.length > 0 || space.ownerId === memberId;
              return (
                <article
                  className="paper-surface flex min-h-56 flex-col border p-5 shadow-[var(--shadow-paper)]"
                  key={space.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-brand-structural/25 bg-brand-structural/8 text-brand-structural">
                        <UsersRoundIcon aria-hidden="true" className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-2xl">
                          {space.title}
                        </h2>
                        <p className="mt-1 truncate font-data text-muted-foreground text-xs">
                          /{space.slug}
                        </p>
                      </div>
                    </div>
                    {space.visibility === "PRIVATE" ? (
                      <Badge variant="outline">
                        <LockKeyholeIcon aria-hidden="true" /> Privado
                      </Badge>
                    ) : (
                      <Badge variant="outline">Público</Badge>
                    )}
                  </div>
                  {space.description ? (
                    <p className="mt-4 line-clamp-3 text-muted-foreground text-sm leading-6">
                      {space.description}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                    <span className="text-muted-foreground text-xs">
                      {space._count.posts} publicações
                      {isMember ? " · você participa" : ""}
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <IntentLink href={`/comunidade/${space.slug}`}>
                        Abrir grupo <ArrowRightIcon aria-hidden="true" />
                      </IntentLink>
                    </Button>
                  </div>
                </article>
              );
            })}
          </Stagger>
        )}
      </main>
    </div>
  );
};

export default CommunityGroupsPage;
