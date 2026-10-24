"use server";

import {
  AccessGrantOrigin,
  AccessResourceType,
  CohortReleaseMode,
  ContentStatus,
  database,
  Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseCohortCalendarDateTime } from "@/lib/cohort-calendar-domain";
import { cohortMembershipActiveKey } from "@/lib/cohort-domain";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const openAccessInput = z.object({
  courseId: z.string().trim().min(1).max(255),
  enabled: z.boolean(),
  idempotencyKey: z.string().uuid(),
});

export type CourseOpenAccessResult =
  | { readonly duplicate?: boolean; readonly ok: true }
  | {
      readonly code:
        | "conflict"
        | "forbidden"
        | "not-found"
        | "rate-limited"
        | "unavailable"
        | "validation";
      readonly fields?: Readonly<Record<string, string>>;
      readonly message: string;
      readonly ok: false;
    };

class CourseAccessFailure extends Error {
  readonly code: Extract<CourseOpenAccessResult, { ok: false }>["code"];
  readonly fields?: Readonly<Record<string, string>>;

  constructor(
    code: Extract<CourseOpenAccessResult, { ok: false }>["code"],
    message: string,
    fields?: Readonly<Record<string, string>>
  ) {
    super(message);
    this.name = "CourseAccessFailure";
    this.code = code;
    this.fields = fields;
  }
}

const courseAccessError = (error: unknown): CourseOpenAccessResult => {
  if (error instanceof z.ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      fields[issue.path.join(".") || "form"] ??= issue.message;
    }
    return {
      ok: false,
      code: "validation",
      message: "Atualize a tela e revise a alteração.",
      fields,
    };
  }
  if (error instanceof CourseAccessFailure) {
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
    (error.code === "P2034" || error.code === "P2002")
  ) {
    return {
      ok: false,
      code: "conflict",
      message:
        "O acesso mudou em outra sessão. Atualize a tela e tente novamente.",
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

const operationKey = (key: string) => `gestao:course:open-access:${key}`;

const lockCourseForAccess = async (
  transaction: Prisma.TransactionClient,
  courseId: string
) => {
  const courseRows = await transaction.$queryRaw<
    Array<{ id: string; status: ContentStatus }>
  >(
    Prisma.sql`SELECT "id", "status" FROM "Course" WHERE "id" = ${courseId} FOR UPDATE`
  );
  const course = courseRows[0];
  if (!course) {
    throw new CourseAccessFailure("not-found", "Curso não encontrado.");
  }
  return course;
};

const hasMatchingOperation = async (
  transaction: Prisma.TransactionClient,
  eventKey: string,
  eventType: string,
  fingerprint: string
) => {
  const previous = await transaction.domainEvent.findUnique({
    where: { idempotencyKey: eventKey },
    select: { eventType: true, payload: true },
  });
  if (!previous) {
    return false;
  }
  const payload = previous.payload as { fingerprint?: unknown };
  if (previous.eventType !== eventType || payload.fingerprint !== fingerprint) {
    throw new CourseAccessFailure(
      "conflict",
      "Esta confirmação já foi usada em outra alteração. Atualize a tela."
    );
  }
  return true;
};

const updateGlobalCourseSource = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly courseId: string;
    readonly enabled: boolean;
    readonly now: Date;
  }
) => {
  const source = await transaction.accessGrantSource.findFirst({
    where: {
      origin: AccessGrantOrigin.OPEN_ACCESS,
      originRefId: input.courseId,
      resourceId: input.courseId,
      resourceType: AccessResourceType.COURSE,
      subjectMemberId: null,
      subjectCohortId: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { id: true, revokedAt: true },
  });
  const currentlyEnabled = Boolean(source && !source.revokedAt);
  if (currentlyEnabled === input.enabled) {
    return false;
  }
  if (input.enabled && source) {
    await transaction.accessGrantSource.update({
      where: { id: source.id },
      data: { validFrom: input.now, validUntil: null, revokedAt: null },
    });
  } else if (input.enabled) {
    await transaction.accessGrantSource.create({
      data: {
        origin: AccessGrantOrigin.OPEN_ACCESS,
        originRefId: input.courseId,
        subjectMemberId: null,
        subjectCohortId: null,
        resourceType: AccessResourceType.COURSE,
        resourceId: input.courseId,
        validFrom: input.now,
        validUntil: null,
        createdByMemberId: input.actorId,
      },
    });
  } else if (source) {
    await transaction.accessGrantSource.update({
      where: { id: source.id },
      data: { revokedAt: input.now },
    });
  }
  return true;
};

const persistCourseOpenAccess = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly courseId: string;
    readonly enabled: boolean;
    readonly eventKey: string;
    readonly fingerprint: string;
    readonly now: Date;
  }
) => {
  const eventType = "gestao.course.open_access.changed";
  const course = await lockCourseForAccess(transaction, input.courseId);
  if (
    await hasMatchingOperation(
      transaction,
      input.eventKey,
      eventType,
      input.fingerprint
    )
  ) {
    return true;
  }
  if (input.enabled && course.status !== ContentStatus.PUBLISHED) {
    throw new CourseAccessFailure(
      "validation",
      "Publique o curso antes de abri-lo para todos os membros."
    );
  }
  const changed = await updateGlobalCourseSource(transaction, input);
  await transaction.domainEvent.create({
    data: {
      eventType,
      actorId: input.actorId,
      aggregateType: "Course",
      aggregateId: input.courseId,
      idempotencyKey: input.eventKey,
      payload: {
        courseId: input.courseId,
        enabled: input.enabled,
        changed,
        fingerprint: input.fingerprint,
      },
      occurredAt: input.now,
    },
  });
  return false;
};

export const setGestaoCourseOpenAccess = async (
  input: unknown
): Promise<CourseOpenAccessResult> => {
  try {
    const value = openAccessInput.parse(input);
    const { actor } = await requireGestaoAction("access.manage", {
      contentId: value.courseId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new CourseAccessFailure(
        "validation",
        "Atualize a tela antes de salvar."
      );
    }
    await consumeMutationRateLimit({
      action: "admin.mutation",
      memberId: actor.userId,
    });

    const eventKey = operationKey(key);
    const fingerprint = `${value.courseId}:${value.enabled ? "open" : "closed"}`;
    const now = new Date();
    const duplicate = await database.$transaction(
      (transaction) =>
        persistCourseOpenAccess(transaction, {
          actorId: actor.userId,
          courseId: value.courseId,
          enabled: value.enabled,
          eventKey,
          fingerprint,
          now,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
    );

    revalidatePath(`/gestao/ensino/cursos/${value.courseId}/turmas`);
    revalidatePath("/cursos");
    return { ok: true, duplicate };
  } catch (error) {
    return courseAccessError(error);
  }
};

const courseId = z.string().trim().min(1).max(255);
const cohortId = z.string().trim().min(1).max(255);
const uuid = z.string().uuid();
const cohortCourseAccessInput = z.object({
  cohortId,
  courseId,
  enabled: z.boolean(),
  expectedCohortVersion: z.number().int().positive(),
  idempotencyKey: uuid,
  releaseMode: z.nativeEnum(CohortReleaseMode),
  startsAt: z.string().max(16).optional().or(z.literal("")),
});

const directCourseGrantInput = z.object({
  courseId,
  expiresAt: z.string().max(16).optional().or(z.literal("")),
  idempotencyKey: uuid,
  memberId: z.string().trim().min(1).max(255),
});

const revokeDirectCourseGrantInput = z.object({
  courseId,
  grantId: z.string().trim().min(1).max(255),
  grantKind: z.enum(["SOURCE", "LEGACY"]),
  idempotencyKey: uuid,
});

const readOperation = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly eventKey: string;
    readonly eventType: string;
    readonly fingerprint: string;
  }
) => {
  const previous = await transaction.domainEvent.findUnique({
    where: { idempotencyKey: input.eventKey },
    select: { eventType: true, payload: true },
  });
  if (!previous) {
    return false;
  }
  const payload = previous.payload as { fingerprint?: unknown };
  if (
    previous.eventType !== input.eventType ||
    payload.fingerprint !== input.fingerprint
  ) {
    throw new CourseAccessFailure(
      "conflict",
      "Esta confirmação já foi usada em outra alteração. Atualize a tela."
    );
  }
  return true;
};

const recordOperation = (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly aggregateId: string;
    readonly aggregateType: string;
    readonly eventKey: string;
    readonly eventType: string;
    readonly occurredAt: Date;
    readonly payload: Prisma.InputJsonObject;
  }
) =>
  transaction.domainEvent.create({
    data: {
      eventType: input.eventType,
      actorId: input.actorId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      idempotencyKey: input.eventKey,
      payload: input.payload,
      occurredAt: input.occurredAt,
    },
  });

type CohortCourseAccessChange = z.infer<typeof cohortCourseAccessInput>;

interface CourseAccessActor {
  readonly role: string;
  readonly userId: string;
}

const lockCohortForActor = async (
  transaction: Prisma.TransactionClient,
  actor: CourseAccessActor,
  cohortId: string
) => {
  const scopedCohorts = await transaction.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT cohort."id"
      FROM "Cohort" AS cohort
      WHERE cohort."id" = ${cohortId}
        AND (${actor.role === "ADMIN"} OR EXISTS (
          SELECT 1 FROM "CohortTeacher" AS teacher
          WHERE teacher."cohortId" = cohort."id"
            AND teacher."memberId" = ${actor.userId}
        ))
      FOR UPDATE
    `
  );
  if (!scopedCohorts.length) {
    throw new CourseAccessFailure(
      "not-found",
      "Turma não encontrada ou fora do seu escopo."
    );
  }
};

const loadCohortAccessState = async (
  transaction: Prisma.TransactionClient,
  value: CohortCourseAccessChange
) => {
  const [cohort, course, current] = await Promise.all([
    transaction.cohort.findUnique({
      where: { id: value.cohortId },
      select: { id: true, version: true, archivedAt: true },
    }),
    transaction.course.findUnique({
      where: { id: value.courseId },
      select: { id: true, status: true },
    }),
    transaction.cohortCourseAccess.findFirst({
      where: {
        cohortId: value.cohortId,
        courseId: value.courseId,
        revokedAt: null,
      },
      select: { id: true, releaseMode: true, startsAt: true },
    }),
  ]);
  if (!(cohort && course)) {
    throw new CourseAccessFailure(
      "not-found",
      "Turma ou curso não encontrado."
    );
  }
  if (cohort.version !== value.expectedCohortVersion) {
    throw new CourseAccessFailure(
      "conflict",
      "A turma mudou em outra sessão. Atualize a tela e tente novamente."
    );
  }
  if (value.enabled && cohort.archivedAt) {
    throw new CourseAccessFailure("conflict", "Esta turma está arquivada.");
  }
  if (value.enabled && course.status !== ContentStatus.PUBLISHED && !current) {
    throw new CourseAccessFailure(
      "validation",
      "Publique o curso antes de liberá-lo para uma turma.",
      { courseId: "O curso ainda não está publicado." }
    );
  }
  return { cohort, course, current };
};

const hasUnchangedCohortCourseAccess = (
  current: { releaseMode: CohortReleaseMode; startsAt: Date | null } | null,
  enabled: boolean,
  releaseMode: CohortReleaseMode,
  startsAt: Date | null
) =>
  enabled
    ? Boolean(
        current &&
          current.releaseMode === releaseMode &&
          (current.startsAt?.getTime() ?? null) ===
            (startsAt?.getTime() ?? null)
      )
    : !current;

const applyCohortCourseAccess = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly cohort: { readonly id: string; readonly version: number };
    readonly course: { readonly id: string };
    readonly current: {
      readonly id: string;
      readonly releaseMode: CohortReleaseMode;
      readonly startsAt: Date | null;
    } | null;
    readonly enabled: boolean;
    readonly expectedVersion: number;
    readonly releaseMode: CohortReleaseMode;
    readonly startsAt: Date | null;
    readonly now: Date;
  }
) => {
  if (
    hasUnchangedCohortCourseAccess(
      input.current,
      input.enabled,
      input.releaseMode,
      input.startsAt
    )
  ) {
    return false;
  }
  const updated = await transaction.cohort.updateMany({
    where: { id: input.cohort.id, version: input.expectedVersion },
    data: { version: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new CourseAccessFailure(
      "conflict",
      "A turma mudou em outra sessão. Atualize a tela e tente novamente."
    );
  }
  if (input.enabled) {
    await transaction.cohortCourseAccess.upsert({
      where: {
        activeKey: cohortMembershipActiveKey(input.cohort.id, input.course.id),
      },
      create: {
        activeKey: cohortMembershipActiveKey(input.cohort.id, input.course.id),
        cohortId: input.cohort.id,
        courseId: input.course.id,
        releaseMode: input.releaseMode,
        startsAt: input.startsAt,
        createdByMemberId: input.actorId,
      },
      update: {
        releaseMode: input.releaseMode,
        startsAt: input.startsAt,
        revokedAt: null,
      },
    });
  } else if (input.current) {
    await transaction.cohortCourseAccess.updateMany({
      where: { id: input.current.id, revokedAt: null },
      data: { activeKey: null, revokedAt: input.now },
    });
  }
  return true;
};

const persistCohortCourseAccess = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actor: CourseAccessActor;
    readonly value: CohortCourseAccessChange;
    readonly eventKey: string;
    readonly eventType: string;
    readonly fingerprint: string;
    readonly startsAt: Date | null;
    readonly now: Date;
  }
) => {
  await lockCohortForActor(transaction, input.actor, input.value.cohortId);
  if (
    await readOperation(transaction, {
      eventKey: input.eventKey,
      eventType: input.eventType,
      fingerprint: input.fingerprint,
    })
  ) {
    return true;
  }
  const state = await loadCohortAccessState(transaction, input.value);
  const changed = await applyCohortCourseAccess(transaction, {
    actorId: input.actor.userId,
    cohort: state.cohort,
    course: state.course,
    current: state.current,
    enabled: input.value.enabled,
    expectedVersion: input.value.expectedCohortVersion,
    releaseMode: input.value.releaseMode,
    startsAt: input.startsAt,
    now: input.now,
  });
  await recordOperation(transaction, {
    actorId: input.actor.userId,
    aggregateId: state.cohort.id,
    aggregateType: "Cohort",
    eventKey: input.eventKey,
    eventType: input.eventType,
    occurredAt: input.now,
    payload: {
      cohortId: state.cohort.id,
      courseId: state.course.id,
      enabled: input.value.enabled,
      changed,
      releaseMode: input.value.releaseMode,
      startsAt: input.startsAt?.toISOString() ?? null,
      fingerprint: input.fingerprint,
    },
  });
  return false;
};

export const setGestaoCourseCohortAccess = async (
  input: unknown
): Promise<CourseOpenAccessResult> => {
  try {
    const value = cohortCourseAccessInput.parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new CourseAccessFailure(
        "validation",
        "Atualize a tela antes de salvar."
      );
    }
    const now = new Date();
    const startsAt =
      value.enabled && value.releaseMode === CohortReleaseMode.SCHEDULE
        ? parseCohortCalendarDateTime(value.startsAt ?? "")
        : null;
    if (value.enabled && value.releaseMode === CohortReleaseMode.SCHEDULE) {
      if (!startsAt) {
        throw new CourseAccessFailure(
          "validation",
          "Informe uma data e um horário válidos.",
          { startsAt: "Escolha quando liberar o curso." }
        );
      }
      if (startsAt <= now) {
        throw new CourseAccessFailure(
          "validation",
          "A liberação agendada precisa estar no futuro.",
          { startsAt: "Escolha um horário futuro." }
        );
      }
    }
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const eventType = "gestao.course.cohort_access.changed";
    const eventKey = `gestao:course:cohort-access:${key}`;
    const fingerprint = [
      value.cohortId,
      value.courseId,
      value.enabled ? "enabled" : "disabled",
      value.releaseMode,
      startsAt?.toISOString() ?? "",
    ].join(":");
    const duplicate = await database.$transaction(
      (transaction) =>
        persistCohortCourseAccess(transaction, {
          actor,
          value,
          eventKey,
          eventType,
          fingerprint,
          startsAt,
          now,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
    );
    revalidatePath(`/gestao/ensino/cursos/${value.courseId}/turmas`);
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}/conteudo`);
    revalidatePath("/cursos");
    return { ok: true, duplicate };
  } catch (error) {
    return courseAccessError(error);
  }
};

export const grantGestaoCourseDirectAccess = async (
  input: unknown
): Promise<CourseOpenAccessResult> => {
  try {
    const value = directCourseGrantInput.parse(input);
    const { actor } = await requireGestaoAction("access.manage", {
      contentId: value.courseId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new CourseAccessFailure(
        "validation",
        "Atualize a tela antes de salvar."
      );
    }
    const expiresAt = value.expiresAt
      ? parseCohortCalendarDateTime(value.expiresAt)
      : null;
    const now = new Date();
    if (value.expiresAt && !expiresAt) {
      throw new CourseAccessFailure(
        "validation",
        "Informe uma data de expiração válida.",
        { expiresAt: "Confira a data e o horário." }
      );
    }
    if (expiresAt && expiresAt <= now) {
      throw new CourseAccessFailure(
        "validation",
        "A expiração precisa estar no futuro.",
        { expiresAt: "Escolha um horário futuro." }
      );
    }
    await consumeMutationRateLimit({
      action: "admin.mutation",
      memberId: actor.userId,
    });
    const eventType = "gestao.course.direct_access.granted";
    const eventKey = `gestao:course:direct-access:${key}`;
    const fingerprint = `${value.courseId}:${value.memberId}:${expiresAt?.toISOString() ?? "never"}`;
    const duplicate = await database.$transaction(
      async (transaction) => {
        const courseRows = await transaction.$queryRaw<
          Array<{ id: string; status: ContentStatus }>
        >(
          Prisma.sql`SELECT "id", "status" FROM "Course" WHERE "id" = ${value.courseId} FOR UPDATE`
        );
        const course = courseRows[0];
        if (!course) {
          throw new CourseAccessFailure("not-found", "Curso não encontrado.");
        }
        if (
          await readOperation(transaction, { eventKey, eventType, fingerprint })
        ) {
          return true;
        }
        const memberRows = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT "id" FROM "Member"
            WHERE "id" = ${value.memberId}
              AND "role" = 'MEMBER'
              AND "deactivatedAt" IS NULL
            FOR UPDATE
          `
        );
        const [existingSource, existingLegacy] = await Promise.all([
          transaction.accessGrantSource.findFirst({
            where: {
              origin: AccessGrantOrigin.DIRECT,
              resourceType: AccessResourceType.COURSE,
              resourceId: value.courseId,
              subjectMemberId: value.memberId,
              revokedAt: null,
              validFrom: { lte: now },
              OR: [{ validUntil: null }, { validUntil: { gt: now } }],
            },
            select: { id: true },
          }),
          transaction.accessGrant.findFirst({
            where: {
              memberId: value.memberId,
              resourceType: AccessResourceType.COURSE,
              resourceId: value.courseId,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            select: { id: true },
          }),
        ]);
        const member = memberRows[0];
        if (course.status !== ContentStatus.PUBLISHED) {
          throw new CourseAccessFailure(
            "validation",
            "Publique o curso antes de conceder acesso individual."
          );
        }
        if (!member) {
          throw new CourseAccessFailure(
            "validation",
            "Escolha um membro ativo da lista.",
            { memberId: "O membro não está disponível." }
          );
        }
        if (existingSource || existingLegacy) {
          throw new CourseAccessFailure(
            "conflict",
            "Este membro já tem uma concessão individual ativa para o curso."
          );
        }
        await transaction.accessGrantSource.create({
          data: {
            idempotencyKey: eventKey,
            origin: AccessGrantOrigin.DIRECT,
            originRefId: "gestao-course-access",
            subjectMemberId: member.id,
            subjectCohortId: null,
            resourceType: AccessResourceType.COURSE,
            resourceId: course.id,
            validFrom: now,
            validUntil: expiresAt,
            createdByMemberId: actor.userId,
          },
        });
        await recordOperation(transaction, {
          actorId: actor.userId,
          aggregateId: course.id,
          aggregateType: "Course",
          eventKey,
          eventType,
          occurredAt: now,
          payload: {
            courseId: course.id,
            memberId: member.id,
            expiresAt: expiresAt?.toISOString() ?? null,
            fingerprint,
          },
        });
        return false;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
    );
    revalidatePath(`/gestao/ensino/cursos/${value.courseId}/turmas`);
    revalidatePath("/cursos");
    return { ok: true, duplicate };
  } catch (error) {
    return courseAccessError(error);
  }
};

const revokeCourseDirectGrant = async (
  transaction: Prisma.TransactionClient,
  input: z.infer<typeof revokeDirectCourseGrantInput>,
  now: Date
) => {
  if (input.grantKind === "SOURCE") {
    const grant = await transaction.accessGrantSource.findFirst({
      where: {
        id: input.grantId,
        origin: AccessGrantOrigin.DIRECT,
        resourceType: AccessResourceType.COURSE,
        resourceId: input.courseId,
        subjectMemberId: { not: null },
        revokedAt: null,
      },
      select: { subjectMemberId: true },
    });
    if (!grant?.subjectMemberId) {
      throw new CourseAccessFailure(
        "not-found",
        "A concessão já foi removida ou não pertence a este curso."
      );
    }
    const result = await transaction.accessGrantSource.updateMany({
      where: {
        id: input.grantId,
        origin: AccessGrantOrigin.DIRECT,
        resourceType: AccessResourceType.COURSE,
        resourceId: input.courseId,
        subjectMemberId: grant.subjectMemberId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
    if (result.count !== 1) {
      throw new CourseAccessFailure(
        "not-found",
        "A concessão já foi removida ou não pertence a este curso."
      );
    }
    return grant.subjectMemberId;
  }

  const grant = await transaction.accessGrant.findFirst({
    where: {
      id: input.grantId,
      resourceType: AccessResourceType.COURSE,
      resourceId: input.courseId,
    },
    select: { memberId: true },
  });
  if (!grant) {
    throw new CourseAccessFailure(
      "not-found",
      "A concessão já foi removida ou não pertence a este curso."
    );
  }
  const result = await transaction.accessGrant.deleteMany({
    where: {
      id: input.grantId,
      resourceType: AccessResourceType.COURSE,
      resourceId: input.courseId,
    },
  });
  if (result.count !== 1) {
    throw new CourseAccessFailure(
      "not-found",
      "A concessão já foi removida ou não pertence a este curso."
    );
  }
  return grant.memberId;
};

export const revokeGestaoCourseDirectAccess = async (
  input: unknown
): Promise<CourseOpenAccessResult> => {
  try {
    const value = revokeDirectCourseGrantInput.parse(input);
    const { actor } = await requireGestaoAction("access.manage", {
      contentId: value.courseId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new CourseAccessFailure(
        "validation",
        "Atualize a tela antes de salvar."
      );
    }
    await consumeMutationRateLimit({
      action: "admin.mutation",
      memberId: actor.userId,
    });
    const eventType = "gestao.course.direct_access.revoked";
    const eventKey = `gestao:course:direct-revoke:${key}`;
    const fingerprint = `${value.courseId}:${value.grantKind}:${value.grantId}`;
    const duplicate = await database.$transaction(
      async (transaction) => {
        const courseRows = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Course" WHERE "id" = ${value.courseId} FOR UPDATE`
        );
        if (!courseRows.length) {
          throw new CourseAccessFailure("not-found", "Curso não encontrado.");
        }
        const previous = await transaction.domainEvent.findUnique({
          where: { idempotencyKey: eventKey },
          select: { eventType: true, payload: true },
        });
        if (previous) {
          const payload = previous.payload as { fingerprint?: unknown };
          if (
            previous.eventType !== eventType ||
            payload.fingerprint !== fingerprint
          ) {
            throw new CourseAccessFailure(
              "conflict",
              "Esta confirmação já foi usada em outra revogação. Atualize a tela."
            );
          }
          return true;
        }
        const now = new Date();
        const memberId = await revokeCourseDirectGrant(transaction, value, now);
        await recordOperation(transaction, {
          actorId: actor.userId,
          aggregateId: value.courseId,
          aggregateType: "Course",
          eventKey,
          eventType,
          occurredAt: now,
          payload: {
            courseId: value.courseId,
            grantId: value.grantId,
            grantKind: value.grantKind,
            memberId,
            fingerprint,
          },
        });
        return false;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
    );
    revalidatePath(`/gestao/ensino/cursos/${value.courseId}/turmas`);
    revalidatePath("/cursos");
    return { ok: true, duplicate };
  } catch (error) {
    return courseAccessError(error);
  }
};
