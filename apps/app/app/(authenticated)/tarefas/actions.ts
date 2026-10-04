"use server";

import { randomUUID } from "node:crypto";
import {
  BadgeCriterion,
  database,
  LearningTaskRecurrence,
  MemberRole,
  StudyGoalPeriod,
} from "@repo/database";
import { enqueueNotificationBatch } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/authorization";
import { evaluateMemberBadges } from "@/lib/badges";
import { requireMemberId } from "@/lib/learning";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";
import { studyPeriodKey } from "@/lib/study-periods";

const textValue = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const recurrenceValue = (raw: string) =>
  Object.values(LearningTaskRecurrence).find((item) => item === raw);

const dueDateValue = (raw: string) => {
  if (!raw) {
    return null;
  }
  if (!datePattern.test(raw)) {
    return undefined;
  }
  const parsed = new Date(`${raw}T23:59:59-03:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const createPersonalLearningTask = async (formData: FormData) => {
  const memberId = await requireMemberId();
  const title = textValue(formData, "title").slice(0, 180);
  const description = textValue(formData, "description").slice(0, 2000);
  const recurrence = recurrenceValue(textValue(formData, "recurrence"));
  const dueAt = dueDateValue(textValue(formData, "dueAt"));
  if (!(title && recurrence) || dueAt === undefined) {
    redirect("/tarefas?resultado=invalido");
  }

  await database.$transaction(async (transaction) => {
    const task = await transaction.learningTask.create({
      data: {
        createdByMemberId: memberId,
        title,
        description: description || null,
        recurrence,
        ...(dueAt ? { dueAt } : {}),
      },
      select: { id: true },
    });
    await transaction.learningTaskRecipient.create({
      data: { taskId: task.id, memberId },
    });
  });
  revalidatePath("/");
  revalidatePath("/tarefas");
  redirect("/tarefas?resultado=tarefa-criada");
};

export const completeLearningTaskOccurrence = async (formData: FormData) => {
  const memberId = await requireMemberId();
  const taskId = textValue(formData, "taskId");
  const task = await database.learningTaskRecipient.findFirst({
    where: {
      taskId,
      memberId,
      task: { is: { archivedAt: null, startsAt: { lte: new Date() } } },
    },
    select: { task: { select: { recurrence: true } } },
  });
  if (!task) {
    redirect("/tarefas?resultado=tarefa-indisponivel");
  }
  const periodKey = studyPeriodKey(task.task.recurrence);
  await database.$transaction(async (transaction) => {
    await transaction.learningTaskCompletion.upsert({
      where: {
        taskId_memberId_periodKey: { taskId, memberId, periodKey },
      },
      create: { taskId, memberId, periodKey },
      update: {},
    });
    await evaluateMemberBadges(transaction, memberId, new Date(), {
      criteria: [BadgeCriterion.TASKS_COMPLETED],
      force: true,
    });
  });
  await dispatchPendingNotifications();
  revalidatePath("/");
  revalidatePath("/tarefas");
  redirect("/tarefas?resultado=tarefa-concluida");
};

export const archivePersonalLearningTask = async (formData: FormData) => {
  const memberId = await requireMemberId();
  const taskId = textValue(formData, "taskId");
  const now = new Date();
  const result = await database.learningTask.updateMany({
    where: {
      id: taskId,
      createdByMemberId: memberId,
      recipients: { some: { memberId } },
      archivedAt: null,
    },
    data: { archivedAt: now },
  });
  if (result.count !== 1) {
    redirect("/tarefas?resultado=tarefa-indisponivel");
  }
  revalidatePath("/");
  revalidatePath("/tarefas");
  redirect("/tarefas?resultado=tarefa-arquivada");
};

export const savePersonalStudyGoal = async (formData: FormData) => {
  const memberId = await requireMemberId();
  const period = textValue(formData, "period") as StudyGoalPeriod;
  const targetMinutes = Number.parseInt(
    textValue(formData, "targetMinutes"),
    10
  );
  if (
    !(
      Object.values(StudyGoalPeriod).includes(period) &&
      Number.isInteger(targetMinutes)
    ) ||
    targetMinutes < 15 ||
    targetMinutes > 100_800
  ) {
    redirect("/tarefas?resultado=meta-invalida");
  }

  await database.$transaction(async (transaction) => {
    const existing = await transaction.studyGoal.findUnique({
      where: { memberId_period: { memberId, period } },
      select: { id: true, targetMinutes: true },
    });
    if (existing?.targetMinutes === targetMinutes) {
      return;
    }
    const goal = existing
      ? await transaction.studyGoal.update({
          where: { id: existing.id },
          data: { targetMinutes },
          select: { id: true },
        })
      : await transaction.studyGoal.create({
          data: { memberId, period, targetMinutes },
          select: { id: true },
        });
    await transaction.studyGoalRevision.create({
      data: { studyGoalId: goal.id, targetMinutes },
    });
    await evaluateMemberBadges(transaction, memberId, new Date(), {
      criteria: [BadgeCriterion.STUDY_GOALS_MET],
      force: true,
    });
  });
  await dispatchPendingNotifications();
  revalidatePath("/");
  revalidatePath("/tarefas");
  redirect("/tarefas?resultado=meta-salva");
};

export const createAssignedLearningTask = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const title = textValue(formData, "title").slice(0, 180);
  const description = textValue(formData, "description").slice(0, 2000);
  const recurrence = recurrenceValue(textValue(formData, "recurrence"));
  const dueAt = dueDateValue(textValue(formData, "dueAt"));
  const allMembers = textValue(formData, "audience") === "ALL_MEMBERS";
  const selectedIds = [
    ...new Set(
      formData
        .getAll("memberIds")
        .flatMap((id) =>
          typeof id === "string" && id.trim() ? [id.trim()] : []
        )
    ),
  ].slice(0, 10_000);
  if (
    !(title && recurrence) ||
    dueAt === undefined ||
    !(allMembers || selectedIds.length)
  ) {
    redirect("/admin/estudo?resultado=invalido");
  }

  const recipients = await database.member.findMany({
    where: {
      role: MemberRole.MEMBER,
      deactivatedAt: null,
      ...(allMembers ? {} : { id: { in: selectedIds } }),
    },
    select: { id: true },
    take: 10_000,
  });
  if (!recipients.length) {
    redirect("/admin/estudo?resultado=sem-destinatarios");
  }

  const createdAt = new Date();
  const taskId = randomUUID();
  await database.$transaction(async (transaction) => {
    await transaction.learningTask.create({
      data: {
        id: taskId,
        createdByMemberId: userId,
        title,
        description: description || null,
        recurrence,
        startsAt: createdAt,
        ...(dueAt ? { dueAt } : {}),
        recipients: {
          createMany: { data: recipients.map(({ id }) => ({ memberId: id })) },
        },
      },
    });
    await enqueueNotificationBatch(transaction, {
      actorId: userId,
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
  });
  await dispatchPendingNotifications();
  revalidatePath("/admin/estudo");
  revalidatePath("/tarefas");
  revalidatePath("/");
  redirect("/admin/estudo?resultado=tarefa-atribuida");
};

export const createStudyCampaign = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const title = textValue(formData, "title").slice(0, 180);
  const description = textValue(formData, "description").slice(0, 2000);
  const targetMinutes = Number.parseInt(
    textValue(formData, "targetMinutes"),
    10
  );
  const startsAtRaw = textValue(formData, "startsAt");
  const endsAtRaw = textValue(formData, "endsAt");
  const startsAt = dateTimePattern.test(startsAtRaw)
    ? new Date(`${startsAtRaw}:00-03:00`)
    : null;
  const endsAt = dateTimePattern.test(endsAtRaw)
    ? new Date(`${endsAtRaw}:00-03:00`)
    : null;
  if (
    !(title && startsAt && endsAt && Number.isInteger(targetMinutes)) ||
    targetMinutes < 15 ||
    targetMinutes > 100_800 ||
    endsAt <= startsAt
  ) {
    redirect("/admin/estudo?resultado=campanha-invalida");
  }
  await database.studyCampaign.create({
    data: {
      createdByMemberId: userId,
      title,
      description: description || null,
      targetMinutes,
      startsAt,
      endsAt,
      publishedAt:
        textValue(formData, "published") === "true" ? new Date() : null,
    },
  });
  revalidatePath("/admin/estudo");
  revalidatePath("/");
  redirect("/admin/estudo?resultado=campanha-criada");
};

export const setStudyCampaignPublication = async (formData: FormData) => {
  await requireStaff();
  const id = textValue(formData, "campaignId");
  const published = textValue(formData, "published") === "true";
  const updated = await database.studyCampaign.updateMany({
    where: { id },
    data: { publishedAt: published ? new Date() : null, archivedAt: null },
  });
  if (updated.count !== 1) {
    redirect("/admin/estudo?resultado=campanha-indisponivel");
  }
  revalidatePath("/admin/estudo");
  revalidatePath("/");
  redirect("/admin/estudo?resultado=campanha-atualizada");
};
