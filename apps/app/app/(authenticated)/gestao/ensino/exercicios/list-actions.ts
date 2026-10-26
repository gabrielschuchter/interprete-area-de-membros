"use server";

import { ContentStatus, database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

export type ExerciseListResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const idsOf = (value: FormDataEntryValue | null) =>
  text(value)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

const authorize = async () => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  return actor;
};

const refresh = (listId: string) => {
  revalidatePath("/gestao/ensino/exercicios");
  revalidatePath(`/gestao/ensino/exercicios/${listId}`);
  revalidatePath("/exercicios");
};

const editableList = (listId: string) =>
  database.exerciseList.findUnique({
    where: { id: listId },
    select: { id: true, status: true, bank: { select: { status: true } } },
  });

export const reorderExerciseListItems = async (
  formData: FormData
): Promise<ExerciseListResult> => {
  const listId = text(formData.get("listId"));
  const ids = idsOf(formData.get("ids"));
  if (!listId || ids.length < 2 || new Set(ids).size !== ids.length) {
    return { ok: false, message: "Ordem inválida." };
  }
  const actor = await authorize();
  const list = await editableList(listId);
  if (!list || list.bank.status === ContentStatus.ARCHIVED) {
    return { ok: false, message: "Lista indisponível para edição." };
  }
  const reordered = await database.$transaction(async (transaction) => {
    const current = await transaction.exerciseListItem.findMany({
      where: { id: { in: ids }, listId },
      orderBy: { position: "asc" },
      select: { id: true, position: true },
    });
    if (current.length !== ids.length) {
      return false;
    }
    const slots = current.map((item) => item.position);
    // A restrição única (lista, posição) exige duas fases: temporárias negativas e depois as finais.
    for (const [index, id] of ids.entries()) {
      await transaction.exerciseListItem.update({
        where: { id },
        data: { position: -(index + 1) },
      });
    }
    for (const [index, id] of ids.entries()) {
      await transaction.exerciseListItem.update({
        where: { id },
        data: { position: slots[index] },
      });
    }
    return true;
  });
  if (!reordered) {
    return { ok: false, message: "A lista mudou. Recarregue a página." };
  }
  await recordAuditEvent({
    eventType: "gestao.exercise-list.reordered",
    actorId: actor.userId,
    aggregateType: "ExerciseList",
    aggregateId: listId,
    payload: { ids, listId },
  });
  refresh(listId);
  return { ok: true };
};

export const removeExerciseListItems = async (
  formData: FormData
): Promise<ExerciseListResult> => {
  const listId = text(formData.get("listId"));
  const ids = idsOf(formData.get("ids"));
  if (!listId || ids.length === 0) {
    return { ok: false, message: "Selecione ao menos uma questão." };
  }
  const actor = await authorize();
  const list = await editableList(listId);
  if (!list || list.bank.status === ContentStatus.ARCHIVED) {
    return { ok: false, message: "Lista indisponível para edição." };
  }
  const outcome = await database.$transaction(async (transaction) => {
    const all = await transaction.exerciseListItem.findMany({
      where: { listId },
      orderBy: { position: "asc" },
      select: { id: true, questionId: true },
    });
    const removing = all.filter((item) => ids.includes(item.id));
    if (removing.length !== ids.length) {
      return "stale" as const;
    }
    const remaining = all.filter((item) => !ids.includes(item.id));
    if (list.status === ContentStatus.PUBLISHED && remaining.length === 0) {
      return "empty" as const;
    }
    await transaction.exerciseListItem.deleteMany({
      where: { id: { in: ids }, listId },
    });
    for (const [index, item] of remaining.entries()) {
      await transaction.exerciseListItem.update({
        where: { id: item.id },
        data: { position: -(index + 1) },
      });
    }
    for (const [index, item] of remaining.entries()) {
      await transaction.exerciseListItem.update({
        where: { id: item.id },
        data: { position: index },
      });
    }
    return "ok" as const;
  });
  if (outcome === "stale") {
    return { ok: false, message: "A lista mudou. Recarregue a página." };
  }
  if (outcome === "empty") {
    return {
      ok: false,
      message:
        "Uma lista publicada precisa de ao menos uma questão. Volte a lista para rascunho antes de remover tudo.",
    };
  }
  await recordAuditEvent({
    eventType: "gestao.exercise-list.questions-removed",
    actorId: actor.userId,
    aggregateType: "ExerciseList",
    aggregateId: listId,
    payload: { ids, listId },
  });
  refresh(listId);
  return { ok: true };
};

export const updateGestaoExerciseList = async (
  formData: FormData
): Promise<ExerciseListResult> => {
  const listId = text(formData.get("listId"));
  const title = text(formData.get("title")).slice(0, 160);
  const description = text(formData.get("description")).slice(0, 2000);
  if (!(listId && title)) {
    return { ok: false, message: "Informe o título da lista." };
  }
  const actor = await authorize();
  const list = await editableList(listId);
  if (!list) {
    return { ok: false, message: "Lista não encontrada." };
  }
  await database.exerciseList.update({
    where: { id: listId },
    data: { title, description: description || null },
  });
  await recordAuditEvent({
    eventType: "gestao.exercise-list.updated",
    actorId: actor.userId,
    aggregateType: "ExerciseList",
    aggregateId: listId,
    payload: { listId, title },
  });
  refresh(listId);
  return { ok: true };
};

const questionStates = [
  ContentStatus.DRAFT,
  ContentStatus.PUBLISHED,
  ContentStatus.ARCHIVED,
] as const;

export const setExerciseQuestionState = async (
  formData: FormData
): Promise<ExerciseListResult> => {
  const listId = text(formData.get("listId"));
  const questionId = text(formData.get("questionId"));
  const status = text(formData.get("status")) as ContentStatus;
  if (!(listId && questionId && questionStates.includes(status))) {
    return { ok: false, message: "Estado inválido." };
  }
  const actor = await authorize();
  const item = await database.exerciseListItem.findFirst({
    where: { listId, questionId },
    select: { id: true },
  });
  if (!item) {
    return { ok: false, message: "Questão não pertence à lista." };
  }
  await database.exerciseQuestion.update({
    where: { id: questionId },
    data: { status },
  });
  await recordAuditEvent({
    eventType: "gestao.exercise-question.state-changed",
    actorId: actor.userId,
    aggregateType: "ExerciseQuestion",
    aggregateId: questionId,
    payload: { listId, questionId, status },
  });
  refresh(listId);
  revalidatePath(`/gestao/ensino/exercicios/${listId}/questoes/${questionId}`);
  return { ok: true };
};
