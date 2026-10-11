import type { BadgeCriterion } from "@repo/database";

const profileBadgeCriterionOrder = [
  "STUDY_MINUTES",
  "STUDY_STREAK_DAYS",
  "LESSONS_COMPLETED",
  "LEARNING_PATHS_COMPLETED",
  "EXERCISE_ANSWERS",
  "ACTIVITIES_COMPLETED",
  "TASKS_COMPLETED",
  "STUDY_GOALS_MET",
  "COMMUNITY_PUBLICATIONS",
  "MEETINGS_ATTENDED",
] satisfies readonly BadgeCriterion[];

const profileBadgeCriterionRank = new Map(
  profileBadgeCriterionOrder.map((criterion, index) => [criterion, index])
);

export const orderProfileBadges = <
  T extends { readonly criterion: BadgeCriterion },
>(
  badges: readonly T[]
) =>
  [...badges].sort(
    (left, right) =>
      (profileBadgeCriterionRank.get(left.criterion) ??
        Number.MAX_SAFE_INTEGER) -
      (profileBadgeCriterionRank.get(right.criterion) ??
        Number.MAX_SAFE_INTEGER)
  );

export interface ProfileBadgeDefinition {
  readonly criterion: BadgeCriterion;
  readonly description: string;
  readonly id: string;
  readonly title: string;
}

export interface ProfileBadgeAward {
  readonly awardedAt: Date;
  readonly badgeId: string;
  readonly definitionRevision: Omit<ProfileBadgeDefinition, "id">;
  readonly id: string;
}

export const splitProfileBadges = (
  awards: readonly ProfileBadgeAward[],
  definitions: readonly ProfileBadgeDefinition[]
) => {
  const awardedDefinitionIds = new Set(awards.map(({ badgeId }) => badgeId));

  return {
    earned: awards.map(({ definitionRevision, ...award }) => ({
      ...definitionRevision,
      id: award.id,
      awardedAt: award.awardedAt,
    })),
    available: definitions.filter(({ id }) => !awardedDefinitionIds.has(id)),
  };
};
