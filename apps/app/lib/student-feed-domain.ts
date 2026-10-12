export type StudentFeedAssignmentStatus =
  | "NEW"
  | "VIEWED"
  | "STARTED"
  | "COMPLETED"
  | "REVOKED";

export interface StudentFeedMembership {
  readonly archivedAt: Date | null;
  readonly cohortId: string;
  readonly endsAt: Date | null;
  readonly joinedAt: Date;
  readonly lateJoinPolicy: "ALL_ACTIVE" | "FROM_JOIN";
  readonly startsAt: Date;
}

export interface StudentFeedActivityCandidate {
  readonly assignments: readonly {
    readonly id: string;
    readonly status: StudentFeedAssignmentStatus;
    readonly message: string | null;
    readonly availableAt: Date | null;
    readonly dueAt: Date | null;
    readonly expiresAt: Date | null;
    readonly assignedAt: Date;
  }[];
  readonly cohortTargets: readonly {
    readonly cohortId: string;
    readonly assignedAt: Date;
  }[];
  readonly dueAt: Date | null;
  readonly id: string;
  readonly slug: string;
  readonly submissions: readonly { readonly status: string }[];
  readonly title: string;
}

export interface StudentFeedActivity {
  readonly assignedAt: Date;
  readonly availableAt: Date | null;
  readonly dueAt: Date | null;
  readonly href: string;
  readonly id: string;
  readonly message: string | null;
  readonly slug: string;
  readonly status: Exclude<StudentFeedAssignmentStatus, "REVOKED">;
  readonly targetId: string;
  readonly title: string;
}

const compareNewest = (
  left: { readonly assignedAt: Date; readonly id: string },
  right: { readonly assignedAt: Date; readonly id: string }
) =>
  right.assignedAt.getTime() - left.assignedAt.getTime() ||
  left.id.localeCompare(right.id);

const earliest = (dates: readonly (Date | null)[]) =>
  dates.reduce<Date | null>((result, date) => {
    if (!date) {
      return result;
    }
    return !result || date < result ? date : result;
  }, null);

const latestMessage = (
  assignments: StudentFeedActivityCandidate["assignments"]
) =>
  [...assignments]
    .filter((assignment) => assignment.message?.trim())
    .sort(compareNewest)[0]
    ?.message?.trim() ?? null;

const progressRank: Record<
  Exclude<StudentFeedAssignmentStatus, "REVOKED">,
  number
> = { NEW: 0, VIEWED: 1, STARTED: 2, COMPLETED: 3 };

export const resolveStudentFeedActivities = (
  activities: readonly StudentFeedActivityCandidate[],
  memberships: readonly StudentFeedMembership[],
  at = new Date()
): StudentFeedActivity[] => {
  const membershipById = new Map(
    memberships.map((membership) => [membership.cohortId, membership])
  );

  return activities
    .flatMap((activity) => {
      const assignments = activity.assignments
        .filter(
          (assignment) =>
            assignment.status !== "REVOKED" &&
            (!assignment.expiresAt || assignment.expiresAt > at)
        )
        .sort(compareNewest);
      const cohortTargets = activity.cohortTargets.filter((target) => {
        const membership = membershipById.get(target.cohortId);
        if (
          !membership ||
          target.assignedAt > at ||
          membership.archivedAt ||
          membership.startsAt > at ||
          (membership.endsAt && membership.endsAt <= at) ||
          membership.joinedAt > at ||
          (activity.dueAt && activity.dueAt < membership.joinedAt)
        ) {
          return false;
        }
        return (
          membership.lateJoinPolicy === "ALL_ACTIVE" ||
          target.assignedAt >= membership.joinedAt
        );
      });

      if (assignments.length === 0 && cohortTargets.length === 0) {
        return [];
      }

      const latestAssignment = assignments[0];
      const submitted = activity.submissions.some(
        ({ status }) => status === "SUBMITTED" || status === "REVIEWED"
      );
      const status = submitted
        ? "COMPLETED"
        : (assignments
            .map(({ status: assignmentStatus }) => assignmentStatus)
            .filter(
              (
                assignmentStatus
              ): assignmentStatus is Exclude<
                StudentFeedAssignmentStatus,
                "REVOKED"
              > => assignmentStatus !== "REVOKED"
            )
            .sort(
              (left, right) => progressRank[right] - progressRank[left]
            )[0] ?? "NEW");
      const dueAt = earliest([
        activity.dueAt,
        ...assignments.map((assignment) => assignment.dueAt),
      ]);
      const availableAt =
        cohortTargets.length > 0
          ? null
          : earliest(assignments.map((assignment) => assignment.availableAt));
      const assignedAt =
        latestAssignment?.assignedAt ??
        cohortTargets
          .map(({ assignedAt: targetAt }) => targetAt)
          .sort((left, right) => left.getTime() - right.getTime())[0];
      if (!assignedAt) {
        return [];
      }
      const id = latestAssignment?.id ?? `cohort-activity:${activity.id}`;
      return [
        {
          id,
          targetId: activity.id,
          title: activity.title,
          slug: activity.slug,
          href: latestAssignment
            ? `/aprender/atribuicoes/${encodeURIComponent(latestAssignment.id)}`
            : `/atividades/${encodeURIComponent(activity.slug)}`,
          status,
          message: latestMessage(assignments),
          availableAt,
          dueAt,
          assignedAt,
        },
      ];
    })
    .sort((left, right) => {
      if (left.dueAt && right.dueAt) {
        const byDueDate = left.dueAt.getTime() - right.dueAt.getTime();
        if (byDueDate !== 0) {
          return byDueDate;
        }
      } else if (left.dueAt) {
        return -1;
      } else if (right.dueAt) {
        return 1;
      }
      return right.assignedAt.getTime() - left.assignedAt.getTime();
    });
};
