import "server-only";

import {
  ActivitySubmissionStatus,
  ContentStatus,
  CourseExperience,
  database,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  MemberRole,
} from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import { getProfilesByClerkIds } from "./profile";

export const getAdminOverview = async () => {
  const now = new Date();

  const [
    activeMembers,
    publishedCourses,
    pendingFeedback,
    upcomingMeetings,
    recentLessons,
    recentPosts,
    draftPaths,
    draftCourses,
    draftModules,
    draftLessons,
    draftPosts,
    overdueAssignments,
  ] = await tracePerformance("member.admin.overview.primary-queries", () =>
    Promise.all([
      tracePerformance("member.admin.overview.active-members", () =>
        database.member.count({ where: { role: MemberRole.MEMBER } })
      ),
      tracePerformance("member.admin.overview.published-courses", () =>
        database.course.count({
          where: {
            experience: CourseExperience.ASYNC,
            status: ContentStatus.PUBLISHED,
          },
        })
      ),
      tracePerformance("member.admin.overview.pending-feedback", () =>
        database.activitySubmission.findMany({
          where: {
            status: ActivitySubmissionStatus.SUBMITTED,
            activity: { status: ContentStatus.PUBLISHED },
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: {
            id: true,
            memberId: true,
            submittedAt: true,
            updatedAt: true,
            member: { select: { displayName: true, email: true } },
            activity: { select: { title: true, slug: true } },
          },
        })
      ),
      tracePerformance("member.admin.overview.upcoming-meetings", () =>
        database.meeting.findMany({
          where: { status: ContentStatus.PUBLISHED, startsAt: { gte: now } },
          orderBy: [{ startsAt: "asc" }, { position: "asc" }],
          take: 5,
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            timezone: true,
            kind: true,
            joinUrl: true,
            teacherId: true,
          },
        })
      ),
      tracePerformance("member.admin.overview.recent-lessons", () =>
        database.lesson.findMany({
          where: {
            module: { course: { experience: CourseExperience.ASYNC } },
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true,
            module: {
              select: {
                title: true,
                course: { select: { title: true } },
              },
            },
          },
        })
      ),
      tracePerformance("member.admin.overview.recent-posts", () =>
        database.communityPost.findMany({
          where: { status: ContentStatus.PUBLISHED, deletedAt: null },
          orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
          take: 5,
          select: {
            id: true,
            title: true,
            slug: true,
            authorId: true,
            publishedAt: true,
            updatedAt: true,
            space: { select: { title: true, slug: true } },
          },
        })
      ),
      tracePerformance("member.admin.overview.draft-paths", () =>
        database.learningPath.count({ where: { status: ContentStatus.DRAFT } })
      ),
      tracePerformance("member.admin.overview.draft-courses", () =>
        database.course.count({
          where: {
            experience: CourseExperience.ASYNC,
            status: ContentStatus.DRAFT,
          },
        })
      ),
      tracePerformance("member.admin.overview.draft-modules", () =>
        database.module.count({
          where: {
            status: ContentStatus.DRAFT,
            course: { experience: CourseExperience.ASYNC },
          },
        })
      ),
      tracePerformance("member.admin.overview.draft-lessons", () =>
        database.lesson.count({
          where: {
            status: ContentStatus.DRAFT,
            module: { course: { experience: CourseExperience.ASYNC } },
          },
        })
      ),
      tracePerformance("member.admin.overview.draft-posts", () =>
        database.communityPost.count({
          where: { status: ContentStatus.DRAFT, deletedAt: null },
        })
      ),
      tracePerformance("member.admin.overview.overdue-assignments", () =>
        database.activityAssignment.findMany({
          where: {
            targetType: LearningAssignmentTargetType.ACTIVITY,
            activityId: { not: null },
            status: {
              in: [
                LearningAssignmentStatus.NEW,
                LearningAssignmentStatus.VIEWED,
                LearningAssignmentStatus.STARTED,
              ],
            },
            revokedAt: null,
            dueAt: { lt: now },
            activity: { is: { status: ContentStatus.PUBLISHED } },
          },
          orderBy: { dueAt: "asc" },
          take: 12,
          select: {
            activityId: true,
            memberId: true,
            dueAt: true,
            activity: { select: { title: true, slug: true } },
            member: { select: { displayName: true, email: true } },
          },
        })
      ),
    ])
  );

  const overdueActivityAssignments = overdueAssignments.flatMap((assignment) =>
    assignment.activityId && assignment.activity
      ? [
          {
            ...assignment,
            activityId: assignment.activityId,
            activity: assignment.activity,
          },
        ]
      : []
  );

  const [overdueSubmissionPairs, profiles] = await tracePerformance(
    "member.admin.overview.related-queries",
    () =>
      Promise.all([
        overdueActivityAssignments.length
          ? tracePerformance("member.admin.overview.overdue-submissions", () =>
              database.activitySubmission.findMany({
                where: {
                  OR: overdueActivityAssignments.map(
                    ({ activityId, memberId }) => ({ activityId, memberId })
                  ),
                  status: {
                    in: [
                      ActivitySubmissionStatus.SUBMITTED,
                      ActivitySubmissionStatus.REVIEWED,
                    ],
                  },
                },
                select: { activityId: true, memberId: true },
              })
            )
          : [],
        tracePerformance("member.admin.overview.profiles", () =>
          getProfilesByClerkIds([
            ...recentPosts.map((post) => post.authorId),
            ...upcomingMeetings.flatMap((meeting) =>
              meeting.teacherId ? [meeting.teacherId] : []
            ),
          ])
        ),
      ])
  );
  const completedOverduePairs = new Set(
    overdueSubmissionPairs.map(
      ({ activityId, memberId }) => `${activityId}:${memberId}`
    )
  );
  const overdue = overdueActivityAssignments.filter(
    ({ activityId, memberId }) =>
      !completedOverduePairs.has(`${activityId}:${memberId}`)
  );

  return {
    counts: {
      activeMembers,
      publishedCourses,
      pendingFeedback: pendingFeedback.length,
      drafts:
        draftPaths + draftCourses + draftModules + draftLessons + draftPosts,
      overdue: overdue.length,
    },
    pendingFeedback,
    upcomingMeetings: upcomingMeetings.map((meeting) => ({
      ...meeting,
      teacher: meeting.teacherId
        ? (profiles.get(meeting.teacherId) ?? null)
        : null,
    })),
    overdue,
    recentLessons,
    recentPosts: recentPosts.map((post) => ({
      ...post,
      author: profiles.get(post.authorId) ?? null,
    })),
  };
};
