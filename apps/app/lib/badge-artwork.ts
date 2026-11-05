import type { BadgeCriterion } from "@repo/database";

export const badgeArtworkByCriterion = {
  STUDY_MINUTES: "/brand/badges/study-minutes.webp",
  STUDY_STREAK_DAYS: "/brand/badges/study-streak-days.webp",
  STUDY_GOALS_MET: "/brand/badges/study-goals-met.webp",
  EXERCISE_ANSWERS: "/brand/badges/exercise-answers.webp",
  ACTIVITIES_COMPLETED: "/brand/badges/activities-completed.webp",
  COMMUNITY_PUBLICATIONS: "/brand/badges/community-publications.webp",
  LESSONS_COMPLETED: "/brand/badges/lessons-completed.webp",
  TASKS_COMPLETED: "/brand/badges/tasks-completed.webp",
  LEARNING_PATHS_COMPLETED: "/brand/badges/learning-paths-completed.webp",
  MEETINGS_ATTENDED: "/brand/badges/meetings-attended.webp",
} satisfies Record<BadgeCriterion, string>;

/** Símbolos que a Gestão pode escolher para uma medalha. */
export const badgeSymbols = Object.values(badgeArtworkByCriterion);

const customSymbolPattern = /^https:\/\/\S+$/;

/**
 * Símbolo de uma medalha: o escolhido na Gestão, ou o da família do critério.
 * Aceita só caminhos do próprio site e https, nunca um esquema arbitrário.
 */
export const badgeImageFor = (badge: {
  readonly criterion: BadgeCriterion;
  readonly imageUrl?: string | null;
}) => {
  const chosen = badge.imageUrl?.trim();
  if (
    chosen &&
    ((chosen.startsWith("/brand/badges/") && !chosen.includes("..")) ||
      customSymbolPattern.test(chosen))
  ) {
    return chosen;
  }
  return badgeArtworkByCriterion[badge.criterion];
};
