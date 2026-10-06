"use server";

import {
  CollectionItemType,
  ContentStatus,
  CourseExperience,
  database,
  type Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/authorization";
import { isAllowedCollectionCoverUrl } from "@/lib/collection-covers";
import {
  consumeMutationRateLimit,
  mutationLog,
} from "@/lib/mutation-reliability";

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const parseCollectionDate = (value: string) =>
  value ? new Date(`${value}:00-03:00`) : null;

const collectionFields = z
  .object({
    audienceSpaceId: z.string().max(128),
    availableAt: z
      .string()
      .max(16)
      .refine(
        (value) => !value || Boolean(parseCollectionDate(value)?.getTime())
      ),
    coverUrl: z.string().max(2000).refine(isAllowedCollectionCoverUrl),
    description: z.string().max(500),
    expiresAt: z
      .string()
      .max(16)
      .refine(
        (value) => !value || Boolean(parseCollectionDate(value)?.getTime())
      ),
    position: z.number().int().min(0).max(999),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    title: z.string().min(1).max(120),
  })
  .superRefine((fields, context) => {
    const availableAt = parseCollectionDate(fields.availableAt);
    const expiresAt = parseCollectionDate(fields.expiresAt);
    if (availableAt && expiresAt && expiresAt <= availableAt) {
      context.addIssue({
        code: "custom",
        message: "A data de encerramento deve ser posterior à liberação.",
        path: ["expiresAt"],
      });
    }
  });

const parseCollectionForm = (formData: FormData) =>
  collectionFields.safeParse({
    audienceSpaceId: text(formData.get("audienceSpaceId")),
    availableAt: text(formData.get("availableAt")),
    coverUrl: text(formData.get("coverUrl")),
    description: text(formData.get("description")),
    expiresAt: text(formData.get("expiresAt")),
    position: Number(text(formData.get("position")) || 0),
    slug: text(formData.get("slug")).toLowerCase(),
    title: text(formData.get("title")),
  });

const collectionInputData = (fields: z.infer<typeof collectionFields>) => ({
  audienceSpaceId: fields.audienceSpaceId || null,
  availableAt: parseCollectionDate(fields.availableAt),
  coverUrl: fields.coverUrl || null,
  description: fields.description || null,
  expiresAt: parseCollectionDate(fields.expiresAt),
  position: fields.position,
  slug: fields.slug,
  title: fields.title,
});

const isValidAudienceSpace = async (spaceId: string) =>
  !spaceId ||
  Boolean(
    await database.communitySpace.findFirst({
      where: { id: spaceId, status: ContentStatus.PUBLISHED },
      select: { id: true },
    })
  );

const redirectToCollections = (status: "success" | "error", message: string) =>
  redirect(
    `/admin/colecoes?${new URLSearchParams({ message, status }).toString()}`
  );

const revalidateCollections = () => {
  revalidatePath("/admin/colecoes");
  revalidatePath("/aprender");
  revalidatePath("/");
};

export const createCollection = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const parsed = parseCollectionForm(formData);
  if (
    !(
      parsed.success &&
      (await isValidAudienceSpace(parsed.data.audienceSpaceId))
    )
  ) {
    return redirectToCollections("error", "Revise título, slug e posição.");
  }

  try {
    await database.contentCollection.create({
      data: {
        ...collectionInputData(parsed.data),
        createdByMemberId: userId,
        updatedByMemberId: userId,
      },
    });
    mutationLog({
      action: "admin.collection.create",
      memberId: userId,
      status: "success",
    });
    revalidateCollections();
    redirectToCollections("success", "Coleção criada como rascunho.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    mutationLog({
      action: "admin.collection.create",
      memberId: userId,
      status: "error",
    });
    console.error("Collection creation failed", error);
    redirectToCollections("error", "Não foi possível criar a coleção.");
  }
};

export const updateCollection = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const id = text(formData.get("id"));
  const parsed = parseCollectionForm(formData);
  if (
    !(
      id &&
      parsed.success &&
      (await isValidAudienceSpace(parsed.data.audienceSpaceId))
    )
  ) {
    return redirectToCollections("error", "Revise os dados da coleção.");
  }

  try {
    await database.contentCollection.update({
      where: { id },
      data: {
        ...collectionInputData(parsed.data),
        updatedByMemberId: userId,
      },
    });
    revalidateCollections();
    redirectToCollections("success", "Coleção atualizada.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Collection update failed", error);
    redirectToCollections("error", "Não foi possível atualizar a coleção.");
  }
};

export const setCollectionStatus = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const id = text(formData.get("id"));
  const status = text(formData.get("status"));
  if (!(id && Object.values(ContentStatus).includes(status as ContentStatus))) {
    return redirectToCollections("error", "Status inválido.");
  }

  try {
    await database.contentCollection.update({
      where: { id },
      data: {
        status: status as ContentStatus,
        updatedByMemberId: userId,
      },
    });
    revalidateCollections();
    redirectToCollections("success", "Status da coleção atualizado.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Collection status update failed", error);
    redirectToCollections("error", "Não foi possível atualizar o status.");
  }
};

const addItemInput = z.object({
  collectionId: z.string().min(1),
  itemType: z.enum(
    Object.values(CollectionItemType) as [
      CollectionItemType,
      ...CollectionItemType[],
    ]
  ),
  resourceId: z.string().min(1),
});

type CollectionItemInput = z.infer<typeof addItemInput>;
type CollectionItemTransaction = Prisma.TransactionClient;

const getNextCollectionPosition = async (
  transaction: CollectionItemTransaction,
  collectionId: string
) => {
  const collection = await transaction.contentCollection.findUnique({
    where: { id: collectionId },
    select: { id: true },
  });
  if (!collection) {
    throw new Error("collection_not_found");
  }

  const result = await transaction.contentCollectionItem.aggregate({
    where: { collectionId: collection.id },
    _max: { position: true },
  });
  return (result._max.position ?? -1) + 1;
};

const addLessonCollectionItem = async (
  transaction: CollectionItemTransaction,
  input: CollectionItemInput,
  position: number
) => {
  const lesson = await transaction.lesson.findFirst({
    where: {
      id: input.resourceId,
      module: { course: { experience: CourseExperience.ASYNC } },
    },
    select: { id: true },
  });
  if (!lesson) {
    throw new Error("lesson_not_found");
  }
  await transaction.contentCollectionItem.create({
    data: {
      collectionId: input.collectionId,
      itemType: CollectionItemType.LESSON,
      lessonId: lesson.id,
      position,
    },
  });
};

const addCourseCollectionItem = async (
  transaction: CollectionItemTransaction,
  input: CollectionItemInput,
  position: number
) => {
  const course = await transaction.course.findFirst({
    where: {
      id: input.resourceId,
      experience: CourseExperience.ASYNC,
      status: { not: ContentStatus.ARCHIVED },
    },
    select: { id: true },
  });
  if (!course) {
    throw new Error("course_not_found");
  }
  await transaction.contentCollectionItem.create({
    data: {
      collectionId: input.collectionId,
      itemType: CollectionItemType.COURSE,
      courseId: course.id,
      position,
    },
  });
};

const addExerciseListCollectionItem = async (
  transaction: CollectionItemTransaction,
  input: CollectionItemInput,
  position: number
) => {
  const list = await transaction.exerciseList.findFirst({
    where: {
      id: input.resourceId,
      status: { not: ContentStatus.ARCHIVED },
      bank: { is: { status: ContentStatus.PUBLISHED } },
    },
    select: { id: true },
  });
  if (!list) {
    throw new Error("exercise_list_not_found");
  }
  await transaction.contentCollectionItem.create({
    data: {
      collectionId: input.collectionId,
      itemType: CollectionItemType.EXERCISE_LIST,
      exerciseListId: list.id,
      position,
    },
  });
};

const addRecordingCollectionItem = async (
  transaction: CollectionItemTransaction,
  input: CollectionItemInput,
  position: number
) => {
  const recording = await transaction.importedRecording.findFirst({
    where: { id: input.resourceId },
    select: { id: true },
  });
  if (!recording) {
    throw new Error("recording_not_found");
  }
  await transaction.contentCollectionItem.create({
    data: {
      collectionId: input.collectionId,
      itemType: CollectionItemType.RECORDING,
      recordingId: recording.id,
      position,
    },
  });
};

const addLibraryItemCollectionItem = async (
  transaction: CollectionItemTransaction,
  input: CollectionItemInput,
  position: number
) => {
  const libraryItem = await transaction.libraryItem.findFirst({
    where: {
      id: input.resourceId,
      status: { not: ContentStatus.ARCHIVED },
    },
    select: { id: true },
  });
  if (!libraryItem) {
    throw new Error("library_item_not_found");
  }
  await transaction.contentCollectionItem.create({
    data: {
      collectionId: input.collectionId,
      itemType: CollectionItemType.LIBRARY_ITEM,
      libraryItemId: libraryItem.id,
      position,
    },
  });
};

const addCollectionItemInTransaction = async (
  transaction: CollectionItemTransaction,
  input: CollectionItemInput
) => {
  const position = await getNextCollectionPosition(
    transaction,
    input.collectionId
  );
  switch (input.itemType) {
    case CollectionItemType.LESSON:
      return addLessonCollectionItem(transaction, input, position);
    case CollectionItemType.COURSE:
      return addCourseCollectionItem(transaction, input, position);
    case CollectionItemType.EXERCISE_LIST:
      return addExerciseListCollectionItem(transaction, input, position);
    case CollectionItemType.RECORDING:
      return addRecordingCollectionItem(transaction, input, position);
    case CollectionItemType.LIBRARY_ITEM:
      return addLibraryItemCollectionItem(transaction, input, position);
    default:
      throw new Error("unsupported_collection_item_type");
  }
};

export const addCollectionItem = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const parsed = addItemInput.safeParse({
    collectionId: text(formData.get("collectionId")),
    itemType: text(formData.get("itemType")),
    resourceId: text(formData.get("resourceId")),
  });
  if (!parsed.success) {
    return redirectToCollections("error", "Escolha um recurso válido.");
  }

  try {
    await database.$transaction((transaction) =>
      addCollectionItemInTransaction(transaction, parsed.data)
    );
    mutationLog({
      action: "admin.collection-item.create",
      memberId: userId,
      resource: parsed.data.collectionId,
      status: "success",
    });
    revalidateCollections();
    redirectToCollections("success", "Recurso adicionado à coleção.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    mutationLog({
      action: "admin.collection-item.create",
      memberId: userId,
      resource: parsed.data.collectionId,
      status: "error",
    });
    console.error("Collection item creation failed", error);
    redirectToCollections(
      "error",
      "Não foi possível adicionar. O recurso pode já estar nesta coleção."
    );
  }
};

export const removeCollectionItem = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const id = text(formData.get("id"));
  if (!id) {
    return redirectToCollections("error", "Item inválido.");
  }
  try {
    await database.contentCollectionItem.delete({ where: { id } });
    revalidateCollections();
    redirectToCollections("success", "Recurso removido da coleção.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Collection item removal failed", error);
    redirectToCollections("error", "Não foi possível remover o recurso.");
  }
};

export const moveCollectionItem = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const id = text(formData.get("id"));
  const direction = text(formData.get("direction"));
  if (!(id && (direction === "up" || direction === "down"))) {
    return redirectToCollections("error", "Movimento inválido.");
  }

  try {
    await database.$transaction(async (transaction) => {
      const item = await transaction.contentCollectionItem.findUnique({
        where: { id },
        select: { id: true, collectionId: true, position: true },
      });
      if (!item) {
        throw new Error("collection_item_not_found");
      }

      const neighbor = await transaction.contentCollectionItem.findFirst({
        where: {
          collectionId: item.collectionId,
          position:
            direction === "up" ? { lt: item.position } : { gt: item.position },
        },
        orderBy: { position: direction === "up" ? "desc" : "asc" },
        select: { id: true, position: true },
      });
      if (!neighbor) {
        return;
      }

      const temporaryPosition =
        Math.max(item.position, neighbor.position) + 1000;
      await transaction.contentCollectionItem.update({
        where: { id: item.id },
        data: { position: temporaryPosition },
      });
      await transaction.contentCollectionItem.update({
        where: { id: neighbor.id },
        data: { position: item.position },
      });
      await transaction.contentCollectionItem.update({
        where: { id: item.id },
        data: { position: neighbor.position },
      });
    });
    revalidateCollections();
    redirectToCollections("success", "Ordem da coleção atualizada.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Collection item reorder failed", error);
    redirectToCollections("error", "Não foi possível reorganizar o recurso.");
  }
};

export const deleteCollection = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const id = text(formData.get("id"));
  if (!id) {
    return redirectToCollections("error", "Coleção inválida.");
  }

  try {
    const collection = await database.contentCollection.findUnique({
      where: { id },
      select: { status: true, _count: { select: { items: true } } },
    });
    if (!collection) {
      return redirectToCollections("error", "Coleção não encontrada.");
    }
    if (
      collection.status === ContentStatus.PUBLISHED ||
      collection._count.items > 0
    ) {
      return redirectToCollections(
        "error",
        "Arquive a coleção e remova seus itens antes de excluí-la."
      );
    }
    await database.contentCollection.delete({ where: { id } });
    revalidateCollections();
    redirectToCollections("success", "Coleção excluída.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Collection deletion failed", error);
    redirectToCollections("error", "Não foi possível excluir a coleção.");
  }
};
