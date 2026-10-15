import { randomUUID } from "node:crypto";
import type {
  PlannerRecurrence as PlannerRecurrenceType,
  PlannerTaskStatus as PlannerTaskStatusType,
  Prisma,
} from "@repo/database";
import { enqueueDomainEvent, resolveOutboxConsumerKey } from "./events";
import { notificationOutboxConsumerKey } from "./notifications";
import {
  firstPlannerOccurrenceOnOrAfter as firstOccurrenceOnOrAfter,
  isPlannerSeriesOccurrence as withinSeries,
} from "./planner-recurrence";

const PlannerRecurrence = {
  NONE: "NONE",
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
} satisfies Record<PlannerRecurrenceType, PlannerRecurrenceType>;
const PlannerTaskStatus = {
  DONE: "DONE",
} satisfies { DONE: PlannerTaskStatusType };

const defaultTimezone = "America/Sao_Paulo";

const reminderAlreadyExists = async (
  transaction: Prisma.TransactionClient,
  reminder: { memberId: string; entityType: string; entityId: string },
  occurrenceAt: Date
) =>
  Boolean(
    await transaction.plannerReminder.findFirst({
      where: {
        memberId: reminder.memberId,
        entityType: reminder.entityType,
        entityId: reminder.entityId,
        occurrenceAt,
        cancelledAt: null,
      },
      select: { id: true },
    })
  );

const enqueuePlannerReminder = async (
  transaction: Prisma.TransactionClient,
  input: {
    memberId: string;
    entityType: "PLANNER_TASK" | "PLANNER_EVENT";
    entityId: string;
    occurrenceAt: Date;
    title: string;
    reminderAt: Date;
    timezone: string;
    href: string;
  }
) => {
  if (await reminderAlreadyExists(transaction, input, input.occurrenceAt)) {
    return;
  }
  const id = randomUUID();
  const now = new Date();
  const reminderAt = input.reminderAt < now ? now : input.reminderAt;
  const event = await enqueueDomainEvent(transaction, {
    eventType: "notifications.batch_requested",
    actorId: null,
    aggregateType: "planner.reminder",
    aggregateId: id,
    idempotencyKey: `planner-reminder:${id}`,
    occurredAt: reminderAt,
    consumers: [notificationOutboxConsumerKey],
    payload: {
      notifications: [
        {
          recipientId: input.memberId,
          type: "PLANNER_REMINDER",
          entityType: input.entityType,
          entityId: input.entityId,
          dedupeKey: `planner-reminder:${id}`,
          priority: 2,
          title: `Lembrete: ${input.title}`.slice(0, 160),
          body: `Este item está previsto para ${input.occurrenceAt.toLocaleString("pt-BR", { timeZone: input.timezone })}.`,
          href: input.href,
        },
      ],
    },
  });
  await transaction.outboxJob.updateMany({
    where: {
      eventId: event.id,
      consumerKey: resolveOutboxConsumerKey(notificationOutboxConsumerKey),
    },
    data: { availableAt: reminderAt },
  });
  await transaction.plannerReminder.create({
    data: {
      id,
      memberId: input.memberId,
      entityType: input.entityType,
      entityId: input.entityId,
      occurrenceAt: input.occurrenceAt,
      remindAt: reminderAt,
      domainEventId: event.id,
    },
  });
};

interface CurrentPlannerReminder {
  readonly entityId: string;
  readonly entityType: string;
  readonly memberId: string;
  readonly occurrenceAt: Date | null;
}

interface TaskReminderOccurrence {
  occurrenceAt: Date;
  reminderAt: Date;
  title: string;
}

type EventReminderOccurrence = TaskReminderOccurrence;

const findNextTaskReminderOccurrence = async (
  transaction: Prisma.TransactionClient,
  current: CurrentPlannerReminder,
  task: {
    title: string;
    dueAt: Date;
    recurrence: PlannerRecurrenceType;
    recurrenceUntil: Date | null;
    reminderMinutes: number;
  },
  timezone: string
): Promise<TaskReminderOccurrence | null> => {
  if (!current.occurrenceAt) {
    return null;
  }
  let target = new Date(current.occurrenceAt.getTime() + 1);
  for (let skipped = 0; skipped < 101; skipped += 1) {
    const occurrenceAt = firstOccurrenceOnOrAfter(
      task.dueAt,
      task.recurrence,
      target,
      timezone,
      task.recurrenceUntil
    );
    if (!occurrenceAt) {
      return null;
    }
    const exception = await transaction.plannerTaskOccurrence.findFirst({
      where: {
        taskId: current.entityId,
        memberId: current.memberId,
        occurrenceAt,
      },
      select: {
        titleOverride: true,
        dueAtOverride: true,
        status: true,
        completedAt: true,
        deletedAt: true,
      },
    });
    const skippedByMember = Boolean(
      exception?.deletedAt ||
        exception?.completedAt ||
        exception?.status === PlannerTaskStatus.DONE
    );
    const dueAt = exception?.dueAtOverride ?? occurrenceAt;
    const reminderAt = new Date(
      dueAt.getTime() - task.reminderMinutes * 60_000
    );
    if (skippedByMember || reminderAt < new Date()) {
      target = new Date(occurrenceAt.getTime() + 1);
      continue;
    }
    return {
      occurrenceAt,
      title: exception?.titleOverride ?? task.title,
      reminderAt,
    };
  }
  return null;
};

const scheduleNextTaskReminder = async (
  transaction: Prisma.TransactionClient,
  current: CurrentPlannerReminder
) => {
  const [task, preferences] = await Promise.all([
    transaction.plannerTask.findFirst({
      where: {
        id: current.entityId,
        memberId: current.memberId,
        deletedAt: null,
        status: { not: PlannerTaskStatus.DONE },
        recurrence: { not: PlannerRecurrence.NONE },
        reminderMinutes: { not: null },
        dueAt: { not: null },
      },
      select: {
        title: true,
        dueAt: true,
        recurrence: true,
        recurrenceUntil: true,
        reminderMinutes: true,
      },
    }),
    transaction.plannerPreferences.findUnique({
      where: { memberId: current.memberId },
      select: { timezone: true },
    }),
  ]);
  if (!(task?.dueAt && task.reminderMinutes !== null && current.occurrenceAt)) {
    return;
  }
  const timezone = preferences?.timezone ?? defaultTimezone;
  if (
    !withinSeries(
      task.dueAt,
      task.recurrence,
      current.occurrenceAt,
      timezone,
      task.recurrenceUntil
    )
  ) {
    return;
  }
  const next = await findNextTaskReminderOccurrence(
    transaction,
    current,
    {
      title: task.title,
      dueAt: task.dueAt,
      recurrence: task.recurrence,
      recurrenceUntil: task.recurrenceUntil,
      reminderMinutes: task.reminderMinutes,
    },
    timezone
  );
  if (!next) {
    return;
  }
  await enqueuePlannerReminder(transaction, {
    memberId: current.memberId,
    entityType: "PLANNER_TASK",
    entityId: current.entityId,
    ...next,
    timezone,
    href: `/planejamento?view=tasks&task=${encodeURIComponent(current.entityId)}&occurrence=${encodeURIComponent(next.occurrenceAt.toISOString())}`,
  });
};

const findNextEventReminderOccurrence = async (
  transaction: Prisma.TransactionClient,
  current: CurrentPlannerReminder,
  event: {
    title: string;
    startsAt: Date;
    recurrence: PlannerRecurrenceType;
    recurrenceUntil: Date | null;
    reminderMinutes: number;
    timezone: string;
  }
): Promise<EventReminderOccurrence | null> => {
  if (!current.occurrenceAt) {
    return null;
  }
  let target = new Date(current.occurrenceAt.getTime() + 1);
  for (let skipped = 0; skipped < 101; skipped += 1) {
    const occurrenceAt = firstOccurrenceOnOrAfter(
      event.startsAt,
      event.recurrence,
      target,
      event.timezone,
      event.recurrenceUntil
    );
    if (!occurrenceAt) {
      return null;
    }
    const exception = await transaction.plannerEventOccurrence.findFirst({
      where: {
        eventId: current.entityId,
        memberId: current.memberId,
        occurrenceStartsAt: occurrenceAt,
      },
      select: { startsAtOverride: true, titleOverride: true, deletedAt: true },
    });
    const startsAt = exception?.startsAtOverride ?? occurrenceAt;
    const reminderAt = new Date(
      startsAt.getTime() - event.reminderMinutes * 60_000
    );
    if (exception?.deletedAt || reminderAt < new Date()) {
      target = new Date(occurrenceAt.getTime() + 1);
      continue;
    }
    return {
      occurrenceAt,
      title: exception?.titleOverride ?? event.title,
      reminderAt,
    };
  }
  return null;
};

const scheduleNextEventReminder = async (
  transaction: Prisma.TransactionClient,
  current: CurrentPlannerReminder
) => {
  const event = await transaction.plannerEvent.findFirst({
    where: {
      id: current.entityId,
      memberId: current.memberId,
      deletedAt: null,
      recurrence: { not: PlannerRecurrence.NONE },
      reminderMinutes: { not: null },
    },
    select: {
      title: true,
      startsAt: true,
      recurrence: true,
      recurrenceUntil: true,
      reminderMinutes: true,
      timezone: true,
    },
  });
  if (!(event && event.reminderMinutes !== null && current.occurrenceAt)) {
    return;
  }
  if (
    !withinSeries(
      event.startsAt,
      event.recurrence,
      current.occurrenceAt,
      event.timezone,
      event.recurrenceUntil
    )
  ) {
    return;
  }
  const next = await findNextEventReminderOccurrence(transaction, current, {
    ...event,
    reminderMinutes: event.reminderMinutes,
  });
  if (!next) {
    return;
  }
  await enqueuePlannerReminder(transaction, {
    memberId: current.memberId,
    entityType: "PLANNER_EVENT",
    entityId: current.entityId,
    ...next,
    timezone: event.timezone,
    href: `/planejamento?view=calendar&event=${encodeURIComponent(current.entityId)}&occurrence=${encodeURIComponent(next.occurrenceAt.toISOString())}`,
  });
};

export const scheduleNextRecurringPlannerReminder = async (
  transaction: Prisma.TransactionClient,
  current: CurrentPlannerReminder
) => {
  if (!current.occurrenceAt) {
    return;
  }
  const activeMember = await transaction.member.findFirst({
    where: { id: current.memberId, deactivatedAt: null },
    select: { id: true },
  });
  if (!activeMember) {
    return;
  }
  if (current.entityType === "PLANNER_TASK") {
    await scheduleNextTaskReminder(transaction, current);
    return;
  }
  if (current.entityType === "PLANNER_EVENT") {
    await scheduleNextEventReminder(transaction, current);
  }
};
