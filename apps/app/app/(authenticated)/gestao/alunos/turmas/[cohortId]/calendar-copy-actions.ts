"use server";

import { database, MemberRole, Prisma } from "@repo/database";
import { enqueueDomainEvent } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const id = z.string().trim().min(1).max(255);
const inputSchema = z.object({
  sourceCohortId: id,
  destinationCohortId: id,
  expectedDestinationVersion: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
});

interface CopiedCounts {
  readonly activitiesAdded: number;
  readonly eventsCreated: number;
  readonly meetingsAdded: number;
  readonly releasesCreated: number;
  readonly releasesSkipped: number;
  readonly releasesUpdated: number;
}

export type CohortCalendarCopyResult =
  | {
      readonly ok: true;
      readonly counts: CopiedCounts;
      readonly duplicate?: true;
    }
  | {
      readonly ok: false;
      readonly code:
        | "validation"
        | "conflict"
        | "forbidden"
        | "not-found"
        | "unavailable";
      readonly message: string;
    };

class CalendarCopyFailure extends Error {
  readonly code: Extract<CohortCalendarCopyResult, { ok: false }>["code"];

  constructor(
    code: Extract<CohortCalendarCopyResult, { ok: false }>["code"],
    message: string
  ) {
    super(message);
    this.name = "CalendarCopyFailure";
    this.code = code;
  }
}

const emptyCounts: CopiedCounts = {
  eventsCreated: 0,
  meetingsAdded: 0,
  activitiesAdded: 0,
  releasesCreated: 0,
  releasesUpdated: 0,
  releasesSkipped: 0,
};

const conflict = () =>
  new CalendarCopyFailure(
    "conflict",
    "A turma mudou em outra sessão. Atualize a agenda e tente novamente."
  );

const getCountsFromPayload = (payload: Prisma.JsonValue): CopiedCounts => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    !("copiedCounts" in payload)
  ) {
    return emptyCounts;
  }
  const counts = payload.copiedCounts;
  if (typeof counts !== "object" || counts === null || Array.isArray(counts)) {
    return emptyCounts;
  }
  const value = counts as Record<string, unknown>;
  return {
    eventsCreated: Number(value.eventsCreated) || 0,
    meetingsAdded: Number(value.meetingsAdded) || 0,
    activitiesAdded: Number(value.activitiesAdded) || 0,
    releasesCreated: Number(value.releasesCreated) || 0,
    releasesUpdated: Number(value.releasesUpdated) || 0,
    releasesSkipped: Number(value.releasesSkipped) || 0,
  };
};

const requireManagedCohort = async (
  tx: Prisma.TransactionClient,
  actorId: string,
  role: MemberRole,
  cohortId: string
) => {
  const cohort = await tx.cohort.findFirst({
    where: {
      id: cohortId,
      archivedAt: null,
      ...(role === MemberRole.ADMIN
        ? {}
        : { teachers: { some: { memberId: actorId } } }),
    },
    select: { id: true, version: true },
  });
  if (!cohort) {
    throw new CalendarCopyFailure(
      "not-found",
      "Turma não encontrada ou sem acesso."
    );
  }
  return cohort;
};

const updateActivityTargets = async (
  tx: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly activityIds: readonly string[];
    readonly destinationCohortId: string;
    readonly now: Date;
  }
) => {
  if (input.activityIds.length === 0) {
    return 0;
  }
  const current = await tx.activityCohortTarget.findMany({
    where: {
      activityId: { in: [...input.activityIds] },
      cohortId: input.destinationCohortId,
    },
    orderBy: [{ assignedAt: "asc" }, { id: "asc" }],
    select: { id: true, activityId: true, activeKey: true, revokedAt: true },
  });
  const byActivity = new Map<string, (typeof current)[number]>();
  for (const target of current) {
    if (!byActivity.has(target.activityId) || target.activeKey !== null) {
      byActivity.set(target.activityId, target);
    }
  }
  const added = input.activityIds.filter(
    (activityId) =>
      byActivity.get(activityId)?.activeKey === null ||
      !byActivity.has(activityId)
  );
  for (const activityId of added) {
    const previous = byActivity.get(activityId);
    if (previous) {
      const changed = await tx.activityCohortTarget.updateMany({
        where: { id: previous.id, activeKey: null, revokedAt: { not: null } },
        data: {
          activeKey: `${activityId}:${input.destinationCohortId}`,
          assignedAt: input.now,
          revokedAt: null,
          createdByMemberId: input.actorId,
        },
      });
      if (changed.count !== 1) {
        throw conflict();
      }
    } else {
      await tx.activityCohortTarget.create({
        data: {
          activityId,
          cohortId: input.destinationCohortId,
          activeKey: `${activityId}:${input.destinationCohortId}`,
          assignedAt: input.now,
          createdByMemberId: input.actorId,
        },
      });
    }
  }
  return added.length;
};

const updateMeetingTargets = async (
  tx: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly destinationCohortId: string;
    readonly meetingIds: readonly string[];
    readonly now: Date;
  }
) => {
  if (input.meetingIds.length === 0) {
    return 0;
  }
  let added = 0;
  for (const meetingId of input.meetingIds) {
    const previous = await tx.meetingCohortTarget.findUnique({
      where: {
        meetingId_cohortId: { meetingId, cohortId: input.destinationCohortId },
      },
      select: { id: true, revokedAt: true },
    });
    if (!previous) {
      await tx.meetingCohortTarget.create({
        data: {
          meetingId,
          cohortId: input.destinationCohortId,
          assignedAt: input.now,
          createdByMemberId: input.actorId,
        },
      });
      added += 1;
    } else if (previous.revokedAt) {
      const changed = await tx.meetingCohortTarget.updateMany({
        where: { id: previous.id, revokedAt: { not: null } },
        data: {
          revokedAt: null,
          assignedAt: input.now,
          createdByMemberId: input.actorId,
        },
      });
      if (changed.count !== 1) {
        throw conflict();
      }
      added += 1;
    }
  }
  return added;
};

const loadCalendarCopySource = async (
  tx: Prisma.TransactionClient,
  sourceCohortId: string
) => {
  const [events, meetingTargets, activityTargets, releases] = await Promise.all(
    [
      tx.cohortEvent.findMany({
        where: { cohortId: sourceCohortId, status: { not: "ARCHIVED" } },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        take: 501,
        select: {
          id: true,
          title: true,
          description: true,
          startsAt: true,
          endsAt: true,
          allDay: true,
          color: true,
          recurrence: true,
          recurrenceUntil: true,
          occurrenceExceptions: {
            take: 501,
            select: {
              occurrenceStartsAt: true,
              startsAtOverride: true,
              endsAtOverride: true,
              titleOverride: true,
              descriptionOverride: true,
              colorOverride: true,
              cancelledAt: true,
            },
          },
        },
      }),
      tx.meetingCohortTarget.findMany({
        where: {
          cohortId: sourceCohortId,
          revokedAt: null,
          meeting: { is: { status: { not: "ARCHIVED" }, demoKey: null } },
        },
        orderBy: [{ meetingId: "asc" }],
        take: 501,
        select: { meetingId: true },
      }),
      tx.activityCohortTarget.findMany({
        where: {
          cohortId: sourceCohortId,
          activeKey: { not: null },
          revokedAt: null,
          activity: { is: { status: "PUBLISHED", dueAt: { not: null } } },
        },
        orderBy: [{ activityId: "asc" }],
        take: 501,
        select: { activityId: true },
      }),
      tx.cohortLessonRelease.findMany({
        where: {
          cohortId: sourceCohortId,
          lesson: {
            is: {
              status: "PUBLISHED",
              module: {
                is: {
                  status: "PUBLISHED",
                  course: { is: { status: "PUBLISHED" } },
                },
              },
            },
          },
        },
        orderBy: [{ lessonId: "asc" }],
        take: 501,
        select: {
          lessonId: true,
          releaseAt: true,
          lesson: { select: { module: { select: { courseId: true } } } },
        },
      }),
    ]
  );
  const exceptionsCount = events.reduce(
    (total, event) => total + event.occurrenceExceptions.length,
    0
  );
  if (
    events.length > 500 ||
    meetingTargets.length > 500 ||
    activityTargets.length > 500 ||
    releases.length > 500 ||
    events.some((event) => event.occurrenceExceptions.length > 500) ||
    exceptionsCount > 500
  ) {
    throw new CalendarCopyFailure(
      "conflict",
      "A agenda de origem é grande demais para copiar de uma vez."
    );
  }
  return {
    events,
    meetingIds: [...new Set(meetingTargets.map(({ meetingId }) => meetingId))],
    activityIds: [
      ...new Set(activityTargets.map(({ activityId }) => activityId)),
    ],
    releases,
  };
};

type CalendarCopySource = Awaited<ReturnType<typeof loadCalendarCopySource>>;

const copyCohortEvents = async (
  tx: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly destinationCohortId: string;
    readonly idempotencyKey: string;
    readonly source: CalendarCopySource;
  }
) => {
  const eventRows = input.source.events.map((event) => ({
    cohortId: input.destinationCohortId,
    createdByMemberId: input.actorId,
    idempotencyKey: `calendar-copy:${input.idempotencyKey}:${event.id}`,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    color: event.color,
    recurrence: event.recurrence,
    recurrenceUntil: event.recurrenceUntil,
    status: "DRAFT" as const,
    publishedAt: null,
  }));
  if (eventRows.length === 0) {
    return 0;
  }
  await tx.cohortEvent.createMany({ data: eventRows });
  const eventKeys = eventRows.map(({ idempotencyKey }) => idempotencyKey);
  const copiedEvents = await tx.cohortEvent.findMany({
    where: {
      createdByMemberId: input.actorId,
      idempotencyKey: { in: eventKeys },
    },
    select: { id: true, idempotencyKey: true },
  });
  const eventIdsByKey = new Map(
    copiedEvents.map((event) => [event.idempotencyKey, event.id])
  );
  const exceptionRows = input.source.events.flatMap((event) => {
    const copiedId = eventIdsByKey.get(
      `calendar-copy:${input.idempotencyKey}:${event.id}`
    );
    if (!copiedId) {
      throw new CalendarCopyFailure(
        "unavailable",
        "Não foi possível recuperar os eventos copiados."
      );
    }
    return event.occurrenceExceptions.map((exception) => ({
      eventId: copiedId,
      occurrenceStartsAt: exception.occurrenceStartsAt,
      startsAtOverride: exception.startsAtOverride,
      endsAtOverride: exception.endsAtOverride,
      titleOverride: exception.titleOverride,
      descriptionOverride: exception.descriptionOverride,
      colorOverride: exception.colorOverride,
      cancelledAt: exception.cancelledAt,
      updatedByMemberId: input.actorId,
    }));
  });
  if (exceptionRows.length > 0) {
    await tx.cohortEventOccurrenceException.createMany({ data: exceptionRows });
  }
  return eventRows.length;
};

const copyEligibleLessonReleases = async (
  tx: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly destinationCohortId: string;
    readonly sourceReleases: CalendarCopySource["releases"];
  }
) => {
  const accesses = await tx.cohortCourseAccess.findMany({
    where: { cohortId: input.destinationCohortId, revokedAt: null },
    select: { courseId: true },
  });
  const courseIds = new Set(accesses.map(({ courseId }) => courseId));
  const eligible = input.sourceReleases.filter((release) =>
    courseIds.has(release.lesson.module.courseId)
  );
  const skipped = input.sourceReleases.length - eligible.length;
  const existing = eligible.length
    ? await tx.cohortLessonRelease.findMany({
        where: {
          cohortId: input.destinationCohortId,
          lessonId: { in: eligible.map(({ lessonId }) => lessonId) },
        },
        select: { id: true, lessonId: true, releaseAt: true, version: true },
      })
    : [];
  const byLesson = new Map(
    existing.map((release) => [release.lessonId, release])
  );
  let created = 0;
  let updated = 0;
  for (const release of eligible) {
    const previous = byLesson.get(release.lessonId);
    if (!previous) {
      await tx.cohortLessonRelease.create({
        data: {
          cohortId: input.destinationCohortId,
          lessonId: release.lessonId,
          releaseAt: release.releaseAt,
          updatedByMemberId: input.actorId,
        },
      });
      created += 1;
      continue;
    }
    if (previous.releaseAt.getTime() === release.releaseAt.getTime()) {
      continue;
    }
    const changed = await tx.cohortLessonRelease.updateMany({
      where: { id: previous.id, version: previous.version },
      data: {
        releaseAt: release.releaseAt,
        updatedByMemberId: input.actorId,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) {
      throw conflict();
    }
    updated += 1;
  }
  return { created, skipped, updated };
};

const getCopiedCounts = async (
  tx: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly destinationCohortId: string;
    readonly idempotencyKey: string;
    readonly now: Date;
    readonly source: CalendarCopySource;
  }
): Promise<CopiedCounts> => {
  const [eventsCreated, meetingsAdded, activitiesAdded, releases] =
    await Promise.all([
      copyCohortEvents(tx, input),
      updateMeetingTargets(tx, {
        actorId: input.actorId,
        destinationCohortId: input.destinationCohortId,
        meetingIds: input.source.meetingIds,
        now: input.now,
      }),
      updateActivityTargets(tx, {
        actorId: input.actorId,
        activityIds: input.source.activityIds,
        destinationCohortId: input.destinationCohortId,
        now: input.now,
      }),
      copyEligibleLessonReleases(tx, {
        actorId: input.actorId,
        destinationCohortId: input.destinationCohortId,
        sourceReleases: input.source.releases,
      }),
    ]);
  return {
    activitiesAdded,
    eventsCreated,
    meetingsAdded,
    releasesCreated: releases.created,
    releasesSkipped: releases.skipped,
    releasesUpdated: releases.updated,
  };
};

const copyAgendaInTransaction = async (
  value: z.infer<typeof inputSchema>,
  actorId: string,
  operationKey: string
) =>
  database.$transaction(
    async (tx) => {
      const currentActor = await tx.member.findFirst({
        where: {
          id: actorId,
          deactivatedAt: null,
          role: { in: [MemberRole.ADMIN, MemberRole.TEACHER] },
        },
        select: { role: true },
      });
      if (!currentActor) {
        throw new CalendarCopyFailure("forbidden", "Seu acesso foi alterado.");
      }
      const [source, destination] = await Promise.all([
        requireManagedCohort(
          tx,
          actorId,
          currentActor.role,
          value.sourceCohortId
        ),
        requireManagedCohort(
          tx,
          actorId,
          currentActor.role,
          value.destinationCohortId
        ),
      ]);
      const processed = await tx.domainEvent.findUnique({
        where: { idempotencyKey: operationKey },
        select: { payload: true },
      });
      if (processed) {
        return getCountsFromPayload(processed.payload);
      }
      if (destination.version !== value.expectedDestinationVersion) {
        throw conflict();
      }
      const sourceData = await loadCalendarCopySource(tx, source.id);
      const now = new Date();
      const counts = await getCopiedCounts(tx, {
        actorId,
        destinationCohortId: destination.id,
        idempotencyKey: operationKey,
        now,
        source: sourceData,
      });
      const changedCount =
        counts.activitiesAdded +
        counts.eventsCreated +
        counts.meetingsAdded +
        counts.releasesCreated +
        counts.releasesUpdated;
      if (changedCount > 0) {
        const bumped = await tx.cohort.updateMany({
          where: {
            id: destination.id,
            version: value.expectedDestinationVersion,
          },
          data: { version: { increment: 1 } },
        });
        if (bumped.count !== 1) {
          throw conflict();
        }
      }
      await enqueueDomainEvent(tx, {
        eventType: "gestao.cohort.calendar.copied",
        actorId,
        aggregateType: "cohort",
        aggregateId: destination.id,
        idempotencyKey: operationKey,
        payload: {
          sourceCohortId: source.id,
          copiedCounts: {
            activitiesAdded: counts.activitiesAdded,
            eventsCreated: counts.eventsCreated,
            meetingsAdded: counts.meetingsAdded,
            releasesCreated: counts.releasesCreated,
            releasesSkipped: counts.releasesSkipped,
            releasesUpdated: counts.releasesUpdated,
          },
        },
        occurredAt: now,
        consumers: [],
      });
      return counts;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

export const copyGestaoCohortCalendarAgenda = async (
  input: unknown
): Promise<CohortCalendarCopyResult> => {
  const parsed = inputSchema.safeParse(input);
  if (
    !parsed.success ||
    parsed.data.sourceCohortId === parsed.data.destinationCohortId
  ) {
    return {
      ok: false,
      code: "validation",
      message: "Escolha outra turma para copiar a agenda.",
    };
  }
  const value = parsed.data;
  try {
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.destinationCohortId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new CalendarCopyFailure(
        "validation",
        "Atualize a agenda e tente novamente."
      );
    }
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = `gestao:cohort:calendar-copy:${actor.userId}:${value.sourceCohortId}:${value.destinationCohortId}:${key}`;
    const counts = await copyAgendaInTransaction(
      value,
      actor.userId,
      operationKey
    );
    revalidatePath(`/gestao/alunos/turmas/${value.destinationCohortId}`);
    revalidatePath(
      `/gestao/alunos/turmas/${value.destinationCohortId}/calendario`
    );
    revalidatePath("/planejamento");
    return { ok: true, counts };
  } catch (error) {
    if (error instanceof CalendarCopyFailure) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return { ok: false, code: "conflict", message: conflict().message };
    }
    if (error instanceof Error && error.name === "MutationRateLimitError") {
      return {
        ok: false,
        code: "conflict",
        message: "Você fez muitas alterações. Aguarde e tente novamente.",
      };
    }
    return {
      ok: false,
      code: "unavailable",
      message: "Não foi possível copiar a agenda agora. Tente novamente.",
    };
  }
};
