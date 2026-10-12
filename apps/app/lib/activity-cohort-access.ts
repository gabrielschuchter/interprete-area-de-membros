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
