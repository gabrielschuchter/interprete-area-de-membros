import "server-only";

import { randomUUID } from "node:crypto";
import {
  database,
  FocusTimerMode,
  PlannerEventKind,
  PlannerPriority,
  PlannerRecurrence,
  PlannerTaskStatus,
  type Prisma,
  type StudyActivityKind,
  StudyGoalPeriod,
} from "@repo/database";
import {
  enqueueDomainEvent,
  expandPlannerOccurrences as expandOccurrences,
  firstPlannerOccurrenceOnOrAfter as firstOccurrenceOnOrAfter,
  plannerDateFromZonedParts as fromZonedParts,
  notificationOutboxConsumerKey,
  plannerZonedParts as partsAt,
  isPlannerSeriesOccurrence as withinSeries,
} from "@repo/member-domain";
import { z } from "zod";
import { resolveCalendar } from "./student-calendar";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const hexColorPattern = /^#[\da-fA-F]{6}$/;
const defaultColumns = [
  {
    status: PlannerTaskStatus.TODO,
    label: "A fazer",
    color: "#CDBBB5",
    position: 0,
  },
  {
    status: PlannerTaskStatus.IN_PROGRESS,
    label: "Em andamento",
    color: "#8C1535",
    position: 1,
  },
  {
    status: PlannerTaskStatus.DONE,
    label: "Concluída",
    color: "#6A1A3A",
    position: 2,
  },
] as const;

const isoDate = z.string().datetime({ offset: true }).nullable().optional();
const requiredId = z.string().trim().min(1).max(255);
const taskInputSchema = z.object({
  id: requiredId.optional(),
  title: z.string().trim().min(1).max(180),
  description: z.string().max(8000).nullable().optional(),
  status: z.nativeEnum(PlannerTaskStatus).optional(),
  priority: z.nativeEnum(PlannerPriority).optional(),
  category: z.string().trim().max(80).nullable().optional(),
  dueAt: isoDate,
  recurrence: z.nativeEnum(PlannerRecurrence).optional(),
  recurrenceUntil: isoDate,
  reminderMinutes: z.number().int().min(0).max(10_080).nullable().optional(),
  parentTaskId: requiredId.nullable().optional(),
});

const eventInputSchema = z.object({
  id: requiredId.optional(),
  title: z.string().trim().min(1).max(180),
  description: z.string().max(8000).nullable().optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  timezone: z.string().trim().min(1).max(80).default(DEFAULT_TIMEZONE),
  allDay: z.boolean().optional(),
  color: z.string().regex(hexColorPattern).default("#7A5A69"),
  location: z.string().trim().max(300).nullable().optional(),
  recurrence: z.nativeEnum(PlannerRecurrence).optional(),
  recurrenceUntil: isoDate,
  reminderMinutes: z.number().int().min(0).max(10_080).nullable().optional(),
  kind: z.nativeEnum(PlannerEventKind).optional(),
});

const occurrenceDateSchema = z.string().datetime({ offset: true });

const normalizeDate = (value: string | null | undefined) =>
  value ? new Date(value) : null;

const startOfLocalDay = (date: Date, timezone: string) => {
  const parts = partsAt(date, timezone);
  return fromZonedParts({ ...parts, hour: 0, minute: 0, second: 0 }, timezone);
};

const addLocalDays = (date: Date, days: number, timezone: string) => {
  const parts = partsAt(date, timezone);
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  localDate.setUTCDate(localDate.getUTCDate() + days);
  return fromZonedParts(
    {
      year: localDate.getUTCFullYear(),
      month: localDate.getUTCMonth() + 1,
      day: localDate.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timezone
  );
};

const toDateKey = (date: Date, timezone: string) => {
  const { year, month, day } = partsAt(date, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const schedulePlannerReminder = async (
  transaction: Prisma.TransactionClient,
  input: {
    memberId: string;
    entityType: "PLANNER_TASK" | "PLANNER_EVENT";
    entityId: string;
    title: string;
    reminderAt: Date;
    href: string;
    occurrenceAt?: Date;
    timezone?: string;
  }
) => {
  const reminderId = randomUUID();
  const now = new Date();
  const reminderAt = input.reminderAt < now ? now : input.reminderAt;
  const event = await enqueueDomainEvent(transaction, {
    eventType: "notifications.batch_requested",
    actorId: null,
    aggregateType: "planner.reminder",
    aggregateId: reminderId,
    idempotencyKey: `planner-reminder:${reminderId}`,
    payload: {
      notifications: [
        {
          recipientId: input.memberId,
          type: "PLANNER_REMINDER",
          entityType: input.entityType,
          entityId: input.entityId,
          dedupeKey: `planner-reminder:${reminderId}`,
          priority: 2,
          title: `Lembrete: ${input.title}`.slice(0, 160),
          body: input.occurrenceAt
            ? `Este item está previsto para ${input.occurrenceAt.toLocaleString("pt-BR", { timeZone: input.timezone ?? DEFAULT_TIMEZONE })}.`
            : "Você definiu um lembrete para este item.",
          href: input.href,
        },
      ],
    },
    occurredAt: reminderAt,
    consumers: [notificationOutboxConsumerKey],
  });
  await transaction.outboxJob.updateMany({
    where: { eventId: event.id, consumerKey: notificationOutboxConsumerKey },
    data: { availableAt: reminderAt },
  });
  await transaction.plannerReminder.create({
    data: {
      id: reminderId,
      memberId: input.memberId,
      entityType: input.entityType,
      entityId: input.entityId,
      occurrenceAt: input.occurrenceAt ?? null,
      remindAt: reminderAt,
      domainEventId: event.id,
    },
  });
};

const cancelPlannerReminders = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  entityType: "PLANNER_TASK" | "PLANNER_EVENT",
  entityId: string
) => {
  const reminders = await transaction.plannerReminder.findMany({
    where: {
      memberId,
      entityType,
      entityId,
      cancelledAt: null,
      deliveredAt: null,
    },
    select: { id: true, domainEventId: true },
  });
  if (reminders.length === 0) {
    return;
  }
  const now = new Date();
  await transaction.plannerReminder.updateMany({
    where: { id: { in: reminders.map(({ id }) => id) }, cancelledAt: null },
    data: { cancelledAt: now },
  });
  await transaction.outboxJob.updateMany({
    where: {
      eventId: { in: reminders.map(({ domainEventId }) => domainEventId) },
      status: { in: ["PENDING", "RETRY"] },
    },
    data: { status: "SUCCEEDED", completedAt: now },
  });
};

const cancelPlannerOccurrenceReminder = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  entityType: "PLANNER_TASK" | "PLANNER_EVENT",
  entityId: string,
  occurrenceAt: Date
) => {
  const reminders = await transaction.plannerReminder.findMany({
    where: {
      memberId,
      entityType,
      entityId,
      occurrenceAt,
      cancelledAt: null,
      deliveredAt: null,
    },
    select: { id: true, domainEventId: true },
  });
  if (reminders.length === 0) {
    return;
  }
  const now = new Date();
  await transaction.plannerReminder.updateMany({
    where: {
      id: { in: reminders.map((reminder) => reminder.id) },
      cancelledAt: null,
    },
    data: { cancelledAt: now },
  });
  await transaction.outboxJob.updateMany({
    where: {
      eventId: { in: reminders.map((reminder) => reminder.domainEventId) },
      status: { in: ["PENDING", "RETRY"] },
    },
    data: { status: "SUCCEEDED", completedAt: now },
  });
};

const syncTaskOccurrenceReminder = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  taskId: string,
  occurrenceAt: Date
) => {
  await cancelPlannerOccurrenceReminder(
    transaction,
    memberId,
    "PLANNER_TASK",
    taskId,
    occurrenceAt
  );
  const [task, exception, preferences] = await Promise.all([
    transaction.plannerTask.findFirst({
      where: {
        id: taskId,
        memberId,
        deletedAt: null,
        status: { not: PlannerTaskStatus.DONE },
      },
      select: {
        title: true,
        dueAt: true,
        recurrence: true,
        recurrenceUntil: true,
        reminderMinutes: true,
      },
    }),
    transaction.plannerTaskOccurrence.findUnique({
      where: { taskId_occurrenceAt: { taskId, occurrenceAt } },
      select: {
        titleOverride: true,
        dueAtOverride: true,
        status: true,
        completedAt: true,
        deletedAt: true,
      },
    }),
    transaction.plannerPreferences.findUnique({
      where: { memberId },
      select: { timezone: true },
    }),
  ]);
  if (
    !task?.dueAt ||
    task.recurrence === PlannerRecurrence.NONE ||
    task.reminderMinutes === null ||
    exception?.deletedAt ||
    exception?.completedAt ||
    exception?.status === PlannerTaskStatus.DONE
  ) {
    return;
  }
  const timezone = preferences?.timezone ?? DEFAULT_TIMEZONE;
  if (
    !withinSeries(
      task.dueAt,
      task.recurrence,
      occurrenceAt,
      timezone,
      task.recurrenceUntil
    )
  ) {
    return;
  }
  const dueAt = exception?.dueAtOverride ?? occurrenceAt;
  await schedulePlannerReminder(transaction, {
    memberId,
    entityType: "PLANNER_TASK",
    entityId: taskId,
    title: exception?.titleOverride ?? task.title,
    reminderAt: new Date(dueAt.getTime() - task.reminderMinutes * 60_000),
    occurrenceAt,
    timezone,
    href: `/planejamento?view=tasks&task=${encodeURIComponent(taskId)}&occurrence=${encodeURIComponent(occurrenceAt.toISOString())}`,
  });
};

const syncEventOccurrenceReminder = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  eventId: string,
  occurrenceAt: Date
) => {
  await cancelPlannerOccurrenceReminder(
    transaction,
    memberId,
    "PLANNER_EVENT",
    eventId,
    occurrenceAt
  );
  const [event, exception] = await Promise.all([
    transaction.plannerEvent.findFirst({
      where: { id: eventId, memberId, deletedAt: null },
      select: {
        title: true,
        startsAt: true,
        recurrence: true,
        recurrenceUntil: true,
        reminderMinutes: true,
        timezone: true,
      },
    }),
    transaction.plannerEventOccurrence.findUnique({
      where: {
        eventId_occurrenceStartsAt: {
          eventId,
          occurrenceStartsAt: occurrenceAt,
        },
      },
      select: { titleOverride: true, startsAtOverride: true, deletedAt: true },
    }),
  ]);
  if (
    !event ||
    event.recurrence === PlannerRecurrence.NONE ||
    event.reminderMinutes === null ||
    exception?.deletedAt ||
    !withinSeries(
      event.startsAt,
      event.recurrence,
      occurrenceAt,
      event.timezone,
      event.recurrenceUntil
    )
  ) {
    return;
  }
  const startsAt = exception?.startsAtOverride ?? occurrenceAt;
  await schedulePlannerReminder(transaction, {
    memberId,
    entityType: "PLANNER_EVENT",
    entityId: eventId,
    title: exception?.titleOverride ?? event.title,
    reminderAt: new Date(startsAt.getTime() - event.reminderMinutes * 60_000),
    occurrenceAt,
    timezone: event.timezone,
    href: `/planejamento?view=calendar&event=${encodeURIComponent(eventId)}&occurrence=${encodeURIComponent(occurrenceAt.toISOString())}`,
  });
};

interface CalendarStudySource {
  readonly activityKind: StudyActivityKind;
  readonly clientSessionId: string | null;
  readonly endedAt: Date | null;
  readonly id: string;
  readonly resourceId: string | null;
  readonly startedAt: Date;
}
interface CalendarStudyLesson {
  readonly module: { readonly course: { readonly slug: string } };
  readonly slug: string;
  readonly title: string;
}
interface CalendarStudyTimer {
  readonly linkedResourceId: string | null;
  readonly title: string | null;
}

const calendarStudyDestination = (
  session: CalendarStudySource,
  timerById: ReadonlyMap<string, CalendarStudyTimer>,
  lessonById: ReadonlyMap<string, CalendarStudyLesson>,
  activityById: ReadonlyMap<
    string,
    { readonly slug: string; readonly title: string }
  >,
  libraryItemById: ReadonlyMap<string, { readonly title: string }>
) => {
  let title = "Sessão de estudo";
  let href = "/aprender";
  switch (session.activityKind) {
    case "PERSONAL_TIMER": {
      const timer = timerById.get(session.clientSessionId ?? "");
      title = timer?.title?.trim() || "Cronômetro";
      href = "/ferramentas?view=timer";
      const linkedLesson = timer?.linkedResourceId
        ? lessonById.get(timer.linkedResourceId)
        : null;
      if (linkedLesson) {
        title = timer?.title?.trim() || linkedLesson.title;
        href = `/aprender/cursos/${linkedLesson.module.course.slug}/${linkedLesson.slug}`;
      }
      break;
    }
    case "LESSON": {
      const lesson = session.resourceId
        ? lessonById.get(session.resourceId)
        : null;
      if (lesson) {
        title = lesson.title;
        href = `/aprender/cursos/${lesson.module.course.slug}/${lesson.slug}`;
      }
      break;
    }
    case "ACTIVITY": {
      const activity = session.resourceId
        ? activityById.get(session.resourceId)
        : null;
      if (activity) {
        title = activity.title;
        href = `/atividades/${activity.slug}`;
      }
      break;
    }
    case "LIBRARY_ITEM": {
      const item = session.resourceId
        ? libraryItemById.get(session.resourceId)
        : null;
      if (item) {
        title = item.title;
        href = "/biblioteca";
      }
      break;
    }
    case "RECORDING":
      title = "Gravação";
      href = "/encontros/gravacoes";
      break;
    case "COMMUNITY":
      title = "Comunidade";
      href = "/comunidade";
      break;
    default:
      break;
  }
  return { href, title };
};

export const getPlannerDashboard = async (
  memberId: string,
  rangeInput?: { start?: string; end?: string }
) => {
  const savedPreferences = await database.plannerPreferences.findUnique({
    where: { memberId },
    select: { timezone: true },
  });
  const preferences = savedPreferences ?? { timezone: DEFAULT_TIMEZONE };
  const now = new Date();
  const timezone = preferences.timezone;
  const rangeStart = rangeInput?.start
    ? new Date(rangeInput.start)
    : addLocalDays(startOfLocalDay(now, timezone), -30, timezone);
  const rangeEnd = rangeInput?.end
    ? new Date(rangeInput.end)
    : addLocalDays(startOfLocalDay(now, timezone), 120, timezone);
  if (
    Number.isNaN(rangeStart.valueOf()) ||
    Number.isNaN(rangeEnd.valueOf()) ||
    rangeEnd <= rangeStart ||
    rangeEnd.getTime() - rangeStart.getTime() > 400 * 86_400_000
  ) {
    throw new Error("O período solicitado não é válido.");
  }

  const weekStart = startOfLocalDay(now, timezone);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(now);
  const daysFromMonday =
    ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as const)[
      weekday as "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
    ] ?? 0;
  const weekStartDate = addLocalDays(weekStart, -daysFromMonday, timezone);
  const monthStartParts = partsAt(now, timezone);
  const monthStart = fromZonedParts(
    { ...monthStartParts, day: 1, hour: 0, minute: 0, second: 0 },
    timezone
  );
  const weekKey = toDateKey(weekStartDate, timezone);
  const monthKey = toDateKey(monthStart, timezone);
  const weekEnd = addLocalDays(weekStartDate, 7, timezone);
  const monthEnd = fromZonedParts(
    {
      year: monthStartParts.year,
      month: monthStartParts.month + 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timezone
  );

  const [
    columns,
    tasks,
    events,
    meetings,
    goals,
    weekMinutes,
    monthMinutes,
    completedLessons,
    submittedActivities,
    completedAssignedTasks,
    completedPlannerTasks,
  ] = await Promise.all([
    database.plannerBoardColumn.findMany({
      where: { memberId },
      orderBy: { position: "asc" },
      select: {
        id: true,
        status: true,
        label: true,
        color: true,
        position: true,
      },
    }),
    database.plannerTask.findMany({
      where: { memberId, parentTaskId: null, deletedAt: null },
      orderBy: [{ dueAt: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        category: true,
        dueAt: true,
        completedAt: true,
        recurrence: true,
        recurrenceUntil: true,
        reminderMinutes: true,
        updatedAt: true,
        subtasks: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            title: true,
            status: true,
            dueAt: true,
            priority: true,
            completedAt: true,
          },
        },
        occurrences: {
          where: { memberId, occurrenceAt: { gte: rangeStart, lte: rangeEnd } },
          select: {
            occurrenceAt: true,
            dueAtOverride: true,
            titleOverride: true,
            descriptionOverride: true,
            status: true,
            priority: true,
            deletedAt: true,
            completedAt: true,
          },
        },
      },
    }),
    database.plannerEvent.findMany({
      where: {
        memberId,
        deletedAt: null,
        startsAt: { lte: rangeEnd },
        OR: [
          { recurrence: { not: PlannerRecurrence.NONE } },
          { endsAt: { gte: rangeStart } },
        ],
      },
      orderBy: { startsAt: "asc" },
      take: 500,
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        allDay: true,
        color: true,
        location: true,
        recurrence: true,
        recurrenceUntil: true,
        reminderMinutes: true,
        occurrences: {
          where: {
            memberId,
            occurrenceStartsAt: { gte: rangeStart, lte: rangeEnd },
          },
          select: {
            occurrenceStartsAt: true,
            startsAtOverride: true,
            endsAtOverride: true,
            titleOverride: true,
            descriptionOverride: true,
            colorOverride: true,
            deletedAt: true,
          },
        },
      },
    }),
    database.meeting.findMany({
      where: {
        status: "PUBLISHED",
        startsAt: { gte: rangeStart, lte: rangeEnd },
        participants: { some: { memberId } },
      },
      orderBy: { startsAt: "asc" },
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        joinUrl: true,
        kind: true,
      },
    }),
    database.studyGoal.findMany({
      where: { memberId },
      select: { id: true, period: true, targetMinutes: true, updatedAt: true },
      orderBy: { period: "asc" },
    }),
    database.studyActivityInterval.aggregate({
      where: {
        memberId,
        isPlayback: false,
        startedAt: { gte: weekStartDate, lt: weekEnd },
      },
      _sum: { seconds: true },
    }),
    database.studyActivityInterval.aggregate({
      where: {
        memberId,
        isPlayback: false,
        startedAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { seconds: true },
    }),
    database.lessonProgress.count({
      where: { memberId, status: "COMPLETED", completedAt: { not: null } },
    }),
    database.activitySubmission.count({
      where: { memberId, status: { in: ["SUBMITTED", "REVIEWED"] } },
    }),
    database.learningTaskCompletion.count({ where: { memberId } }),
    database.plannerTask.count({
      where: {
        memberId,
        deletedAt: null,
        parentTaskId: null,
        status: PlannerTaskStatus.DONE,
      },
    }),
  ]);

  const [calendarActivities, studyTrackingSessions] = rangeInput
    ? await Promise.all([
        resolveCalendar(memberId, { start: rangeStart, end: rangeEnd }, now),
        database.studyTrackingSession.findMany({
          where: {
            memberId,
            startedAt: { lt: rangeEnd },
            endedAt: { not: null, gte: rangeStart },
          },
          orderBy: { startedAt: "desc" },
          take: 300,
          select: {
            id: true,
            clientSessionId: true,
            activityKind: true,
            resourceId: true,
            startedAt: true,
            endedAt: true,
          },
        }),
      ])
    : [[], []];

  const intervalSeconds = studyTrackingSessions.length
    ? await database.studyActivityInterval.groupBy({
        by: ["sessionId"],
        where: {
          memberId,
          isPlayback: false,
          sessionId: { in: studyTrackingSessions.map((session) => session.id) },
        },
        _sum: { seconds: true },
      })
    : [];
  const secondsBySession = new Map(
    intervalSeconds.map((entry) => [entry.sessionId, entry._sum.seconds ?? 0])
  );
  const sessionResourceIds = [
    ...new Set(
      studyTrackingSessions
        .map((session) => session.resourceId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const personalTimerIds = studyTrackingSessions
    .filter((session) => session.activityKind === "PERSONAL_TIMER")
    .map((session) => session.clientSessionId);
  const [
    linkedLessons,
    linkedActivities,
    linkedLibraryItems,
    linkedTimerSessions,
  ] =
    sessionResourceIds.length || personalTimerIds.length
      ? await Promise.all([
          database.lesson.findMany({
            where: {
              id: { in: sessionResourceIds },
              status: "PUBLISHED",
            },
            select: {
              id: true,
              title: true,
              slug: true,
              module: { select: { course: { select: { slug: true } } } },
            },
          }),
          database.activity.findMany({
            where: { id: { in: sessionResourceIds }, status: "PUBLISHED" },
            select: { id: true, title: true, slug: true },
          }),
          database.libraryItem.findMany({
            where: { id: { in: sessionResourceIds }, status: "PUBLISHED" },
            select: { id: true, title: true },
          }),
          database.focusTimerSession.findMany({
            where: { memberId, id: { in: personalTimerIds } },
            select: { id: true, title: true, linkedResourceId: true },
          }),
        ])
      : [[], [], [], []];
  const lessonById = new Map(
    linkedLessons.map((lesson) => [lesson.id, lesson])
  );
  const activityById = new Map(
    linkedActivities.map((activity) => [activity.id, activity])
  );
  const libraryItemById = new Map(
    linkedLibraryItems.map((item) => [item.id, item])
  );
  const timerById = new Map(
    linkedTimerSessions.map((session) => [session.id, session])
  );
  const assignedActivities = calendarActivities;
  const calendarStudySessions = studyTrackingSessions.flatMap((session) => {
    const seconds = secondsBySession.get(session.id) ?? 0;
    if (!(seconds && session.endedAt)) {
      return [];
    }
    const { href, title } = calendarStudyDestination(
      session,
      timerById,
      lessonById,
      activityById,
      libraryItemById
    );
    return [
      {
        id: session.id,
        title,
        href,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        seconds,
      },
    ];
  });

  const expandTaskOccurrences = () => {
    type ExpandedPlannerTask = Omit<
      (typeof tasks)[number],
      "dueAt" | "completedAt"
    > & {
      dueAt: Date | null;
      completedAt: Date | null;
      occurrenceKey: string | null;
      occurrenceAt: Date | null;
    };
    const expandTask = (
      task: (typeof tasks)[number]
    ): ExpandedPlannerTask[] => {
      if (!task.dueAt) {
        return task.recurrence === PlannerRecurrence.NONE
          ? [
              {
                ...task,
                dueAt: null,
                occurrenceKey: null,
                occurrenceAt: null,
                completedAt: task.completedAt,
              },
            ]
          : [];
      }
      const exceptionsByDate = new Map(
        task.occurrences.map((occurrence) => [
          occurrence.occurrenceAt.toISOString(),
          occurrence,
        ])
      );
      return expandOccurrences(
        task.dueAt,
        task.recurrence,
        task.recurrenceUntil,
        rangeStart,
        rangeEnd,
        timezone
      ).flatMap((occurrenceAt) => {
        const exception = exceptionsByDate.get(occurrenceAt.toISOString());
        if (exception?.deletedAt) {
          return [];
        }
        return [
          {
            ...task,
            title: exception?.titleOverride ?? task.title,
            description: exception?.descriptionOverride ?? task.description,
            status: exception?.status ?? task.status,
            priority: exception?.priority ?? task.priority,
            dueAt: exception?.dueAtOverride ?? occurrenceAt,
            completedAt: exception?.completedAt ?? null,
            occurrenceKey: occurrenceAt.toISOString(),
            occurrenceAt,
          },
        ];
      });
    };
    return tasks.flatMap(expandTask);
  };
  const expandedTasks = expandTaskOccurrences();
  const expandEventOccurrences = () =>
    events.flatMap((event) => {
      const exceptionsByDate = new Map(
        event.occurrences.map((occurrence) => [
          occurrence.occurrenceStartsAt.toISOString(),
          occurrence,
        ])
      );
      return expandOccurrences(
        event.startsAt,
        event.recurrence,
        event.recurrenceUntil,
        rangeStart,
        rangeEnd,
        event.timezone
      ).flatMap((occurrenceStartsAt) => {
        const exception = exceptionsByDate.get(
          occurrenceStartsAt.toISOString()
        );
        if (exception?.deletedAt) {
          return [];
        }
        const shift = occurrenceStartsAt.getTime() - event.startsAt.getTime();
        return [
          {
            ...event,
            title: exception?.titleOverride ?? event.title,
            description: exception?.descriptionOverride ?? event.description,
            color: exception?.colorOverride ?? event.color,
            startsAt: exception?.startsAtOverride ?? occurrenceStartsAt,
            endsAt:
              exception?.endsAtOverride ??
              new Date(event.endsAt.getTime() + shift),
            occurrenceKey: occurrenceStartsAt.toISOString(),
            occurrenceStartsAt,
          },
        ];
      });
    });
  const expandedEvents = expandEventOccurrences();

  return {
    columns: defaultColumns.map(
      (column) =>
        columns.find((saved) => saved.status === column.status) ?? {
          ...column,
          id: `default-${column.status}`,
        }
    ),
    tasks: expandedTasks,
    events: expandedEvents,
    meetings,
    activities: assignedActivities,
    studySessions: calendarStudySessions,
    goals,
    preferences,
    stats: {
      weeklyMinutes: Math.floor((weekMinutes._sum.seconds ?? 0) / 60),
      monthlyMinutes: Math.floor((monthMinutes._sum.seconds ?? 0) / 60),
      completedLessons,
      submittedActivities,
      completedAssignedTasks,
      completedPlannerTasks,
      weekKey,
      monthKey,
    },
    range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
  };
};

export const savePlannerGoal = (
  memberId: string,
  input: { period: StudyGoalPeriod; targetMinutes: number }
) => {
  const parsed = z
    .object({
      period: z.nativeEnum(StudyGoalPeriod),
      targetMinutes: z.number().int().min(1).max(10_080),
    })
    .parse(input);
  return database.$transaction(async (transaction) => {
    const goal = await transaction.studyGoal.upsert({
      where: { memberId_period: { memberId, period: parsed.period } },
      create: {
        memberId,
        period: parsed.period,
        targetMinutes: parsed.targetMinutes,
      },
      update: { targetMinutes: parsed.targetMinutes },
      select: { id: true, targetMinutes: true },
    });
    await transaction.studyGoalRevision.create({
      data: { studyGoalId: goal.id, targetMinutes: parsed.targetMinutes },
    });
    return goal;
  });
};

const taskPayload = (input: unknown) => taskInputSchema.parse(input);
const eventPayload = (input: unknown) => eventInputSchema.parse(input);

const syncTaskReminder = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  id: string,
  values: {
    title: string;
    dueAt: Date | null;
    recurrence: PlannerRecurrence;
    recurrenceUntil: Date | null;
    reminderMinutes: number | null;
    status: PlannerTaskStatus;
  }
) => {
  await cancelPlannerReminders(transaction, memberId, "PLANNER_TASK", id);
  if (
    !values.dueAt ||
    values.reminderMinutes === null ||
    values.status === PlannerTaskStatus.DONE
  ) {
    return;
  }
  const timezone = await transaction.plannerPreferences
    .findUnique({
      where: { memberId },
      select: { timezone: true },
    })
    .then((preferences) => preferences?.timezone ?? DEFAULT_TIMEZONE);
  let occurrenceAt = values.dueAt;
  let dueAt = values.dueAt;
  let title = values.title;
  if (values.recurrence !== PlannerRecurrence.NONE) {
    let target = new Date();
    let found = false;
    for (let skipped = 0; skipped < 101; skipped += 1) {
      const next = firstOccurrenceOnOrAfter(
        values.dueAt,
        values.recurrence,
        target,
        timezone,
        values.recurrenceUntil
      );
      if (!next) {
        return;
      }
      const exception = await transaction.plannerTaskOccurrence.findUnique({
        where: { taskId_occurrenceAt: { taskId: id, occurrenceAt: next } },
        select: {
          titleOverride: true,
          dueAtOverride: true,
          status: true,
          completedAt: true,
          deletedAt: true,
        },
      });
      if (
        exception?.deletedAt ||
        exception?.completedAt ||
        exception?.status === PlannerTaskStatus.DONE
      ) {
        target = new Date(next.getTime() + 1);
        continue;
      }
      occurrenceAt = next;
      dueAt = exception?.dueAtOverride ?? next;
      title = exception?.titleOverride ?? values.title;
      found = true;
      break;
    }
    if (!found) {
      return;
    }
  }
  await schedulePlannerReminder(transaction, {
    memberId,
    entityType: "PLANNER_TASK",
    entityId: id,
    title,
    reminderAt: new Date(dueAt.getTime() - values.reminderMinutes * 60_000),
    occurrenceAt,
    timezone,
    href: `/planejamento?view=tasks&task=${encodeURIComponent(id)}${values.recurrence !== PlannerRecurrence.NONE ? `&occurrence=${encodeURIComponent(occurrenceAt.toISOString())}` : ""}`,
  });
};

export const savePlannerTask = async (memberId: string, input: unknown) => {
  const parsed = taskPayload(input);
  const dueAt = normalizeDate(parsed.dueAt);
  const recurrenceUntil = normalizeDate(parsed.recurrenceUntil);
  const recurrence = parsed.recurrence ?? PlannerRecurrence.NONE;
  if (recurrence !== PlannerRecurrence.NONE && !dueAt) {
    throw new Error("Defina uma data para repetir a tarefa.");
  }
  if (dueAt && recurrenceUntil && recurrenceUntil < dueAt) {
    throw new Error(
      "A repetição não pode terminar antes da primeira ocorrência."
    );
  }
  if (parsed.parentTaskId) {
    const parent = await database.plannerTask.findFirst({
      where: { id: parsed.parentTaskId, memberId, deletedAt: null },
      select: { id: true, parentTaskId: true },
    });
    if (!parent || parent.parentTaskId) {
      throw new Error("A subtarefa não pode ser associada a este item.");
    }
  }
  const data = {
    title: parsed.title,
    description: parsed.description?.trim() || null,
    status: parsed.status ?? PlannerTaskStatus.TODO,
    priority: parsed.priority ?? PlannerPriority.MEDIUM,
    category: parsed.category?.trim() || null,
    dueAt,
    recurrence,
    recurrenceUntil,
    reminderMinutes: parsed.reminderMinutes ?? null,
    parentTaskId: parsed.parentTaskId ?? null,
  };
  return database.$transaction(async (transaction) => {
    const task = parsed.id
      ? await transaction.plannerTask
          .updateMany({
            where: { id: parsed.id, memberId, deletedAt: null },
            data,
          })
          .then(({ count }) => {
            if (count === 0) {
              throw new Error("A tarefa não foi encontrada.");
            }
            return transaction.plannerTask.findFirstOrThrow({
              where: { id: parsed.id, memberId },
              select: { id: true, title: true, dueAt: true },
            });
          })
      : await transaction.plannerTask.create({
          data: { ...data, memberId },
          select: { id: true, title: true, dueAt: true },
        });
    await syncTaskReminder(transaction, memberId, task.id, {
      title: task.title,
      dueAt: task.dueAt,
      recurrence,
      recurrenceUntil,
      reminderMinutes: data.reminderMinutes,
      status: data.status,
    });
    return task;
  });
};

export const savePlannerTaskOccurrence = (memberId: string, input: unknown) => {
  const parsed = taskInputSchema
    .extend({
      id: requiredId,
      occurrenceAt: occurrenceDateSchema,
    })
    .parse(input);
  const occurrenceAt = new Date(parsed.occurrenceAt);
  return database.$transaction(async (transaction) => {
    const task = await transaction.plannerTask.findFirst({
      where: {
        id: parsed.id,
        memberId,
        deletedAt: null,
        recurrence: { not: PlannerRecurrence.NONE },
      },
      select: {
        id: true,
        dueAt: true,
        recurrence: true,
        recurrenceUntil: true,
      },
    });
    const timezone = await transaction.plannerPreferences
      .findUnique({
        where: { memberId },
        select: { timezone: true },
      })
      .then((preferences) => preferences?.timezone ?? DEFAULT_TIMEZONE);
    if (
      !(
        task?.dueAt &&
        withinSeries(
          task.dueAt,
          task.recurrence,
          occurrenceAt,
          timezone,
          task.recurrenceUntil
        )
      )
    ) {
      throw new Error("A tarefa repetida não foi encontrada.");
    }
    const occurrence = await transaction.plannerTaskOccurrence.upsert({
      where: { taskId_occurrenceAt: { taskId: task.id, occurrenceAt } },
      create: {
        taskId: task.id,
        memberId,
        occurrenceAt,
        titleOverride: parsed.title,
        descriptionOverride: parsed.description?.trim() || null,
        dueAtOverride: normalizeDate(parsed.dueAt),
        priority: parsed.priority ?? PlannerPriority.MEDIUM,
        status: parsed.status ?? PlannerTaskStatus.TODO,
      },
      update: {
        titleOverride: parsed.title,
        descriptionOverride: parsed.description?.trim() || null,
        dueAtOverride: normalizeDate(parsed.dueAt),
        priority: parsed.priority ?? PlannerPriority.MEDIUM,
        status: parsed.status ?? PlannerTaskStatus.TODO,
        deletedAt: null,
      },
      select: { id: true, occurrenceAt: true, status: true },
    });
    await syncTaskOccurrenceReminder(
      transaction,
      memberId,
      task.id,
      occurrenceAt
    );
    return occurrence;
  });
};

export const changePlannerTaskStatus = (
  memberId: string,
  input: { id: string; status: PlannerTaskStatus; occurrenceAt?: string }
) => {
  const parsed = z
    .object({
      id: requiredId,
      status: z.nativeEnum(PlannerTaskStatus),
      occurrenceAt: occurrenceDateSchema.optional(),
    })
    .parse(input);
  const completedAt =
    parsed.status === PlannerTaskStatus.DONE ? new Date() : null;
  if (parsed.occurrenceAt) {
    const occurrenceAt = new Date(parsed.occurrenceAt);
    return database.$transaction(async (transaction) => {
      const task = await transaction.plannerTask.findFirst({
        where: {
          id: parsed.id,
          memberId,
          deletedAt: null,
          recurrence: { not: PlannerRecurrence.NONE },
        },
        select: {
          id: true,
          dueAt: true,
          recurrence: true,
          recurrenceUntil: true,
        },
      });
      const timezone = await transaction.plannerPreferences
        .findUnique({
          where: { memberId },
          select: { timezone: true },
        })
        .then((preferences) => preferences?.timezone ?? DEFAULT_TIMEZONE);
      if (
        !(
          task?.dueAt &&
          withinSeries(
            task.dueAt,
            task.recurrence,
            occurrenceAt,
            timezone,
            task.recurrenceUntil
          )
        )
      ) {
        throw new Error("A ocorrência repetida não foi encontrada.");
      }
      const occurrence = await transaction.plannerTaskOccurrence.upsert({
        where: { taskId_occurrenceAt: { taskId: parsed.id, occurrenceAt } },
        create: {
          taskId: parsed.id,
          memberId,
          occurrenceAt,
          status: parsed.status,
          completedAt,
        },
        update: { status: parsed.status, completedAt, deletedAt: null },
        select: { id: true, status: true },
      });
      await syncTaskOccurrenceReminder(
        transaction,
        memberId,
        parsed.id,
        occurrenceAt
      );
      return occurrence;
    });
  }
  return database.$transaction(async (transaction) => {
    const task = await transaction.plannerTask.findFirst({
      where: { id: parsed.id, memberId, deletedAt: null },
      select: {
        id: true,
        title: true,
        dueAt: true,
        recurrence: true,
        recurrenceUntil: true,
        reminderMinutes: true,
      },
    });
    if (!task) {
      throw new Error("A tarefa não foi encontrada.");
    }
    await transaction.plannerTask.updateMany({
      where: { id: task.id, memberId, deletedAt: null },
      data: { status: parsed.status, completedAt },
    });
    await syncTaskReminder(transaction, memberId, task.id, {
      ...task,
      status: parsed.status,
    });
    return { count: 1 };
  });
};

export const deletePlannerTask = (
  memberId: string,
  input: { id: string; occurrenceAt?: string }
) => {
  const parsed = z
    .object({ id: requiredId, occurrenceAt: occurrenceDateSchema.optional() })
    .parse(input);
  const now = new Date();
  return database.$transaction(async (transaction) => {
    const task = await transaction.plannerTask.findFirst({
      where: { id: parsed.id, memberId, deletedAt: null },
      select: {
        id: true,
        dueAt: true,
        recurrence: true,
        recurrenceUntil: true,
      },
    });
    if (!task) {
      throw new Error("A tarefa não foi encontrada.");
    }
    if (parsed.occurrenceAt) {
      const occurrenceAt = new Date(parsed.occurrenceAt);
      const timezone = await transaction.plannerPreferences
        .findUnique({
          where: { memberId },
          select: { timezone: true },
        })
        .then((preferences) => preferences?.timezone ?? DEFAULT_TIMEZONE);
      if (
        task.recurrence === PlannerRecurrence.NONE ||
        !task.dueAt ||
        !withinSeries(
          task.dueAt,
          task.recurrence,
          occurrenceAt,
          timezone,
          task.recurrenceUntil
        )
      ) {
        throw new Error("A ocorrência repetida não foi encontrada.");
      }
      const occurrence = await transaction.plannerTaskOccurrence.upsert({
        where: {
          taskId_occurrenceAt: { taskId: task.id, occurrenceAt },
        },
        create: {
          taskId: task.id,
          memberId,
          occurrenceAt,
          deletedAt: now,
        },
        update: { deletedAt: now },
      });
      await cancelPlannerOccurrenceReminder(
        transaction,
        memberId,
        "PLANNER_TASK",
        task.id,
        occurrenceAt
      );
      return occurrence;
    }
    await cancelPlannerReminders(
      transaction,
      memberId,
      "PLANNER_TASK",
      task.id
    );
    return transaction.plannerTask.updateMany({
      where: { id: task.id, memberId, deletedAt: null },
      data: { deletedAt: now },
    });
  });
};

export const restorePlannerTask = async (memberId: string, id: string) => {
  const parsedId = requiredId.parse(id);
  const result = await database.$transaction(async (transaction) => {
    const task = await transaction.plannerTask.findFirst({
      where: { id: parsedId, memberId, deletedAt: { not: null } },
      select: {
        id: true,
        title: true,
        dueAt: true,
        recurrence: true,
        recurrenceUntil: true,
        reminderMinutes: true,
        status: true,
      },
    });
    if (!task) {
      throw new Error("A tarefa não está mais disponível para desfazer.");
    }
    const restored = await transaction.plannerTask.updateMany({
      where: { id: parsedId, memberId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (restored.count > 0) {
      await syncTaskReminder(transaction, memberId, task.id, task);
    }
    return restored;
  });
  if (result.count === 0) {
    throw new Error("A tarefa não está mais disponível para desfazer.");
  }
  return result;
};

export const restorePlannerTaskOccurrence = (
  memberId: string,
  input: { id: string; occurrenceAt: string }
) => {
  const parsed = z
    .object({ id: requiredId, occurrenceAt: occurrenceDateSchema })
    .parse(input);
  const occurrenceAt = new Date(parsed.occurrenceAt);
  return database.$transaction(async (transaction) => {
    const result = await transaction.plannerTaskOccurrence.updateMany({
      where: {
        taskId: parsed.id,
        memberId,
        occurrenceAt,
        deletedAt: { not: null },
      },
      data: { deletedAt: null },
    });
    if (result.count > 0) {
      await syncTaskOccurrenceReminder(
        transaction,
        memberId,
        parsed.id,
        occurrenceAt
      );
    }
    return result;
  });
};

export const duplicatePlannerTask = async (memberId: string, id: string) => {
  const parsedId = requiredId.parse(id);
  const task = await database.plannerTask.findFirst({
    where: { id: parsedId, memberId, deletedAt: null },
    select: {
      title: true,
      description: true,
      priority: true,
      category: true,
      dueAt: true,
    },
  });
  if (!task) {
    throw new Error("A tarefa não foi encontrada.");
  }
  return database.plannerTask.create({
    data: {
      memberId,
      title: `${task.title} (cópia)`.slice(0, 180),
      description: task.description,
      priority: task.priority,
      category: task.category,
      dueAt: task.dueAt,
      recurrence: PlannerRecurrence.NONE,
    },
    select: { id: true, title: true },
  });
};

export const savePlannerColumn = (
  memberId: string,
  input: { status: PlannerTaskStatus; label: string; color: string }
) => {
  const parsed = z
    .object({
      status: z.nativeEnum(PlannerTaskStatus),
      label: z.string().trim().min(1).max(40),
      color: z.string().regex(hexColorPattern),
    })
    .parse(input);
  return database.plannerBoardColumn.upsert({
    where: { memberId_status: { memberId, status: parsed.status } },
    create: {
      memberId,
      ...parsed,
      position:
        defaultColumns.find((column) => column.status === parsed.status)
          ?.position ?? 0,
    },
    update: { label: parsed.label, color: parsed.color },
    select: { status: true, label: true, color: true, position: true },
  });
};

const syncEventReminder = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  event: {
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    recurrence: PlannerRecurrence;
    recurrenceUntil: Date | null;
    timezone: string;
    reminderMinutes: number | null;
  }
) => {
  await cancelPlannerReminders(
    transaction,
    memberId,
    "PLANNER_EVENT",
    event.id
  );
  if (event.reminderMinutes === null) {
    return;
  }
  let occurrenceAt = event.startsAt;
  let startsAt = event.startsAt;
  let title = event.title;
  if (event.recurrence !== PlannerRecurrence.NONE) {
    let target = new Date();
    let found = false;
    for (let skipped = 0; skipped < 101; skipped += 1) {
      const next = firstOccurrenceOnOrAfter(
        event.startsAt,
        event.recurrence,
        target,
        event.timezone,
        event.recurrenceUntil
      );
      if (!next) {
        return;
      }
      const exception = await transaction.plannerEventOccurrence.findUnique({
        where: {
          eventId_occurrenceStartsAt: {
            eventId: event.id,
            occurrenceStartsAt: next,
          },
        },
        select: {
          startsAtOverride: true,
          titleOverride: true,
          deletedAt: true,
        },
      });
      if (exception?.deletedAt) {
        target = new Date(next.getTime() + 1);
        continue;
      }
      occurrenceAt = next;
      startsAt = exception?.startsAtOverride ?? next;
      title = exception?.titleOverride ?? event.title;
      found = true;
      break;
    }
    if (!found) {
      return;
    }
  }
  await schedulePlannerReminder(transaction, {
    memberId,
    entityType: "PLANNER_EVENT",
    entityId: event.id,
    title,
    reminderAt: new Date(startsAt.getTime() - event.reminderMinutes * 60_000),
    occurrenceAt,
    timezone: event.timezone,
    href: `/planejamento?view=calendar&event=${encodeURIComponent(event.id)}${event.recurrence !== PlannerRecurrence.NONE ? `&occurrence=${encodeURIComponent(occurrenceAt.toISOString())}` : ""}`,
  });
};

export const savePlannerEvent = (memberId: string, input: unknown) => {
  const parsed = eventPayload(input);
  const startsAt = new Date(parsed.startsAt);
  const endsAt = new Date(parsed.endsAt);
  if (endsAt <= startsAt) {
    throw new Error("O horário de término precisa ser posterior ao início.");
  }
  const recurrenceUntil = normalizeDate(parsed.recurrenceUntil);
  const recurrence = parsed.recurrence ?? PlannerRecurrence.NONE;
  if (
    recurrence !== PlannerRecurrence.NONE &&
    recurrenceUntil &&
    recurrenceUntil < startsAt
  ) {
    throw new Error(
      "A repetição não pode terminar antes da primeira ocorrência."
    );
  }
  const data = {
    title: parsed.title,
    description: parsed.description?.trim() || null,
    startsAt,
    endsAt,
    timezone: parsed.timezone,
    allDay: parsed.allDay ?? false,
    color: parsed.color,
    location: parsed.location?.trim() || null,
    recurrence,
    recurrenceUntil,
    reminderMinutes: parsed.reminderMinutes ?? null,
    kind: parsed.kind ?? PlannerEventKind.PERSONAL,
  };
  return database.$transaction(async (transaction) => {
    const event = parsed.id
      ? await transaction.plannerEvent
          .updateMany({
            where: { id: parsed.id, memberId, deletedAt: null },
            data,
          })
          .then(({ count }) => {
            if (count === 0) {
              throw new Error("O evento não foi encontrado.");
            }
            return transaction.plannerEvent.findFirstOrThrow({
              where: { id: parsed.id, memberId },
              select: {
                id: true,
                title: true,
                startsAt: true,
                endsAt: true,
                recurrence: true,
                recurrenceUntil: true,
                timezone: true,
                color: true,
                reminderMinutes: true,
              },
            });
          })
      : await transaction.plannerEvent.create({
          data: { ...data, memberId },
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            recurrence: true,
            recurrenceUntil: true,
            timezone: true,
            color: true,
            reminderMinutes: true,
          },
        });
    await syncEventReminder(transaction, memberId, event);
    return event;
  });
};

export const savePlannerEventOccurrence = (
  memberId: string,
  input: unknown
) => {
  const parsed = eventInputSchema
    .extend({
      id: requiredId,
      occurrenceStartsAt: occurrenceDateSchema,
    })
    .parse(input);
  const occurrenceStartsAt = new Date(parsed.occurrenceStartsAt);
  const startsAtOverride = new Date(parsed.startsAt);
  const endsAtOverride = new Date(parsed.endsAt);
  if (endsAtOverride <= startsAtOverride) {
    throw new Error("O horário de término precisa ser posterior ao início.");
  }
  return database.$transaction(async (transaction) => {
    const event = await transaction.plannerEvent.findFirst({
      where: {
        id: parsed.id,
        memberId,
        deletedAt: null,
        recurrence: { not: PlannerRecurrence.NONE },
      },
      select: {
        id: true,
        startsAt: true,
        recurrence: true,
        recurrenceUntil: true,
        timezone: true,
      },
    });
    if (
      !(
        event &&
        withinSeries(
          event.startsAt,
          event.recurrence,
          occurrenceStartsAt,
          event.timezone,
          event.recurrenceUntil
        )
      )
    ) {
      throw new Error("O evento repetido não foi encontrado.");
    }
    const occurrence = await transaction.plannerEventOccurrence.upsert({
      where: {
        eventId_occurrenceStartsAt: { eventId: event.id, occurrenceStartsAt },
      },
      create: {
        eventId: event.id,
        memberId,
        occurrenceStartsAt,
        titleOverride: parsed.title,
        descriptionOverride: parsed.description?.trim() || null,
        colorOverride: parsed.color,
        startsAtOverride,
        endsAtOverride,
      },
      update: {
        titleOverride: parsed.title,
        descriptionOverride: parsed.description?.trim() || null,
        colorOverride: parsed.color,
        startsAtOverride,
        endsAtOverride,
        deletedAt: null,
      },
      select: { id: true, occurrenceStartsAt: true },
    });
    await syncEventOccurrenceReminder(
      transaction,
      memberId,
      event.id,
      occurrenceStartsAt
    );
    return occurrence;
  });
};

export const deletePlannerEvent = (
  memberId: string,
  input: { id: string; occurrenceAt?: string }
) => {
  const parsed = z
    .object({ id: requiredId, occurrenceAt: occurrenceDateSchema.optional() })
    .parse(input);
  const now = new Date();
  return database.$transaction(async (transaction) => {
    const event = await transaction.plannerEvent.findFirst({
      where: { id: parsed.id, memberId, deletedAt: null },
      select: {
        id: true,
        recurrence: true,
        startsAt: true,
        recurrenceUntil: true,
        timezone: true,
      },
    });
    if (!event) {
      throw new Error("O evento não foi encontrado.");
    }
    if (parsed.occurrenceAt) {
      const occurrenceStartsAt = new Date(parsed.occurrenceAt);
      if (
        event.recurrence === PlannerRecurrence.NONE ||
        !withinSeries(
          event.startsAt,
          event.recurrence,
          occurrenceStartsAt,
          event.timezone,
          event.recurrenceUntil
        )
      ) {
        throw new Error("A ocorrência repetida não foi encontrada.");
      }
      const occurrence = await transaction.plannerEventOccurrence.upsert({
        where: {
          eventId_occurrenceStartsAt: {
            eventId: event.id,
            occurrenceStartsAt,
          },
        },
        create: {
          eventId: event.id,
          memberId,
          occurrenceStartsAt,
          deletedAt: now,
        },
        update: { deletedAt: now },
      });
      await cancelPlannerOccurrenceReminder(
        transaction,
        memberId,
        "PLANNER_EVENT",
        event.id,
        occurrenceStartsAt
      );
      return occurrence;
    }
    await cancelPlannerReminders(
      transaction,
      memberId,
      "PLANNER_EVENT",
      event.id
    );
    return transaction.plannerEvent.updateMany({
      where: { id: event.id, memberId, deletedAt: null },
      data: { deletedAt: now },
    });
  });
};

export const duplicatePlannerEvent = async (memberId: string, id: string) => {
  const parsedId = requiredId.parse(id);
  const event = await database.plannerEvent.findFirst({
    where: { id: parsedId, memberId, deletedAt: null },
    select: {
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      allDay: true,
      color: true,
      location: true,
      kind: true,
    },
  });
  if (!event) {
    throw new Error("O evento não foi encontrado.");
  }
  return database.plannerEvent.create({
    data: {
      memberId,
      ...event,
      title: `${event.title} (cópia)`.slice(0, 180),
      recurrence: PlannerRecurrence.NONE,
    },
    select: { id: true, title: true },
  });
};

export const setPlannerTimezone = (memberId: string, timezone: string) => {
  const parsedTimezone = z.string().trim().min(1).max(80).parse(timezone);
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: parsedTimezone });
  } catch {
    throw new Error("Escolha um fuso horário válido.");
  }
  return database.plannerPreferences.upsert({
    where: { memberId },
    create: { memberId, timezone: parsedTimezone },
    update: { timezone: parsedTimezone },
    select: { timezone: true },
  });
};

interface UpcomingPlannerTask {
  dueAt: Date | null;
  id: string;
  recurrence: PlannerRecurrence;
  recurrenceUntil: Date | null;
  title: string;
}

interface UpcomingPlannerTaskOverride {
  completedAt: Date | null;
  deletedAt: Date | null;
  dueAtOverride: Date | null;
  occurrenceAt: Date;
  status: PlannerTaskStatus | null;
  taskId: string;
  titleOverride: string | null;
}

interface UpcomingPlannerTaskCandidate {
  dueAt: Date;
  id: string;
  occurrenceAt: Date | null;
  title: string;
}

const getRecurringTaskNoticeCandidates = (
  task: UpcomingPlannerTask,
  overridesByOccurrence: Map<string, UpcomingPlannerTaskOverride>,
  now: Date,
  soon: Date,
  timezone: string
) => {
  if (!task.dueAt) {
    return [];
  }
  const candidates: UpcomingPlannerTaskCandidate[] = [];
  let target = now;
  for (let index = 0; index < 3; index += 1) {
    const occurrenceAt = firstOccurrenceOnOrAfter(
      task.dueAt,
      task.recurrence,
      target,
      timezone,
      task.recurrenceUntil
    );
    if (!occurrenceAt || occurrenceAt > soon) {
      break;
    }
    target = new Date(occurrenceAt.getTime() + 1);
    const override = overridesByOccurrence.get(
      `${task.id}:${occurrenceAt.toISOString()}`
    );
    if (
      override?.deletedAt ||
      override?.completedAt ||
      override?.status === PlannerTaskStatus.DONE
    ) {
      continue;
    }
    const dueAt = override?.dueAtOverride ?? occurrenceAt;
    if (dueAt >= now && dueAt <= soon) {
      candidates.push({
        id: task.id,
        title: override?.titleOverride ?? task.title,
        dueAt,
        occurrenceAt,
      });
    }
  }
  return candidates;
};

const getUpcomingPlannerTask = async (
  memberId: string,
  now: Date,
  soon: Date,
  timezone: string
) => {
  const tasks = await database.plannerTask.findMany({
    where: {
      memberId,
      parentTaskId: null,
      deletedAt: null,
      status: { not: PlannerTaskStatus.DONE },
      dueAt: { not: null, lte: soon },
      OR: [
        { recurrence: PlannerRecurrence.NONE, dueAt: { gte: now, lte: soon } },
        { recurrence: { not: PlannerRecurrence.NONE } },
      ],
    },
    orderBy: { dueAt: "asc" },
    take: 200,
    select: {
      id: true,
      title: true,
      dueAt: true,
      recurrence: true,
      recurrenceUntil: true,
    },
  });
  const recurringTasks = tasks.filter(
    (task) => task.recurrence !== PlannerRecurrence.NONE && task.dueAt
  );
  const overrides: UpcomingPlannerTaskOverride[] = recurringTasks.length
    ? await database.plannerTaskOccurrence.findMany({
        where: {
          memberId,
          taskId: { in: recurringTasks.map((task) => task.id) },
          occurrenceAt: { gte: now, lte: soon },
        },
        select: {
          taskId: true,
          occurrenceAt: true,
          dueAtOverride: true,
          titleOverride: true,
          status: true,
          deletedAt: true,
          completedAt: true,
        },
      })
    : [];
  const overridesByOccurrence = new Map(
    overrides.map((override) => [
      `${override.taskId}:${override.occurrenceAt.toISOString()}`,
      override,
    ])
  );
  const candidates = tasks.flatMap((task) => {
    if (!task.dueAt) {
      return [];
    }
    if (task.recurrence === PlannerRecurrence.NONE) {
      return [
        {
          id: task.id,
          title: task.title,
          dueAt: task.dueAt,
          occurrenceAt: null,
        },
      ];
    }
    return getRecurringTaskNoticeCandidates(
      task,
      overridesByOccurrence,
      now,
      soon,
      timezone
    );
  });
  return (
    candidates.sort(
      (left, right) => left.dueAt.getTime() - right.dueAt.getTime()
    )[0] ?? null
  );
};

export const upcomingPlannerNotice = async (memberId: string) => {
  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const [meeting, preferences] = await Promise.all([
    database.meeting.findFirst({
      where: {
        status: "PUBLISHED",
        startsAt: { gte: now, lte: soon },
        participants: { some: { memberId } },
      },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, startsAt: true, timezone: true },
    }),
    database.plannerPreferences.findUnique({
      where: { memberId },
      select: { timezone: true },
    }),
  ]);
  const timezone = preferences?.timezone ?? DEFAULT_TIMEZONE;
  const task = await getUpcomingPlannerTask(memberId, now, soon, timezone);
  if (!(meeting || task)) {
    return null;
  }
  if (meeting && (!task || meeting.startsAt <= task.dueAt)) {
    return {
      kind: "meeting" as const,
      title: meeting.title,
      startsAt: meeting.startsAt.toISOString(),
      href: "/planejamento?view=calendar",
      timezone: meeting.timezone ?? timezone,
    };
  }
  if (!task) {
    return null;
  }
  return {
    kind: "task" as const,
    title: task.title,
    startsAt: task.dueAt.toISOString(),
    href: `/planejamento?view=tasks&task=${encodeURIComponent(task.id)}${task.occurrenceAt ? `&occurrence=${encodeURIComponent(task.occurrenceAt.toISOString())}` : ""}`,
    timezone,
  };
};

export const isFocusTimerMode = (
  mode: string
): mode is keyof typeof FocusTimerMode => Object.hasOwn(FocusTimerMode, mode);
