"use server";

import { createHash, randomBytes } from "node:crypto";
import {
  AccessGrantOrigin,
  AccessResourceType,
  CohortLateJoinPolicy,
  CohortMemberSource,
  CohortMemberStatus,
  CohortReleaseMode,
  ContentStatus,
  database,
  MemberRole,
  Prisma,
} from "@repo/database";
import { type DomainEventInput, enqueueDomainEvent } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMemberIdentitySnapshot } from "@/lib/auth";
import { requireOnboardedMemberId } from "@/lib/authorization";
import {
  cohortMembershipActiveKey,
  normalizeCohortName,
  resolveCohortCourseAccess,
} from "@/lib/cohort-domain";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import type { GestaoRole } from "@/lib/gestao-permissions";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const id = z.string().trim().min(1).max(255);
const uuid = z.string().uuid();
const dateText = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Informe uma data válida.");
const inviteTokenPattern = /^[a-f\d]{32}$/iu;
const baseCohort = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Use ao menos 3 caracteres.")
    .max(120, "Use até 120 caracteres."),
  startsAt: dateText,
  endsAt: dateText.optional().or(z.literal("")),
  lateJoinPolicy: z
    .nativeEnum(CohortLateJoinPolicy)
    .default(CohortLateJoinPolicy.ALL_ACTIVE),
  teacherIds: z.array(id).max(20).default([]),
  idempotencyKey: uuid,
});

export type CohortActionResult =
  | {
      readonly ok: true;
      readonly cohortId?: string;
      readonly duplicate?: boolean;
      readonly inviteToken?: string;
      readonly invitedCount?: number;
      readonly skippedEmails?: readonly string[];
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

class MutationFailure extends Error {
  readonly code: Extract<CohortActionResult, { ok: false }>["code"];
  readonly fields?: Readonly<Record<string, string>>;

  constructor(
    code: Extract<CohortActionResult, { ok: false }>["code"],
    message: string,
    fields?: Readonly<Record<string, string>>
  ) {
    super(message);
    this.name = "MutationFailure";
    this.code = code;
    this.fields = fields;
  }
}
const errorResult = (error: unknown): CohortActionResult => {
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
  if (error instanceof MutationFailure) {
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
    error.code === "P2002"
  ) {
    return {
      ok: false,
      code: "conflict",
      message:
        "Já existe um registro com esses dados. Atualize a tela e tente novamente.",
    };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return {
      ok: false,
      code: "conflict",
      message:
        "Outra alteração foi salva ao mesmo tempo. Atualize os dados antes de tentar novamente.",
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
const toDate = (value: string, endOfDay = false) => {
  const date = new Date(`${value}T03:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new MutationFailure("validation", "Informe uma data válida.", {
      startsAt: "Informe uma data válida.",
    });
  }
  if (endOfDay) {
    date.setTime(date.getTime() + 86_400_000 - 1);
  }
  return date;
};
const slugFor = (name: string, key: string) =>
  `${
    normalizeCohortName(name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 68) || "turma"
  }-${key.slice(0, 6)}`;
const eventKey = (action: string, key: string) =>
  `gestao:cohort:${action}:${key}`;
const eventExists = async (tx: Prisma.TransactionClient, key: string) =>
  Boolean(
    await tx.domainEvent.findUnique({
      where: { idempotencyKey: key },
      select: { id: true },
    })
  );
const recordEvent = (
  tx: Prisma.TransactionClient,
  actorId: string,
  cohortId: string,
  action: string,
  key: string,
  payload: DomainEventInput["payload"]
) =>
  enqueueDomainEvent(tx, {
    eventType: `gestao.cohort.${action}`,
    actorId,
    aggregateType: "cohort",
    aggregateId: cohortId,
    idempotencyKey: key,
    payload,
    occurredAt: new Date(),
    consumers: [],
  });
const requireCohort = async (
  tx: Prisma.TransactionClient,
  actor: { role: GestaoRole; userId: string },
  cohortId: string
) => {
  const cohort = await tx.cohort.findFirst({
    where: {
      id: cohortId,
      ...(actor.role === "ADMIN"
        ? {}
        : { teachers: { some: { memberId: actor.userId } } }),
    },
    select: {
      id: true,
      version: true,
      archivedAt: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!cohort) {
    throw new MutationFailure(
      "not-found",
      "Turma não encontrada ou sem acesso."
    );
  }
  return cohort;
};
const teacherIdsFor = async (
  tx: Prisma.TransactionClient,
  actor: { role: GestaoRole; userId: string },
  selected: readonly string[]
) => {
  const ids = [
    ...new Set([actor.userId, ...(actor.role === "ADMIN" ? selected : [])]),
  ];
  const rows = await tx.member.findMany({
    where: {
      id: { in: ids },
      role: { in: [MemberRole.TEACHER, MemberRole.ADMIN] },
      deactivatedAt: null,
    },
    select: { id: true },
  });
  if (rows.length !== ids.length) {
    throw new MutationFailure(
      "validation",
      "Selecione apenas professores ativos.",
      { teacherIds: "Há responsáveis inválidos." }
    );
  }
  return ids;
};
const checkDates = (startsAt: string, endsAt?: string) => {
  const start = toDate(startsAt);
  const end = endsAt ? toDate(endsAt, true) : null;
  if (endsAt && endsAt <= startsAt) {
    throw new MutationFailure(
      "validation",
      "A data final deve ser posterior à inicial.",
      { endsAt: "Escolha uma data posterior ao início." }
    );
  }
  return { start, end };
};

export const createGestaoCohort = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const { actor } = await requireGestaoAction("cohort.manage");
    const value = baseCohort.parse(input);
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize o formulário e tente novamente."
      );
    }
    const { start, end } = checkDates(value.startsAt, value.endsAt);
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = eventKey("created", key);
    const row = await database.$transaction(
      async (tx) => {
        if (await eventExists(tx, operationKey)) {
          return tx.cohort.findFirst({
            where: { createdByMemberId: actor.userId, idempotencyKey: key },
            select: { id: true },
          });
        }
        const prior = await tx.cohort.findFirst({
          where: { createdByMemberId: actor.userId, idempotencyKey: key },
          select: { id: true },
        });
        if (prior) {
          return prior;
        }
        const teachers = await teacherIdsFor(tx, actor, value.teacherIds);
        const cohort = await tx.cohort.create({
          data: {
            name: value.name.trim().replace(/\s+/gu, " "),
            normalizedName: normalizeCohortName(value.name),
            slug: slugFor(value.name, key),
            startsAt: start,
            endsAt: end,
            lateJoinPolicy: value.lateJoinPolicy,
            createdByMemberId: actor.userId,
            idempotencyKey: key,
            teachers: {
              create: teachers.map((memberId) => ({
                memberId,
                assignedByMemberId: actor.userId,
              })),
            },
          },
          select: { id: true },
        });
        await recordEvent(
          tx,
          actor.userId,
          cohort.id,
          "created",
          operationKey,
          {
            startsAt: start.toISOString(),
            endsAt: end?.toISOString() ?? null,
            teacherCount: teachers.length,
          }
        );
        return cohort;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath("/gestao/alunos/turmas");
    return { ok: true, cohortId: row?.id, duplicate: !row };
  } catch (error) {
    return errorResult(error);
  }
};

export const updateGestaoCohort = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = baseCohort
      .extend({ cohortId: id, expectedVersion: z.number().int().positive() })
      .parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize o formulário e tente novamente."
      );
    }
    const { start, end } = checkDates(value.startsAt, value.endsAt);
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = eventKey("updated", key);
    await database.$transaction(
      async (tx) => {
        const current = await requireCohort(tx, actor, value.cohortId);
        if (await eventExists(tx, operationKey)) {
          return;
        }
        if (current.version !== value.expectedVersion) {
          throw new MutationFailure(
            "conflict",
            "A turma mudou em outra sessão. Atualize a tela."
          );
        }
        const teachers =
          actor.role === "ADMIN"
            ? await teacherIdsFor(tx, actor, value.teacherIds)
            : (
                await tx.cohortTeacher.findMany({
                  where: { cohortId: current.id },
                  select: { memberId: true },
                })
              ).map(({ memberId }) => memberId);
        const changed = await tx.cohort.updateMany({
          where: { id: current.id, version: value.expectedVersion },
          data: {
            name: value.name.trim().replace(/\s+/gu, " "),
            normalizedName: normalizeCohortName(value.name),
            startsAt: start,
            endsAt: end,
            lateJoinPolicy: value.lateJoinPolicy,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) {
          throw new MutationFailure(
            "conflict",
            "A turma mudou em outra sessão. Atualize a tela."
          );
        }
        await tx.cohortTeacher.deleteMany({
          where: { cohortId: current.id, memberId: { notIn: teachers } },
        });
        await tx.cohortTeacher.createMany({
          data: teachers.map((memberId) => ({
            cohortId: current.id,
            memberId,
            assignedByMemberId: actor.userId,
          })),
          skipDuplicates: true,
        });
        await recordEvent(
          tx,
          actor.userId,
          current.id,
          "updated",
          operationKey,
          { version: value.expectedVersion + 1 }
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath("/gestao/alunos/turmas");
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}`);
    return { ok: true, cohortId: value.cohortId };
  } catch (error) {
    return errorResult(error);
  }
};

const membersInput = z
  .array(id)
  .min(1, "Selecione ao menos um aluno.")
  .max(100);
const rosterInput = z.object({
  cohortId: id,
  memberIds: membersInput,
  idempotencyKey: uuid,
});
const activeMembers = async (
  tx: Prisma.TransactionClient,
  memberIds: readonly string[]
) => {
  const rows = await tx.member.findMany({
    where: {
      id: { in: [...new Set(memberIds)] },
      role: MemberRole.MEMBER,
      deactivatedAt: null,
    },
    select: { id: true },
  });
  if (rows.length !== new Set(memberIds).size) {
    throw new MutationFailure(
      "validation",
      "Um ou mais alunos não estão disponíveis.",
      { memberIds: "Atualize a busca e selecione alunos ativos." }
    );
  }
  return rows.map((row) => row.id);
};

export const addGestaoCohortMembers = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = rosterInput.parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize a tela e tente novamente."
      );
    }
    const operationKey = eventKey("members-added", key);
    const added = await database.$transaction(
      async (tx) => {
        const cohort = await requireCohort(tx, actor, value.cohortId);
        if (cohort.archivedAt) {
          throw new MutationFailure("conflict", "Esta turma está arquivada.");
        }
        if (await eventExists(tx, operationKey)) {
          return 0;
        }
        const memberIds = await activeMembers(tx, value.memberIds);
        const count = await tx.cohortMembership.createMany({
          data: memberIds.map((memberId) => ({
            cohortId: cohort.id,
            memberId,
            status: CohortMemberStatus.ACTIVE,
            source: CohortMemberSource.MANUAL,
            activeKey: cohortMembershipActiveKey(cohort.id, memberId),
            createdByMemberId: actor.userId,
          })),
          skipDuplicates: true,
        });
        await recordEvent(
          tx,
          actor.userId,
          cohort.id,
          "members_added",
          operationKey,
          { memberCount: count.count }
        );
        return count.count;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath("/gestao/alunos/turmas");
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}/alunos`);
    return { ok: true, cohortId: value.cohortId, invitedCount: added };
  } catch (error) {
    return errorResult(error);
  }
};

const createReadOnlySources = async (
  tx: Prisma.TransactionClient,
  input: {
    cohortId: string;
    memberId: string;
    membershipId: string;
    joinedAt: Date;
    actorId: string;
    now: Date;
  }
) => {
  const [cohort, accesses] = await Promise.all([
    tx.cohort.findUnique({
      where: { id: input.cohortId },
      select: {
        archivedAt: true,
        endsAt: true,
        lateJoinPolicy: true,
        readAfterEndDays: true,
        startsAt: true,
      },
    }),
    tx.cohortCourseAccess.findMany({
      where: { cohortId: input.cohortId, revokedAt: null },
      select: {
        courseId: true,
        createdAt: true,
        releaseMode: true,
        startsAt: true,
        revokedAt: true,
      },
    }),
  ]);
  if (!cohort || accesses.length === 0) {
    return;
  }
  const availableCourseIds = accesses
    .filter(
      (access) =>
        resolveCohortCourseAccess({
          access,
          cohort,
          membership: { joinedAt: input.joinedAt, leftAt: null },
          now: input.now,
        }).available
    )
    .map(({ courseId }) => courseId);
  if (availableCourseIds.length === 0) {
    return;
  }
  const validUntil = new Date(input.now.getTime() + 30 * 24 * 60 * 60_000);
  await tx.accessGrantSource.createMany({
    data: availableCourseIds.map((courseId) => ({
      idempotencyKey: `cohort-exit:${input.membershipId}:${courseId}`,
      origin: AccessGrantOrigin.HISTORICAL,
      originRefId: input.membershipId,
      subjectMemberId: input.memberId,
      resourceType: AccessResourceType.COURSE,
      resourceId: courseId,
      validFrom: input.now,
      validUntil,
      createdByMemberId: input.actorId,
    })),
    skipDuplicates: true,
  });
};
export const removeGestaoCohortMembers = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = rosterInput
      .extend({ includePastReadOnly: z.boolean().default(false) })
      .parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize a tela e tente novamente."
      );
    }
    const operationKey = eventKey("members-removed", key);
    const removed = await database.$transaction(
      async (tx) => {
        const cohort = await requireCohort(tx, actor, value.cohortId);
        if (await eventExists(tx, operationKey)) {
          return 0;
        }
        const memberships = await tx.cohortMembership.findMany({
          where: {
            cohortId: cohort.id,
            memberId: { in: value.memberIds },
            status: CohortMemberStatus.ACTIVE,
            leftAt: null,
          },
          select: { id: true, memberId: true, joinedAt: true },
        });
        if (memberships.length !== new Set(value.memberIds).size) {
          throw new MutationFailure(
            "conflict",
            "A seleção mudou. Atualize a lista de alunos."
          );
        }
        const now = new Date();
        if (value.includePastReadOnly) {
          for (const membership of memberships) {
            await createReadOnlySources(tx, {
              cohortId: cohort.id,
              memberId: membership.memberId,
              membershipId: membership.id,
              joinedAt: membership.joinedAt,
              actorId: actor.userId,
              now,
            });
          }
        }
        const changed = await tx.cohortMembership.updateMany({
          where: {
            id: { in: memberships.map(({ id: membershipId }) => membershipId) },
            status: CohortMemberStatus.ACTIVE,
            leftAt: null,
          },
          data: {
            activeKey: null,
            status: CohortMemberStatus.REMOVED,
            leftAt: now,
            includePastReadOnly: value.includePastReadOnly,
            version: { increment: 1 },
          },
        });
        await recordEvent(
          tx,
          actor.userId,
          cohort.id,
          "members_removed",
          operationKey,
          {
            memberCount: changed.count,
            readOnlyDays: value.includePastReadOnly ? 30 : 0,
          }
        );
        return changed.count;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}/alunos`);
    revalidatePath("/gestao/alunos/turmas");
    revalidatePath("/aprender");
    return { ok: true, cohortId: value.cohortId, invitedCount: removed };
  } catch (error) {
    return errorResult(error);
  }
};

export const moveGestaoCohortMembers = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = rosterInput
      .extend({
        targetCohortId: id,
        includePastReadOnly: z.boolean().default(false),
      })
      .parse(input);
    if (value.cohortId === value.targetCohortId) {
      throw new MutationFailure(
        "validation",
        "Escolha outra turma como destino.",
        { targetCohortId: "O destino precisa ser diferente." }
      );
    }
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize a tela e tente novamente."
      );
    }
    const operationKey = eventKey("members-moved", key);
    await database.$transaction(
      async (tx) => {
        const source = await requireCohort(tx, actor, value.cohortId);
        const target = await requireCohort(tx, actor, value.targetCohortId);
        if (target.archivedAt) {
          throw new MutationFailure(
            "conflict",
            "A turma de destino está arquivada."
          );
        }
        if (await eventExists(tx, operationKey)) {
          return;
        }
        await activeMembers(tx, value.memberIds);
        const memberships = await tx.cohortMembership.findMany({
          where: {
            cohortId: source.id,
            memberId: { in: value.memberIds },
            status: CohortMemberStatus.ACTIVE,
            leftAt: null,
          },
          select: { id: true, memberId: true, joinedAt: true },
        });
        if (memberships.length !== new Set(value.memberIds).size) {
          throw new MutationFailure(
            "conflict",
            "A seleção mudou. Atualize a lista de alunos."
          );
        }
        const now = new Date();
        if (value.includePastReadOnly) {
          for (const membership of memberships) {
            await createReadOnlySources(tx, {
              cohortId: source.id,
              memberId: membership.memberId,
              membershipId: membership.id,
              joinedAt: membership.joinedAt,
              actorId: actor.userId,
              now,
            });
          }
        }
        await tx.cohortMembership.updateMany({
          where: {
            id: { in: memberships.map(({ id: membershipId }) => membershipId) },
            status: CohortMemberStatus.ACTIVE,
          },
          data: {
            activeKey: null,
            status: CohortMemberStatus.REMOVED,
            leftAt: now,
            includePastReadOnly: value.includePastReadOnly,
            version: { increment: 1 },
          },
        });
        for (const membership of memberships) {
          const targetKey = cohortMembershipActiveKey(
            target.id,
            membership.memberId
          );
          const existing = await tx.cohortMembership.findFirst({
            where: {
              cohortId: target.id,
              memberId: membership.memberId,
              status: CohortMemberStatus.ACTIVE,
              leftAt: null,
            },
            select: { id: true },
          });
          if (!existing) {
            await tx.cohortMembership.create({
              data: {
                cohortId: target.id,
                memberId: membership.memberId,
                status: CohortMemberStatus.ACTIVE,
                source: CohortMemberSource.MOVE,
                activeKey: targetKey,
                movedFromCohortId: source.id,
                createdByMemberId: actor.userId,
              },
            });
          }
        }
        await recordEvent(
          tx,
          actor.userId,
          source.id,
          "members_moved",
          operationKey,
          {
            targetCohortId: target.id,
            memberCount: memberships.length,
            readOnlyDays: value.includePastReadOnly ? 30 : 0,
          }
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}/alunos`);
    revalidatePath(`/gestao/alunos/turmas/${value.targetCohortId}/alunos`);
    revalidatePath("/aprender");
    return { ok: true, cohortId: value.targetCohortId };
  } catch (error) {
    return errorResult(error);
  }
};

export const archiveGestaoCohort = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = z
      .object({
        cohortId: id,
        expectedVersion: z.number().int().positive(),
        idempotencyKey: uuid,
      })
      .parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize a tela e tente novamente."
      );
    }
    const operationKey = eventKey("archived", key);
    await database.$transaction(
      async (tx) => {
        const cohort = await requireCohort(tx, actor, value.cohortId);
        if (await eventExists(tx, operationKey)) {
          return;
        }
        if (cohort.version !== value.expectedVersion) {
          throw new MutationFailure(
            "conflict",
            "A turma mudou em outra sessão. Atualize a tela."
          );
        }
        const now = new Date();
        const result = await tx.cohort.updateMany({
          where: { id: cohort.id, version: value.expectedVersion },
          data: {
            archivedAt: now,
            endsAt: cohort.endsAt && cohort.endsAt < now ? cohort.endsAt : now,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new MutationFailure(
            "conflict",
            "A turma mudou em outra sessão. Atualize a tela."
          );
        }
        await recordEvent(
          tx,
          actor.userId,
          cohort.id,
          "archived",
          operationKey,
          { readAfterEndDays: 90 }
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath("/gestao/alunos/turmas");
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}`);
    return { ok: true, cohortId: value.cohortId };
  } catch (error) {
    return errorResult(error);
  }
};

export const setGestaoCohortCourses = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = z
      .object({
        cohortId: id,
        expectedVersion: z.number().int().positive(),
        courseIds: z.array(id).max(100),
        releaseMode: z.nativeEnum(CohortReleaseMode),
        startsAt: dateText.optional().or(z.literal("")),
        idempotencyKey: uuid,
      })
      .parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize a tela e tente novamente."
      );
    }
    const startsAt = value.startsAt ? toDate(value.startsAt) : null;
    if (value.releaseMode === CohortReleaseMode.SCHEDULE && !startsAt) {
      throw new MutationFailure(
        "validation",
        "Informe quando o conteúdo será liberado.",
        { startsAt: "Escolha a data de liberação." }
      );
    }
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = eventKey("courses-set", key);
    await database.$transaction(
      async (tx) => {
        const cohort = await requireCohort(tx, actor, value.cohortId);
        if (cohort.archivedAt) {
          throw new MutationFailure("conflict", "Esta turma está arquivada.");
        }
        if (await eventExists(tx, operationKey)) {
          return;
        }
        if (cohort.version !== value.expectedVersion) {
          throw new MutationFailure(
            "conflict",
            "A turma mudou em outra sessão. Atualize a tela."
          );
        }
        const uniqueIds = [...new Set(value.courseIds)];
        const currentAccesses = await tx.cohortCourseAccess.findMany({
          where: { cohortId: cohort.id, revokedAt: null },
          select: { id: true, courseId: true },
        });
        const previousCourseIds = new Set(
          currentAccesses.map(({ courseId }) => courseId)
        );
        const courses = uniqueIds.length
          ? await tx.course.findMany({
              where: { id: { in: uniqueIds } },
              select: { id: true, status: true },
            })
          : [];
        const allowedIds = new Set(
          courses
            .filter(
              (course) =>
                course.status === ContentStatus.PUBLISHED ||
                previousCourseIds.has(course.id)
            )
            .map(({ id: courseId }) => courseId)
        );
        if (allowedIds.size !== uniqueIds.length) {
          throw new MutationFailure(
            "validation",
            "Selecione cursos publicados. Cursos já liberados permanecem vinculados até serem removidos.",
            { courseIds: "Há cursos inválidos ou em rascunho." }
          );
        }
        const changed = await tx.cohort.updateMany({
          where: { id: cohort.id, version: value.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (changed.count !== 1) {
          throw new MutationFailure(
            "conflict",
            "A turma mudou em outra sessão. Atualize a tela."
          );
        }
        for (const access of currentAccesses) {
          if (!uniqueIds.includes(access.courseId)) {
            await tx.cohortCourseAccess.updateMany({
              where: { id: access.id, revokedAt: null },
              data: { activeKey: null, revokedAt: new Date() },
            });
          }
        }
        for (const courseId of uniqueIds) {
          await tx.cohortCourseAccess.upsert({
            where: {
              activeKey: cohortMembershipActiveKey(cohort.id, courseId),
            },
            create: {
              activeKey: cohortMembershipActiveKey(cohort.id, courseId),
              cohortId: cohort.id,
              courseId,
              releaseMode: value.releaseMode,
              startsAt,
              createdByMemberId: actor.userId,
            },
            update: {
              releaseMode: value.releaseMode,
              startsAt,
              revokedAt: null,
            },
          });
        }
        await recordEvent(
          tx,
          actor.userId,
          cohort.id,
          "courses_set",
          operationKey,
          {
            courseIds: uniqueIds,
            releaseMode: value.releaseMode,
            startsAt: startsAt?.toISOString() ?? null,
            version: value.expectedVersion + 1,
          }
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}/conteudo`);
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}`);
    revalidatePath("/aprender");
    return { ok: true, cohortId: value.cohortId };
  } catch (error) {
    return errorResult(error);
  }
};
export const revokeGestaoCohortCourse = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = z
      .object({ cohortId: id, courseId: id, idempotencyKey: uuid })
      .parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize a tela e tente novamente."
      );
    }
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = eventKey("course-revoked", key);
    await database.$transaction(
      async (tx) => {
        const cohort = await requireCohort(tx, actor, value.cohortId);
        if (await eventExists(tx, operationKey)) {
          return;
        }
        await tx.cohortCourseAccess.updateMany({
          where: {
            cohortId: cohort.id,
            courseId: value.courseId,
            revokedAt: null,
          },
          data: { activeKey: null, revokedAt: new Date() },
        });
        await recordEvent(
          tx,
          actor.userId,
          cohort.id,
          "course_revoked",
          operationKey,
          { courseId: value.courseId }
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}/conteudo`);
    revalidatePath("/aprender");
    return { ok: true, cohortId: value.cohortId };
  } catch (error) {
    return errorResult(error);
  }
};

export const createGestaoCohortInvite = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = z
      .object({
        cohortId: id,
        email: z.string().trim().email().max(320).optional().or(z.literal("")),
        maxUses: z.number().int().min(1).max(500).default(1),
        expiresInDays: z.number().int().min(1).max(30).default(14),
        idempotencyKey: uuid,
      })
      .parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize a tela e tente novamente."
      );
    }
    const operationKey = eventKey("invite-created", key);
    const token = randomBytes(16).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date();
    const inviteId = await database.$transaction(
      async (tx) => {
        const cohort = await requireCohort(tx, actor, value.cohortId);
        if (cohort.archivedAt) {
          throw new MutationFailure("conflict", "Esta turma está arquivada.");
        }
        if (await eventExists(tx, operationKey)) {
          return null;
        }
        const invite = await tx.cohortInvite.create({
          data: {
            cohortId: cohort.id,
            tokenHash,
            email: value.email
              ? value.email.trim().toLocaleLowerCase("pt-BR")
              : null,
            maxUses: value.maxUses,
            expiresAt: new Date(
              now.getTime() + value.expiresInDays * 86_400_000
            ),
            createdByMemberId: actor.userId,
          },
          select: { id: true },
        });
        await recordEvent(
          tx,
          actor.userId,
          cohort.id,
          "invite_created",
          operationKey,
          {
            inviteId: invite.id,
            expiresInDays: value.expiresInDays,
            maxUses: value.maxUses,
            emailRestricted: Boolean(value.email),
          }
        );
        return invite.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    if (!inviteId) {
      return { ok: true, duplicate: true, cohortId: value.cohortId };
    }
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}/alunos`);
    return { ok: true, cohortId: value.cohortId, inviteToken: token };
  } catch (error) {
    return errorResult(error);
  }
};

export const importGestaoCohortMembers = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = z
      .object({
        cohortId: id,
        emails: z.array(z.string().trim().email().max(320)).min(1).max(500),
        idempotencyKey: uuid,
      })
      .parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize a tela e tente novamente."
      );
    }
    const normalized = [
      ...new Set(
        value.emails.map((email) => email.trim().toLocaleLowerCase("pt-BR"))
      ),
    ];
    const operationKey = eventKey("members-imported", key);
    const imported = await database.$transaction(
      async (tx) => {
        const cohort = await requireCohort(tx, actor, value.cohortId);
        if (cohort.archivedAt) {
          throw new MutationFailure("conflict", "Esta turma está arquivada.");
        }
        if (await eventExists(tx, operationKey)) {
          return { count: 0, skipped: [] as string[] };
        }
        const members = await tx.member.findMany({
          where: {
            email: { in: normalized, mode: "insensitive" },
            role: MemberRole.MEMBER,
            deactivatedAt: null,
          },
          select: { id: true, email: true },
        });
        const memberIds = members.map(({ id: memberId }) => memberId);
        const count = memberIds.length
          ? await tx.cohortMembership.createMany({
              data: memberIds.map((memberId) => ({
                cohortId: cohort.id,
                memberId,
                source: CohortMemberSource.CSV,
                status: CohortMemberStatus.ACTIVE,
                activeKey: cohortMembershipActiveKey(cohort.id, memberId),
                createdByMemberId: actor.userId,
              })),
              skipDuplicates: true,
            })
          : { count: 0 };
        const matched = new Set(
          members.map((member) => member.email?.toLocaleLowerCase("pt-BR"))
        );
        const skipped = normalized.filter((email) => !matched.has(email));
        await recordEvent(
          tx,
          actor.userId,
          cohort.id,
          "members_imported",
          operationKey,
          { matchedCount: count.count, unresolvedCount: skipped.length }
        );
        return { count: count.count, skipped };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}/alunos`);
    return {
      ok: true,
      cohortId: value.cohortId,
      invitedCount: imported.count,
      skippedEmails: imported.skipped,
    };
  } catch (error) {
    return errorResult(error);
  }
};

export const acceptGestaoCohortInvite = async (
  token: unknown
): Promise<CohortActionResult> => {
  try {
    const value = z.string().regex(inviteTokenPattern).parse(token);
    const memberId = await requireOnboardedMemberId();
    const member = await getMemberIdentitySnapshot(memberId);
    if (!member || member.deactivatedAt || member.role !== MemberRole.MEMBER) {
      throw new MutationFailure(
        "forbidden",
        "Entre na sua conta ativa para aceitar o convite."
      );
    }
    const tokenHash = createHash("sha256").update(value).digest("hex");
    const now = new Date();
    const cohortId = await database.$transaction(
      async (tx) => {
        const invite = await tx.cohortInvite.findFirst({
          where: {
            tokenHash,
            revokedAt: null,
            expiresAt: { gt: now },
            cohort: { archivedAt: null },
          },
          select: {
            id: true,
            cohortId: true,
            email: true,
            maxUses: true,
            usedCount: true,
          },
        });
        if (!invite) {
          throw new MutationFailure(
            "not-found",
            "Este convite expirou, foi cancelado ou atingiu o limite de usos."
          );
        }
        if (
          invite.email &&
          invite.email.toLocaleLowerCase("pt-BR") !==
            member.email?.toLocaleLowerCase("pt-BR")
        ) {
          throw new MutationFailure(
            "forbidden",
            "Este convite foi enviado para outro e-mail."
          );
        }
        const existing = await tx.cohortMembership.findFirst({
          where: {
            cohortId: invite.cohortId,
            memberId,
            status: CohortMemberStatus.ACTIVE,
            leftAt: null,
          },
          select: { id: true },
        });
        if (existing) {
          return invite.cohortId;
        }
        const used = await tx.cohortInvite.updateMany({
          where: {
            id: invite.id,
            revokedAt: null,
            expiresAt: { gt: now },
            usedCount: { lt: invite.maxUses },
          },
          data: { usedCount: { increment: 1 } },
        });
        if (used.count !== 1) {
          throw new MutationFailure(
            "conflict",
            "O convite acabou de atingir o limite de usos."
          );
        }
        await tx.cohortMembership.create({
          data: {
            cohortId: invite.cohortId,
            memberId,
            source: CohortMemberSource.INVITE,
            status: CohortMemberStatus.ACTIVE,
            activeKey: cohortMembershipActiveKey(invite.cohortId, memberId),
          },
        });
        const auditMemberKey = createHash("sha256")
          .update(memberId)
          .digest("hex")
          .slice(0, 16);
        const auditKey = `gestao:cohort:invite-accepted:${invite.id}:${auditMemberKey}`;
        await recordEvent(
          tx,
          memberId,
          invite.cohortId,
          "invite_accepted",
          auditKey,
          { inviteId: invite.id }
        );
        return invite.cohortId;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath("/aprender");
    revalidatePath("/gestao/alunos/turmas");
    return { ok: true, cohortId };
  } catch (error) {
    return errorResult(error);
  }
};

export const revokeGestaoCohortInvite = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = z
      .object({ cohortId: id, inviteId: id, idempotencyKey: uuid })
      .parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize a tela e tente novamente."
      );
    }
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = eventKey("invite-revoked", key);
    await database.$transaction(
      async (tx) => {
        const cohort = await requireCohort(tx, actor, value.cohortId);
        if (await eventExists(tx, operationKey)) {
          return;
        }
        const invite = await tx.cohortInvite.updateMany({
          where: { id: value.inviteId, cohortId: cohort.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (invite.count !== 1) {
          throw new MutationFailure(
            "conflict",
            "Este convite já foi cancelado ou expirou."
          );
        }
        await recordEvent(
          tx,
          actor.userId,
          cohort.id,
          "invite_revoked",
          operationKey,
          { inviteId: value.inviteId }
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}/alunos`);
    return { ok: true, cohortId: value.cohortId };
  } catch (error) {
    return errorResult(error);
  }
};

export const setGestaoCohortLessonRelease = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = z
      .object({
        cohortId: id,
        lessonId: id,
        expectedVersion: z.number().int().positive(),
        releaseAt: dateText.optional().or(z.literal("")),
        idempotencyKey: uuid,
      })
      .parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize a tela e tente novamente."
      );
    }
    const releaseAt = value.releaseAt ? toDate(value.releaseAt) : null;
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = eventKey("lesson-release-set", key);
    await database.$transaction(
      async (tx) => {
        const cohort = await requireCohort(tx, actor, value.cohortId);
        if (cohort.archivedAt) {
          throw new MutationFailure("conflict", "Esta turma está arquivada.");
        }
        if (await eventExists(tx, operationKey)) {
          return;
        }
        if (cohort.version !== value.expectedVersion) {
          throw new MutationFailure(
            "conflict",
            "A turma mudou em outra sessão. Atualize a tela."
          );
        }
        const lesson = await tx.lesson.findFirst({
          where: {
            id: value.lessonId,
            status: ContentStatus.PUBLISHED,
            module: {
              is: {
                status: ContentStatus.PUBLISHED,
                course: {
                  is: {
                    status: ContentStatus.PUBLISHED,
                    cohortCourseAccesses: {
                      some: { cohortId: cohort.id, revokedAt: null },
                    },
                  },
                },
              },
            },
          },
          select: { id: true },
        });
        if (!lesson) {
          throw new MutationFailure(
            "not-found",
            "Aula não encontrada entre os cursos liberados para esta turma."
          );
        }
        const changed = await tx.cohort.updateMany({
          where: { id: cohort.id, version: value.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (changed.count !== 1) {
          throw new MutationFailure(
            "conflict",
            "A turma mudou em outra sessão. Atualize a tela."
          );
        }
        if (releaseAt) {
          await tx.cohortLessonRelease.upsert({
            where: {
              cohortId_lessonId: { cohortId: cohort.id, lessonId: lesson.id },
            },
            create: {
              cohortId: cohort.id,
              lessonId: lesson.id,
              releaseAt,
              updatedByMemberId: actor.userId,
            },
            update: {
              releaseAt,
              updatedByMemberId: actor.userId,
              version: { increment: 1 },
            },
          });
        } else {
          await tx.cohortLessonRelease.deleteMany({
            where: { cohortId: cohort.id, lessonId: lesson.id },
          });
        }
        await recordEvent(
          tx,
          actor.userId,
          cohort.id,
          "lesson_release_set",
          operationKey,
          {
            lessonId: lesson.id,
            releaseAt: releaseAt?.toISOString() ?? null,
            version: value.expectedVersion + 1,
          }
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath(`/gestao/alunos/turmas/${value.cohortId}/conteudo`);
    revalidatePath("/aprender");
    return { ok: true, cohortId: value.cohortId };
  } catch (error) {
    return errorResult(error);
  }
};

export const duplicateGestaoCohort = async (
  input: unknown
): Promise<CohortActionResult> => {
  try {
    const value = z
      .object({
        cohortId: id,
        expectedVersion: z.number().int().positive(),
        name: z.string().trim().min(3).max(120),
        startsAt: dateText,
        endsAt: dateText.optional().or(z.literal("")),
        idempotencyKey: uuid,
      })
      .parse(input);
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: value.cohortId,
    });
    const key = readIdempotencyKey(value.idempotencyKey);
    if (!key) {
      throw new MutationFailure(
        "validation",
        "Atualize a tela e tente novamente."
      );
    }
    const { start, end } = checkDates(
      value.startsAt,
      value.endsAt || undefined
    );
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const operationKey = eventKey("duplicated", key);
    const cohortId = await database.$transaction(
      async (tx) => {
        const source = await tx.cohort.findFirst({
          where: {
            id: value.cohortId,
            ...(actor.role === "ADMIN"
              ? {}
              : { teachers: { some: { memberId: actor.userId } } }),
          },
          select: {
            id: true,
            version: true,
            lateJoinPolicy: true,
            notifyOnNews: true,
            readAfterEndDays: true,
            teachers: { select: { memberId: true } },
            courseAccesses: {
              where: { revokedAt: null },
              select: {
                courseId: true,
                releaseMode: true,
                startsAt: true,
              },
            },
            lessonReleases: {
              select: { lessonId: true, releaseAt: true },
            },
          },
        });
        if (!source) {
          throw new MutationFailure(
            "not-found",
            "Turma não encontrada ou sem acesso."
          );
        }
        if (await eventExists(tx, operationKey)) {
          const previous = await tx.cohort.findUnique({
            where: {
              createdByMemberId_idempotencyKey: {
                createdByMemberId: actor.userId,
                idempotencyKey: key,
              },
            },
            select: { id: true },
          });
          if (previous) {
            return previous.id;
          }
          throw new MutationFailure(
            "conflict",
            "Não foi possível recuperar a cópia criada. Atualize a tela."
          );
        }
        if (source.version !== value.expectedVersion) {
          throw new MutationFailure(
            "conflict",
            "A turma mudou em outra sessão. Atualize a tela."
          );
        }
        const responsibleIds = await teacherIdsFor(
          tx,
          actor,
          source.teachers.map(({ memberId }) => memberId)
        );
        const copy = await tx.cohort.create({
          data: {
            name: value.name.trim(),
            normalizedName: normalizeCohortName(value.name),
            slug: slugFor(value.name, key),
            startsAt: start,
            endsAt: end,
            lateJoinPolicy: source.lateJoinPolicy,
            readAfterEndDays: source.readAfterEndDays,
            notifyOnNews: source.notifyOnNews,
            createdByMemberId: actor.userId,
            idempotencyKey: key,
            teachers: {
              createMany: {
                data: responsibleIds.map((memberId) => ({
                  memberId,
                  assignedByMemberId: actor.userId,
                })),
              },
            },
          },
          select: { id: true },
        });
        if (source.courseAccesses.length) {
          await tx.cohortCourseAccess.createMany({
            data: source.courseAccesses.map((access) => ({
              activeKey: cohortMembershipActiveKey(copy.id, access.courseId),
              cohortId: copy.id,
              courseId: access.courseId,
              releaseMode: access.releaseMode,
              startsAt: access.startsAt,
              createdByMemberId: actor.userId,
            })),
          });
        }
        if (source.lessonReleases.length) {
          await tx.cohortLessonRelease.createMany({
            data: source.lessonReleases.map((release) => ({
              cohortId: copy.id,
              lessonId: release.lessonId,
              releaseAt: release.releaseAt,
              updatedByMemberId: actor.userId,
            })),
          });
        }
        await recordEvent(
          tx,
          actor.userId,
          copy.id,
          "duplicated",
          operationKey,
          {
            sourceCohortId: source.id,
            copiedCourseCount: source.courseAccesses.length,
            copiedLessonReleaseCount: source.lessonReleases.length,
            copiedStudents: false,
            copiedInvites: false,
          }
        );
        return copy.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidatePath("/gestao/alunos/turmas");
    revalidatePath(`/gestao/alunos/turmas/${cohortId}`);
    return { ok: true, cohortId };
  } catch (error) {
    return errorResult(error);
  }
};
