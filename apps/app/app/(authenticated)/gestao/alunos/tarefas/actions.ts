"use server";

import { randomUUID } from "node:crypto";
import { database } from "@repo/database";
import { enqueueNotificationBatch } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveCohortStudents } from "@/lib/gestao-assignments";
import { recordAuditEvent } from "@/lib/gestao-audit";
import {
  requireGestaoAction,
  requireGestaoAdmin,
} from "@/lib/gestao-authorization";
import { parseTaskRecurrence } from "@/lib/gestao-tasks-domain";
import { getLearningAssignmentRecipientScope } from "@/lib/learning-assignment-scope";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

const listPath = "/gestao/alunos/tarefas";
const maxRecipients = 500;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export interface GestaoTaskFormState {
  readonly error: string | null;
}

const fail = (error: string): GestaoTaskFormState => ({ error });

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const strings = (formData: FormData, key: string) => [
  ...new Set(
    formData
      .getAll(key)
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
  ),
];

const dayAt = (value: string, time: string) => {
  if (!value) {
    return null;
  }
  if (!dayPattern.test(value)) {
    return undefined;
  }
  const parsed = new Date(`${value}T${time}-03:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const dateTimeAt = (value: string) => {
  if (!dateTimePattern.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const createGestaoTask = async (
  _previous: GestaoTaskFormState,
  formData: FormData
): Promise<GestaoTaskFormState> => {
  const { actor } = await requireGestaoAction("assignments.manage");
  const title = text(formData, "title").slice(0, 180);
  const description = text(formData, "description").slice(0, 2000);
  const recurrence = parseTaskRecurrence(text(formData, "recurrence"));
  const startsAt = dayAt(text(formData, "startsAt"), "00:00:00");
  const dueAt = dayAt(text(formData, "dueAt"), "23:59:59");
  if (!title) {
    return fail("Dê um título à tarefa.");
  }
  if (!recurrence || startsAt === undefined || dueAt === undefined) {
    return fail("Confira a frequência e as datas.");
  }
  if (startsAt && dueAt && dueAt < startsAt) {
    return fail("O prazo não pode vir antes do início.");
  }
  const cohortIds = strings(formData, "cohortIds");
  const fromCohorts = await resolveCohortStudents(actor, cohortIds);
  if (fromCohorts.cohorts.length !== cohortIds.length) {
    return fail("Uma das turmas escolhidas não está sob sua responsabilidade.");
  }
  const wanted = [
    ...new Set([...fromCohorts.memberIds, ...strings(formData, "memberIds")]),
  ];
  if (wanted.length === 0) {
    return fail("Escolha ao menos uma turma ou um aluno.");
  }
  if (wanted.length > maxRecipients) {
    return fail(`Uma tarefa aceita até ${maxRecipients} alunos por envio.`);
  }
  const recipients = await database.member.findMany({
    where: {
      AND: [
        { id: { in: wanted } },
        getLearningAssignmentRecipientScope({
          role: actor.role === "ADMIN" ? "ADMIN" : "TEACHER",
          userId: actor.userId,
        }),
      ],
    },
    select: { id: true },
  });
  if (recipients.length !== wanted.length) {
    return fail("Algum aluno escolhido está fora do seu escopo.");
  }

  const createdAt = new Date();
  const taskId = randomUUID();
  await database.$transaction(async (transaction) => {
    await transaction.learningTask.create({
      data: {
        id: taskId,
        createdByMemberId: actor.userId,
        title,
        description: description || null,
        recurrence,
        startsAt: startsAt ?? createdAt,
        ...(dueAt ? { dueAt } : {}),
        recipients: {
          createMany: { data: recipients.map(({ id }) => ({ memberId: id })) },
        },
      },
    });
    await enqueueNotificationBatch(transaction, {
      actorId: actor.userId,
      aggregateType: "LEARNING_TASK",
      aggregateId: taskId,
      idempotencyKey: `learning-task:${taskId}`,
      occurredAt: createdAt,
      notifications: recipients.map(({ id }) => ({
        recipientId: id,
        type: "LEARNING_CONTENT_ASSIGNED",
        entityType: "LEARNING_TASK",
        entityId: taskId,
        dedupeKey: `learning-task:${taskId}:${id}`,
        href: "/tarefas",
      })),
    });
    await recordAuditEvent(
      {
        actorId: actor.userId,
        aggregateId: taskId,
        aggregateType: "LearningTask",
        eventType: "gestao.task.created",
        payload: {
          cohortNames: fromCohorts.cohorts.map((cohort) => cohort.name),
          recipientCount: recipients.length,
          recurrence,
        },
      },
      transaction
    );
  });
  await dispatchPendingNotifications();
  revalidatePath(listPath);
  revalidatePath("/tarefas");
  revalidatePath("/");
  redirect(`${listPath}?resultado=tarefa-criada`);
};

export const archiveGestaoTask = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("assignments.manage");
  const taskId = text(formData, "taskId");
  const archived = await database.learningTask.updateMany({
    where: {
      id: taskId,
      archivedAt: null,
      ...(actor.role === "ADMIN" ? {} : { createdByMemberId: actor.userId }),
    },
    data: { archivedAt: new Date() },
  });
  if (archived.count !== 1) {
    redirect(`${listPath}?resultado=indisponivel`);
  }
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: taskId,
    aggregateType: "LearningTask",
    eventType: "gestao.task.archived",
    payload: {},
  });
  revalidatePath(listPath);
  revalidatePath("/tarefas");
  revalidatePath("/");
  redirect(`${listPath}?resultado=tarefa-arquivada`);
};

export const createGestaoCampaign = async (
  _previous: GestaoTaskFormState,
  formData: FormData
): Promise<GestaoTaskFormState> => {
  const actor = await requireGestaoAdmin();
  const title = text(formData, "title").slice(0, 180);
  const description = text(formData, "description").slice(0, 2000);
  const hours = Number(text(formData, "targetHours").replace(",", "."));
  const targetMinutes = Math.round(hours * 60);
  const startsAt = dateTimeAt(text(formData, "startsAt"));
  const endsAt = dateTimeAt(text(formData, "endsAt"));
  if (!title) {
    return fail("Dê um título à meta.");
  }
  if (
    !(Number.isFinite(hours) && targetMinutes >= 15 && targetMinutes <= 100_800)
  ) {
    return fail("O objetivo deve ficar entre 15 minutos e 1.680 horas.");
  }
  if (!(startsAt && endsAt) || endsAt <= startsAt) {
    return fail("Informe início e fim, com o fim depois do início.");
  }
  const publish = text(formData, "published") === "true";
  const campaign = await database.studyCampaign.create({
    data: {
      createdByMemberId: actor.userId,
      title,
      description: description || null,
      targetMinutes,
      startsAt,
      endsAt,
      publishedAt: publish ? new Date() : null,
    },
    select: { id: true },
  });
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: campaign.id,
    aggregateType: "StudyCampaign",
    eventType: publish ? "gestao.goal.published" : "gestao.goal.created",
    payload: { targetMinutes },
  });
  revalidatePath(listPath);
  revalidatePath("/");
  redirect(`${listPath}?aba=metas&resultado=meta-criada`);
};

const campaignOperations = {
  archive: { event: "gestao.goal.archived", result: "meta-arquivada" },
  publish: { event: "gestao.goal.published", result: "meta-publicada" },
  unpublish: { event: "gestao.goal.unpublished", result: "meta-retirada" },
} as const;

export const changeGestaoCampaign = async (formData: FormData) => {
  const actor = await requireGestaoAdmin();
  const id = text(formData, "campaignId");
  const operation = text(formData, "operation");
  const config =
    operation === "archive" ||
    operation === "publish" ||
    operation === "unpublish"
      ? campaignOperations[operation]
      : null;
  if (!config) {
    redirect(`${listPath}?aba=metas&resultado=indisponivel`);
  }
  const data =
    operation === "archive"
      ? { archivedAt: new Date() }
      : {
          archivedAt: null,
          publishedAt: operation === "publish" ? new Date() : null,
        };
  const updated = await database.studyCampaign.updateMany({
    where: { id },
    data,
  });
  if (updated.count !== 1) {
    redirect(`${listPath}?aba=metas&resultado=indisponivel`);
  }
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: id,
    aggregateType: "StudyCampaign",
    eventType: config.event,
    payload: {},
  });
  revalidatePath(listPath);
  revalidatePath("/");
  redirect(`${listPath}?aba=metas&resultado=${config.result}`);
};
