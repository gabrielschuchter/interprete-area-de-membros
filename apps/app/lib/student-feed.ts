import "server-only";

import {
  ContentStatus,
  database,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  type Prisma,
} from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import {
  resolveStudentFeedActivities,
  type StudentFeedActivity,
  type StudentFeedActivityCandidate,
  type StudentFeedMembership,
} from "./student-feed-domain";

const activityVisibleToLearners: Prisma.ActivityWhereInput = {
  status: ContentStatus.PUBLISHED,
  AND: [
    {
      OR: [
        { courseId: null },
        { course: { is: { status: ContentStatus.PUBLISHED } } },
      ],
    },
    {
      OR: [
        { lessonId: null },
        {
          lesson: {
            is: {
              status: ContentStatus.PUBLISHED,
              module: {
                status: ContentStatus.PUBLISHED,
                course: { status: ContentStatus.PUBLISHED },
              },
            },
          },
        },
      ],
    },
  ],
};

export interface StudentFeedOptions {
  readonly assignmentLimit?: number;
  readonly dueRange?: { readonly end: Date; readonly start: Date };
}

const getStudentFeedUncached = async (
  memberId: string,
  at: Date,
  options: StudentFeedOptions
): Promise<StudentFeedActivity[]> => {
  const [memberships, assignments] = await Promise.all([
    database.cohortMembership.findMany({
      where: {
        memberId,
        status: "ACTIVE",
        leftAt: null,
        joinedAt: { lte: at },
        cohort: {
          is: {
            archivedAt: null,
            startsAt: { lte: at },
            AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: at } }] }],
          },
        },
      },
      select: {
        cohortId: true,
        joinedAt: true,
        cohort: {
          select: {
            archivedAt: true,
            endsAt: true,
            lateJoinPolicy: true,
            startsAt: true,
          },
        },
      },
    }),
    database.activityAssignment.findMany({
      where: {
        memberId,
        targetType: LearningAssignmentTargetType.ACTIVITY,
        revokedAt: null,
        status: { not: LearningAssignmentStatus.REVOKED },
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: at } }] },
          ...(options.dueRange
            ? [
                {
                  OR: [
                    {
                      dueAt: {
                        gte: options.dueRange.start,
                        lte: options.dueRange.end,
                      },
                    },
                    {
                      activity: {
                        is: {
                          dueAt: {
                            gte: options.dueRange.start,
                            lte: options.dueRange.end,
                          },
                        },
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ assignedAt: "desc" }, { id: "asc" }],
      take: options.assignmentLimit ?? 100,
      select: {
        id: true,
        targetId: true,
        status: true,
        message: true,
        availableAt: true,
        dueAt: true,
        expiresAt: true,
        assignedAt: true,
      },
    }),
  ]);

  const membershipContexts: StudentFeedMembership[] = memberships.map(
    ({ cohortId, joinedAt, cohort }) => ({
      cohortId,
      joinedAt,
      lateJoinPolicy: cohort.lateJoinPolicy,
      startsAt: cohort.startsAt,
      endsAt: cohort.endsAt,
      archivedAt: cohort.archivedAt,
    })
  );
  const cohortTargetFilters: Prisma.ActivityCohortTargetWhereInput[] =
    memberships.map(({ cohortId, joinedAt, cohort }) => ({
      cohortId,
      activeKey: { not: null },
      revokedAt: null,
      assignedAt:
        cohort.lateJoinPolicy === "FROM_JOIN"
          ? { gte: joinedAt, lte: at }
          : { lte: at },
    }));
  const directActivityIds = [
    ...new Set(assignments.map(({ targetId }) => targetId)),
  ];
  const candidateBranches: Prisma.ActivityWhereInput[] = [];
  if (directActivityIds.length > 0) {
    candidateBranches.push({ id: { in: directActivityIds } });
  }
  if (cohortTargetFilters.length > 0) {
    const earliestJoin = memberships.reduce(
      (earliest, membership) =>
        membership.joinedAt < earliest ? membership.joinedAt : earliest,
      memberships[0]?.joinedAt ?? at
    );
    candidateBranches.push({
      cohortTargets: { some: { OR: cohortTargetFilters } },
      AND: [
        { OR: [{ dueAt: null }, { dueAt: { gte: earliestJoin } }] },
        ...(options.dueRange
          ? [
              {
                dueAt: {
                  gte: options.dueRange.start,
                  lte: options.dueRange.end,
                },
              },
            ]
          : []),
      ],
    });
  }
  if (candidateBranches.length === 0) {
    return [];
  }

  const activities = await database.activity.findMany({
    where: {
      AND: [activityVisibleToLearners, { OR: candidateBranches }],
    },
    orderBy: [
      { dueAt: { sort: "asc", nulls: "last" } },
      { title: "asc" },
      { id: "asc" },
    ],
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      dueAt: true,
      cohortTargets: {
        where: { OR: cohortTargetFilters },
        select: { cohortId: true, assignedAt: true },
      },
      submissions: {
        where: { memberId },
        take: 1,
        select: { status: true },
      },
    },
  });
  const assignmentsByActivity = new Map<
    string,
    StudentFeedActivityCandidate["assignments"][number][]
  >();
  for (const assignment of assignments) {
    const activityAssignments =
      assignmentsByActivity.get(assignment.targetId) ?? [];
    activityAssignments.push(assignment);
    assignmentsByActivity.set(assignment.targetId, activityAssignments);
  }
  const candidates: StudentFeedActivityCandidate[] = activities.map(
    (activity) => ({
      ...activity,
      assignments: assignmentsByActivity.get(activity.id) ?? [],
    })
  );
  return resolveStudentFeedActivities(candidates, membershipContexts, at);
};

export const resolveStudentFeed = (
  memberId: string,
  at = new Date(),
  options: StudentFeedOptions = {}
) =>
  tracePerformance("member.learning.student-feed", () =>
    getStudentFeedUncached(memberId, at, options)
  );
