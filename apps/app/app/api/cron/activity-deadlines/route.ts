import {
  ActivitySubmissionStatus,
  ContentStatus,
  database,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
} from "@repo/database";
import { isAuthorizedCronRequest } from "@repo/security/cron-auth";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { notifyActivityDeadline } from "@/lib/notifications";

export const GET = async (request: Request) => {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "O processamento agendado não está configurado." },
      { status: 503 }
    );
  }

  if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const assignments = await database.activityAssignment.findMany({
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
      dueAt: { gt: now, lte: horizon },
      activity: { is: { status: ContentStatus.PUBLISHED } },
    },
    select: {
      activity: { select: { id: true, slug: true, title: true } },
      dueAt: true,
      memberId: true,
    },
  });
  const activityAssignments = assignments.flatMap((assignment) =>
    assignment.activity
      ? [{ ...assignment, activity: assignment.activity }]
      : []
  );
  const submitted = activityAssignments.length
    ? await database.activitySubmission.findMany({
        where: {
          OR: activityAssignments.map(({ activity, memberId }) => ({
            activityId: activity.id,
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
  const submittedKeys = new Set(
    submitted.map(({ activityId, memberId }) => `${activityId}:${memberId}`)
  );
  const results = await Promise.all(
    activityAssignments
      .filter(
        ({ activity, memberId }) =>
          !submittedKeys.has(`${activity.id}:${memberId}`)
      )
      .map(({ activity, dueAt, memberId }) =>
        notifyActivityDeadline({
          recipientId: memberId,
          activityId: activity.id,
          activityTitle: activity.title,
          dueAt: dueAt ?? horizon,
          href: `/atividades/${activity.slug}`,
        })
      )
  );
  return NextResponse.json({
    ok: true,
    notified: results.filter(Boolean).length,
  });
};
