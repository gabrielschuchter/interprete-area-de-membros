"use server";

import {
  CollectionItemType,
  ContentStatus,
  database,
  Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

export interface GestaoLibraryBulkState {
  readonly count?: number;
  readonly message?: string;
  readonly status: "idle" | "error" | "success";
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const selectedLibraryIds = (formData: FormData) => {
  const rawIds = formData.getAll("itemIds");
  if (
    rawIds.length === 0 ||
    rawIds.length > 100 ||
    rawIds.some((value) => typeof value !== "string")
  ) {
    return null;
  }
  const ids = [...new Set(rawIds as string[])];
  return ids.length > 100 || ids.some((id) => !id || id.length > 128)
    ? null
    : ids;
};

const conflictResult = (error: unknown) => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return error.code === "P2002" || error.code === "P2034";
};

const revalidateLibrary = () => {
  revalidatePath("/gestao/ensino/biblioteca");
  revalidatePath("/admin/library");
  revalidatePath("/biblioteca");
  revalidatePath("/cursos");
};

export const applyGestaoLibraryBulkAction = async (
  _previousState: GestaoLibraryBulkState,
  formData: FormData
): Promise<GestaoLibraryBulkState> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "library.mutation",
    memberId: actor.userId,
  });

  const ids = selectedLibraryIds(formData);
  const intent = text(formData, "intent");
  if (
    !(ids && ["publish", "archive", "category", "collection"].includes(intent))
  ) {
    return {
      status: "error",
      message: "Selecione até 100 materiais e escolha uma ação.",
    };
  }

  if (intent === "publish" || intent === "archive") {
    const updated = await database.libraryItem.updateMany({
      where: {
        id: { in: ids },
        ...(intent === "archive"
          ? { status: { not: ContentStatus.ARCHIVED } }
          : {}),
      },
      data: {
        status:
          intent === "publish"
            ? ContentStatus.PUBLISHED
            : ContentStatus.ARCHIVED,
        updatedBy: actor.userId,
      },
    });
    revalidateLibrary();
    return {
      count: updated.count,
      message:
        intent === "publish"
          ? `${updated.count} material(is) publicado(s).`
          : `${updated.count} material(is) arquivado(s).`,
      status: "success",
    };
  }

  if (intent === "category") {
    const category = text(formData, "category").slice(0, 80);
    if (!category) {
      return {
        status: "error",
        message: "Informe a categoria para aplicar aos materiais selecionados.",
      };
    }
    const updated = await database.libraryItem.updateMany({
      where: { id: { in: ids } },
      data: { category, updatedBy: actor.userId },
    });
    revalidateLibrary();
    return {
      count: updated.count,
      message: `Categoria atualizada em ${updated.count} material(is).`,
      status: "success",
    };
  }

  const collectionId = text(formData, "collectionId");
  if (!collectionId) {
    return {
      status: "error",
      message: "Escolha uma coleção para adicionar os materiais.",
    };
  }
  try {
    const added = await database.$transaction(
      async (transaction) => {
        const collection = await transaction.contentCollection.findUnique({
          where: { id: collectionId },
          select: { id: true, status: true },
        });
        const materials = await transaction.libraryItem.findMany({
          where: { id: { in: ids }, status: { not: ContentStatus.ARCHIVED } },
          orderBy: [{ position: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        if (
          !collection ||
          collection.status === ContentStatus.ARCHIVED ||
          materials.length !== ids.length
        ) {
          throw new Error("GESTAO_LIBRARY_BULK_TARGET_INVALID");
        }
        const existing = await transaction.contentCollectionItem.findMany({
          where: {
            collectionId,
            itemType: CollectionItemType.LIBRARY_ITEM,
            libraryItemId: { in: ids },
          },
          select: { libraryItemId: true },
        });
        const existingIds = new Set(
          existing.flatMap(({ libraryItemId }) =>
            libraryItemId ? [libraryItemId] : []
          )
        );
        const toAdd = materials.filter(({ id }) => !existingIds.has(id));
        if (toAdd.length === 0) {
          return 0;
        }

        const lastPosition = await transaction.contentCollectionItem.aggregate({
          where: { collectionId },
          _max: { position: true },
        });
        const firstPosition = (lastPosition._max.position ?? -1) + 1;
        await transaction.contentCollectionItem.createMany({
          data: toAdd.map(({ id }, index) => ({
            collectionId,
            itemType: CollectionItemType.LIBRARY_ITEM,
            libraryItemId: id,
            position: firstPosition + index,
          })),
        });
        return toAdd.length;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    revalidateLibrary();
    revalidatePath("/gestao/ensino/colecoes");
    revalidatePath("/admin/colecoes");
    return {
      count: added,
      message: `${added} material(is) adicionado(s) à coleção.`,
      status: "success",
    };
  } catch (error) {
    if (conflictResult(error)) {
      return {
        status: "error",
        message:
          "A coleção mudou enquanto os materiais eram adicionados. Tente novamente.",
      };
    }
    if (
      error instanceof Error &&
      error.message === "GESTAO_LIBRARY_BULK_TARGET_INVALID"
    ) {
      return {
        status: "error",
        message: "A coleção não existe ou contém materiais arquivados.",
      };
    }
    throw error;
  }
};

export interface LibraryDuplicate {
  readonly id: string;
  readonly matchedBy: "doi" | "url";
  readonly title: string;
}

/** Procura material já cadastrado com o mesmo DOI ou endereço. */
export const findGestaoLibraryDuplicate = async (input: {
  readonly doi: string;
  readonly excludeId?: string;
  readonly url: string;
}): Promise<LibraryDuplicate | null> => {
  await requireGestaoAction("content.manage");
  const doi = input.doi.trim().slice(0, 200);
  const url = input.url.trim().slice(0, 2000);
  const notSelf = input.excludeId ? { id: { not: input.excludeId } } : {};
  if (doi) {
    const byDoi = await database.libraryItem.findFirst({
      where: { ...notSelf, doi: { equals: doi, mode: "insensitive" } },
      select: { id: true, title: true },
    });
    if (byDoi) {
      return { ...byDoi, matchedBy: "doi" };
    }
  }
  if (url) {
    const byUrl = await database.libraryItem.findFirst({
      where: { ...notSelf, url },
      select: { id: true, title: true },
    });
    if (byUrl) {
      return { ...byUrl, matchedBy: "url" };
    }
  }
  return null;
};
