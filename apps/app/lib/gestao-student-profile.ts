import "server-only";
import { database } from "@repo/database";
import { notFound } from "next/navigation";
import { requireGestaoAction } from "./gestao-authorization";
import { getGestaoCorrectionCohortScope } from "./gestao-correction-scope";
import { queryStudentTracking } from "./gestao-student-tracking";

export interface TimelineEntry {
  readonly at: Date;
  readonly detail: string | null;
  readonly kind: string;
  readonly title: string;
}

const gradedLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  SUBMITTED: "Aguardando feedback",
  REVIEWED: "Corrigida",
};

export const getGestaoStudentProfile = async (memberId: string) => {
  const { actor } = await requireGestaoAction("students.read");
  if (!memberId || memberId.length > 255) {
    notFound();
  }
  const scope = getGestaoCorrectionCohortScope(actor);
  const member = await database.member.findFirst({
    where: {
      id: memberId,
      role: "MEMBER",
      deactivatedAt: null,
      cohortMemberships: {
        some: {
          status: "ACTIVE",
          leftAt: null,
          cohort: { is: scope },
        },
      },
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
      profile: {
        select: { username: true, headline: true, institution: true },
      },
      cohortMemberships: {
        where: { status: "ACTIVE", leftAt: null, cohort: { is: scope } },
        orderBy: { joinedAt: "asc" },
        select: {
          joinedAt: true,
          cohort: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!member) {
    notFound();
  }
  const cohortIds = member.cohortMemberships.map(({ cohort }) => cohort.id);
  const now = new Date();
  const [
    tracking,
    lessonProgress,
    completedLessons,
    submissions,
    cohortActivities,
    individualAssignments,
    exerciseSessions,
    awards,
    goals,
    attendance,
  ] = await Promise.all([
    queryStudentTracking(actor, { memberId, limit: 1 }, now),
    database.lessonProgress.findMany({
      where: { memberId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        status: true,
        updatedAt: true,
        completedAt: true,
        lesson: {
          select: {
            title: true,
            module: {
              select: { course: { select: { id: true, title: true } } },
            },
          },
        },
      },
    }),
    database.lessonProgress.count({
      where: { memberId, status: "COMPLETED" },
    }),
    database.activitySubmission.findMany({
      where: { memberId, status: { in: ["SUBMITTED", "REVIEWED"] } },
      orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
      take: 12,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        activity: { select: { id: true, title: true } },
        feedback: { select: { submittedAt: true } },
      },
    }),
    database.activity.findMany({
      where: {
        status: "PUBLISHED",
        cohortTargets: {
          some: {
            cohortId: { in: cohortIds },
            revokedAt: null,
            activeKey: { not: null },
          },
        },
        submissions: {
          none: {
            memberId,
            status: { in: ["SUBMITTED", "REVIEWED"] },
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { title: "asc" }],
      take: 12,
      select: { id: true, title: true, dueAt: true },
    }),
    database.activityAssignment.findMany({
      where: {
        memberId,
        revokedAt: null,
        status: { not: "REVOKED" },
        completedAt: null,
        activityId: { not: null },
      },
      orderBy: [{ dueAt: "asc" }, { assignedAt: "desc" }],
      take: 12,
      select: {
        dueAt: true,
        activity: { select: { id: true, title: true } },
      },
    }),
    database.exerciseSession.findMany({
      where: { memberId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        completedAt: true,
        list: { select: { title: true } },
      },
    }),
    database.badgeAward.findMany({
      where: { memberId },
      orderBy: { awardedAt: "desc" },
      take: 12,
      select: {
        awardedAt: true,
        badge: { select: { id: true, title: true } },
      },
    }),
    database.studyGoal.findMany({
      where: { memberId },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { period: true, targetMinutes: true },
    }),
    database.meetingAttendance.findMany({
      where: { memberId },
      orderBy: { markedAt: "desc" },
      take: 20,
      select: { isPresent: true },
    }),
  ]);
  const pendingActivities = new Map<
    string,
    { id: string; title: string; dueAt: Date | null }
  >();
  for (const activity of cohortActivities) {
    pendingActivities.set(activity.id, activity);
  }
  for (const assignment of individualAssignments) {
    if (assignment.activity) {
      pendingActivities.set(assignment.activity.id, {
        ...assignment.activity,
        dueAt: assignment.dueAt,
      });
    }
  }
  const timeline: TimelineEntry[] = [
    ...member.cohortMemberships.map(
      ({ cohort, joinedAt }): TimelineEntry => ({
        at: joinedAt,
        kind: "Turma",
        title: `Entrou em ${cohort.name}`,
        detail: null,
      })
    ),
    ...submissions.flatMap((submission): TimelineEntry[] => {
      const entries: TimelineEntry[] = [];
      if (submission.submittedAt) {
        entries.push({
          at: submission.submittedAt,
          kind: "Entrega",
          title: `Entregou ${submission.activity.title}`,
          detail: gradedLabel[submission.status] ?? null,
        });
      }
      if (submission.feedback?.submittedAt) {
        entries.push({
          at: submission.feedback.submittedAt,
          kind: "Feedback",
          title: `Recebeu feedback em ${submission.activity.title}`,
          detail: null,
        });
      }
      return entries;
    }),
    ...lessonProgress
      .filter((item) => item.completedAt)
      .map(
        (item): TimelineEntry => ({
          at: item.completedAt as Date,
          kind: "Aula",
          title: `Concluiu ${item.lesson.title}`,
          detail: item.lesson.module.course.title,
        })
      ),
    ...awards.map(
      (award): TimelineEntry => ({
        at: award.awardedAt,
        kind: "Medalha",
        title: `Conquistou ${award.badge.title}`,
        detail: null,
      })
    ),
  ]
    .sort((left, right) => right.at.getTime() - left.at.getTime())
    .slice(0, 15);
  const present = attendance.filter((entry) => entry.isPresent).length;
  return {
    actor,
    attendance: {
      present,
      total: attendance.length,
    },
    awards,
    completedLessons,
    exerciseSessions,
    goals,
    lessonProgress,
    member,
    pendingActivities: [...pendingActivities.values()].sort(
      (left, right) =>
        (left.dueAt?.getTime() ?? Number.POSITIVE_INFINITY) -
        (right.dueAt?.getTime() ?? Number.POSITIVE_INFINITY)
    ),
    situation: tracking.rows[0] ?? null,
    submissions,
    timeline,
  };
};
