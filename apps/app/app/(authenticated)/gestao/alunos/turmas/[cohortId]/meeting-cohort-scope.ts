import { MemberRole } from "@repo/database";

/**
 * A staff member may manage a shared meeting only when they manage every
 * active cohort target. Keep this predicate aligned across series and
 * occurrence mutations.
 */
export const meetingCohortScopeWhere = (input: {
  readonly actorId: string;
  readonly actorRole: MemberRole;
  readonly cohortId: string;
}) => ({
  cohortTargets: {
    some: { cohortId: input.cohortId, revokedAt: null },
    ...(input.actorRole === MemberRole.ADMIN
      ? {}
      : {
          none: {
            revokedAt: null,
            cohort: { teachers: { none: { memberId: input.actorId } } },
          },
        }),
  },
});
