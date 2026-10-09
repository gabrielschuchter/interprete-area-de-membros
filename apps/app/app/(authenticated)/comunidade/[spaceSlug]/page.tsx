import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  LockKeyholeIcon,
  PlusIcon,
  UsersRoundIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityDraftStarter } from "@/components/community/community-draft-starter";
import { CommunityFeedCard } from "@/components/community/community-feed-card";
import { GroupMemberInvitePicker } from "@/components/community/group-member-invite-picker";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { getMemberRole } from "@/lib/authorization";
import { getCommunitySpace } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { inviteStudyGroupMembers, joinPublicStudyGroup } from "../actions";

interface CommunitySpacePageProperties {
  readonly params: Promise<{ spaceSlug: string }>;
  readonly searchParams: Promise<{ page?: string }>;
}

const CommunitySpacePage = async ({
  params,
  searchParams,
}: CommunitySpacePageProperties) => {
  const { spaceSlug } = await params;
  const filters = await searchParams;
  const memberId = await requireMemberId();
  const page = Number.parseInt(filters.page ?? "1", 10);
  const space = await getCommunitySpace(spaceSlug, memberId, page);

  if (!space) {
    notFound();
  }
  const role = await getMemberRole(memberId);
  const isOwner = space.ownerId === memberId;
  const isMember = space.members.length > 0;
  const canManageGroup = isOwner || role === "TEACHER" || role === "ADMIN";

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/comunidade">
            <ArrowLeftIcon aria-hidden="true" /> Todos os grupos
          </Link>
        </Button>
        <header className="mt-8 flex flex-col justify-between gap-6 border-border border-b pb-8 md:flex-row md:items-end">
          <div>
            <p className="brand-eyebrow">Grupo de estudo · /{space.slug}</p>
            {space.coverUrl ? (
              <div className="relative mt-5 aspect-[16/6] max-w-2xl overflow-hidden rounded-sm border">
                <Image
                  alt={`Capa do grupo ${space.title}`}
                  className="object-cover"
                  fill
                  priority
                  referrerPolicy="no-referrer"
                  sizes="(max-width: 768px) 100vw, 672px"
                  src={space.coverUrl}
                  unoptimized
                />
              </div>
            ) : null}
            <h1 className="mt-4 font-display text-5xl leading-none sm:text-6xl">
              {space.title}
            </h1>
            {space.description && (
              <p className="mt-4 max-w-2xl text-muted-foreground leading-7">
                {space.description}
              </p>
            )}
            {space.details ? (
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-muted-foreground text-sm leading-6">
                {space.details}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">
              {space.visibility === "PRIVATE" ? (
                <LockKeyholeIcon aria-hidden="true" />
              ) : (
                <UsersRoundIcon aria-hidden="true" />
              )}
              {space.visibility === "PRIVATE" ? "Privado" : "Público"}
            </Badge>
            <Badge variant="secondary">{space._count.members} membros</Badge>
            {space.commentsClosed && (
              <Badge variant="outline">Comentários fechados</Badge>
            )}
            {!isMember && space.visibility === "PUBLIC" ? (
              <SingleFlightForm action={joinPublicStudyGroup}>
                <input name="groupId" type="hidden" value={space.id} />
                <SingleFlightSubmit size="sm" variant="outline">
                  Participar do grupo
                </SingleFlightSubmit>
              </SingleFlightForm>
            ) : null}
            {isMember || canManageGroup ? (
              <CommunityDraftStarter spaceId={space.id}>
                <PlusIcon aria-hidden="true" /> Criar aqui
              </CommunityDraftStarter>
            ) : null}
          </div>
        </header>
        {canManageGroup ? (
          <details className="paper-surface mt-6 border p-5 sm:p-6">
            <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Convidar pessoas para o grupo
            </summary>
            <SingleFlightForm
              action={inviteStudyGroupMembers}
              className="mt-5 space-y-5"
            >
              <input name="groupId" type="hidden" value={space.id} />
              <GroupMemberInvitePicker currentMemberId={memberId} />
              <div className="flex justify-end border-t pt-4">
                <SingleFlightSubmit pendingLabel="Enviando…" size="sm">
                  Enviar convites
                </SingleFlightSubmit>
              </div>
            </SingleFlightForm>
          </details>
        ) : null}
        <section aria-labelledby="posts-heading" className="mt-10">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="posts-heading">
              Conteúdo recente
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              Página {space.page}
            </span>
          </div>
          {space.posts.length === 0 ? (
            <div className="paper-surface mt-5 border p-8">
              <p className="text-muted-foreground">
                Este grupo ainda não tem conteúdo. Seja a primeira pessoa a
                escrever.
              </p>
            </div>
          ) : (
            <div className="mt-5 divide-y border-border border-y">
              {space.posts.map((post) => (
                <CommunityFeedCard
                  key={post.id}
                  post={post}
                  spaceSlug={space.slug}
                />
              ))}
            </div>
          )}
          {(space.page > 1 || space.hasMorePosts) && (
            <nav
              aria-label="Paginação do grupo"
              className="mt-8 flex justify-between gap-3"
            >
              {space.page > 1 ? (
                <Button asChild variant="outline">
                  <Link
                    href={`/comunidade/${space.slug}?page=${space.page - 1}`}
                  >
                    Anterior
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {space.hasMorePosts && (
                <Button asChild variant="outline">
                  <Link
                    href={`/comunidade/${space.slug}?page=${space.page + 1}`}
                  >
                    Mais conteúdo <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </nav>
          )}
        </section>
      </main>
    </div>
  );
};

export default CommunitySpacePage;
