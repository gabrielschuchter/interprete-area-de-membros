import { Button } from "@repo/design-system/components/ui/button";
import { GlobeIcon, LockKeyholeIcon, UsersIcon } from "lucide-react";
import Image from "next/image";
import { IntentLink as Link } from "@/app/(authenticated)/components/intent-link";
import { joinPublicStudyGroup } from "@/app/(authenticated)/comunidade/actions";
import type { CommunitySpaceDirectoryItem } from "@/lib/community";

interface CommunitySpaceDirectoryCardProperties {
  readonly memberId: string;
  readonly space: CommunitySpaceDirectoryItem;
}

export const CommunitySpaceDirectoryCard = ({
  memberId,
  space,
}: CommunitySpaceDirectoryCardProperties) => {
  const membership = space.members[0];
  const isOwner = space.ownerId === memberId;
  const isMember = isOwner || Boolean(membership);
  let memberRole: string | null = null;
  if (isOwner || membership?.role === "OWNER") {
    memberRole = "Dono";
  } else if (membership) {
    memberRole = "Membro";
  }
  const groupHref = `/comunidade/grupos/${space.slug}`;

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-sm border border-border bg-background">
      <div className="relative aspect-[16/7] overflow-hidden bg-brand-structural/10">
        {space.coverUrl ? (
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="(min-width: 1280px) 360px, (min-width: 640px) 50vw, 100vw"
            src={space.coverUrl}
            unoptimized
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_72%_35%,rgba(143,19,57,0.24),transparent_34%),linear-gradient(125deg,rgba(143,19,57,0.12),rgba(74,0,46,0.04))] text-brand-structural"
          >
            <UsersIcon className="size-10 opacity-75" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex min-h-7 flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-muted-foreground">
            {space.visibility === "PUBLIC" ? (
              <GlobeIcon aria-hidden="true" className="size-3" />
            ) : (
              <LockKeyholeIcon aria-hidden="true" className="size-3" />
            )}
            {space.visibility === "PUBLIC" ? "Público" : "Privado"}
          </span>
          {memberRole ? (
            <span className="rounded-sm border border-brand-structural/40 px-2 py-1 text-brand-structural">
              {memberRole}
            </span>
          ) : null}
        </div>

        <h2 className="mt-3 min-w-0 font-display text-xl leading-tight [overflow-wrap:anywhere]">
          <Link className="hover:text-brand-structural" href={groupHref}>
            {space.title}
          </Link>
        </h2>
        {space.description ? (
          <p className="mt-2 line-clamp-2 min-h-10 text-muted-foreground text-sm leading-5">
            {space.description}
          </p>
        ) : (
          <p className="mt-2 min-h-10 text-muted-foreground text-sm leading-5">
            Sem descrição.
          </p>
        )}

        <p className="mt-4 inline-flex items-center gap-2 text-muted-foreground text-sm">
          <UsersIcon aria-hidden="true" className="size-4" />
          {space._count.members}{" "}
          {space._count.members === 1 ? "membro" : "membros"}
        </p>

        <div className="mt-5">
          {isMember ? (
            <Button asChild className="min-h-11 w-full" variant="outline">
              <Link href={groupHref}>Abrir grupo</Link>
            </Button>
          ) : (
            <form action={joinPublicStudyGroup}>
              <input name="groupId" type="hidden" value={space.id} />
              <Button className="min-h-11 w-full" type="submit">
                Entrar no grupo
              </Button>
            </form>
          )}
        </div>
      </div>
    </article>
  );
};
