"use server";

import { createHash } from "node:crypto";
import {
  CollectionItemType,
  ContentStatus,
  CourseExperience,
  database,
  Prisma,
} from "@repo/database";
import { enqueueDomainEvent } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { getGestaoCollectionResourceSearch } from "@/lib/gestao-collections";
import {
  type GestaoCollectionFormState,
  parseGestaoCollectionWriteInput,
} from "@/lib/gestao-collections-domain";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const validVersion = (input: string) => {
  if (!input || input.length > 64) {
    return null;
  }
  const date = new Date(input);
  return Number.isFinite(date.getTime()) ? date : null;
};

const requestHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const actorScopedEventKey = (actorId: string, key: string) =>
  `gestao-collection:${createHash("sha256").update(actorId).digest("hex").slice(0, 16)}:${key}`;

const isMatchingReplay = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly eventKey: string;
    readonly eventType: string;
    readonly requestHash: string;
    readonly aggregateId?: string;
  }
) => {
  const event = await transaction.domainEvent.findUnique({
    where: { idempotencyKey: input.eventKey },
    select: {
      actorId: true,
      aggregateId: true,
      eventType: true,
      payload: true,
    },
  });
  if (!event) {
    return null;
  }
  const payload =
    typeof event.payload === "object" &&
    event.payload !== null &&
    !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : {};
  if (
    event.actorId !== input.actorId ||
    event.eventType !== input.eventType ||
    (event.aggregateId !== input.aggregateId &&
      input.aggregateId !== undefined) ||
    payload.requestHash !== input.requestHash
  ) {
    throw new Error("GESTAO_COLLECTION_IDEMPOTENCY_CONFLICT");
  }
  return event.aggregateId;
};

const recordCollectionEvent = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly aggregateId: string;
    readonly eventKey: string;
    readonly eventType: string;
    readonly requestHash: string;
    readonly details?: Prisma.InputJsonObject;
  }
) =>
  enqueueDomainEvent(transaction, {
    eventType: input.eventType,
    actorId: input.actorId,
    aggregateType: "content.collection",
    aggregateId: input.aggregateId,
    idempotencyKey: input.eventKey,
    payload: {
      requestHash: input.requestHash,
      ...(input.details ?? {}),
    },
    occurredAt: new Date(),
    consumers: [],
  });

const revalidateCollections = () => {
  revalidatePath("/gestao/ensino/colecoes");
  revalidatePath("/admin/colecoes");
  revalidatePath("/gestao");
  revalidatePath("/cursos");
  revalidatePath("/");
};

const failedState = (message: string): GestaoCollectionFormState => ({
  message,
  status: "error",
});

const statusResultPath = (result: string) =>
  `/gestao/ensino/colecoes?${new URLSearchParams({ resultado: result }).toString()}`;

const collectionSaveMessage = (
  intent: "draft" | "publish",
  id: string | null | undefined,
  availableAt: Date | null
) => {
  if (intent === "publish") {
    if (availableAt && availableAt > new Date()) {
      return "Coleção publicada e programada para ficar visível na data escolhida.";
    }
    return "Coleção publicada.";
  }
  return id ? "Rascunho salvo." : "Coleção criada como rascunho.";
};

const collectionDeleteResult = (error: unknown) => {
  if (
    error instanceof Error &&
    error.message === "GESTAO_COLLECTION_NOT_EMPTY_DRAFT"
  ) {
    return "nao-excluida";
  }
  if (
    error instanceof Error &&
    error.message === "GESTAO_COLLECTION_CONFLICT"
  ) {
    return "conflito";
  }
  return "erro";
};

const slugFrom = (title: string, idempotencyKey: string) => {
  const safeTitle = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return `${safeTitle || "colecao"}-${idempotencyKey.slice(0, 8)}`;
};

const mutationConflictMessage = (error: unknown) => {
  if (error instanceof Error) {
    if (error.message === "GESTAO_COLLECTION_CONFLICT") {
      return "Outra edição foi salva primeiro. Atualize a tela e confira a versão atual antes de tentar novamente.";
    }
    if (error.message === "GESTAO_COLLECTION_NOT_FOUND") {
      return "Esta coleção não existe mais. Volte ao catálogo e escolha outra.";
    }
    if (error.message === "GESTAO_COLLECTION_AUDIENCE_INVALID") {
      return "O grupo escolhido não está mais disponível.";
    }
    if (error.message === "GESTAO_COLLECTION_ARCHIVED") {
      return "Reative a coleção antes de editar seus itens.";
    }
    if (error.message === "GESTAO_COLLECTION_IDEMPOTENCY_CONFLICT") {
      return "Esta solicitação já foi usada com outros dados. Atualize a tela e tente novamente.";
    }
  }
  if (isUniqueConstraintError(error)) {
    return "Esta alteração já foi aplicada ou entrou em conflito com outra edição.";
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return "Outra edição aconteceu ao mesmo tempo. Atualize a tela e tente novamente.";
  }
  return "Não foi possível salvar agora. Tente novamente.";
};

export const saveGestaoCollection = async (
  _previousState: GestaoCollectionFormState,
  formData: FormData
): Promise<GestaoCollectionFormState> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "collection.mutation",
    memberId: actor.userId,
  });

  const id = text(formData, "id") || null;
  if (id && id.length > 128) {
    return failedState("O identificador desta coleção está inválido.");
  }
  const parsed = parseGestaoCollectionWriteInput(formData, {
    creating: id === null,
  });
  if (!parsed.ok) {
    return parsed.state;
  }
  const input = parsed.input;
  const intent = text(formData, "intent") === "publish" ? "publish" : "draft";
  const status =
    intent === "publish" ? ContentStatus.PUBLISHED : ContentStatus.DRAFT;
  const key = input.idempotencyKey;
  if (!key) {
    return failedState("Atualize a tela para criar uma chave de salvamento.");
  }
  const eventKey = actorScopedEventKey(actor.userId, key);
  const expectedVersion = id ? validVersion(text(formData, "version")) : null;
  if (id && !expectedVersion) {
    return failedState(
      "A versão desta coleção está inválida. Atualize a tela."
    );
  }
  if (
    input.audienceSpaceId &&
    !(await database.communitySpace.findFirst({
      where: {
        id: input.audienceSpaceId,
        status: ContentStatus.PUBLISHED,
      },
      select: { id: true },
    }))
  ) {
    return {
      fieldErrors: {
        audienceSpaceId: "Escolha um grupo publicado.",
      },
      message: "Revise os campos destacados.",
      status: "error",
    };
  }

  const hash = requestHash({
    audienceSpaceId: input.audienceSpaceId,
    availableAt: input.availableAt?.toISOString() ?? null,
    coverUrl: input.coverUrl,
    description: input.description,
    expiresAt: input.expiresAt?.toISOString() ?? null,
    intent,
    publishMode: input.publishMode,
    title: input.title,
  });
  const eventType = id
    ? "gestao.collection.saved"
    : "gestao.collection.created";

  try {
    const savedId = await database.$transaction(
      async (transaction) => {
        const replayId = await isMatchingReplay(transaction, {
          actorId: actor.userId,
          eventKey,
          eventType,
          requestHash: hash,
          ...(id ? { aggregateId: id } : {}),
        });
        if (replayId) {
          return replayId;
        }

        const data = {
          audienceSpaceId: input.audienceSpaceId,
          availableAt: input.availableAt,
          coverUrl: input.coverUrl,
          description: input.description,
          expiresAt: input.expiresAt,
          status,
          title: input.title,
          updatedByMemberId: actor.userId,
        };
        let collectionId = id;
        if (id && expectedVersion) {
          const current = await transaction.contentCollection.findUnique({
            where: { id },
            select: { id: true, updatedAt: true },
          });
          if (!current) {
            throw new Error("GESTAO_COLLECTION_NOT_FOUND");
          }
          if (current.updatedAt.getTime() !== expectedVersion.getTime()) {
            throw new Error("GESTAO_COLLECTION_CONFLICT");
          }
          const updated = await transaction.contentCollection.updateMany({
            where: { id, updatedAt: expectedVersion },
            data: { ...data, updatedAt: new Date() },
          });
          if (updated.count !== 1) {
            throw new Error("GESTAO_COLLECTION_CONFLICT");
          }
        } else {
          const created = await transaction.contentCollection.create({
            data: {
              ...data,
              slug: slugFrom(input.title, key),
              createdByMemberId: actor.userId,
            },
            select: { id: true },
          });
          collectionId = created.id;
        }
        if (!collectionId) {
          throw new Error("GESTAO_COLLECTION_NOT_FOUND");
        }
        await recordCollectionEvent(transaction, {
          actorId: actor.userId,
          aggregateId: collectionId,
          eventKey,
          eventType,
          requestHash: hash,
          details: {
            changedFields: [
              "title",
              "description",
              "cover",
              "audience",
              "period",
              "status",
            ],
          },
        });
        return collectionId;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidateCollections();
    return {
      id: savedId,
      message: collectionSaveMessage(intent, id, input.availableAt),
      status: "success",
    };
  } catch (error) {
    return failedState(mutationConflictMessage(error));
  }
};

export interface GestaoCollectionSearchState {
  readonly message?: string;
  readonly options: readonly {
    readonly id: string;
    readonly label: string;
    readonly origin: string;
  }[];
  readonly status: "idle" | "error" | "success";
  readonly type?: CollectionItemType;
}

export const searchGestaoCollectionResources = async (
  _previousState: GestaoCollectionSearchState,
  formData: FormData
): Promise<GestaoCollectionSearchState> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "collection.search",
    memberId: actor.userId,
  });
  const type = text(formData, "itemType");
  const query = text(formData, "query");
  if (!Object.values(CollectionItemType).includes(type as CollectionItemType)) {
    return {
      options: [],
      message: "Escolha um tipo de recurso.",
      status: "error",
    };
  }
  if (query.length < 2) {
    return {
      options: [],
      message: "Digite ao menos duas letras para buscar.",
      status: "error",
      type: type as CollectionItemType,
    };
  }
  const options = await getGestaoCollectionResourceSearch({
    query,
    type: type as CollectionItemType,
  });
  return {
    options,
    message:
      options.length > 0
        ? `${options.length} recurso(s) encontrado(s).`
        : "Nenhum recurso encontrado para esta busca.",
    status: "success",
    type: type as CollectionItemType,
  };
};

const resourceForeignKey = async (
  transaction: Prisma.TransactionClient,
  type: CollectionItemType,
  resourceId: string
) => {
  if (type === CollectionItemType.LESSON) {
    const lesson = await transaction.lesson.findFirst({
      where: {
        id: resourceId,
        module: { course: { experience: CourseExperience.ASYNC } },
      },
      select: { id: true },
    });
    return lesson ? { lessonId: lesson.id } : null;
  }
  if (type === CollectionItemType.COURSE) {
    const course = await transaction.course.findFirst({
      where: {
        id: resourceId,
        experience: CourseExperience.ASYNC,
        status: { not: ContentStatus.ARCHIVED },
      },
      select: { id: true },
    });
    return course ? { courseId: course.id } : null;
  }
  if (type === CollectionItemType.EXERCISE_LIST) {
    const exerciseList = await transaction.exerciseList.findFirst({
      where: {
        id: resourceId,
        status: { not: ContentStatus.ARCHIVED },
        bank: { is: { status: ContentStatus.PUBLISHED } },
      },
      select: { id: true },
    });
    return exerciseList ? { exerciseListId: exerciseList.id } : null;
  }
  if (type === CollectionItemType.RECORDING) {
    const recording = await transaction.importedRecording.findUnique({
      where: { id: resourceId },
      select: { id: true },
    });
    return recording ? { recordingId: recording.id } : null;
  }
  const libraryItem = await transaction.libraryItem.findFirst({
    where: { id: resourceId, status: { not: ContentStatus.ARCHIVED } },
    select: { id: true },
  });
  return libraryItem ? { libraryItemId: libraryItem.id } : null;
};

export interface GestaoCollectionMutationState {
  readonly message?: string;
  readonly status: "idle" | "error" | "success";
}

const collectionMutationState = (
  status: GestaoCollectionMutationState["status"],
  message: string
): GestaoCollectionMutationState => ({ status, message });

interface CollectionReorderInput {
  readonly actorId: string;
  readonly before: boolean;
  readonly collectionId: string;
  readonly eventKey: string;
  readonly expectedVersion: Date;
  readonly itemId: string;
  readonly requestHash: string;
  readonly targetItemId: string;
}

const planCollectionReorder = async (
  transaction: Prisma.TransactionClient,
  input: CollectionReorderInput
) => {
  const [source, target] = await Promise.all([
    transaction.contentCollectionItem.findFirst({
      where: { id: input.itemId, collectionId: input.collectionId },
      select: { id: true, position: true },
    }),
    transaction.contentCollectionItem.findFirst({
      where: { id: input.targetItemId, collectionId: input.collectionId },
      select: { id: true, position: true },
    }),
  ]);
  if (!(source && target)) {
    throw new Error("GESTAO_COLLECTION_CONFLICT");
  }
  if (source.id === target.id) {
    return null;
  }
  const lower = Math.min(source.position, target.position);
  const upper = Math.max(source.position, target.position);
  const rows = await transaction.contentCollectionItem.findMany({
    where: {
      collectionId: input.collectionId,
      position: { gte: lower, lte: upper },
    },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: { id: true, position: true },
  });
  const orderedIds = rows.map(({ id }) => id);
  const sourceIndex = orderedIds.indexOf(source.id);
  orderedIds.splice(sourceIndex, 1);
  const targetIndex = orderedIds.indexOf(target.id);
  orderedIds.splice(targetIndex + (input.before ? 0 : 1), 0, source.id);
  if (orderedIds.every((id, index) => id === rows[index]?.id)) {
    return null;
  }
  const maxPosition = await transaction.contentCollectionItem.aggregate({
    where: { collectionId: input.collectionId },
    _max: { position: true },
  });
  return {
    orderedIds,
    rows,
    temporaryStart: (maxPosition._max.position ?? upper) + rows.length + 2,
  };
};

const persistCollectionReorder = async (
  transaction: Prisma.TransactionClient,
  input: CollectionReorderInput,
  plan: NonNullable<Awaited<ReturnType<typeof planCollectionReorder>>>
) => {
  for (const [index, itemId] of plan.orderedIds.entries()) {
    await transaction.contentCollectionItem.update({
      where: { id: itemId },
      data: { position: plan.temporaryStart + index },
    });
  }
  for (const [index, itemId] of plan.orderedIds.entries()) {
    const position = plan.rows[index]?.position;
    if (position === undefined) {
      throw new Error("GESTAO_COLLECTION_CONFLICT");
    }
    await transaction.contentCollectionItem.update({
      where: { id: itemId },
      data: { position },
    });
  }
  const updated = await transaction.contentCollection.updateMany({
    where: { id: input.collectionId, updatedAt: input.expectedVersion },
    data: { updatedByMemberId: input.actorId, updatedAt: new Date() },
  });
  if (updated.count !== 1) {
    throw new Error("GESTAO_COLLECTION_CONFLICT");
  }
  await recordCollectionEvent(transaction, {
    actorId: input.actorId,
    aggregateId: input.collectionId,
    eventKey: input.eventKey,
    eventType: "gestao.collection.items_reordered",
    requestHash: input.requestHash,
    details: {
      before: input.before,
      itemId: input.itemId,
      targetItemId: input.targetItemId,
    },
  });
};

const reorderCollectionTransaction = async (
  transaction: Prisma.TransactionClient,
  input: CollectionReorderInput
) => {
  const replayId = await isMatchingReplay(transaction, {
    actorId: input.actorId,
    eventKey: input.eventKey,
    eventType: "gestao.collection.items_reordered",
    requestHash: input.requestHash,
    aggregateId: input.collectionId,
  });
  if (replayId) {
    return;
  }
  const collection = await transaction.contentCollection.findUnique({
    where: { id: input.collectionId },
    select: { id: true, status: true, updatedAt: true },
  });
  if (!collection) {
    throw new Error("GESTAO_COLLECTION_NOT_FOUND");
  }
  if (collection.status === ContentStatus.ARCHIVED) {
    throw new Error("GESTAO_COLLECTION_ARCHIVED");
  }
  if (collection.updatedAt.getTime() !== input.expectedVersion.getTime()) {
    throw new Error("GESTAO_COLLECTION_CONFLICT");
  }
  const plan = await planCollectionReorder(transaction, input);
  if (!plan) {
    return;
  }
  await persistCollectionReorder(transaction, input, plan);
};

const collectionVersion = (formData: FormData) =>
  validVersion(text(formData, "version"));

export const addGestaoCollectionItem = async (
  _previousState: GestaoCollectionMutationState,
  formData: FormData
): Promise<GestaoCollectionMutationState> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "collection.mutation",
    memberId: actor.userId,
  });
  const collectionId = text(formData, "collectionId");
  const resourceId = text(formData, "resourceId");
  const type = text(formData, "itemType") as CollectionItemType;
  const expectedVersion = collectionVersion(formData);
  const key = readIdempotencyKey(formData.get("idempotencyKey"));
  if (
    !collectionId ||
    collectionId.length > 128 ||
    !resourceId ||
    resourceId.length > 128 ||
    !Object.values(CollectionItemType).includes(type) ||
    !expectedVersion ||
    !key
  ) {
    return collectionMutationState("error", "Escolha um recurso válido.");
  }
  const eventKey = actorScopedEventKey(actor.userId, key);
  const hash = requestHash({ collectionId, resourceId, type });

  try {
    await database.$transaction(
      async (transaction) => {
        const replayId = await isMatchingReplay(transaction, {
          actorId: actor.userId,
          eventKey,
          eventType: "gestao.collection.item_added",
          requestHash: hash,
          aggregateId: collectionId,
        });
        if (replayId) {
          return;
        }
        const collection = await transaction.contentCollection.findUnique({
          where: { id: collectionId },
          select: { id: true, status: true, updatedAt: true },
        });
        if (!collection) {
          throw new Error("GESTAO_COLLECTION_NOT_FOUND");
        }
        if (collection.status === ContentStatus.ARCHIVED) {
          throw new Error("GESTAO_COLLECTION_ARCHIVED");
        }
        const foreignKey = await resourceForeignKey(
          transaction,
          type,
          resourceId
        );
        if (!foreignKey) {
          throw new Error("GESTAO_COLLECTION_RESOURCE_INVALID");
        }
        const existing = await transaction.contentCollectionItem.findFirst({
          where: {
            collectionId,
            itemType: type,
            ...(foreignKey as Prisma.ContentCollectionItemWhereInput),
          },
          select: { id: true },
        });
        if (existing) {
          return;
        }
        if (collection.updatedAt.getTime() !== expectedVersion.getTime()) {
          throw new Error("GESTAO_COLLECTION_CONFLICT");
        }
        const lastItem = await transaction.contentCollectionItem.aggregate({
          where: { collectionId },
          _max: { position: true },
        });
        await transaction.contentCollectionItem.create({
          data: {
            collectionId,
            itemType: type,
            position: (lastItem._max.position ?? -1) + 1,
            ...foreignKey,
          },
        });
        const updated = await transaction.contentCollection.updateMany({
          where: { id: collectionId, updatedAt: expectedVersion },
          data: { updatedByMemberId: actor.userId, updatedAt: new Date() },
        });
        if (updated.count !== 1) {
          throw new Error("GESTAO_COLLECTION_CONFLICT");
        }
        await recordCollectionEvent(transaction, {
          actorId: actor.userId,
          aggregateId: collectionId,
          eventKey,
          eventType: "gestao.collection.item_added",
          requestHash: hash,
          details: { itemType: type, resourceId },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidateCollections();
    return collectionMutationState("success", "Recurso adicionado à coleção.");
  } catch (error) {
    return collectionMutationState("error", mutationConflictMessage(error));
  }
};

export const removeGestaoCollectionItem = async (input: {
  readonly collectionId: string;
  readonly idempotencyKey: string;
  readonly itemId: string;
  readonly version: string;
}): Promise<GestaoCollectionMutationState> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "collection.mutation",
    memberId: actor.userId,
  });
  const expectedVersion = validVersion(input.version);
  const key = readIdempotencyKey(input.idempotencyKey);
  if (
    !(expectedVersion && key) ||
    input.collectionId.length > 128 ||
    input.itemId.length > 128
  ) {
    return collectionMutationState(
      "error",
      "Atualize a página antes de remover."
    );
  }
  const eventKey = actorScopedEventKey(actor.userId, key);
  const hash = requestHash({
    collectionId: input.collectionId,
    itemId: input.itemId,
  });
  try {
    await database.$transaction(
      async (transaction) => {
        const replayId = await isMatchingReplay(transaction, {
          actorId: actor.userId,
          eventKey,
          eventType: "gestao.collection.item_removed",
          requestHash: hash,
          aggregateId: input.collectionId,
        });
        if (replayId) {
          return;
        }
        const [collection, item] = await Promise.all([
          transaction.contentCollection.findUnique({
            where: { id: input.collectionId },
            select: { id: true, updatedAt: true, status: true },
          }),
          transaction.contentCollectionItem.findFirst({
            where: { id: input.itemId, collectionId: input.collectionId },
            select: { id: true },
          }),
        ]);
        if (!collection) {
          throw new Error("GESTAO_COLLECTION_NOT_FOUND");
        }
        if (!item) {
          return;
        }
        if (collection.status === ContentStatus.ARCHIVED) {
          throw new Error("GESTAO_COLLECTION_ARCHIVED");
        }
        if (collection.updatedAt.getTime() !== expectedVersion.getTime()) {
          throw new Error("GESTAO_COLLECTION_CONFLICT");
        }
        await transaction.contentCollectionItem.delete({
          where: { id: item.id },
        });
        const updated = await transaction.contentCollection.updateMany({
          where: { id: collection.id, updatedAt: expectedVersion },
          data: { updatedByMemberId: actor.userId, updatedAt: new Date() },
        });
        if (updated.count !== 1) {
          throw new Error("GESTAO_COLLECTION_CONFLICT");
        }
        await recordCollectionEvent(transaction, {
          actorId: actor.userId,
          aggregateId: collection.id,
          eventKey,
          eventType: "gestao.collection.item_removed",
          requestHash: hash,
          details: { itemId: item.id },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidateCollections();
    return collectionMutationState("success", "Item removido desta coleção.");
  } catch (error) {
    return collectionMutationState("error", mutationConflictMessage(error));
  }
};

export const moveGestaoCollectionItem = async (input: {
  readonly before: boolean;
  readonly collectionId: string;
  readonly idempotencyKey: string;
  readonly itemId: string;
  readonly targetItemId: string;
  readonly version: string;
}): Promise<GestaoCollectionMutationState> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "collection.mutation",
    memberId: actor.userId,
  });
  const expectedVersion = validVersion(input.version);
  const key = readIdempotencyKey(input.idempotencyKey);
  if (
    !(
      expectedVersion &&
      key &&
      input.collectionId &&
      input.itemId &&
      input.targetItemId
    ) ||
    input.collectionId.length > 128 ||
    input.itemId.length > 128 ||
    input.targetItemId.length > 128
  ) {
    return collectionMutationState(
      "error",
      "Atualize a página antes de reordenar."
    );
  }
  const eventKey = actorScopedEventKey(actor.userId, key);
  const hash = requestHash({
    before: input.before,
    collectionId: input.collectionId,
    itemId: input.itemId,
    targetItemId: input.targetItemId,
  });

  try {
    await database.$transaction(
      (transaction) =>
        reorderCollectionTransaction(transaction, {
          actorId: actor.userId,
          before: input.before,
          collectionId: input.collectionId,
          eventKey,
          expectedVersion,
          itemId: input.itemId,
          requestHash: hash,
          targetItemId: input.targetItemId,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidateCollections();
    return collectionMutationState("success", "Ordem da coleção atualizada.");
  } catch (error) {
    return collectionMutationState("error", mutationConflictMessage(error));
  }
};

export const setGestaoCollectionStatus = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "collection.mutation",
    memberId: actor.userId,
  });
  const id = text(formData, "id");
  const status = text(formData, "status");
  const expectedVersion = collectionVersion(formData);
  const key = readIdempotencyKey(formData.get("idempotencyKey"));
  if (
    !id ||
    id.length > 128 ||
    !expectedVersion ||
    !key ||
    ![
      ContentStatus.DRAFT,
      ContentStatus.PUBLISHED,
      ContentStatus.ARCHIVED,
    ].includes(status as ContentStatus)
  ) {
    redirect(statusResultPath("dados-invalidos"));
  }
  const targetStatus = status as ContentStatus;
  const eventKey = actorScopedEventKey(actor.userId, key);
  const hash = requestHash({ id, status: targetStatus });
  try {
    await database.$transaction(
      async (transaction) => {
        const replayId = await isMatchingReplay(transaction, {
          actorId: actor.userId,
          eventKey,
          eventType: "gestao.collection.status_changed",
          requestHash: hash,
          aggregateId: id,
        });
        if (replayId) {
          return;
        }
        const collection = await transaction.contentCollection.findUnique({
          where: { id },
          select: { id: true, status: true, updatedAt: true },
        });
        if (!collection) {
          throw new Error("GESTAO_COLLECTION_NOT_FOUND");
        }
        if (collection.status === targetStatus) {
          return;
        }
        if (collection.updatedAt.getTime() !== expectedVersion.getTime()) {
          throw new Error("GESTAO_COLLECTION_CONFLICT");
        }
        await transaction.contentCollection.update({
          where: { id, updatedAt: expectedVersion },
          data: {
            status: targetStatus,
            updatedByMemberId: actor.userId,
          },
        });
        await recordCollectionEvent(transaction, {
          actorId: actor.userId,
          aggregateId: id,
          eventKey,
          eventType: "gestao.collection.status_changed",
          requestHash: hash,
          details: { status: targetStatus },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidateCollections();
    redirect(statusResultPath("status-atualizado"));
  } catch (error) {
    redirect(
      statusResultPath(
        error instanceof Error && error.message === "GESTAO_COLLECTION_CONFLICT"
          ? "conflito"
          : "erro"
      )
    );
  }
};

export const deleteGestaoCollection = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "collection.mutation",
    memberId: actor.userId,
  });
  const id = text(formData, "id");
  const expectedVersion = collectionVersion(formData);
  const key = readIdempotencyKey(formData.get("idempotencyKey"));
  if (!id || id.length > 128 || !expectedVersion || !key) {
    redirect(statusResultPath("dados-invalidos"));
  }
  const eventKey = actorScopedEventKey(actor.userId, key);
  const hash = requestHash({ id, action: "delete" });
  try {
    await database.$transaction(
      async (transaction) => {
        const replayId = await isMatchingReplay(transaction, {
          actorId: actor.userId,
          eventKey,
          eventType: "gestao.collection.deleted",
          requestHash: hash,
          aggregateId: id,
        });
        if (replayId) {
          return;
        }
        const collection = await transaction.contentCollection.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            updatedAt: true,
            _count: { select: { items: true } },
          },
        });
        if (!collection) {
          throw new Error("GESTAO_COLLECTION_NOT_FOUND");
        }
        if (
          collection.status !== ContentStatus.DRAFT ||
          collection._count.items > 0
        ) {
          throw new Error("GESTAO_COLLECTION_NOT_EMPTY_DRAFT");
        }
        if (collection.updatedAt.getTime() !== expectedVersion.getTime()) {
          throw new Error("GESTAO_COLLECTION_CONFLICT");
        }
        await recordCollectionEvent(transaction, {
          actorId: actor.userId,
          aggregateId: id,
          eventKey,
          eventType: "gestao.collection.deleted",
          requestHash: hash,
        });
        await transaction.contentCollection.delete({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidateCollections();
    redirect(statusResultPath("colecao-excluida"));
  } catch (error) {
    redirect(statusResultPath(collectionDeleteResult(error)));
  }
};
