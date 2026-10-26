"use server";

import { AnnouncementAudience, ContentStatus, database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { queueAnnouncementNotifications } from "@/lib/announcement-notification-outbox";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoCohortActor } from "@/lib/gestao-authorization";
import {
  cohortNoticeCreated,
  getCohortNoticeIds,
} from "@/lib/gestao-cohort-notices";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

export interface CohortNoticeState {
  readonly done: boolean;
  readonly error: string | null;
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const pathFor = (cohortId: string) =>
  `/gestao/alunos/turmas/${cohortId}/avisos`;

export const publishCohortNotice = async (
  _previous: CohortNoticeState,
  formData: FormData
): Promise<CohortNoticeState> => {
  const cohortId = text(formData, "cohortId");
  if (!cohortId) {
    return { done: false, error: "Turma não identificada." };
  }
  const { actor } = await requireGestaoCohortActor(cohortId);
  const title = text(formData, "title").slice(0, 180);
  const body = text(formData, "body").slice(0, 2000);
  const rawStart = text(formData, "startsAt");
  const startsAt = rawStart ? new Date(rawStart) : null;
  if (!(title && body)) {
    return { done: false, error: "Escreva o título e a mensagem do aviso." };
  }
  if (startsAt && !Number.isFinite(startsAt.valueOf())) {
    return { done: false, error: "A data de publicação não é válida." };
  }
  const now = new Date();
  if (startsAt && startsAt <= now) {
    return { done: false, error: "Escolha uma data futura para agendar." };
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const students = await database.cohortMembership.findMany({
    where: {
      cohortId,
      status: "ACTIVE",
      leftAt: null,
      member: { is: { role: "MEMBER", deactivatedAt: null } },
    },
    select: { memberId: true },
  });
  if (students.length === 0) {
    return {
      done: false,
      error: "Esta turma ainda não tem alunos ativos para receber o aviso.",
    };
  }
  const recipientIds = students.map(({ memberId }) => memberId);
  await database.$transaction(async (transaction) => {
    const announcement = await transaction.announcement.create({
      data: {
        audience: AnnouncementAudience.SELECTED,
        body,
        createdByMemberId: actor.userId,
        isPinned: text(formData, "isPinned") === "on",
        publishedAt: now,
        recipientIds,
        startsAt,
        status: ContentStatus.PUBLISHED,
        title,
      },
    });
    await recordAuditEvent(
      {
        actorId: actor.userId,
        aggregateId: announcement.id,
        aggregateType: "Announcement",
        eventType: cohortNoticeCreated,
        payload: {
          cohortId,
          recipients: recipientIds.length,
          scheduled: startsAt?.toISOString() ?? null,
          title,
        },
      },
      transaction
    );
    await queueAnnouncementNotifications(
      transaction,
      announcement,
      [],
      actor.userId
    );
  });
  if (!startsAt) {
    await dispatchPendingNotifications();
  }
  revalidatePath(pathFor(cohortId));
  revalidatePath("/comunidade");
  return { done: true, error: null };
};

const manage = async (formData: FormData) => {
  const cohortId = text(formData, "cohortId");
  const id = text(formData, "id");
  if (!(cohortId && id)) {
    return null;
  }
  const { actor } = await requireGestaoCohortActor(cohortId);
  const ids = await getCohortNoticeIds(cohortId);
  if (!ids.includes(id)) {
    return null;
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  return { actor, cohortId, id };
};

export const endCohortNotice = async (formData: FormData) => {
  const target = await manage(formData);
  if (!target) {
    return;
  }
  const now = new Date();
  const current = await database.announcement.findUnique({
    where: { id: target.id },
    select: { startsAt: true },
  });
  // Um aviso agendado ainda não começou: encerrá-lo só o arquiva, porque o
  // fim não pode vir antes do início (restrição do banco).
  const started = !current?.startsAt || current.startsAt <= now;
  await database.announcement.update({
    where: { id: target.id },
    data: {
      archivedAt: now,
      status: ContentStatus.ARCHIVED,
      ...(started ? { endsAt: now } : {}),
    },
  });
  await recordAuditEvent({
    actorId: target.actor.userId,
    aggregateId: target.id,
    aggregateType: "Announcement",
    eventType: "gestao.cohort_notice.ended",
    payload: { cohortId: target.cohortId },
  });
  revalidatePath(pathFor(target.cohortId));
  revalidatePath("/comunidade");
};

export const toggleCohortNoticePin = async (formData: FormData) => {
  const target = await manage(formData);
  if (!target) {
    return;
  }
  const current = await database.announcement.findUnique({
    where: { id: target.id },
    select: { isPinned: true },
  });
  await database.announcement.update({
    where: { id: target.id },
    data: { isPinned: !current?.isPinned },
  });
  await recordAuditEvent({
    actorId: target.actor.userId,
    aggregateId: target.id,
    aggregateType: "Announcement",
    eventType: "gestao.cohort_notice.pin_changed",
    payload: { cohortId: target.cohortId, pinned: !current?.isPinned },
  });
  revalidatePath(pathFor(target.cohortId));
  revalidatePath("/comunidade");
};
