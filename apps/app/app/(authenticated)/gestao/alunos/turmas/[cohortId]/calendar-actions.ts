"use server";

import { createHash } from "node:crypto";
import {
  ContentStatus,
  database,
  MemberRole,
  PlannerRecurrence,
  Prisma,
} from "@repo/database";
import { type DomainEventInput, enqueueDomainEvent } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  cohortCalendarTimezone,
  isCohortCalendarEventColor,
  parseCohortCalendarDateTime,
} from "@/lib/cohort-calendar-domain";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const id = z.string().trim().min(1).max(255);
const uuid = z.string().uuid();
const color = z.string().refine(isCohortCalendarEventColor, {
  message: "Escolha uma cor disponível.",
});
const eventFields = z.object({
  cohortId: id,
  eventId: id.optional(),
  expectedCohortVersion: z.number().int().positive(),
  expectedEventVersion: z.number().int().positive().optional(),
  title: z.string().trim().min(1, "Informe um título.").max(140),
  description: z.string().trim().max(4000).nullable().optional(),
  startsAt: z.string().min(1, "Informe a data e o horário."),
  endsAt: z.string().optional().or(z.literal("")),
  allDay: z.boolean().default(false),
  recurrence: z.nativeEnum(PlannerRecurrence).default(PlannerRecurrence.NONE),
  recurrenceUntil: z.string().optional().or(z.literal("")),
  color,
  status: z.enum([ContentStatus.DRAFT, ContentStatus.PUBLISHED]),
  idempotencyKey: uuid,
});

export type CohortCalendarActionResult =
  | {
      readonly ok: true;
      readonly eventId: string;
      readonly duplicate?: boolean;
    }
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

const meetingFields = z.object({
  cohortId: id,
  expectedCohortVersion: z.number().int().positive(),
  title: z.string().trim().min(1, "Informe um título.").max(140),
  description: z.string().trim().max(4000).default(""),
  startsAt: z.string().min(1, "Informe o início."),
  endsAt: z.string().min(1, "Informe o término."),
  timezone: z.string().trim().min(1).max(100),
  joinUrl: z.string().trim().max(2000).default(""),
  recurrence: z.nativeEnum(PlannerRecurrence).default(PlannerRecurrence.NONE),
  recurrenceUntil: z.string().default(""),
  status: z.enum([ContentStatus.DRAFT, ContentStatus.PUBLISHED]),
  confirmed: z.boolean().default(false),
  idempotencyKey: uuid,
});

export type CohortMeetingActionResult =
  | { readonly ok: true; readonly meetingId: string }
  | Extract<CohortCalendarActionResult, { ok: false }>;

const validateMeetingInput = (value: z.infer<typeof meetingFields>) => {
  const fields: Record<string, string> = {};
  const startsAt = parseCohortCalendarDateTime(value.startsAt, {
    timezone: value.timezone,
  });
  const endsAt = parseCohortCalendarDateTime(value.endsAt, {
    timezone: value.timezone,
  });
  const recurrenceUntil = value.recurrenceUntil
    ? parseCohortCalendarDateTime(value.recurrenceUntil, {
        timezone: value.timezone,
      })
    : null;
  if (!startsAt) {
    fields.startsAt = "Confira o início e o fuso horário.";
  }
  if (!endsAt || (startsAt && endsAt <= startsAt)) {
    fields.endsAt = "O término deve ser posterior ao início.";
  }
  if (
    value.recurrenceUntil &&
    (!(recurrenceUntil && startsAt) ||
      recurrenceUntil < startsAt ||
      value.recurrence === PlannerRecurrence.NONE)
  ) {
    fields.recurrenceUntil = "Confira a repetição e a data final.";
  }
  if (value.joinUrl) {
    try {
      const url = new URL(value.joinUrl);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      ) {
        fields.joinUrl = "Informe um link HTTP ou HTTPS sem credenciais.";
      }
    } catch {
      fields.joinUrl = "Informe um link válido.";
    }
  } else if (value.status === ContentStatus.PUBLISHED) {
    fields.joinUrl = "Informe o link antes de publicar.";
  }
  if (value.status === ContentStatus.PUBLISHED && !value.confirmed) {
    fields.confirmed = "Confirme a publicação para os alunos da turma.";
  }
  if (Object.keys(fields).length || !startsAt || !endsAt) {
    throw new CalendarMutationFailure(
      "validation",
      "Revise os campos indicados.",
      fields
    );
  }
  return { startsAt, endsAt, recurrenceUntil };
};

export const createGestaoCohortMeeting = async (
  input: unknown
): Promise<CohortMeetingActionResult> => {
  try {
    const value = meetingFields.parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    const dates = validateMeetingInput(value);
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = `gestao:cohort:meeting:${createHash("sha256")
      .update(
        JSON.stringify([actor.userId, value.cohortId, value.idempotencyKey])
      )
      .digest("hex")}`;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ ...value, expectedCohortVersion: undefined }))
      .digest("hex");
    const meetingId = await database.$transaction(
      async (tx) => {
        const cohort = await requireWritableCohort(
          tx,
          actor.userId,
          value.cohortId
        );
        const previous = await tx.meeting.findFirst({
          where: {
            teacherId: actor.userId,
            idempotencyKey: value.idempotencyKey,
          },
          select: {
            id: true,
            cohortTargets: {
              where: { cohortId: cohort.id, revokedAt: null },
              select: { id: true },
            },
          },
        });
        if (previous) {
          if (!previous.cohortTargets.length) {
            throw new CalendarMutationFailure(
              "conflict",
              "Esta operação pertence a outra turma."
            );
          }
          const audit = await tx.domainEvent.findUnique({
            where: { idempotencyKey: operationKey },
            select: { payload: true },
          });
          if (
            !audit?.payload ||
            typeof audit.payload !== "object" ||
            Array.isArray(audit.payload) ||
            audit.payload.fingerprint !== fingerprint
          ) {
            throw new CalendarMutationFailure(
              "conflict",
              "Os dados desta operação mudaram. Feche e reabra o formulário."
            );
          }
          return previous.id;
        }
        if (cohort.archivedAt) {
          throw new CalendarMutationFailure(
            "conflict",
            "Esta turma está arquivada."
          );
        }
        await bumpCohortVersion(tx, cohort.id, value.expectedCohortVersion);
        const now = new Date();
        const meeting = await tx.meeting.create({
          data: {
            title: value.title,
            description: value.description || null,
            ...dates,
            timezone: value.timezone,
            joinUrl: value.joinUrl,
            status: value.status,
            publishedAt: value.status === ContentStatus.PUBLISHED ? now : null,
            teacherId: actor.userId,
            idempotencyKey: value.idempotencyKey,
            recurrenceRule:
              value.recurrence === PlannerRecurrence.NONE
                ? null
                : value.recurrence,
            cohortTargets: {
              create: {
                cohortId: cohort.id,
                createdByMemberId: actor.userId,
                assignedAt: now,
              },
            },
          },
          select: { id: true },
        });
        await enqueueDomainEvent(tx, {
          eventType:
            value.status === ContentStatus.PUBLISHED
              ? "event.published"
              : "gestao.cohort.meeting.saved",
          actorId: actor.userId,
          aggregateType: "meeting",
          aggregateId: meeting.id,
          idempotencyKey: operationKey,
          payload: { cohortId: cohort.id, status: value.status, fingerprint },
          occurredAt: now,
          consumers: [],
        });
        return meeting.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidateCalendar(value.cohortId);
    revalidatePath("/encontros");
    return { ok: true, meetingId };
  } catch (error) {
    return errorResult(error) as Extract<
      CohortCalendarActionResult,
      { ok: false }
    >;
  }
};

class CalendarMutationFailure extends Error {
  readonly code: Extract<CohortCalendarActionResult, { ok: false }>["code"];
  readonly fields?: Readonly<Record<string, string>>;

  constructor(
    code: Extract<CohortCalendarActionResult, { ok: false }>["code"],
    message: string,
    fields?: Readonly<Record<string, string>>
  ) {
    super(message);
    this.name = "CalendarMutationFailure";
    this.code = code;
    this.fields = fields;
  }
}

const errorResult = (error: unknown): CohortCalendarActionResult => {
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
  if (error instanceof CalendarMutationFailure) {
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
        "A turma mudou em outra sessão. Atualize a tela e tente novamente.",
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

const eventOperationKey = (verb: string, key: string) =>
  `gestao:cohort:event:${verb}:${key}`;

const appendCalendarAudit = (
  tx: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly cohortId: string;
    readonly eventId: string;
    readonly operationKey: string;
    readonly verb: string;
    readonly status: string;
  }
) =>
  enqueueDomainEvent(tx, {
    eventType: `gestao.cohort.event.${input.verb}`,
    actorId: input.actorId,
    aggregateType: "cohort-event",
    aggregateId: input.eventId,
    idempotencyKey: input.operationKey,
    payload: {
      cohortId: input.cohortId,
      status: input.status,
    } satisfies DomainEventInput["payload"],
    occurredAt: new Date(),
    consumers: [],
  });

const requireWritableCohort = async (
  tx: Prisma.TransactionClient,
  actorId: string,
  cohortId: string
) => {
  const currentActor = await tx.member.findFirst({
    where: {
      id: actorId,
      deactivatedAt: null,
      role: { in: [MemberRole.ADMIN, MemberRole.TEACHER] },
    },
    select: { role: true },
  });
  if (!currentActor) {
    throw new CalendarMutationFailure("forbidden", "Seu acesso foi alterado.");
  }
  const cohort = await tx.cohort.findFirst({
    where: {
      id: cohortId,
      ...(currentActor.role === MemberRole.ADMIN
        ? {}
        : { teachers: { some: { memberId: actorId } } }),
    },
    select: { id: true, version: true, archivedAt: true },
  });
  if (!cohort) {
    throw new CalendarMutationFailure(
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
  const changed = await tx.cohort.updateMany({
    where: { id: cohortId, version: expectedVersion },
    data: { version: { increment: 1 } },
  });
  if (changed.count !== 1) {
    throw new CalendarMutationFailure(
      "conflict",
      "A turma mudou em outra sessão. Atualize os dados antes de salvar."
    );
  }
};

const revalidateCalendar = (cohortId: string) => {
  revalidatePath(`/gestao/alunos/turmas/${cohortId}`);
  revalidatePath(`/gestao/alunos/turmas/${cohortId}/calendario`);
  revalidatePath("/planejamento");
};

const parseEventDates = (value: z.infer<typeof eventFields>) => {
  const startsAt = parseCohortCalendarDateTime(value.startsAt, {
    allDay: value.allDay,
    timezone: cohortCalendarTimezone,
  });
  const endsAt = value.endsAt
    ? parseCohortCalendarDateTime(value.endsAt, {
        allDay: value.allDay,
        timezone: cohortCalendarTimezone,
      })
    : null;
  const recurrenceUntil = value.recurrenceUntil
    ? parseCohortCalendarDateTime(value.recurrenceUntil, {
        timezone: cohortCalendarTimezone,
      })
    : null;
  if (!startsAt) {
    throw new CalendarMutationFailure(
      "validation",
      "Informe uma data e horário existentes em São Paulo.",
      { startsAt: "Confira a data e o horário." }
    );
  }
  if (value.endsAt && !endsAt) {
    throw new CalendarMutationFailure(
      "validation",
      "Informe uma data final válida.",
      { endsAt: "Confira a data e o horário." }
    );
  }
  if (endsAt && endsAt <= startsAt) {
    throw new CalendarMutationFailure(
      "validation",
      "O término precisa ser posterior ao início.",
      { endsAt: "Escolha um horário posterior ao início." }
    );
  }
  if (value.recurrenceUntil && !recurrenceUntil) {
    throw new CalendarMutationFailure(
      "validation",
      "Informe um término válido para a repetição.",
      { recurrenceUntil: "Confira a data e o horário." }
    );
  }
  if (recurrenceUntil && recurrenceUntil < startsAt) {
    throw new CalendarMutationFailure(
      "validation",
      "A repetição deve terminar depois do início.",
      { recurrenceUntil: "Escolha uma data posterior ao início." }
    );
  }
  if (value.recurrence === PlannerRecurrence.NONE && recurrenceUntil) {
    throw new CalendarMutationFailure(
      "validation",
      "Escolha uma repetição para informar o término da série."
    );
  }
  return { startsAt, endsAt, recurrenceUntil };
};

type CalendarEventInput = z.infer<typeof eventFields>;
type CalendarEventDates = ReturnType<typeof parseEventDates>;

const findProcessedEvent = async (
  tx: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly eventId: string | undefined;
    readonly idempotencyKey: string;
    readonly operationKey: string;
  }
) => {
  const processed = await tx.domainEvent.findUnique({
    where: { idempotencyKey: input.operationKey },
    select: { id: true },
  });
  if (!processed) {
    return null;
  }
  if (input.eventId) {
    return input.eventId;
  }
  const event = await tx.cohortEvent.findFirst({
    where: {
      createdByMemberId: input.actorId,
      idempotencyKey: input.idempotencyKey,
    },
    select: { id: true },
  });
  return event?.id ?? null;
};

const saveExistingEvent = async (
  tx: Prisma.TransactionClient,
  input: CalendarEventInput,
  cohortId: string,
  dates: CalendarEventDates,
  now: Date
) => {
  if (!(input.eventId && input.expectedEventVersion)) {
    throw new CalendarMutationFailure(
      "validation",
      "Atualize o calendário antes de editar este evento."
    );
  }
  const previous = await tx.cohortEvent.findFirst({
    where: { id: input.eventId, cohortId },
    select: { id: true, status: true, publishedAt: true },
  });
  if (!previous) {
    throw new CalendarMutationFailure(
      "not-found",
      "Evento não encontrado nesta turma."
    );
  }

  const publishedAt = resolvePublishedAt(input.status, previous, now);
  const changed = await tx.cohortEvent.updateMany({
    where: {
      id: previous.id,
      cohortId,
      version: input.expectedEventVersion,
    },
    data: {
      title: input.title,
      description: input.description || null,
      startsAt: dates.startsAt,
      endsAt: dates.endsAt,
      allDay: input.allDay,
      color: input.color,
      recurrence: input.recurrence,
      recurrenceUntil: dates.recurrenceUntil,
      status: input.status,
      publishedAt,
      version: { increment: 1 },
    },
  });
  if (changed.count !== 1) {
    throw new CalendarMutationFailure(
      "conflict",
      "Este evento mudou em outra sessão. Atualize a tela."
    );
  }
  return previous.id;
};

const createCalendarEvent = async (
  tx: Prisma.TransactionClient,
  input: CalendarEventInput,
  actorId: string,
  cohortId: string,
  idempotencyKey: string,
  dates: CalendarEventDates,
  now: Date
) => {
  const event = await tx.cohortEvent.create({
    data: {
      cohortId,
      createdByMemberId: actorId,
      idempotencyKey,
      title: input.title,
      description: input.description || null,
      startsAt: dates.startsAt,
      endsAt: dates.endsAt,
      allDay: input.allDay,
      color: input.color,
      recurrence: input.recurrence,
      recurrenceUntil: dates.recurrenceUntil,
      status: input.status,
      publishedAt: input.status === ContentStatus.PUBLISHED ? now : null,
    },
    select: { id: true },
  });
  return event.id;
};

const saveCalendarEventTransaction = async (
  tx: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly event: CalendarEventInput;
    readonly idempotencyKey: string;
    readonly operationKey: string;
    readonly dates: CalendarEventDates;
  }
) => {
  const cohort = await requireWritableCohort(
    tx,
    input.actorId,
    input.event.cohortId
  );
  const processedEventId = await findProcessedEvent(tx, {
    actorId: input.actorId,
    eventId: input.event.eventId,
    idempotencyKey: input.idempotencyKey,
    operationKey: input.operationKey,
  });
  if (processedEventId) {
    return processedEventId;
  }
  if (cohort.archivedAt) {
    throw new CalendarMutationFailure("conflict", "Esta turma está arquivada.");
  }
  if (cohort.version !== input.event.expectedCohortVersion) {
    throw new CalendarMutationFailure(
      "conflict",
      "A turma mudou em outra sessão. Atualize a tela."
    );
  }
  if (!input.event.eventId) {
    const duplicate = await tx.cohortEvent.findFirst({
      where: {
        createdByMemberId: input.actorId,
        idempotencyKey: input.idempotencyKey,
      },
      select: { id: true },
    });
    if (duplicate) {
      return duplicate.id;
    }
  }

  await bumpCohortVersion(tx, cohort.id, input.event.expectedCohortVersion);
  const now = new Date();
  const eventId = input.event.eventId
    ? await saveExistingEvent(tx, input.event, cohort.id, input.dates, now)
    : await createCalendarEvent(
        tx,
        input.event,
        input.actorId,
        cohort.id,
        input.idempotencyKey,
        input.dates,
        now
      );
  await appendCalendarAudit(tx, {
    actorId: input.actorId,
    cohortId: cohort.id,
    eventId,
    operationKey: input.operationKey,
    verb:
      input.event.status === ContentStatus.PUBLISHED ? "published" : "saved",
    status: input.event.status,
  });
  return eventId;
};

const resolvePublishedAt = (
  status: ContentStatus,
  previous: {
    readonly publishedAt: Date | null;
    readonly status: ContentStatus;
  },
  now: Date
) => {
  if (status === ContentStatus.PUBLISHED) {
    if (previous.status === ContentStatus.PUBLISHED && previous.publishedAt) {
      return previous.publishedAt;
    }
    return now;
  }
  if (status === ContentStatus.DRAFT) {
    return null;
  }
  return previous.publishedAt;
};

const setCalendarEventStatusTransaction = async (
  tx: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly cohortId: string;
    readonly eventId: string;
    readonly expectedCohortVersion: number;
    readonly expectedEventVersion: number;
    readonly operationKey: string;
    readonly status: ContentStatus;
  }
) => {
  const cohort = await requireWritableCohort(tx, input.actorId, input.cohortId);
  if (
    await tx.domainEvent.findUnique({
      where: { idempotencyKey: input.operationKey },
      select: { id: true },
    })
  ) {
    return input.eventId;
  }
  if (cohort.archivedAt) {
    throw new CalendarMutationFailure("conflict", "Esta turma está arquivada.");
  }
  if (cohort.version !== input.expectedCohortVersion) {
    throw new CalendarMutationFailure(
      "conflict",
      "A turma mudou em outra sessão. Atualize a tela."
    );
  }
  const previous = await tx.cohortEvent.findFirst({
    where: { id: input.eventId, cohortId: cohort.id },
    select: { id: true, status: true, publishedAt: true },
  });
  if (!previous) {
    throw new CalendarMutationFailure(
      "not-found",
      "Evento não encontrado nesta turma."
    );
  }
  await bumpCohortVersion(tx, cohort.id, input.expectedCohortVersion);
  const changed = await tx.cohortEvent.updateMany({
    where: {
      id: previous.id,
      cohortId: cohort.id,
      version: input.expectedEventVersion,
    },
    data: {
      status: input.status,
      publishedAt: resolvePublishedAt(input.status, previous, new Date()),
      version: { increment: 1 },
    },
  });
  if (changed.count !== 1) {
    throw new CalendarMutationFailure(
      "conflict",
      "Este evento mudou em outra sessão. Atualize a tela."
    );
  }
  await appendCalendarAudit(tx, {
    actorId: input.actorId,
    cohortId: cohort.id,
    eventId: previous.id,
    operationKey: input.operationKey,
    verb:
      input.status === ContentStatus.PUBLISHED ? "published" : "status_changed",
    status: input.status,
  });
  return previous.id;
};

export const saveGestaoCohortCalendarEvent = async (
  input: unknown
): Promise<CohortCalendarActionResult> => {
  let cohortId = "";
  try {
    const value = eventFields.parse(input);
    cohortId = value.cohortId;
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new CalendarMutationFailure(
        "validation",
        "Atualize o formulário e tente novamente."
      );
    }
    if (value.eventId && !value.expectedEventVersion) {
      throw new CalendarMutationFailure(
        "validation",
        "Atualize o calendário antes de editar este evento."
      );
    }
    const dates = parseEventDates(value);
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = eventOperationKey("saved", key);
    const eventId = await database.$transaction(
      (tx) =>
        saveCalendarEventTransaction(tx, {
          actorId: actor.userId,
          event: value,
          idempotencyKey: key,
          operationKey,
          dates,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidateCalendar(cohortId);
    return { ok: true, eventId };
  } catch (error) {
    return errorResult(error);
  }
};

export const setGestaoCohortCalendarEventStatus = async (
  input: unknown
): Promise<CohortCalendarActionResult> => {
  let cohortId = "";
  try {
    const value = z
      .object({
        cohortId: id,
        eventId: id,
        expectedCohortVersion: z.number().int().positive(),
        expectedEventVersion: z.number().int().positive(),
        status: z.nativeEnum(ContentStatus),
        idempotencyKey: uuid,
      })
      .parse(input);
    cohortId = value.cohortId;
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new CalendarMutationFailure(
        "validation",
        "Atualize o formulário e tente novamente."
      );
    }
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = eventOperationKey(
      `status-${value.status.toLowerCase()}`,
      key
    );
    const eventId = await database.$transaction(
      (tx) =>
        setCalendarEventStatusTransaction(tx, {
          actorId: actor.userId,
          cohortId: value.cohortId,
          eventId: value.eventId,
          expectedCohortVersion: value.expectedCohortVersion,
          expectedEventVersion: value.expectedEventVersion,
          operationKey,
          status: value.status,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidateCalendar(cohortId);
    return { ok: true, eventId };
  } catch (error) {
    return errorResult(error);
  }
};
