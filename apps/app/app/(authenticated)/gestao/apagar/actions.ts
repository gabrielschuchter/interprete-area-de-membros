"use server";

import { database, Prisma } from "@repo/database";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/gestao-audit";
import {
  requireGestaoAction,
  requireGestaoCohortActor,
} from "@/lib/gestao-authorization";
import {
  eraseGestaoContent,
  type GestaoErasableKind,
  GestaoErasureBlockedError,
} from "@/lib/gestao-content-erasure";
import { deleteGestaoVideoStorageObject } from "@/lib/gestao-lesson-video-upload";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

export type GestaoEraseResult =
  | { readonly ok: true }
  | { readonly message: string; readonly ok: false };

const kinds = new Set<GestaoErasableKind>([
  "activity",
  "assignment",
  "badge",
  "bank",
  "cohort",
  "collection",
  "course",
  "exercise-list",
  "goal",
  "group",
  "learning-path",
  "lesson",
  "library-item",
  "meeting",
  "module",
  "post",
  "task",
]);

const aggregateTypes: Record<GestaoErasableKind, string> = {
  activity: "Activity",
  assignment: "LearningAssignmentBatch",
  badge: "BadgeDefinition",
  bank: "ExerciseBank",
  cohort: "Cohort",
  collection: "ContentCollection",
  course: "Course",
  "exercise-list": "ExerciseList",
  goal: "StudyCampaign",
  group: "CommunitySpace",
  "learning-path": "LearningPath",
  lesson: "Lesson",
  "library-item": "LibraryItem",
  meeting: "Meeting",
  module: "Module",
  post: "CommunityPost",
  task: "LearningTask",
};

const isKind = (value: unknown): value is GestaoErasableKind =>
  typeof value === "string" && kinds.has(value as GestaoErasableKind);

const authorize = async (kind: GestaoErasableKind, id: string) => {
  switch (kind) {
    case "cohort":
      return (await requireGestaoCohortActor(id)).actor;
    case "assignment":
    case "task":
      return (await requireGestaoAction("assignments.manage")).actor;
    case "goal":
      return (await requireGestaoAction("members.manage")).actor;
    case "post":
    case "meeting":
      return (await requireGestaoAction("community.moderate")).actor;
    case "badge":
      return (await requireGestaoAction("badges.manage")).actor;
    default:
      return (await requireGestaoAction("content.manage")).actor;
  }
};

/**
 * Apaga de verdade um registro da Gestão. A confirmação digitada ("APAGAR")
 * é conferida também no servidor.
 */
export const eraseGestaoRecord = async (input: {
  readonly confirmation: string;
  readonly id: string;
  readonly kind: string;
  readonly title?: string;
}): Promise<GestaoEraseResult> => {
  const { confirmation, id, kind } = input;
  if (!(isKind(kind) && typeof id === "string" && id && id.length <= 128)) {
    return { ok: false, message: "Pedido inválido. Atualize a página." };
  }
  if (confirmation?.trim().toUpperCase() !== "APAGAR") {
    return { ok: false, message: "Digite APAGAR para confirmar." };
  }
  const actor = await authorize(kind, id);
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  if (kind === "assignment" && actor.role !== "ADMIN") {
    const own = await database.learningAssignmentBatch.findFirst({
      where: { id, createdByMemberId: actor.userId },
      select: { id: true },
    });
    if (!own) {
      return {
        ok: false,
        message: "Só quem criou a atribuição pode apagá-la.",
      };
    }
  }
  let storagePath: string | null = null;
  try {
    storagePath = await database.$transaction(
      (transaction) => eraseGestaoContent(transaction, kind, id),
      { maxWait: 10_000, timeout: 30_000 }
    );
  } catch (error) {
    if (error instanceof GestaoErasureBlockedError) {
      return { ok: false, message: error.message };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { ok: false, message: "Este item já foi apagado." };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        ok: false,
        message:
          "Ainda há registros presos a este item. Nada foi apagado; avise a equipe técnica.",
      };
    }
    throw error;
  }
  if (storagePath) {
    await deleteGestaoVideoStorageObject(storagePath).catch(() => false);
  }
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: id,
    aggregateType: aggregateTypes[kind],
    eventType: "gestao.content.erased",
    payload: { kind, title: (input.title ?? "").slice(0, 200) },
  });
  revalidatePath("/", "layout");
  return { ok: true };
};
