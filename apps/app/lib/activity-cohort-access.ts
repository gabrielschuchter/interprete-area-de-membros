export interface ActivityCohortTargetForMember {
  readonly assignedAt: Date;
  readonly cohort: {
    readonly archivedAt: Date | null;
    readonly endsAt: Date | null;
    readonly lateJoinPolicy: "ALL_ACTIVE" | "FROM_JOIN";
    readonly memberships: readonly { readonly joinedAt: Date }[];
    readonly readAfterEndDays: number;
    readonly startsAt: Date;
  };
}

export interface ActivityCohortRecipientTarget {
  readonly assignedAt: Date;
  readonly cohort: Omit<ActivityCohortTargetForMember["cohort"], "memberships">;
  readonly cohortId: string;
}

export interface ActivityCohortRecipientMembership {
  readonly cohortId: string;
  readonly joinedAt: Date;
  readonly memberId: string;
}

export const hasActivityCohortAccess = (
  targets: readonly ActivityCohortTargetForMember[],
  now = new Date()
) =>
  targets.some((target) => {
    const membership = target.cohort.memberships[0];
    if (!membership || target.cohort.startsAt > now) {
      return false;
    }
    const end = target.cohort.endsAt ?? target.cohort.archivedAt;
    const readUntil = end
      ? new Date(end.getTime() + target.cohort.readAfterEndDays * 86_400_000)
      : null;
    if (readUntil && now >= readUntil) {
      return false;
    }
    return target.cohort.lateJoinPolicy === "ALL_ACTIVE"
      ? true
      : membership.joinedAt.getTime() <= target.assignedAt.getTime();
  });

export const selectActivityCohortRecipientIds = (
  targets: readonly ActivityCohortRecipientTarget[],
  memberships: readonly ActivityCohortRecipientMembership[],
  now = new Date()
) => {
  const targetByCohortId = new Map(
    targets.map((target) => [target.cohortId, target])
  );
  const recipientIds = new Set<string>();

  for (const membership of memberships) {
    const target = targetByCohortId.get(membership.cohortId);
    if (
      target &&
      hasActivityCohortAccess(
        [
          {
            assignedAt: target.assignedAt,
            cohort: {
              ...target.cohort,
              memberships: [{ joinedAt: membership.joinedAt }],
            },
          },
        ],
        now
      )
    ) {
      recipientIds.add(membership.memberId);
    }
  }

  return recipientIds;
};
