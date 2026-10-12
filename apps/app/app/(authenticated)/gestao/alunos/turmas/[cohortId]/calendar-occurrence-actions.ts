"use server";

import { createHash } from "node:crypto";
import {
  database,
  MemberRole,
  PlannerRecurrence,
  Prisma,
} from "@repo/database";
import {
  enqueueDomainEvent,
  isPlannerSeriesOccurrence,
} from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  cohortCalendarTimezone,
  meetingRecurrenceFromRule,
  parseCohortCalendarDateTime,
} from "@/lib/cohort-calendar-domain";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const id = z.string().trim().min(1).max(255);
const uuid = z.string().uuid();
const fields = z.object({
  cohortId: id,
  sourceType: z.enum(["event", "meeting"]),
  sourceId: id,
  occurrenceStartsAt: z.string().min(1),
  expectedCohortVersion: z.number().int().positive(),
  expectedSourceRevision: z.union([
    z.number().int().positive(),
    z.string().min(1).max(40),
  ]),
  expectedExceptionVersion: z.number().int().nonnegative(),
  operation: z.enum(["move", "cancel", "restore"]),
  startsAtOverride: z.string().optional().or(z.literal("")),
  endsAtOverride: z.string().optional().or(z.literal("")),
  titleOverride: z.string().trim().max(140).optional().or(z.literal("")),
  descriptionOverride: z.string().trim().max(4000).optional().or(z.literal("")),
  idempotencyKey: uuid,
});

export type CohortCalendarOccurrenceResult =
  | { readonly ok: true; readonly sourceId: string; readonly duplicate?: true }
  | {
      readonly ok: false;
      readonly code:
        | "validation"
        | "conflict"
        | "forbidden"
        | "not-found"
        | "rate-limited"
        | "unavailable";
      readonly message: string;
      readonly fields?: Readonly<Record<string, string>>;
    };

class OccurrenceMutationFailure extends Error {
  readonly code: Extract<CohortCalendarOccurrenceResult, { ok: false }>["code"];
  readonly fields?: Readonly<Record<string, string>>;

  constructor(
    code: Extract<CohortCalendarOccurrenceResult, { ok: false }>["code"],
    message: string,
    fields?: Readonly<Record<string, string>>
  ) {
    super(message);
    this.name = "OccurrenceMutationFailure";
    this.code = code;
    this.fields = fields;
  }
}

const errorResult = (error: unknown): CohortCalendarOccurrenceResult => {
  if (error instanceof z.ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      fields[issue.path.join(".") || "form"] ??= issue.message;
    }
    return {
      ok: false,
      code: "validation",
      message: "Revise os campos indicados.",
      fields,
    };
  }
  if (error instanceof OccurrenceMutationFailure) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      fields: error.fields,
    };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2002" || error.code === "P2034")
  ) {
    return {
      ok: false,
      code: "conflict",
      message:
        "A turma ou esta ocorrência mudou em outra sessão. Atualize a agenda.",
    };
  }
  if (error instanceof Error && error.name === "MutationRateLimitError") {
    return {
      ok: false,
      code: "rate-limited",
      message: "Você fez muitas alterações. Aguarde e tente novamente.",
    };
  }
  return {
    ok: false,
    code: "unavailable",
    message: "Não foi possível salvar agora. Tente novamente.",
  };
};

const parseInstant = (value: string, field: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== value) {
    throw new OccurrenceMutationFailure(
      "validation",
      "Atualize a agenda e confira os horários.",
      { [field]: "O horário original não é válido." }
    );
  }
  return date;
};

const operationKeyFor = (
  cohortId: string,
  sourceType: "event" | "meeting",
  sourceId: string,
  occurrenceStartsAt: Date,
  operation: "move" | "cancel" | "restore",
  key: string
) =>
  `gestao:calendar-occurrence:${createHash("sha256")
    .update(
      `${cohortId}:${sourceType}:${sourceId}:${occurrenceStartsAt.toISOString()}:${operation}:${key}`
    )
    .digest("hex")}`;

const requireWritableCohort = async (
  tx: Prisma.TransactionClient,
  actorId: string,
  cohortId: string
) => {
  const actor = await tx.member.findFirst({
    where: {
      id: actorId,
      deactivatedAt: null,
      role: { in: [MemberRole.ADMIN, MemberRole.TEACHER] },
    },
    select: { role: true },
  });
  if (!actor) {
    throw new OccurrenceMutationFailure(
      "forbidden",
      "Seu acesso foi alterado."
    );
  }
  const cohort = await tx.cohort.findFirst({
    where: {
      id: cohortId,
      ...(actor.role === MemberRole.ADMIN
        ? {}
        : { teachers: { some: { memberId: actorId } } }),
    },
    select: { id: true, version: true, archivedAt: true },
  });
  if (!cohort) {
    throw new OccurrenceMutationFailure(
      "not-found",
      "Turma não encontrada ou sem acesso."
    );
  }
  return cohort;
};

const bumpCohortVersion = async (
  tx: Prisma.TransactionClient,
  cohortId: string,
  expectedVersion: number
) => {
  const updated = await tx.cohort.updateMany({
    where: { id: cohortId, version: expectedVersion },
    data: { version: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new OccurrenceMutationFailure(
      "conflict",
      "A turma mudou em outra sessão. Atualize a agenda."
    );
  }
};

const resolveOverrideDates = (
  value: z.infer<typeof fields>,
  source: { readonly endsAt: Date | null; readonly startsAt: Date }
) => {
  if (value.operation !== "move") {
    return { startsAtOverride: null, endsAtOverride: null };
  }
  const startsAtOverride = value.startsAtOverride
    ? parseCohortCalendarDateTime(value.startsAtOverride, {
        timezone: cohortCalendarTimezone,
      })
    : null;
  if (!startsAtOverride) {
    throw new OccurrenceMutationFailure(
      "validation",
      "Informe a nova data e horário da ocorrência.",
      { startsAtOverride: "Confira a data e o horário em São Paulo." }
    );
  }
  let endsAtOverride: Date | null = null;
  if (value.endsAtOverride) {
    endsAtOverride = parseCohortCalendarDateTime(value.endsAtOverride, {
      timezone: cohortCalendarTimezone,
    });
  } else if (source.endsAt) {
    endsAtOverride = new Date(
      startsAtOverride.getTime() +
        Math.max(0, source.endsAt.getTime() - source.startsAt.getTime())
    );
  }
  if (value.endsAtOverride && !endsAtOverride) {
    throw new OccurrenceMutationFailure(
      "validation",
      "Informe um horário final válido.",
      { endsAtOverride: "Confira a data e o horário." }
    );
  }
  if (endsAtOverride && endsAtOverride <= startsAtOverride) {
    throw new OccurrenceMutationFailure(
      "validation",
      "O término precisa ser posterior ao início.",
      { endsAtOverride: "Escolha um horário posterior ao início." }
    );
  }
  return { startsAtOverride, endsAtOverride };
};

const saveEventOccurrence = async (
  tx: Prisma.TransactionClient,
  input: z.infer<typeof fields>,
  actorId: string,
  cohortId: string,
  occurrenceStartsAt: Date,
  now: Date
) => {
  const event = await tx.cohortEvent.findFirst({
    where: { id: input.sourceId, cohortId },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      recurrence: true,
      recurrenceUntil: true,
      version: true,
    },
  });
  if (!event) {
    throw new OccurrenceMutationFailure(
      "not-found",
      "Evento não encontrado nesta turma."
    );
  }
  if (
    event.recurrence === PlannerRecurrence.NONE ||
    input.expectedSourceRevision !== event.version ||
    !isPlannerSeriesOccurrence(
      event.startsAt,
      event.recurrence,
      occurrenceStartsAt,
      cohortCalendarTimezone,
      event.recurrenceUntil
    )
  ) {
    throw new OccurrenceMutationFailure(
      "conflict",
      "A série mudou ou esta data não pertence mais a ela. Atualize a agenda."
    );
  }
  const existing = await tx.cohortEventOccurrenceException.findUnique({
    where: {
      eventId_occurrenceStartsAt: {
        eventId: event.id,
        occurrenceStartsAt,
      },
    },
    select: { id: true, version: true },
  });
  assertExceptionVersion(existing, input.expectedExceptionVersion);
  const overrideDates = resolveOverrideDates(input, event);
  const data = {
    ...overrideDates,
    titleOverride:
      input.operation === "move" ? input.titleOverride || null : null,
    descriptionOverride:
      input.operation === "move" ? input.descriptionOverride || null : null,
    colorOverride: null,
    cancelledAt: input.operation === "cancel" ? now : null,
    updatedByMemberId: actorId,
  };
  if (existing) {
    const changed = await tx.cohortEventOccurrenceException.updateMany({
      where: { id: existing.id, version: input.expectedExceptionVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (changed.count !== 1) {
      throw new OccurrenceMutationFailure(
        "conflict",
        "Esta ocorrência mudou em outra sessão. Atualize a agenda."
      );
    }
  } else {
    await tx.cohortEventOccurrenceException.create({
      data: {
        ...data,
        eventId: event.id,
        occurrenceStartsAt,
      },
    });
  }
  return event.id;
};

const saveMeetingOccurrence = async (
  tx: Prisma.TransactionClient,
  input: z.infer<typeof fields>,
  actorId: string,
  cohortId: string,
  occurrenceStartsAt: Date,
  now: Date
) => {
  const meeting = await tx.meeting.findFirst({
    where: {
      id: input.sourceId,
      demoKey: null,
      status: { not: "ARCHIVED" },
      cohortTargets: { some: { cohortId, revokedAt: null } },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      recurrenceRule: true,
      recurrenceUntil: true,
      timezone: true,
      updatedAt: true,
    },
  });
  if (!meeting) {
    throw new OccurrenceMutationFailure(
      "not-found",
      "Encontro não encontrado ou sem acesso nesta turma."
    );
  }
  const recurrence = meetingRecurrenceFromRule(meeting.recurrenceRule);
  if (
    recurrence === PlannerRecurrence.NONE ||
    typeof input.expectedSourceRevision !== "string" ||
    Date.parse(input.expectedSourceRevision) !== meeting.updatedAt.getTime() ||
    !isPlannerSeriesOccurrence(
      meeting.startsAt,
      recurrence,
      occurrenceStartsAt,
      meeting.timezone || cohortCalendarTimezone,
      meeting.recurrenceUntil
    )
  ) {
    throw new OccurrenceMutationFailure(
      "conflict",
      "A série mudou ou esta data não pertence mais a ela. Atualize a agenda."
    );
  }
  const existing = await tx.meetingOccurrenceException.findUnique({
    where: {
      meetingId_occurrenceStartsAt: {
        meetingId: meeting.id,
        occurrenceStartsAt,
      },
    },
    select: { id: true, version: true },
  });
  assertExceptionVersion(existing, input.expectedExceptionVersion);
  const overrideDates = resolveOverrideDates(input, meeting);
  const data = {
    ...overrideDates,
    titleOverride:
      input.operation === "move" ? input.titleOverride || null : null,
    descriptionOverride:
      input.operation === "move" ? input.descriptionOverride || null : null,
    cancelledAt: input.operation === "cancel" ? now : null,
    updatedByMemberId: actorId,
  };
  if (existing) {
    const changed = await tx.meetingOccurrenceException.updateMany({
      where: { id: existing.id, version: input.expectedExceptionVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (changed.count !== 1) {
      throw new OccurrenceMutationFailure(
        "conflict",
        "Esta ocorrência mudou em outra sessão. Atualize a agenda."
      );
    }
  } else {
    await tx.meetingOccurrenceException.create({
      data: {
        ...data,
        meetingId: meeting.id,
        occurrenceStartsAt,
      },
    });
  }
  return meeting.id;
};

const assertExceptionVersion = (
  existing: { readonly version: number } | null,
  expectedVersion: number
) => {
  if (
    (existing === null && expectedVersion !== 0) ||
    (existing !== null && existing.version !== expectedVersion)
  ) {
    throw new OccurrenceMutationFailure(
      "conflict",
      "Esta ocorrência mudou em outra sessão. Atualize a agenda."
    );
  }
};

export const setGestaoCohortCalendarOccurrence = async (
  input: unknown
): Promise<CohortCalendarOccurrenceResult> => {
  let cohortId = "";
  let sourceType: "event" | "meeting" = "event";
  let sourceId = "";
  try {
    const value = fields.parse(input);
    cohortId = value.cohortId;
    sourceType = value.sourceType;
    sourceId = value.sourceId;
    const { actor } = await requireGestaoAction("cohort.manage", { cohortId });
    const idempotencyKey = readIdempotencyKey(value.idempotencyKey);
    if (!idempotencyKey) {
      throw new OccurrenceMutationFailure(
        "validation",
        "Atualize a agenda e tente novamente."
      );
    }
    const occurrenceStartsAt = parseInstant(
      value.occurrenceStartsAt,
      "occurrenceStartsAt"
    );
    if (value.operation === "move") {
      resolveOverrideDates(value, {
        startsAt: occurrenceStartsAt,
        endsAt: null,
      });
    }
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = operationKeyFor(
      cohortId,
      sourceType,
      sourceId,
      occurrenceStartsAt,
      value.operation,
      idempotencyKey
    );
    const savedSourceId = await database.$transaction(
      async (tx) => {
        const processed = await tx.domainEvent.findUnique({
          where: { idempotencyKey: operationKey },
          select: { id: true },
        });
        if (processed) {
          return sourceId;
        }
        const cohort = await requireWritableCohort(tx, actor.userId, cohortId);
        if (cohort.archivedAt) {
          throw new OccurrenceMutationFailure(
            "conflict",
            "Esta turma está arquivada."
          );
        }
        if (cohort.version !== value.expectedCohortVersion) {
          throw new OccurrenceMutationFailure(
            "conflict",
            "A turma mudou em outra sessão. Atualize a agenda."
          );
        }
        await bumpCohortVersion(tx, cohortId, value.expectedCohortVersion);
        const updatedSourceId =
          sourceType === "event"
            ? await saveEventOccurrence(
                tx,
                value,
                actor.userId,
                cohortId,
                occurrenceStartsAt,
                new Date()
              )
            : await saveMeetingOccurrence(
                tx,
                value,
                actor.userId,
                cohortId,
                occurrenceStartsAt,
                new Date()
              );
        await enqueueDomainEvent(tx, {
          eventType: "gestao.cohort.calendar.occurrence.changed",
          actorId: actor.userId,
          aggregateType: sourceType === "event" ? "cohort-event" : "meeting",
          aggregateId: updatedSourceId,
          idempotencyKey: operationKey,
          payload: {
            cohortId,
            sourceType,
            occurrenceStartsAt: occurrenceStartsAt.toISOString(),
            operation: value.operation,
          },
          occurredAt: new Date(),
          consumers: [],
        });
        return updatedSourceId;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath(`/gestao/alunos/turmas/${cohortId}`);
    revalidatePath(`/gestao/alunos/turmas/${cohortId}/calendario`);
    revalidatePath("/planejamento");
    if (sourceType === "meeting") {
      revalidatePath(`/encontros/${sourceId}`);
    }
    return { ok: true, sourceId: savedSourceId };
  } catch (error) {
    return errorResult(error);
  }
};
