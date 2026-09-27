"use server";

import {
  CollectionItemType,
  ContentStatus,
  CourseExperience,
  database,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/authorization";
import {
  consumeMutationRateLimit,
  mutationLog,
} from "@/lib/mutation-reliability";

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const collectionFields = z.object({
  description: z.string().max(500),
  position: z.number().int().min(0).max(999),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  title: z.string().min(1).max(120),
});

const redirectToCollections = (status: "success" | "error", message: string) =>
  redirect(
    `/admin/colecoes?${new URLSearchParams({ message, status }).toString()}`
  );

const revalidateCollections = () => {
  revalidatePath("/admin/colecoes");
  revalidatePath("/");
};

export const createCollection = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const parsed = collectionFields.safeParse({
    description: text(formData.get("description")),
    position: Number(text(formData.get("position")) || 0),
    slug: text(formData.get("slug")).toLowerCase(),
    title: text(formData.get("title")),
  });
  if (!parsed.success) {
    return redirectToCollections("error", "Revise título, slug e posição.");
  }

  try {
    await database.contentCollection.create({
      data: {
        ...parsed.data,
        description: parsed.data.description || null,
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
  const parsed = collectionFields.safeParse({
    description: text(formData.get("description")),
    position: Number(text(formData.get("position")) || 0),
    slug: text(formData.get("slug")).toLowerCase(),
    title: text(formData.get("title")),
  });
  if (!(id && parsed.success)) {
    return redirectToCollections("error", "Revise os dados da coleção.");
  }

  try {
    await database.contentCollection.update({
      where: { id },
      data: {
        ...parsed.data,
        description: parsed.data.description || null,
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
    await database.$transaction(async (transaction) => {
      const collection = await transaction.contentCollection.findUnique({
        where: { id: parsed.data.collectionId },
        select: { id: true },
      });
      if (!collection) {
        throw new Error("collection_not_found");
      }

      const positionResult = await transaction.contentCollectionItem.aggregate({
        where: { collectionId: collection.id },
        _max: { position: true },
      });
      const position = (positionResult._max.position ?? -1) + 1;
      const common = {
        collectionId: collection.id,
        position,
      };

      if (parsed.data.itemType === CollectionItemType.LESSON) {
        const lesson = await transaction.lesson.findFirst({
          where: {
            id: parsed.data.resourceId,
            module: { course: { experience: CourseExperience.ASYNC } },
          },
          select: { id: true },
        });
        if (!lesson) {
          throw new Error("lesson_not_found");
        }
        await transaction.contentCollectionItem.create({
          data: {
            ...common,
            itemType: parsed.data.itemType,
            lessonId: lesson.id,
          },
        });
      }

      if (parsed.data.itemType === CollectionItemType.RECORDING) {
        const asset = await transaction.lessonAsset.findFirst({
          where: {
            id: parsed.data.resourceId,
            importedRecording: { isNot: null },
          },
          select: { id: true },
        });
        if (!asset) {
          throw new Error("recording_not_found");
        }
        await transaction.contentCollectionItem.create({
          data: {
            ...common,
            itemType: parsed.data.itemType,
            assetId: asset.id,
          },
        });
      }

      if (parsed.data.itemType === CollectionItemType.LIBRARY_ITEM) {
        const libraryItem = await transaction.libraryItem.findFirst({
          where: {
            id: parsed.data.resourceId,
            status: { not: ContentStatus.ARCHIVED },
          },
          select: { id: true },
        });
        if (!libraryItem) {
          throw new Error("library_item_not_found");
        }
        await transaction.contentCollectionItem.create({
          data: {
            ...common,
            itemType: parsed.data.itemType,
            libraryItemId: libraryItem.id,
          },
        });
      }
    });
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
