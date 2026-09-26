import "server-only";

import {
  ActivitySubmissionStatus,
  ContentStatus,
  database,
  MemberRole,
} from "@repo/database";
import { getProfilesByClerkIds } from "./profile";

export const getAdminOverview = async () => {
  const now = new Date();

  const [
    activeMembers,
    publishedCourses,
    publishedPaths,
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
  ] = await Promise.all([
    database.member.count({ where: { role: MemberRole.MEMBER } }),
    database.course.count({ where: { status: ContentStatus.PUBLISHED } }),
    database.learningPath.count({ where: { status: ContentStatus.PUBLISHED } }),
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
        activity: { select: { title: true, slug: true } },
      },
    }),
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
    }),
    database.lesson.findMany({
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
    }),
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
    }),
    database.learningPath.count({ where: { status: ContentStatus.DRAFT } }),
    database.course.count({ where: { status: ContentStatus.DRAFT } }),
    database.module.count({ where: { status: ContentStatus.DRAFT } }),
    database.lesson.count({ where: { status: ContentStatus.DRAFT } }),
    database.communityPost.count({
      where: { status: ContentStatus.DRAFT, deletedAt: null },
    }),
    database.activityAssignment.findMany({
      where: {
        dueAt: { lt: now },
        activity: { status: ContentStatus.PUBLISHED },
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
    }),
  ]);

  const overdueSubmissionPairs = overdueAssignments.length
    ? await database.activitySubmission.findMany({
        where: {
          OR: overdueAssignments.map(({ activityId, memberId }) => ({
            activityId,
            memberId,
          })),
          status: {
            in: [
              ActivitySubmissionStatus.SUBMITTED,
              ActivitySubmissionStatus.REVIEWED,
            ],
          },
        },
        select: { activityId: true, memberId: true },
      })
    : [];
  const completedOverduePairs = new Set(
    overdueSubmissionPairs.map(
      ({ activityId, memberId }) => `${activityId}:${memberId}`
    )
  );
  const overdue = overdueAssignments.filter(
    ({ activityId, memberId }) =>
      !completedOverduePairs.has(`${activityId}:${memberId}`)
  );

  const profiles = await getProfilesByClerkIds([
    ...recentPosts.map((post) => post.authorId),
    ...upcomingMeetings.flatMap((meeting) =>
      meeting.teacherId ? [meeting.teacherId] : []
    ),
  ]);
  const memberIds = [
    ...new Set(pendingFeedback.map(({ memberId }) => memberId)),
  ];
  const members = memberIds.length
    ? await database.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, displayName: true, email: true },
      })
    : [];
  const membersById = new Map(members.map((member) => [member.id, member]));

  return {
    counts: {
      activeMembers,
      publishedCourses,
      publishedPaths,
      pendingFeedback: pendingFeedback.length,
      drafts:
        draftPaths + draftCourses + draftModules + draftLessons + draftPosts,
      overdue: overdue.length,
    },
    pendingFeedback: pendingFeedback.map((submission) => ({
      ...submission,
      member: membersById.get(submission.memberId) ?? {
        displayName: null,
        email: null,
      },
    })),
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
