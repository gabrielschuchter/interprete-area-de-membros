"use server";

import { ContentStatus, database, LibraryItemKind } from "@repo/database";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/authorization";
import { requireMemberId } from "@/lib/learning";

const value = (entry: FormDataEntryValue | null) =>
  typeof entry === "string" ? entry.trim() : "";

const safeUrl = (entry: string) => {
  try {
    const url = new URL(entry);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export const createLibraryItem = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const title = value(formData.get("title"));
  const description = value(formData.get("description"));
  const kind = value(formData.get("kind"));
  const category = value(formData.get("category"));
  const tags = value(formData.get("tags"));
  const url = safeUrl(value(formData.get("url")));

  if (
    !(
      title &&
      url &&
      Object.values(LibraryItemKind).includes(kind as LibraryItemKind)
    )
  ) {
    return;
  }

  await database.libraryItem.create({
    data: {
      title,
      description: description || null,
      kind: kind as LibraryItemKind,
      category: category || null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      url,
      authors: value(formData.get("authors")) || null,
      year: Number(value(formData.get("year"))) || null,
      doi: value(formData.get("doi")) || null,
      status: ContentStatus.DRAFT,
      createdBy: userId,
      updatedBy: userId,
    },
  });
  revalidatePath("/admin/library");
};

export const setLibraryStatus = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const id = value(formData.get("id"));
  const status = value(formData.get("status"));
  if (!(id && Object.values(ContentStatus).includes(status as ContentStatus))) {
    return;
  }
  await database.libraryItem.update({
    where: { id },
    data: { status: status as ContentStatus, updatedBy: userId },
  });
  revalidatePath("/admin/library");
  revalidatePath("/biblioteca");
};

export const updateLibraryItem = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const id = value(formData.get("id"));
  const title = value(formData.get("title"));
  const description = value(formData.get("description"));
  const kind = value(formData.get("kind"));
  const category = value(formData.get("category"));
  const tags = value(formData.get("tags"));
  const url = safeUrl(value(formData.get("url")));
  if (
    !(
      id &&
      title &&
      url &&
      Object.values(LibraryItemKind).includes(kind as LibraryItemKind)
    )
  ) {
    return;
  }
  await database.libraryItem.update({
    where: { id },
    data: {
      title,
      description: description || null,
      kind: kind as LibraryItemKind,
      category: category || null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12),
      url,
      authors: value(formData.get("authors")) || null,
      year: Number(value(formData.get("year"))) || null,
      doi: value(formData.get("doi")) || null,
      updatedBy: userId,
    },
  });
  revalidatePath("/admin/library");
  revalidatePath("/biblioteca");
  revalidatePath(`/biblioteca/${id}`);
};

export const toggleLibraryBookmark = async (formData: FormData) => {
  const memberId = await requireMemberId();
  const itemId = formData.get("itemId");

  if (typeof itemId !== "string" || !itemId) {
    return;
  }

  const item = await database.libraryItem.findFirst({
    where: { id: itemId, status: ContentStatus.PUBLISHED },
    select: { id: true },
  });

  if (!item) {
    return;
  }

  const existing = await database.libraryBookmark.findUnique({
    where: { itemId_memberId: { itemId, memberId } },
    select: { id: true },
  });

  if (existing) {
    await database.libraryBookmark.delete({ where: { id: existing.id } });
  } else {
    await database.libraryBookmark.create({ data: { itemId, memberId } });
  }

  revalidatePath("/biblioteca");
  revalidatePath(`/biblioteca/${itemId}`);
};
