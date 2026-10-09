import { BadgeCriterion, database } from "@repo/database";
import { BadgeCheckIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { ProfileBadgeIcon } from "@/components/profile/profile-badge-icon";
import { getAuth } from "@/lib/auth";
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
const criterionOrder = [
  BadgeCriterion.STUDY_MINUTES,
  BadgeCriterion.STUDY_STREAK_DAYS,
  BadgeCriterion.LESSONS_COMPLETED,
  BadgeCriterion.LEARNING_PATHS_COMPLETED,
  BadgeCriterion.EXERCISE_ANSWERS,
  BadgeCriterion.ACTIVITIES_COMPLETED,
  BadgeCriterion.TASKS_COMPLETED,
  BadgeCriterion.STUDY_GOALS_MET,
  BadgeCriterion.COMMUNITY_PUBLICATIONS,
  BadgeCriterion.MEETINGS_ATTENDED,
] satisfies readonly BadgeCriterion[];

const formatProgress = (
  criterion: BadgeCriterion,
  value: number,
  threshold: number
) => {
  if (criterion === BadgeCriterion.STUDY_MINUTES) {
    const formatMinutes = (minutes: number) =>
      minutes >= 60 || minutes === 0
        ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
        : `${minutes} min`;
    return `${formatMinutes(value)} de ${formatMinutes(threshold)}`.toLocaleUpperCase(
      "pt-BR"
    );
  }
  if (criterion === BadgeCriterion.STUDY_STREAK_DAYS) {
    return `${value} de ${threshold} ${threshold === 1 ? "dia" : "dias"}`.toLocaleUpperCase(
      "pt-BR"
    );
  }
  const units: Partial<Record<BadgeCriterion, readonly [string, string]>> = {
    [BadgeCriterion.ACTIVITIES_COMPLETED]: ["atividade", "atividades"],
    [BadgeCriterion.COMMUNITY_PUBLICATIONS]: ["contribuição", "contribuições"],
    [BadgeCriterion.EXERCISE_ANSWERS]: ["questão", "questões"],
    [BadgeCriterion.LEARNING_PATHS_COMPLETED]: ["trilha", "trilhas"],
    [BadgeCriterion.LESSONS_COMPLETED]: ["aula", "aulas"],
    [BadgeCriterion.MEETINGS_ATTENDED]: ["encontro", "encontros"],
    [BadgeCriterion.STUDY_GOALS_MET]: ["meta", "metas"],
    [BadgeCriterion.TASKS_COMPLETED]: ["tarefa", "tarefas"],
  };
  const [singular, plural] = units[criterion] ?? ["", ""];
  return `${value} de ${threshold}${singular ? ` ${threshold === 1 ? singular : plural}` : ""}`.toLocaleUpperCase(
    "pt-BR"
  );
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
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl md:text-3xl">
            {earnedCount} de {definitions.length} conquistas
          </h2>
          <p className="sr-only">
            {earnedCount} de {definitions.length} conquistas recebidas
          </p>
        </div>
        <div
          aria-label={`${earnedCount} de ${definitions.length} conquistas recebidas`}
          aria-valuemax={definitions.length || 1}
          aria-valuemin={0}
          aria-valuenow={earnedCount}
          className="mt-4 h-[5px] rounded-full bg-border"
          role="progressbar"
        >
          <span
            className="block h-full rounded-full bg-brand-structural transition-[width] duration-200"
            style={{
              width: `${definitions.length ? (earnedCount / definitions.length) * 100 : 0}%`,
            }}
          />
        </div>
      </header>

      {definitions.length === 0 ? (
        <p className="mt-8 border-y py-5 text-muted-foreground text-sm">
          Nenhuma conquista está publicada no momento.
        </p>
      ) : (
        categories.map((category) => {
          const categoryBadges = definitions
            .filter(
              ({ criterion }) => categoryForCriterion[criterion] === category
            )
            .sort(
              (left, right) =>
                criterionOrder.indexOf(left.criterion) -
                criterionOrder.indexOf(right.criterion)
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
                  className="font-semibold text-[0.82rem] text-muted-foreground"
                  id={`category-${category}`}
                >
                  {category}
                </h3>
              </div>
              <ul className="divide-y">
                {categoryBadges.map((badge) => {
                  const award = awardsByBadge.get(badge.id);
                  const current = progress[badge.criterion] ?? 0;
                  const reached = Boolean(award);
                  return (
                    <li className="flex gap-4 py-4 sm:gap-5" key={badge.id}>
                      <ProfileBadgeIcon
                        criterion={badge.criterion}
                        earned={reached}
                      />
                      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-5">
                        <div className="min-w-0">
                          <h4 className="font-medium text-sm">{badge.title}</h4>
                          <p className="mt-1 max-w-xl text-muted-foreground text-xs leading-5">
                            {badge.description}
                          </p>
                        </div>
                        <div className="mt-2 shrink-0 font-data text-[0.68rem] sm:mt-0 sm:text-right">
                          {reached ? (
                            <p className="inline-flex items-center gap-1.5 font-sans font-semibold text-brand-structural text-xs">
                              <BadgeCheckIcon
                                aria-hidden="true"
                                className="size-4"
                              />{" "}
                              Conquistada
                            </p>
                          ) : (
                            <p className="text-muted-foreground uppercase tracking-[0.08em]">
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
