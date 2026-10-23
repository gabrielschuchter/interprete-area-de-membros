import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  ArchiveIcon,
  ArrowRightIcon,
  GlobeIcon,
  LockKeyholeIcon,
  PlusIcon,
  Settings2Icon,
  UsersRoundIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { joinPublicStudyGroup } from "@/app/(authenticated)/comunidade/actions";
import {
  removeStudyGroupMember,
  setStudyGroupArchived,
  setStudyGroupMemberRole,
  updateStudyGroup,
} from "@/app/(authenticated)/comunidade/group-management-actions";
import { CommunityDraftStarter } from "@/components/community/community-draft-starter";
import { CommunityFeedCard } from "@/components/community/community-feed-card";
import {
  CommunityGroupInvitationDialog,
  type GroupInvitationManagementSnapshot,
} from "@/components/community/community-group-invitation-dialog";
import { GroupCoverUpload } from "@/components/community/group-cover-upload";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import type {
  getCommunitySpace,
  getCommunitySpaceMembers,
} from "@/lib/community";

export type GroupView = "posts" | "members" | "about" | "settings";
export type CommunitySpaceSnapshot = NonNullable<
  Awaited<ReturnType<typeof getCommunitySpace>>
>;
export type CommunitySpaceMembersSnapshot = Awaited<
  ReturnType<typeof getCommunitySpaceMembers>
>;

const viewLabels: Readonly<Record<GroupView, string>> = {
  posts: "Publicações",
  members: "Membros",
  about: "Sobre",
  settings: "Configurações",
};

export const viewHref = (slug: string, view: GroupView) =>
  `/comunidade/grupos/${slug}${view === "posts" ? "" : `?view=${view}`}`;

export const CommunitySpaceHeader = ({
  canEditGroup,
  canPublish,
  isArchived,
  isMember,
  isModerator,
  space,
}: {
  readonly canEditGroup: boolean;
  readonly canPublish: boolean;
  readonly isArchived: boolean;
  readonly isMember: boolean;
  readonly isModerator: boolean;
  readonly space: CommunitySpaceSnapshot;
}) => (
  <header className="mt-4 overflow-hidden border border-border bg-background">
    {space.coverUrl ? (
      <div className="relative aspect-[16/5] max-h-[440px] min-h-36 w-full overflow-hidden bg-brand-structural/10 sm:aspect-[16/4]">
        <Image
          alt={`Capa do grupo ${space.title}`}
          className="object-cover"
          fill
          loading="eager"
          priority
          referrerPolicy="no-referrer"
          sizes="(max-width: 768px) 100vw, 1280px"
          src={space.coverUrl}
          unoptimized
        />
      </div>
    ) : (
      <div className="flex aspect-[16/5] max-h-[300px] min-h-36 items-center justify-center bg-[radial-gradient(circle_at_72%_35%,rgba(143,19,57,0.24),transparent_34%),linear-gradient(125deg,rgba(143,19,57,0.12),rgba(74,0,46,0.04))] text-brand-structural sm:aspect-[16/4]">
        <UsersRoundIcon aria-hidden="true" className="size-12 opacity-70" />
      </div>
    )}
    <div className="flex flex-col justify-between gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:p-9">
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <p className="brand-eyebrow">Grupo de estudo · /{space.slug}</p>
        <h1 className="mt-3 font-display text-4xl leading-[0.98] sm:text-5xl lg:text-6xl">
          {space.title}
        </h1>
        {space.description ? (
          <p className="mt-4 max-w-3xl text-muted-foreground leading-7">
            {space.description}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {space.visibility === "PRIVATE" ? (
              <LockKeyholeIcon aria-hidden="true" />
            ) : (
              <GlobeIcon aria-hidden="true" />
            )}
            {space.visibility === "PRIVATE" ? "Privado" : "Público"}
          </Badge>
          <Badge variant="secondary">
            {space._count.members}{" "}
            {space._count.members === 1 ? "membro" : "membros"}
          </Badge>
          {isModerator ? <Badge variant="outline">Moderador</Badge> : null}
          {space.commentsClosed ? (
            <Badge variant="outline">Comentários fechados</Badge>
          ) : null}
          {isArchived ? <Badge variant="destructive">Arquivado</Badge> : null}
        </div>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-wrap">
        {!isMember && space.visibility === "PUBLIC" && !isArchived ? (
          <SingleFlightForm action={joinPublicStudyGroup}>
            <input name="groupId" type="hidden" value={space.id} />
            <SingleFlightSubmit className="min-h-11 w-full sm:w-auto">
              Participar do grupo
            </SingleFlightSubmit>
          </SingleFlightForm>
        ) : null}
        {canPublish ? (
          <CommunityDraftStarter
            className="min-h-11 w-full sm:w-auto"
            returnTo={`/comunidade/grupos/${space.slug}`}
            spaceId={space.id}
          >
            <PlusIcon aria-hidden="true" /> Nova publicação
          </CommunityDraftStarter>
        ) : null}
        {canEditGroup ? (
          <Button
            asChild
            className="min-h-11 w-full sm:w-auto"
            variant="outline"
          >
            <Link href={viewHref(space.slug, "settings")}>
              <Settings2Icon aria-hidden="true" /> Configurações
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  </header>
);

export const CommunitySpaceTabs = ({
  canEditGroup,
  spaceSlug,
  view,
}: {
  readonly canEditGroup: boolean;
  readonly spaceSlug: string;
  readonly view: GroupView;
}) => (
  <>
    <nav aria-label="Seções do grupo" className="mt-6 hidden border-b sm:flex">
      {(Object.keys(viewLabels) as GroupView[])
        .filter((item) => item !== "settings" || canEditGroup)
        .map((item) => (
          <Link
            aria-current={view === item ? "page" : undefined}
            className={`-mb-px border-b-2 px-5 py-3 text-sm ${view === item ? "border-brand-structural font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            href={viewHref(spaceSlug, item)}
            key={item}
          >
            {viewLabels[item]}
          </Link>
        ))}
    </nav>
    <nav aria-label="Seções do grupo" className="mt-5 grid gap-3 sm:hidden">
      <MobileGroupLink
        href={viewHref(spaceSlug, "members")}
        icon={
          <UsersRoundIcon
            aria-hidden="true"
            className="size-4 text-brand-structural"
          />
        }
      >
        Membros
      </MobileGroupLink>
      <MobileGroupLink href={viewHref(spaceSlug, "about")}>
        Sobre o grupo
      </MobileGroupLink>
      {canEditGroup ? (
        <MobileGroupLink href={viewHref(spaceSlug, "settings")}>
          Configurações
        </MobileGroupLink>
      ) : null}
    </nav>
  </>
);

const MobileGroupLink = ({
  children,
  href,
  icon,
}: {
  readonly children: ReactNode;
  readonly href: string;
  readonly icon?: ReactNode;
}) => (
  <Link
    className="flex min-h-14 items-center justify-between border bg-background px-4 font-medium"
    href={href}
  >
    <span className="inline-flex items-center gap-3">
      {icon}
      {children}
    </span>
    <ArrowRightIcon
      aria-hidden="true"
      className="size-4 text-muted-foreground"
    />
  </Link>
);

export const CommunitySpacePostsView = ({
  invitationManagement,
  isOwner,
  isModerator,
  isStaff,
  memberId,
  space,
}: {
  readonly isOwner: boolean;
  readonly isModerator: boolean;
  readonly isStaff: boolean;
  readonly memberId: string;
  readonly invitationManagement: GroupInvitationManagementSnapshot | null;
  readonly space: CommunitySpaceSnapshot;
}) => (
  <div className="mt-7 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
    <section
      aria-labelledby="posts-heading"
      className="order-2 min-w-0 lg:order-1"
    >
      <div className="flex items-end justify-between border-border border-b pb-3">
        <h2 className="font-display text-3xl" id="posts-heading">
          Publicações
        </h2>
        <span className="font-data text-muted-foreground text-xs">
          Página {space.page}
        </span>
      </div>
      {space.posts.length === 0 ? (
        <div className="mt-5 border border-dashed p-7 sm:p-9">
          <p className="font-display text-2xl">A conversa começa aqui.</p>
          <p className="mt-2 text-muted-foreground">
            Este grupo ainda não tem publicações.
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y border-border border-y">
          {space.posts.map((post) => (
            <CommunityFeedCard
              key={post.id}
              post={post}
              returnTo={`/comunidade/grupos/${space.slug}?page=${space.page}`}
              spaceSlug={space.slug}
            />
          ))}
        </div>
      )}
      <CommunityPostPagination space={space} />
    </section>
    <aside className="order-1 space-y-5 lg:order-2">
      <section className="border p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Sobre</h2>
          <Link
            className="text-brand-structural text-sm hover:underline"
            href={viewHref(space.slug, "about")}
          >
            Ver tudo
          </Link>
        </div>
        <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-muted-foreground text-sm leading-6">
          {space.details ||
            space.description ||
            "Este grupo ainda não adicionou informações."}
        </p>
        <div className="mt-5 border-t pt-4 text-muted-foreground text-sm">
          {space.visibility === "PRIVATE" ? "Grupo privado" : "Grupo público"} ·{" "}
          {space._count.members} membros
        </div>
      </section>
      <section className="border p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Membros</h2>
          <Link
            className="text-brand-structural text-sm hover:underline"
            href={viewHref(space.slug, "members")}
          >
            Ver todos
          </Link>
        </div>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          {space._count.members} pessoas fazem parte deste grupo.
        </p>
        {invitationManagement && (isOwner || isModerator || isStaff) ? (
          <CommunityGroupInvitationDialog
            groupId={space.id}
            groupName={space.title}
            management={invitationManagement}
            memberId={memberId}
          />
        ) : null}
      </section>
    </aside>
  </div>
);

const CommunityPostPagination = ({
  space,
}: {
  readonly space: CommunitySpaceSnapshot;
}) =>
  space.page > 1 || space.hasMorePosts ? (
    <nav
      aria-label="Paginação do grupo"
      className="mt-8 flex justify-between gap-3"
    >
      {space.page > 1 ? (
        <Button asChild variant="outline">
          <Link
            href={`/comunidade/grupos/${space.slug}?page=${space.page - 1}`}
          >
            Anterior
          </Link>
        </Button>
      ) : (
        <span />
      )}
      {space.hasMorePosts ? (
        <Button asChild variant="outline">
          <Link
            href={`/comunidade/grupos/${space.slug}?page=${space.page + 1}`}
          >
            Mais publicações <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </nav>
  ) : null;

export const CommunitySpaceMembersView = ({
  invitationManagement,
  isOwner,
  isModerator,
  isStaff,
  listing,
  memberId,
  space,
}: {
  readonly isOwner: boolean;
  readonly isModerator: boolean;
  readonly isStaff: boolean;
  readonly listing: CommunitySpaceMembersSnapshot;
  readonly memberId: string;
  readonly space: CommunitySpaceSnapshot;
  readonly invitationManagement: GroupInvitationManagementSnapshot | null;
}) => (
  <section aria-labelledby="members-heading" className="mt-8">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div>
        <p className="brand-eyebrow">Comunidade · grupo</p>
        <h2 className="mt-2 font-display text-3xl" id="members-heading">
          Membros{" "}
          <span className="font-data text-lg text-muted-foreground">
            {space._count.members}
          </span>
        </h2>
      </div>
      {invitationManagement && (isOwner || isModerator || isStaff) ? (
        <CommunityGroupInvitationDialog
          groupId={space.id}
          groupName={space.title}
          management={invitationManagement}
          memberId={memberId}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          Proprietários e moderadores ajudam a cuidar do espaço.
        </p>
      )}
    </div>
    <ul className="mt-4 grid gap-2">
      {listing.members.map((membership) => (
        <GroupMemberRow
          isModerator={isModerator}
          isOwner={isOwner}
          key={membership.id}
          membership={membership}
          spaceId={space.id}
        />
      ))}
    </ul>
    {listing.hasMore ? (
      <div className="mt-5 flex justify-end">
        <Button asChild variant="outline">
          <Link
            href={`/comunidade/grupos/${space.slug}?view=members&memberPage=${listing.page + 1}`}
          >
            Ver mais membros <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </div>
    ) : null}
  </section>
);

const groupRoleLabel = (role: string) => {
  if (role === "OWNER") {
    return "Proprietário";
  }
  if (role === "MODERATOR") {
    return "Moderador";
  }
  return "Membro";
};

const GroupMemberRow = ({
  isOwner,
  isModerator,
  membership,
  spaceId,
}: {
  readonly isOwner: boolean;
  readonly isModerator: boolean;
  readonly membership: CommunitySpaceMembersSnapshot["members"][number];
  readonly spaceId: string;
}) => {
  const displayName = membership.member.displayName || "Membro da comunidade";
  const editable =
    (isOwner && membership.role !== "OWNER") ||
    (isModerator && membership.role === "MEMBER");
  return (
    <li className="flex flex-col gap-4 border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <MemberAvatar
          displayName={displayName}
          src={membership.member.avatarUrl}
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{displayName}</p>
          <p className="mt-2 inline-flex rounded-full border px-2 py-1 text-muted-foreground text-xs">
            {groupRoleLabel(membership.role)}
          </p>
        </div>
      </div>
      {editable ? (
        <GroupMemberControls
          displayName={displayName}
          identityRole={membership.member.role}
          isModerator={isModerator}
          isOwner={isOwner}
          memberId={membership.memberId}
          role={membership.role}
          spaceId={spaceId}
        />
      ) : null}
    </li>
  );
};

const MemberAvatar = ({
  displayName,
  src,
}: {
  readonly displayName: string;
  readonly src: string | null;
}) =>
  src ? (
    <Image
      alt=""
      className="size-11 rounded-full object-cover"
      height={44}
      src={src}
      unoptimized
      width={44}
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-structural/10 font-display text-brand-structural text-lg"
    >
      {displayName.slice(0, 1).toLocaleUpperCase()}
    </span>
  );

const GroupMemberControls = ({
  displayName,
  identityRole,
  isModerator,
  isOwner,
  memberId,
  role,
  spaceId,
}: {
  readonly displayName: string;
  readonly identityRole: string;
  readonly isModerator: boolean;
  readonly isOwner: boolean;
  readonly memberId: string;
  readonly role: string;
  readonly spaceId: string;
}) => (
  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
    {isOwner && identityRole === "MEMBER" ? (
      <SingleFlightForm
        action={setStudyGroupMemberRole}
        className="flex flex-1 items-center gap-2 sm:flex-none"
      >
        <input name="groupId" type="hidden" value={spaceId} />
        <input name="memberId" type="hidden" value={memberId} />
        <label className="sr-only" htmlFor={`role-${memberId}`}>
          Papel de {displayName}
        </label>
        <select
          className="h-10 min-w-32 rounded-sm border bg-background px-2 text-sm"
          defaultValue={role}
          id={`role-${memberId}`}
          name="role"
        >
          <option value="MEMBER">Membro</option>
          <option value="MODERATOR">Moderador</option>
        </select>
        <SingleFlightSubmit size="sm" variant="outline">
          Salvar
        </SingleFlightSubmit>
      </SingleFlightForm>
    ) : null}
    {isOwner || (isModerator && role === "MEMBER") ? (
      <SingleFlightForm action={removeStudyGroupMember}>
        <input name="groupId" type="hidden" value={spaceId} />
        <input name="memberId" type="hidden" value={memberId} />
        <SingleFlightSubmit size="sm" variant="ghost">
          Remover
        </SingleFlightSubmit>
      </SingleFlightForm>
    ) : null}
  </div>
);

export const CommunitySpaceAboutView = ({
  space,
}: {
  readonly space: CommunitySpaceSnapshot;
}) => (
  <section
    aria-labelledby="about-heading"
    className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(270px,0.8fr)]"
  >
    <div className="border p-5 sm:p-8">
      <p className="brand-eyebrow">Grupo de estudo</p>
      <h2 className="mt-2 font-display text-3xl" id="about-heading">
        Sobre o grupo
      </h2>
      <p className="mt-5 text-muted-foreground leading-7">
        {space.description || "Este grupo ainda não adicionou uma descrição."}
      </p>
      <div className="mt-6 whitespace-pre-wrap border-t pt-6 text-muted-foreground leading-7">
        {space.details ||
          "Mais informações sobre este grupo serão adicionadas em breve."}
      </div>
    </div>
    <aside className="h-fit border p-5 sm:p-6">
      <h3 className="font-display text-2xl">Informações</h3>
      <dl className="mt-4 divide-y text-sm">
        <div className="flex justify-between gap-3 py-3">
          <dt className="text-muted-foreground">Privacidade</dt>
          <dd>{space.visibility === "PRIVATE" ? "Privado" : "Público"}</dd>
        </div>
        <div className="flex justify-between gap-3 py-3">
          <dt className="text-muted-foreground">Membros</dt>
          <dd>{space._count.members}</dd>
        </div>
        <div className="flex justify-between gap-3 py-3">
          <dt className="text-muted-foreground">Publicações</dt>
          <dd>{space._count.posts}</dd>
        </div>
      </dl>
    </aside>
  </section>
);

export const CommunitySpaceSettingsView = ({
  isArchived,
  isModerator,
  isOwner,
  space,
}: {
  readonly isArchived: boolean;
  readonly isModerator: boolean;
  readonly isOwner: boolean;
  readonly space: CommunitySpaceSnapshot;
}) => (
  <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
    {isArchived ? (
      <div className="flex items-start gap-3 border bg-muted/20 p-5 sm:p-8">
        <ArchiveIcon
          aria-hidden="true"
          className="mt-1 size-5 shrink-0 text-muted-foreground"
        />
        <div>
          <h2 className="font-display text-2xl">Configurações preservadas</h2>
          <p className="mt-2 text-muted-foreground text-sm leading-6">
            Restaure o grupo para alterar nome, descrição, capa, comentários ou
            privacidade.
          </p>
        </div>
      </div>
    ) : (
      <GroupEditForm isOwner={isOwner} space={space} />
    )}
    <aside className="space-y-5">
      <GroupPermissionSummary
        isArchived={isArchived}
        isModerator={isModerator}
        isOwner={isOwner}
      />
      {isOwner ? (
        <GroupArchivePanel isArchived={isArchived} spaceId={space.id} />
      ) : null}
      {isArchived ? (
        <p className="border bg-muted/20 p-5 text-muted-foreground text-sm">
          Este grupo está arquivado. Somente você e a equipe podem abrir esta
          página até que seja restaurado.
        </p>
      ) : null}
    </aside>
  </section>
);

const GroupEditForm = ({
  isOwner,
  space,
}: {
  readonly isOwner: boolean;
  readonly space: CommunitySpaceSnapshot;
}) => (
  <div className="border p-5 sm:p-8">
    <p className="brand-eyebrow">Administração do grupo</p>
    <h2 className="mt-2 font-display text-3xl">Configurações</h2>
    <SingleFlightForm action={updateStudyGroup} className="mt-6 space-y-6">
      <input name="groupId" type="hidden" value={space.id} />
      <label className="block" htmlFor="group-title">
        <span className="font-medium text-sm">Nome do grupo</span>
        <Input
          className="mt-2"
          defaultValue={space.title}
          id="group-title"
          maxLength={80}
          minLength={3}
          name="title"
          required
        />
      </label>
      <label className="block" htmlFor="group-description">
        <span className="font-medium text-sm">Descrição curta</span>
        <Textarea
          className="mt-2 min-h-24"
          defaultValue={space.description ?? ""}
          id="group-description"
          maxLength={500}
          name="description"
        />
      </label>
      <label className="block" htmlFor="group-details">
        <span className="font-medium text-sm">Sobre o grupo</span>
        <Textarea
          className="mt-2 min-h-36"
          defaultValue={space.details ?? ""}
          id="group-details"
          maxLength={2400}
          name="details"
        />
      </label>
      <GroupCoverUpload initialUrl={space.coverUrl} />
      {isOwner ? <GroupPrivacyField visibility={space.visibility} /> : null}
      <label className="flex items-start gap-3 border-t pt-5">
        <input
          className="mt-1 size-4 accent-brand-structural"
          defaultChecked={!space.commentsClosed}
          name="commentsOpen"
          type="checkbox"
          value="on"
        />
        <span>
          <span className="font-medium text-sm">Permitir comentários</span>
          <span className="mt-1 block text-muted-foreground text-xs">
            Quando desativado, as publicações continuam visíveis e os
            comentários existentes são preservados.
          </span>
        </span>
      </label>
      <div className="flex justify-end border-t pt-5">
        <SingleFlightSubmit pendingLabel="Salvando…">
          Salvar alterações
        </SingleFlightSubmit>
      </div>
    </SingleFlightForm>
  </div>
);

const GroupPrivacyField = ({ visibility }: { readonly visibility: string }) => (
  <label className="block" htmlFor="group-visibility">
    <span className="font-medium text-sm">Privacidade</span>
    <select
      className="mt-2 h-11 w-full rounded-sm border bg-background px-3 text-sm"
      defaultValue={visibility}
      id="group-visibility"
      name="visibility"
    >
      <option value="PUBLIC">Público · qualquer membro pode encontrar</option>
      <option value="PRIVATE">Privado · só membros podem acessar</option>
    </select>
    <span className="mt-2 block text-muted-foreground text-xs">
      A mudança não altera nem remove membros atuais.
    </span>
  </label>
);

const GroupPermissionSummary = ({
  isArchived,
  isModerator,
  isOwner,
}: {
  readonly isArchived: boolean;
  readonly isModerator: boolean;
  readonly isOwner: boolean;
}) => {
  let summary =
    "A equipe acessa este grupo para suporte e moderação. Toda visita a grupos privados é registrada.";
  if (isOwner) {
    summary =
      "Você é responsável pelas configurações sensíveis e pelos papéis de participante.";
  } else if (isModerator) {
    summary =
      "Você pode editar nome, descrição, Sobre, capa e comentários. Privacidade, participantes e arquivamento ficam sob responsabilidade do proprietário.";
  }
  return (
    <div className="border p-5 sm:p-6">
      <h3 className="font-display text-2xl">
        {isArchived ? "Grupo arquivado" : "Seu papel"}
      </h3>
      <p className="mt-3 text-muted-foreground text-sm leading-6">{summary}</p>
    </div>
  );
};

const GroupArchivePanel = ({
  isArchived,
  spaceId,
}: {
  readonly isArchived: boolean;
  readonly spaceId: string;
}) => (
  <div className="border border-destructive/40 p-5 sm:p-6">
    <div className="flex items-center gap-2 text-destructive">
      <ArchiveIcon aria-hidden="true" className="size-4" />
      <h3 className="font-medium">
        {isArchived ? "Restaurar grupo" : "Arquivar grupo"}
      </h3>
    </div>
    <p className="mt-3 text-muted-foreground text-sm leading-6">
      O histórico, as publicações, os membros e a privacidade serão preservados.
      Você pode reabrir o grupo quando quiser.
    </p>
    <SingleFlightForm action={setStudyGroupArchived} className="mt-4">
      <input name="groupId" type="hidden" value={spaceId} />
      <input
        name="status"
        type="hidden"
        value={isArchived ? "PUBLISHED" : "ARCHIVED"}
      />
      <SingleFlightSubmit
        className="w-full"
        pendingLabel={isArchived ? "Restaurando…" : "Arquivando…"}
        variant={isArchived ? "default" : "destructive"}
      >
        {isArchived ? "Restaurar grupo" : "Arquivar grupo"}
      </SingleFlightSubmit>
    </SingleFlightForm>
  </div>
);
