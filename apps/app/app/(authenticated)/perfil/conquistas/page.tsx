import { BadgeCriterion, database } from "@repo/database";
import { BadgeCheckIcon } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { badgeArtworkByCriterion } from "@/lib/badge-artwork";
import { getMemberBadgeProgress } from "@/lib/badges";

const categoryForCriterion: Record<
  BadgeCriterion,
  "Estudo" | "Prática" | "Comunidade"
> = {
  [BadgeCriterion.STUDY_MINUTES]: "Estudo",
  [BadgeCriterion.STUDY_STREAK_DAYS]: "Estudo",
  [BadgeCriterion.STUDY_GOALS_MET]: "Prática",
  [BadgeCriterion.EXERCISE_ANSWERS]: "Prática",
  [BadgeCriterion.ACTIVITIES_COMPLETED]: "Prática",
  [BadgeCriterion.COMMUNITY_PUBLICATIONS]: "Comunidade",
  [BadgeCriterion.LESSONS_COMPLETED]: "Estudo",
  [BadgeCriterion.TASKS_COMPLETED]: "Prática",
  [BadgeCriterion.LEARNING_PATHS_COMPLETED]: "Estudo",
  [BadgeCriterion.MEETINGS_ATTENDED]: "Comunidade",
};

const categories = ["Estudo", "Prática", "Comunidade"] as const;

const formatProgress = (
  criterion: BadgeCriterion,
  value: number,
  threshold: number
) => {
  if (criterion === BadgeCriterion.STUDY_MINUTES) {
    const formatMinutes = (minutes: number) =>
      minutes >= 60
        ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
        : `${minutes} min`;
    return `${formatMinutes(value)} de ${formatMinutes(threshold)}`;
  }
  if (criterion === BadgeCriterion.STUDY_STREAK_DAYS) {
    return `${value} de ${threshold} ${threshold === 1 ? "dia" : "dias"}`;
  }
  return `${value} de ${threshold}`;
};

const AchievementsPage = async () => {
  const { userId } = await getAuth();
  if (!userId) {
    redirect("/sign-in");
  }

  const [definitions, awards] = await Promise.all([
    database.badgeDefinition.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ criterion: "asc" }, { threshold: "asc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        criterion: true,
        threshold: true,
      },
    }),
    database.badgeAward.findMany({
      where: {
        memberId: userId,
        badge: { is: { status: { in: ["PUBLISHED", "ARCHIVED"] } } },
      },
      orderBy: { awardedAt: "desc" },
      take: 100,
      select: { badgeId: true, awardedAt: true },
    }),
  ]);

  const progress = await getMemberBadgeProgress(
    userId,
    definitions.map(({ criterion }) => criterion)
  );
  const awardsByBadge = new Map(awards.map((award) => [award.badgeId, award]));
  const earnedCount = definitions.filter(({ id }) =>
    awardsByBadge.has(id)
  ).length;

  return (
    <div>
      <header>
        <p className="brand-eyebrow">Seu percurso</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl md:text-4xl">Conquistas</h2>
          <p className="font-data text-muted-foreground text-sm">
            {earnedCount} de {definitions.length}
          </p>
        </div>
        <div
          aria-label={`${earnedCount} de ${definitions.length} conquistas recebidas`}
          aria-valuemax={definitions.length || 1}
          aria-valuemin={0}
          aria-valuenow={earnedCount}
          className="mt-4 h-2 bg-brand-pink-essence"
          role="progressbar"
        >
          <span
            className="block h-full bg-brand-dark-amaranth transition-[width] duration-200"
            style={{
              width: `${definitions.length ? (earnedCount / definitions.length) * 100 : 0}%`,
            }}
          />
        </div>
        <p className="mt-3 text-muted-foreground text-sm">
          Medalhas conquistadas acompanham atividades registradas no seu
          percurso.
        </p>
      </header>

      {definitions.length === 0 ? (
        <p className="mt-8 border-y py-5 text-muted-foreground text-sm">
          Nenhuma conquista está publicada no momento.
        </p>
      ) : (
        categories.map((category) => {
          const categoryBadges = definitions.filter(
            ({ criterion }) => categoryForCriterion[criterion] === category
          );
          if (categoryBadges.length === 0) {
            return null;
          }
          return (
            <section
              aria-labelledby={`category-${category}`}
              className="mt-8"
              key={category}
            >
              <div className="flex items-baseline justify-between border-border border-b pb-2">
                <h3
                  className="font-display text-2xl"
                  id={`category-${category}`}
                >
                  {category}
                </h3>
                <span className="font-data text-muted-foreground text-xs">
                  {categoryBadges.length}
                </span>
              </div>
              <ul className="divide-y">
                {categoryBadges.map((badge) => {
                  const award = awardsByBadge.get(badge.id);
                  const current = progress[badge.criterion] ?? 0;
                  const reached = Boolean(award);
                  return (
                    <li className="flex gap-4 py-4 sm:gap-5" key={badge.id}>
                      <span
                        aria-hidden="true"
                        className="flex size-14 shrink-0 items-center justify-center"
                      >
                        <Image
                          alt=""
                          className={
                            reached
                              ? "size-full object-contain"
                              : "size-full object-contain grayscale"
                          }
                          height={56}
                          loading="lazy"
                          src={badgeArtworkByCriterion[badge.criterion]}
                          width={56}
                        />
                      </span>
                      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-5">
                        <div className="min-w-0">
                          <h4 className="font-medium text-sm">{badge.title}</h4>
                          <p className="mt-1 max-w-xl text-muted-foreground text-xs leading-5">
                            {badge.description}
                          </p>
                        </div>
                        <div className="mt-2 shrink-0 text-xs sm:mt-0 sm:text-right">
                          {reached ? (
                            <p className="inline-flex items-center gap-1.5 text-brand-dark-amaranth">
                              <BadgeCheckIcon
                                aria-hidden="true"
                                className="size-4"
                              />{" "}
                              Conquistada
                            </p>
                          ) : (
                            <p className="text-muted-foreground">
                              {formatProgress(
                                badge.criterion,
                                current,
                                badge.threshold
                              )}
                            </p>
                          )}
                          {award ? (
                            <time
                              className="mt-1 block text-muted-foreground"
                              dateTime={award.awardedAt.toISOString()}
                            >
                              {new Intl.DateTimeFormat("pt-BR", {
                                dateStyle: "medium",
                                timeZone: "America/Sao_Paulo",
                              }).format(award.awardedAt)}
                            </time>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
};

export default AchievementsPage;
