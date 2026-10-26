"use server";

import {
  database,
  LearningAssignmentAudienceType,
  LearningAssignmentTargetType,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveCohortStudents } from "@/lib/gestao-assignments";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { createLearningAssignmentBatch } from "@/lib/learning-assignments";
import { readIdempotencyKeyFromForm } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

const listPath = "/gestao/alunos/atribuicoes";
const maxRecipients = 200;

export interface GestaoAssignmentFormState {
  readonly error: string | null;
}

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

const dateAtSaoPaulo = (value: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseTarget = (value: string) => {
  const [type, ...parts] = value.split(":");
  const id = parts.join(":");
  const known = Object.values(LearningAssignmentTargetType).find(
    (candidate) => candidate === type
  );
  return known && id ? { id, type: known } : null;
};

const datesAreCoherent = (
  availableAt: Date | null,
  dueAt: Date | null,
  expiresAt: Date | null
) =>
  !(
    (availableAt && expiresAt && expiresAt <= availableAt) ||
    (availableAt && dueAt && dueAt < availableAt) ||
    (dueAt && expiresAt && dueAt > expiresAt)
  );

const fail = (error: string): GestaoAssignmentFormState => ({ error });

export const createGestaoAssignment = async (
  _previous: GestaoAssignmentFormState,
  formData: FormData
): Promise<GestaoAssignmentFormState> => {
  const { actor } = await requireGestaoAction("assignments.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const target = parseTarget(text(formData, "target"));
  const idempotencyKey = readIdempotencyKeyFromForm(formData);
  const message = text(formData, "message");
  const availableAt = dateAtSaoPaulo(text(formData, "availableAt"));
  const dueAt = dateAtSaoPaulo(text(formData, "dueAt"));
  const expiresAt = dateAtSaoPaulo(text(formData, "expiresAt"));
  if (!(target && idempotencyKey)) {
    return fail("Escolha o conteúdo que será atribuído.");
  }
  if (
    availableAt === undefined ||
    dueAt === undefined ||
    expiresAt === undefined ||
    !datesAreCoherent(availableAt, dueAt, expiresAt)
  ) {
    return fail(
      "Confira as datas: o prazo não pode vir antes da liberação nem depois do fim do acesso."
    );
  }
  if (message.length > 1000) {
    return fail("A orientação aceita até 1.000 caracteres.");
  }
  const cohortIds = strings(formData, "cohortIds");
  const individuals = strings(formData, "memberIds");
  const fromCohorts = await resolveCohortStudents(actor, cohortIds);
  if (fromCohorts.cohorts.length !== cohortIds.length) {
    return fail("Uma das turmas escolhidas não está sob sua responsabilidade.");
  }
  const memberIds = [...new Set([...fromCohorts.memberIds, ...individuals])];
  if (memberIds.length === 0) {
    return fail("Escolha ao menos uma turma ou um aluno.");
  }
  if (memberIds.length > maxRecipients) {
    return fail(
      `Uma atribuição aceita até ${maxRecipients} alunos. Divida o envio por turma.`
    );
  }

  let outcome: "created" | "replayed" | "invalid" = "invalid";
  try {
    outcome = await database.$transaction(async (transaction) => {
      const result = await createLearningAssignmentBatch(transaction, {
        assignedByMemberId: actor.userId,
        audienceSpaceId: null,
        audienceType:
          memberIds.length === 1
            ? LearningAssignmentAudienceType.INDIVIDUAL
            : LearningAssignmentAudienceType.SELECTED_MEMBERS,
        availableAt,
        createdAt: new Date(),
        dueAt,
        expiresAt,
        idempotencyKey,
        memberIds,
        message: message || null,
        targetId: target.id,
        targetType: target.type,
      });
      if (!result) {
        return "invalid" as const;
      }
      if (result.created) {
        await recordAuditEvent(
          {
            actorId: actor.userId,
            aggregateId: result.batchId,
            aggregateType: "LearningAssignmentBatch",
            eventType: "gestao.assignment.created",
            payload: {
              cohortIds: fromCohorts.cohorts.map((cohort) => cohort.id),
              cohortNames: fromCohorts.cohorts.map((cohort) => cohort.name),
              recipientCount: result.recipientCount,
              targetId: target.id,
              targetType: target.type,
            },
          },
          transaction
        );
      }
      return result.created ? ("created" as const) : ("replayed" as const);
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    outcome = "replayed";
  }
  if (outcome === "invalid") {
    return fail(
      "Não foi possível atribuir. O conteúdo precisa estar publicado e os alunos dentro do seu escopo."
    );
  }
  if (outcome === "created") {
    await dispatchPendingNotifications();
  }
  revalidatePath(listPath);
  revalidatePath("/cursos");
  redirect(`${listPath}?resultado=${outcome}`);
};

export const revokeGestaoAssignment = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("assignments.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const batchId = text(formData, "batchId");
  const batch = batchId
    ? await database.learningAssignmentBatch.findFirst({
        where: {
          id: batchId,
          ...(actor.role === "ADMIN"
            ? {}
            : { createdByMemberId: actor.userId }),
        },
        select: { id: true },
      })
    : null;
  if (!batch) {
    redirect(`${listPath}?resultado=invalida`);
  }
  const revokedAt = new Date();
  await database.$transaction(async (transaction) => {
    const { count } = await transaction.activityAssignment.updateMany({
      where: { batchId: batch.id, revokedAt: null, status: { not: "REVOKED" } },
      data: { status: "REVOKED", revokedAt },
    });
    await recordAuditEvent(
      {
        actorId: actor.userId,
        aggregateId: batch.id,
        aggregateType: "LearningAssignmentBatch",
        eventType: "gestao.assignment.revoked",
        payload: { revokedRecipients: count },
      },
      transaction
    );
  });
  revalidatePath(listPath);
  revalidatePath("/cursos");
  redirect(`${listPath}?resultado=revogada`);
};
