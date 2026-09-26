import {
  ActivitySubmissionStatus,
  ContentStatus,
  database,
} from "@repo/database";
import { NextResponse } from "next/server";
import { notifyActivityDeadline } from "@/lib/notifications";

export const GET = async (request: Request) => {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!(expected && authorization === `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const assignments = await database.activityAssignment.findMany({
    where: {
      dueAt: { gt: now, lte: horizon },
      activity: { status: ContentStatus.PUBLISHED },
    },
    select: {
      activity: { select: { id: true, slug: true, title: true } },
      dueAt: true,
      memberId: true,
    },
  });
  const submitted = await database.activitySubmission.findMany({
    where: {
      activityId: { in: assignments.map(({ activity }) => activity.id) },
      memberId: { in: assignments.map(({ memberId }) => memberId) },
      status: {
        in: [
          ActivitySubmissionStatus.SUBMITTED,
          ActivitySubmissionStatus.REVIEWED,
        ],
      },
    },
    select: { activityId: true, memberId: true },
  });
  const submittedKeys = new Set(
    submitted.map(({ activityId, memberId }) => `${activityId}:${memberId}`)
  );
  const results = await Promise.all(
    assignments
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
