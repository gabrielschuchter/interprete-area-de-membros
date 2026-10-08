import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { BadgeCheckIcon, ChevronRightIcon, XIcon } from "lucide-react";
import Image from "next/image";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { getAuth } from "@/lib/auth";
import { badgeArtworkByCriterion } from "@/lib/badge-artwork";
import { getOrCreateProfile, getProfileSummaryStats } from "@/lib/profile";
import { splitProfileBadges } from "@/lib/profile-badge-catalog";
import { profileCompletionItems } from "@/lib/profile-completion";
import { IntentLink as Link } from "../components/intent-link";
import { respondToStudyGroupInvitation } from "./actions";
import { ProfileLinkButton } from "./profile-link-button";

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
  const earnedBadgesForStrip = badgeCollections.earned.slice(0, 10);

  return (
    <div className="space-y-8">
      {filters.saved === "1" ? (
        <p
          aria-live="polite"
          className="border-brand-action border-l-2 bg-brand-action/10 px-4 py-3 text-sm"
        >
          Perfil atualizado.
        </p>
      ) : null}

      <section aria-labelledby="profile-completion-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="brand-eyebrow">Seu perfil</p>
            <h2
              className="mt-1 font-display text-3xl"
              id="profile-completion-heading"
            >
              Complete seu perfil
            </h2>
          </div>
          <p className="shrink-0 font-data text-muted-foreground text-sm">
            {completion.completedCount} <span aria-hidden="true">/</span>{" "}
            {completion.total}
            <span className="sr-only">
              {" "}
              itens completos de {completion.total}
            </span>
          </p>
        </div>
        <div
          aria-label={`Perfil ${completion.percentage}% completo`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={completion.percentage}
          className="mt-4 h-2 w-full bg-brand-pink-essence"
          role="progressbar"
        >
          <span
            className="block h-full bg-brand-dark-amaranth transition-[width] duration-200"
            style={{ width: `${completion.percentage}%` }}
          />
        </div>
        {missing.length > 0 ? (
          <p className="mt-3 text-muted-foreground text-sm">
            Faltam {missing.length} {missing.length === 1 ? "passo" : "passos"}{" "}
            para deixar seu perfil completo.
          </p>
        ) : (
          <p className="mt-3 text-muted-foreground text-sm">
            Seu perfil está completo.
          </p>
        )}

        <ul className="mt-5 hidden grid-cols-2 gap-x-8 md:grid">
          {completion.items.map((item) => (
            <li className="border-border border-b" key={item.field}>
              <Link
                className="flex min-h-[60px] items-center justify-between gap-3 text-sm hover:text-brand-dark-amaranth"
                href={`/perfil/editar#profile-${item.field}`}
              >
                <span>{item.label}</span>
                {item.complete ? (
                  <BadgeCheckIcon
                    aria-label="Completo"
                    className="size-4 shrink-0 text-brand-dark-amaranth"
                  />
                ) : (
                  <ChevronRightIcon
                    aria-label="Adicionar"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-5 md:hidden">
          {missing.length > 0 ? (
            <ul className="divide-y border-y">
              {missing.map((item) => (
                <li key={item.field}>
                  <Link
                    className="flex min-h-[60px] items-center justify-between gap-3 text-sm"
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
          ) : (
            <p className="border-y py-4 text-sm">
              Os oito itens do seu perfil estão completos.
            </p>
          )}
        </div>
      </section>

      <section
        aria-labelledby="overview-achievements-heading"
        className="border-border border-y py-5"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="brand-eyebrow">Reconhecimento</p>
            <h2
              className="mt-1 font-display text-2xl"
              id="overview-achievements-heading"
            >
              Conquistas
            </h2>
          </div>
          <Button
            asChild
            className="-mr-3 shadow-none"
            size="sm"
            variant="ghost"
          >
            <Link href="/perfil/conquistas">
              Ver todas <ChevronRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </div>
        {earnedBadgesForStrip.length > 0 ? (
          <ul
            aria-label="Medalhas conquistadas"
            className="mt-4 flex flex-wrap gap-3"
          >
            {earnedBadgesForStrip.map((badge) => (
              <li key={badge.id} title={badge.title}>
                <Image
                  alt={badge.title}
                  height={52}
                  loading="lazy"
                  src={badgeArtworkByCriterion[badge.criterion]}
                  width={52}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted-foreground text-sm">
            As conquistas aparecem aqui conforme você avança no percurso.
          </p>
        )}
      </section>

      <section aria-labelledby="profile-community-heading">
        <p className="brand-eyebrow">Comunidade</p>
        <h2
          className="mt-1 font-display text-2xl"
          id="profile-community-heading"
        >
          Seu espaço por aqui
        </h2>
        <ul className="mt-3 divide-y border-y">
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
                <span>Convites para grupos</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {pendingInvitations.length} pendentes
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
          <li className="flex min-h-[60px] items-center justify-between gap-3 text-sm">
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
            <ProfileLinkButton compact username={profile.username} />
          </li>
        </ul>
      </section>
    </div>
  );
};

export default ProfilePage;
