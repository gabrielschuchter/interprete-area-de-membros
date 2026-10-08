import type { BadgeCriterion } from "@repo/database";

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
