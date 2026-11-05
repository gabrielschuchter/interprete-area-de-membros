import { BadgeCriterion } from "@repo/database";

export const badgeArtworkByCriterion = {
  [BadgeCriterion.STUDY_MINUTES]: "/brand/badges/study-minutes.webp",
  [BadgeCriterion.STUDY_STREAK_DAYS]: "/brand/badges/study-streak-days.webp",
  [BadgeCriterion.STUDY_GOALS_MET]: "/brand/badges/study-goals-met.webp",
  [BadgeCriterion.EXERCISE_ANSWERS]: "/brand/badges/exercise-answers.webp",
  [BadgeCriterion.ACTIVITIES_COMPLETED]:
    "/brand/badges/activities-completed.webp",
  [BadgeCriterion.COMMUNITY_PUBLICATIONS]:
    "/brand/badges/community-publications.webp",
  [BadgeCriterion.LESSONS_COMPLETED]: "/brand/badges/lessons-completed.webp",
  [BadgeCriterion.TASKS_COMPLETED]: "/brand/badges/tasks-completed.webp",
  [BadgeCriterion.LEARNING_PATHS_COMPLETED]:
    "/brand/badges/learning-paths-completed.webp",
  [BadgeCriterion.MEETINGS_ATTENDED]: "/brand/badges/meetings-attended.webp",
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
