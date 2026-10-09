import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import {
  BadgeCheckIcon,
  ChevronRightIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { ProfileBadgeIcon } from "@/components/profile/profile-badge-icon";
import { getAuth } from "@/lib/auth";
import { getOrCreateProfile, getProfileSummaryStats } from "@/lib/profile";
import {
  orderProfileBadges,
  splitProfileBadges,
} from "@/lib/profile-badge-catalog";
import { profileCompletionItems } from "@/lib/profile-completion";
import { IntentLink as Link } from "../components/intent-link";
import { respondToStudyGroupInvitation } from "./actions";

interface ProfilePageProperties {
  readonly searchParams: Promise<{ saved?: string }>;
}

const ProfilePage = async ({ searchParams }: ProfilePageProperties) => {
  const [{ userId }, filters] = await Promise.all([getAuth(), searchParams]);
  if (!userId) {
    return null;
  }

  const [
    profile,
    stats,
    pendingInvitations,
    earnedBadges,
    publishedBadgeDefinitions,
  ] = await Promise.all([
    getOrCreateProfile(userId),
    getProfileSummaryStats(userId),
    database.communitySpaceInvitation.findMany({
      where: {
        inviteeId: userId,
        status: "PENDING",
        space: { is: { status: "PUBLISHED" } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        inviter: {
          select: {
            displayName: true,
            profile: { select: { displayName: true, username: true } },
          },
        },
        space: { select: { title: true, slug: true, description: true } },
      },
    }),
    database.badgeAward.findMany({
      where: {
        memberId: userId,
        badge: { is: { status: { in: ["PUBLISHED", "ARCHIVED"] } } },
      },
      orderBy: { awardedAt: "desc" },
      take: 100,
      select: {
        id: true,
        badgeId: true,
        awardedAt: true,
        definitionRevision: {
          select: { title: true, description: true, criterion: true },
        },
      },
    }),
    database.badgeDefinition.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ criterion: "asc" }, { threshold: "asc" }],
      take: 200,
      select: { id: true, title: true, description: true, criterion: true },
    }),
  ]);

  if (!profile) {
    return null;
  }

  const completion = profileCompletionItems(profile);
  const missing = completion.items.filter(({ complete }) => !complete);
  const badgeCollections = splitProfileBadges(
    earnedBadges,
    publishedBadgeDefinitions
  );
  const overviewBadges = orderProfileBadges(
    [...badgeCollections.earned, ...badgeCollections.available].filter(
      (badge, index, badges) =>
        badges.findIndex(({ criterion }) => criterion === badge.criterion) ===
        index
    )
  ).slice(0, 10);
  const earnedBadgeCriteria = new Set(
    badgeCollections.earned.map(({ criterion }) => criterion)
  );
  const earnedCriteriaCount = earnedBadgeCriteria.size;
  let pendingInvitationsLabel = `${pendingInvitations.length} pendentes`;
  if (pendingInvitations.length === 1) {
    pendingInvitationsLabel = "1 pendente";
  }
  const completedLabels = completion.items
    .filter(({ complete }) => complete)
    .map(({ label }) => label.toLocaleLowerCase("pt-BR"));

  return (
    <div className="profile-overview-content">
      {filters.saved === "1" ? (
        <p
          aria-live="polite"
          className="border-brand-action border-l-2 bg-brand-action/10 px-4 py-3 text-sm"
        >
          Perfil atualizado.
        </p>
      ) : null}

      <section
        aria-labelledby="profile-completion-heading"
        className="profile-completion-card rounded-lg border border-border bg-white p-5 sm:p-6 md:p-8"
      >
        <div className="flex items-end justify-between gap-4">
          <h2
            className="font-display text-xl leading-tight md:text-2xl"
            id="profile-completion-heading"
          >
            {missing.length > 0 ? (
              <>
                Faltam{" "}
                <span className="profile-completion-underline">
                  {missing.length} {missing.length === 1 ? "passo" : "passos"}
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="8"
                    preserveAspectRatio="none"
                    viewBox="0 0 86 8"
                    width="110"
                  >
                    <path
                      d="M2 5.2C14 2.4 26 6 40 3.9C54 1.9 68 5.6 84 2.8"
                      stroke="#D62839"
                      strokeLinecap="round"
                      strokeWidth="2"
                    />
                  </svg>
                </span>
                .
              </>
            ) : (
              "Perfil completo."
            )}
          </h2>
          <p className="shrink-0 font-data text-[0.68rem] text-muted-foreground uppercase tracking-[0.12em]">
            {completion.completedCount} DE {completion.total}
            <span className="sr-only">
              {" "}
              itens completos de {completion.total}
            </span>
          </p>
        </div>
        <div
          aria-label={`${completion.completedCount} de ${completion.total} itens do perfil completos`}
          aria-valuemax={completion.total}
          aria-valuemin={0}
          aria-valuenow={completion.completedCount}
          className="mt-4 grid grid-cols-8 gap-1"
          role="progressbar"
        >
          {completion.items.map((item) => (
            <span
              aria-hidden="true"
              className={`h-[6px] rounded-full ${item.complete ? "bg-brand-structural" : "bg-border"}`}
              key={item.field}
            />
          ))}
        </div>
        <p className="mt-4 text-[15px] text-muted-foreground leading-6">
          Um perfil completo ajuda colegas e professores a reconhecer você.
        </p>

        <ul className="profile-completion-items mt-5 hidden grid-cols-2 gap-x-8 md:grid">
          {completion.items.map((item) => (
            <li className="border-border border-b" key={item.field}>
              <Link
                className="flex min-h-11 items-center justify-between gap-3 text-[15px] hover:text-brand-structural focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={`/perfil/editar#profile-${item.field}`}
              >
                <span className={item.complete ? "text-muted-foreground" : ""}>
                  {item.label}
                </span>
                {item.complete ? (
                  <BadgeCheckIcon
                    aria-label="Completo"
                    className="size-4 shrink-0 fill-brand-structural text-white"
                  />
                ) : (
                  <PlusIcon
                    aria-label="Adicionar"
                    className="size-4 shrink-0 text-brand-structural"
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-5 md:hidden">
          {missing.length > 0 ? (
            <ul className="profile-completion-items divide-y border-t">
              {missing.map((item) => (
                <li key={item.field}>
                  <Link
                    className="flex min-h-11 items-center justify-between gap-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={`/perfil/editar#profile-${item.field}`}
                  >
                    {item.label}
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 flex items-start gap-2 border-border border-t pt-4 text-muted-foreground text-xs leading-5">
            <BadgeCheckIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 fill-brand-structural text-white"
            />
            <span>
              Concluídos:{" "}
              {completedLabels.length > 0
                ? completedLabels.join(", ")
                : "nenhum item"}
            </span>
          </p>
        </div>
      </section>

      <section
        aria-labelledby="overview-achievements-heading"
        className="profile-overview-achievements"
      >
        <div className="flex items-end justify-between gap-4">
          <h2
            className="profile-overview-achievements__title font-display"
            id="overview-achievements-heading"
          >
            Conquistas
          </h2>
          <div className="flex items-center gap-3">
            <span className="profile-overview-achievements__count font-data text-[0.68rem] text-muted-foreground uppercase tracking-[0.12em]">
              {earnedCriteriaCount} DE {overviewBadges.length}
            </span>
            <Button
              asChild
              className="-mr-3 shadow-none"
              size="sm"
              variant="ghost"
            >
              <Link
                className="profile-overview-achievements__link"
                href="/perfil/conquistas"
              >
                <span className="profile-overview-achievements__link-label">
                  Ver todas
                </span>
                <ChevronRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
        {overviewBadges.length > 0 ? (
          <ul
            aria-label="Conquistas e progresso"
            className="mt-5 hidden flex-wrap gap-2.5 md:flex"
          >
            {overviewBadges.map((badge) => {
              const earned = badgeCollections.earned.some(
                ({ criterion }) => criterion === badge.criterion
              );
              return (
                <li
                  key={badge.criterion}
                  title={`${badge.title}${earned ? " · conquistada" : " · em aberto"}`}
                >
                  <ProfileBadgeIcon
                    criterion={badge.criterion}
                    earned={earned}
                    size="small"
                  />
                  <span className="sr-only">
                    {badge.title} · {earned ? "conquistada" : "em aberto"}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-muted-foreground text-sm">
            Nenhuma conquista publicada ainda.
          </p>
        )}
      </section>

      <section
        aria-labelledby="profile-community-heading"
        className="profile-community-section"
      >
        <h2
          className="profile-community-section__title font-display"
          id="profile-community-heading"
        >
          Comunidade
        </h2>
        <ul className="profile-community-section__list mt-3 divide-y border-y">
          <li>
            <Link
              className="flex min-h-[60px] items-center justify-between gap-3 text-sm"
              href="/comunidade/meus-topicos"
            >
              <span>Meus tópicos</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                {stats.topicCount}
                <ChevronRightIcon aria-hidden="true" className="size-4" />
              </span>
            </Link>
          </li>
          <li>
            <details className="group">
              <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-3 text-sm [&::-webkit-details-marker]:hidden">
                <span>
                  Convites para grupos
                  <span className="hidden md:inline"> de estudo</span>
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {pendingInvitations.length === 0 ? (
                    <>
                      <span className="hidden md:inline">Nenhum pendente</span>
                      <span className="md:hidden">Nenhum</span>
                    </>
                  ) : (
                    pendingInvitationsLabel
                  )}
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="size-4 transition-transform group-open:rotate-90"
                  />
                </span>
              </summary>
              {pendingInvitations.length > 0 ? (
                <ul className="divide-y border-t">
                  {pendingInvitations.map((invitation) => (
                    <li className="py-4" key={invitation.id}>
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0">
                          <Link
                            className="font-medium hover:underline"
                            href={`/comunidade/${invitation.space.slug}`}
                          >
                            {invitation.space.title}
                          </Link>
                          <p className="mt-1 text-muted-foreground text-xs">
                            Convite de{" "}
                            {invitation.inviter?.profile?.displayName ??
                              invitation.inviter?.displayName ??
                              invitation.inviter?.profile?.username ??
                              "membro"}
                          </p>
                          {invitation.space.description ? (
                            <p className="mt-2 text-muted-foreground text-sm">
                              {invitation.space.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <SingleFlightForm
                            action={respondToStudyGroupInvitation}
                          >
                            <input
                              name="invitationId"
                              type="hidden"
                              value={invitation.id}
                            />
                            <input
                              name="response"
                              type="hidden"
                              value="ACCEPTED"
                            />
                            <SingleFlightSubmit>Aceitar</SingleFlightSubmit>
                          </SingleFlightForm>
                          <SingleFlightForm
                            action={respondToStudyGroupInvitation}
                          >
                            <input
                              name="invitationId"
                              type="hidden"
                              value={invitation.id}
                            />
                            <input
                              name="response"
                              type="hidden"
                              value="DECLINED"
                            />
                            <SingleFlightSubmit variant="outline">
                              <XIcon aria-hidden="true" /> Recusar
                            </SingleFlightSubmit>
                          </SingleFlightForm>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-t py-4 text-muted-foreground text-sm">
                  Você não tem convites pendentes.
                </p>
              )}
            </details>
          </li>
          <li>
            <Link
              className="flex min-h-[60px] items-center justify-between gap-3 text-sm"
              href="/membros"
            >
              <span>Explorar membros</span>
              <ChevronRightIcon
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
            </Link>
          </li>
          <li className="flex min-h-[60px] items-center justify-between gap-3 text-sm md:hidden">
            <Link
              className="flex min-h-[60px] flex-1 items-center justify-between"
              href={`/membros/${profile.username}`}
            >
              <span>Perfil público</span>
              <ChevronRightIcon
                aria-hidden="true"
                className="mr-2 size-4 text-muted-foreground"
              />
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default ProfilePage;
