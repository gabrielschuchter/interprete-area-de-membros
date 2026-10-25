"use server";

import {
  ActivitySubmissionStatus,
  ContentStatus,
  database,
} from "@repo/database";
import { enqueueNotificationBatch } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { getGestaoCorrectionRecipientScope } from "@/lib/gestao-correction-scope";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

export type ReminderResult =
  | { readonly ok: true; readonly sent: number }
  | { readonly ok: false; readonly message: string };

const maxRecipients = 500;

/**
 * Lembra alunos que ainda não entregaram. Sem `memberId`, alcança todos os
 * pendentes dentro do escopo do usuário. O lembrete é deduplicado por hora.
 */
export const remindGestaoActivityPending = async (
  formData: FormData
): Promise<ReminderResult> => {
  const activityId = String(formData.get("activityId") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "").trim();
  if (!activityId) {
    return { ok: false, message: "Atividade inválida." };
  }
  const { actor } = await requireGestaoAction("assignments.manage");
  await consumeMutationRateLimit({
    action: "activity.mutation",
    memberId: actor.userId,
  });
  const activity = await database.activity.findFirst({
    where: { id: activityId, status: ContentStatus.PUBLISHED },
    select: { id: true, slug: true, title: true },
  });
  if (!activity) {
    return { ok: false, message: "Só atividades publicadas enviam lembretes." };
  }
  const assignments = await database.activityAssignment.findMany({
    where: {
      activityId,
      revokedAt: null,
      status: { not: "REVOKED" },
      ...(memberId ? { memberId } : {}),
      member: { is: getGestaoCorrectionRecipientScope(actor) },
    },
    take: maxRecipients + 1,
    select: { memberId: true },
  });
  if (assignments.length > maxRecipients) {
    return {
      ok: false,
      message: `O envio em massa é limitado a ${maxRecipients} alunos. Filtre por turma ou lembre um aluno por vez.`,
    };
  }
  const delivered = await database.activitySubmission.findMany({
    where: {
      activityId,
      memberId: { in: assignments.map((row) => row.memberId) },
      status: {
        in: [
          ActivitySubmissionStatus.SUBMITTED,
          ActivitySubmissionStatus.REVIEWED,
        ],
      },
    },
    select: { memberId: true },
  });
  const done = new Set(delivered.map((row) => row.memberId));
  const recipients = [
    ...new Set(
      assignments.map((row) => row.memberId).filter((id) => !done.has(id))
    ),
  ];
  if (recipients.length === 0) {
    return {
      ok: false,
      message: memberId
        ? "Este aluno já entregou ou não é destinatário."
        : "Todos os destinatários já entregaram.",
    };
  }
  const hour = new Date().toISOString().slice(0, 13);
  await database.$transaction(async (transaction) => {
    await enqueueNotificationBatch(transaction, {
      actorId: actor.userId,
      aggregateType: "activity.reminder",
      aggregateId: activityId,
      idempotencyKey: `activity-reminder-pending:${activityId}:${memberId || "all"}:${hour}`,
      occurredAt: new Date(),
      notifications: recipients.map((recipientId) => ({
        recipientId,
        type: "ACTIVITY_DEADLINE",
        entityType: "ACTIVITY",
        entityId: activity.id,
        dedupeKey: `activity-reminder-pending:${activityId}:${recipientId}:${hour}`,
        title: "Lembrete: atividade ainda não enviada",
        body: activity.title,
        href: `/atividades/${activity.slug}`,
      })),
    });
  });
  await dispatchPendingNotifications();
  await recordAuditEvent({
    eventType: "gestao.activity.reminder_sent",
    actorId: actor.userId,
    aggregateType: "Activity",
    aggregateId: activityId,
    payload: {
      activityId,
      count: recipients.length,
      memberId: memberId || null,
    },
  });
  revalidatePath(`/gestao/ensino/atividades/${activityId}/entregas`);
  return { ok: true, sent: recipients.length };
};
