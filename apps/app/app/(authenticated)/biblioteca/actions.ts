"use server";

import { ContentStatus, database, LibraryItemKind } from "@repo/database";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/authorization";
import { requireMemberId } from "@/lib/learning";
import {
  createMemberAssetPath,
  deleteMemberAsset,
  memberAssetUrl,
  uploadMemberAsset,
} from "@/lib/member-storage";

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

const libraryFileTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);
const maxLibraryFileBytes = 20 * 1024 * 1024;

const validLibraryFile = (entry: FormDataEntryValue | null) =>
  entry instanceof File &&
  libraryFileTypes.has(entry.type) &&
  entry.size > 0 &&
  entry.size <= maxLibraryFileBytes
    ? entry
    : null;

const hasValidSignature = async (file: File) => {
  if (file.type === "text/plain") {
    return true;
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "application/pdf") {
    return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }
  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.type === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value
    );
  }
  return (
    file.type === "image/webp" &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
};

const uploadLibraryFile = async (file: File, memberId: string) => {
  if (!(await hasValidSignature(file))) {
    return null;
  }
  const path = createMemberAssetPath({
    kind: "library",
    memberId,
    mimeType: file.type,
  });
  if (!path) {
    return null;
  }
  await uploadMemberAsset({
    storagePath: path,
    body: await file.arrayBuffer(),
    mimeType: file.type,
  });
  return {
    path,
    url: memberAssetUrl(path),
    mimeType: file.type,
    sizeBytes: file.size,
  };
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: multipart validation, storage upload, and metadata persistence must remain one atomic staff action.
export const createLibraryItem = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const title = value(formData.get("title"));
  const description = value(formData.get("description"));
  const kind = value(formData.get("kind"));
  const category = value(formData.get("category"));
  const tags = value(formData.get("tags"));
  const url = safeUrl(value(formData.get("url")));
  const pmid = value(formData.get("pmid"));
  const lessonId = value(formData.get("lessonId"));
  const file = validLibraryFile(formData.get("file"));

  if (
    !(
      title &&
      (url || file) &&
      Object.values(LibraryItemKind).includes(kind as LibraryItemKind)
    )
  ) {
    return;
  }
  if (
    lessonId &&
    !(await database.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    }))
  ) {
    return;
  }

  let uploaded: Awaited<ReturnType<typeof uploadLibraryFile>> = null;
  if (file) {
    try {
      uploaded = await uploadLibraryFile(file, userId);
    } catch {
      return;
    }
    if (!uploaded) {
      return;
    }
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
      url: uploaded?.url ?? url ?? "",
      authors: value(formData.get("authors")) || null,
      year: Number(value(formData.get("year"))) || null,
      doi: value(formData.get("doi")) || null,
      pmid: pmid || null,
      storagePath: uploaded?.path ?? null,
      mimeType: uploaded?.mimeType ?? null,
      sizeBytes: uploaded?.sizeBytes ?? null,
      lessonId: lessonId || null,
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: replacement uploads and safe cleanup are deliberately coordinated in one staff action.
export const updateLibraryItem = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const id = value(formData.get("id"));
  const title = value(formData.get("title"));
  const description = value(formData.get("description"));
  const kind = value(formData.get("kind"));
  const category = value(formData.get("category"));
  const tags = value(formData.get("tags"));
  const url = safeUrl(value(formData.get("url")));
  const pmid = value(formData.get("pmid"));
  const lessonId = value(formData.get("lessonId"));
  const file = validLibraryFile(formData.get("file"));
  if (
    !(
      id &&
      title &&
      Object.values(LibraryItemKind).includes(kind as LibraryItemKind)
    )
  ) {
    return;
  }
  if (
    lessonId &&
    !(await database.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    }))
  ) {
    return;
  }
  const current = await database.libraryItem.findUnique({
    where: { id },
    select: {
      url: true,
      storagePath: true,
      mimeType: true,
      sizeBytes: true,
    },
  });
  if (!current) {
    return;
  }
  let uploaded: Awaited<ReturnType<typeof uploadLibraryFile>> = null;
  if (file) {
    try {
      uploaded = await uploadLibraryFile(file, userId);
    } catch {
      return;
    }
    if (!uploaded) {
      return;
    }
  }
  const nextUrl = uploaded?.url ?? url ?? current.url;
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
      url: nextUrl,
      authors: value(formData.get("authors")) || null,
      year: Number(value(formData.get("year"))) || null,
      doi: value(formData.get("doi")) || null,
      pmid: pmid || null,
      storagePath: uploaded?.path ?? (url ? null : current.storagePath),
      mimeType: uploaded?.mimeType ?? (url ? null : current.mimeType),
      sizeBytes: uploaded?.sizeBytes ?? (url ? null : current.sizeBytes),
      lessonId: lessonId || null,
      updatedBy: userId,
    },
  });
  if (
    current.storagePath &&
    uploaded &&
    current.storagePath !== uploaded.path
  ) {
    await deleteMemberAsset(current.storagePath);
  }
  if (current.storagePath && !uploaded && url) {
    await deleteMemberAsset(current.storagePath);
  }
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
