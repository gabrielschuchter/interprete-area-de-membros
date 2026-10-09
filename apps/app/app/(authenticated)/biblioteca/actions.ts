"use server";

import { createHash } from "node:crypto";
import {
  ContentStatus,
  database,
  LibraryBookmarkTargetType,
  LibraryItemAccessType,
  LibraryItemDifficulty,
  LibraryItemKind,
  libraryCatalog,
} from "@repo/database";
import { shouldPauseStorageUploadDuringRollback } from "@repo/security/write-freeze";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { requireStaff } from "@/lib/authorization";
import {
  getLearningAccessScope,
  hasCourseAccess,
  hasLessonAccess,
  hasModuleAccess,
} from "@/lib/content-access";
import { requireMemberId } from "@/lib/learning";
import {
  createMemberAssetPath,
  deleteMemberAsset,
  memberAssetUrl,
  uploadMemberAsset,
} from "@/lib/member-storage";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";

const LANGUAGE_SEPARATOR_PATTERN = /[,/]/;
const LANGUAGE_CODE_PATTERN = /^[a-z]{2}(-[a-z]{2})?$/;

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

const safeCoverUrl = (entry: string) => {
  const url = safeUrl(entry);
  return url?.startsWith("https://") ? url : null;
};

export type BookmarkMutationResult =
  | { readonly ok: true; readonly saved: boolean }
  | { readonly ok: false };

const libraryLanguage = (entry: string) => {
  const languages = entry
    .split(LANGUAGE_SEPARATOR_PATTERN)
    .map((language) => language.trim().toLowerCase())
    .filter((language) => LANGUAGE_CODE_PATTERN.test(language));
  return [...new Set(languages)].slice(0, 4).join(",") || null;
};

const libraryCatalogKey = (url: string) =>
  `curated:v1:${createHash("sha256").update(url).digest("hex")}`;

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
  const fileEntry = formData.get("file");
  const hasUpload = fileEntry instanceof File && fileEntry.size > 0;
  if (
    shouldPauseStorageUploadDuringRollback({
      enabled: env.UPLOADS_PAUSED_FOR_ROLLBACK === "true",
      hasFile: hasUpload,
    })
  ) {
    redirect("/admin/library?uploadPaused=1");
  }

  await consumeMutationRateLimit({
    action: "library.mutation",
    memberId: userId,
  });
  const title = value(formData.get("title"));
  const description = value(formData.get("description"));
  const kind = value(formData.get("kind"));
  const category = value(formData.get("category"));
  const tags = value(formData.get("tags"));
  const url = safeUrl(value(formData.get("url")));
  const pmid = value(formData.get("pmid"));
  const language = libraryLanguage(value(formData.get("language")));
  const difficulty = value(formData.get("difficulty"));
  const accessType = value(formData.get("accessType"));
  const accessNote = value(formData.get("accessNote")).slice(0, 1200);
  const version = value(formData.get("version")).slice(0, 240);
  const lessonId = value(formData.get("lessonId"));
  const coverUrl = safeCoverUrl(value(formData.get("coverUrl")));
  const file = validLibraryFile(fileEntry);
  const idempotencyKey = readIdempotencyKey(formData.get("idempotencyKey"));

  if (
    !(
      title &&
      idempotencyKey &&
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

  const existingItem = await database.libraryItem.findUnique({
    where: { createdBy_idempotencyKey: { createdBy: userId, idempotencyKey } },
    select: { id: true },
  });
  if (existingItem) {
    revalidatePath("/admin/library");
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

  try {
    await database.libraryItem.create({
      data: {
        title,
        description: description || null,
        coverUrl,
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
        language,
        difficulty: Object.values(LibraryItemDifficulty).includes(
          difficulty as LibraryItemDifficulty
        )
          ? (difficulty as LibraryItemDifficulty)
          : null,
        accessType: Object.values(LibraryItemAccessType).includes(
          accessType as LibraryItemAccessType
        )
          ? (accessType as LibraryItemAccessType)
          : null,
        accessNote: accessNote || null,
        version: version || null,
        storagePath: uploaded?.path ?? null,
        mimeType: uploaded?.mimeType ?? null,
        sizeBytes: uploaded?.sizeBytes ?? null,
        lessonId: lessonId || null,
        status: ContentStatus.DRAFT,
        createdBy: userId,
        updatedBy: userId,
        idempotencyKey,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    if (uploaded?.path) {
      await deleteMemberAsset(uploaded.path);
    }
  }
  revalidatePath("/admin/library");
};

export const setLibraryStatus = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "library.mutation",
    memberId: userId,
  });
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
  const fileEntry = formData.get("file");
  const hasUpload = fileEntry instanceof File && fileEntry.size > 0;
  if (
    shouldPauseStorageUploadDuringRollback({
      enabled: env.UPLOADS_PAUSED_FOR_ROLLBACK === "true",
      hasFile: hasUpload,
    })
  ) {
    redirect("/admin/library?uploadPaused=1");
  }

  await consumeMutationRateLimit({
    action: "library.mutation",
    memberId: userId,
  });
  const id = value(formData.get("id"));
  const title = value(formData.get("title"));
  const description = value(formData.get("description"));
  const kind = value(formData.get("kind"));
  const category = value(formData.get("category"));
  const tags = value(formData.get("tags"));
  const url = safeUrl(value(formData.get("url")));
  const pmid = value(formData.get("pmid"));
  const language = libraryLanguage(value(formData.get("language")));
  const difficulty = value(formData.get("difficulty"));
  const accessType = value(formData.get("accessType"));
  const accessNote = value(formData.get("accessNote")).slice(0, 1200);
  const version = value(formData.get("version")).slice(0, 240);
  const lessonId = value(formData.get("lessonId"));
  const coverUrl = safeCoverUrl(value(formData.get("coverUrl")));
  const file = validLibraryFile(fileEntry);
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
      coverUrl,
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
      language,
      difficulty: Object.values(LibraryItemDifficulty).includes(
        difficulty as LibraryItemDifficulty
      )
        ? (difficulty as LibraryItemDifficulty)
        : null,
      accessType: Object.values(LibraryItemAccessType).includes(
        accessType as LibraryItemAccessType
      )
        ? (accessType as LibraryItemAccessType)
        : null,
      accessNote: accessNote || null,
      version: version || null,
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

export const importCuratedLibraryCatalog = async () => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "library.catalog-import",
    memberId: userId,
  });

  const rows = libraryCatalog.map((reference) => ({
    ...reference,
    catalogKey: libraryCatalogKey(reference.url),
    language: libraryLanguage(reference.language),
  }));
  const existing = await database.libraryItem.findMany({
    where: {
      OR: rows.flatMap((row) => [
        { catalogKey: row.catalogKey },
        { url: row.url },
        ...(row.doi ? [{ doi: row.doi }] : []),
        ...(row.pmid ? [{ pmid: row.pmid }] : []),
        { title: { equals: row.title, mode: "insensitive" as const } },
      ]),
    },
    select: {
      id: true,
      catalogKey: true,
      title: true,
      url: true,
      doi: true,
      pmid: true,
    },
  });

  await database.$transaction(async (transaction) => {
    const missing = [] as typeof rows;

    for (const row of rows) {
      const current = existing.find(
        (item) =>
          item.catalogKey === row.catalogKey ||
          item.url === row.url ||
          (row.doi && item.doi === row.doi) ||
          (row.pmid && item.pmid === row.pmid) ||
          item.title.toLocaleLowerCase("en") ===
            row.title.toLocaleLowerCase("en")
      );
      if (!current) {
        missing.push(row);
        continue;
      }
      await transaction.libraryItem.update({
        where: { id: current.id },
        data: {
          catalogKey: row.catalogKey,
          title: row.title,
          description: row.description,
          kind: row.kind,
          category: row.category,
          tags: row.tags,
          url: row.url,
          authors: row.authors,
          year: row.year ?? null,
          doi: row.doi ?? null,
          pmid: row.pmid ?? null,
          language: row.language,
          difficulty: row.difficulty,
          accessType: row.accessType,
          accessNote: row.accessNote,
          version: row.version ?? null,
          linkCheckedAt: row.linkCheckedAt,
          updatedBy: userId,
        },
      });
    }

    if (missing.length > 0) {
      await transaction.libraryItem.createMany({
        data: missing.map((row) => ({
          ...row,
          status: ContentStatus.PUBLISHED,
          position: 0,
          createdBy: userId,
          updatedBy: userId,
        })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/admin/library");
  revalidatePath("/biblioteca");
  redirect("/admin/library?catalog=imported");
};

export const toggleLibraryBookmark = async (
  formData: FormData
): Promise<BookmarkMutationResult> => {
  const memberId = await requireMemberId();
  const itemId = formData.get("itemId");
  const desired = formData.get("desired");

  if (
    typeof itemId !== "string" ||
    !itemId ||
    (desired !== "on" && desired !== "off")
  ) {
    return { ok: false };
  }

  await consumeMutationRateLimit({
    action: "library.bookmark",
    memberId,
  });

  if (
    !(await bookmarkTargetIsAvailable(
      LibraryBookmarkTargetType.LIBRARY_ITEM,
      itemId,
      memberId
    ))
  ) {
    return { ok: false };
  }

  if (desired === "on") {
    await database.libraryBookmark.upsert({
      where: { itemId_memberId: { itemId, memberId } },
      create: { itemId, memberId },
      update: {},
    });
  } else {
    await database.libraryBookmark.deleteMany({ where: { itemId, memberId } });
  }

  revalidatePath("/biblioteca");
  revalidatePath("/biblioteca/pessoal");
  revalidatePath("/comunidade/salvos");
  revalidatePath(`/biblioteca/${itemId}`);
  return { ok: true, saved: desired === "on" };
};

const bookmarkTargetIsAvailable = async (
  targetType: LibraryBookmarkTargetType,
  targetId: string,
  memberId: string
) => {
  const scope = await getLearningAccessScope(memberId);
  if (targetType === LibraryBookmarkTargetType.LIBRARY_ITEM) {
    const item = await database.libraryItem.findFirst({
      where: { id: targetId, status: ContentStatus.PUBLISHED },
      select: {
        id: true,
        lesson: {
          select: {
            id: true,
            status: true,
            moduleId: true,
            module: {
              select: {
                status: true,
                courseId: true,
                course: { select: { status: true } },
              },
            },
          },
        },
      },
    });
    if (!item) {
      return false;
    }
    const lesson = item.lesson;
    return (
      !lesson ||
      (lesson.status === ContentStatus.PUBLISHED &&
        lesson.module.status === ContentStatus.PUBLISHED &&
        lesson.module.course.status === ContentStatus.PUBLISHED &&
        hasLessonAccess(
          scope,
          lesson.module.courseId,
          lesson.moduleId,
          lesson.id
        ))
    );
  }
  if (targetType === LibraryBookmarkTargetType.COURSE) {
    const course = await database.course.findFirst({
      where: { id: targetId, status: ContentStatus.PUBLISHED },
      select: { id: true },
    });
    return Boolean(course && hasCourseAccess(scope, targetId));
  }
  if (targetType === LibraryBookmarkTargetType.MODULE) {
    const module = await database.module.findFirst({
      where: {
        id: targetId,
        status: ContentStatus.PUBLISHED,
        course: { status: ContentStatus.PUBLISHED },
      },
      select: { id: true, courseId: true },
    });
    return Boolean(
      module && hasModuleAccess(scope, module.courseId, module.id)
    );
  }
  if (targetType === LibraryBookmarkTargetType.LESSON) {
    const lesson = await database.lesson.findFirst({
      where: {
        id: targetId,
        status: ContentStatus.PUBLISHED,
        module: {
          status: ContentStatus.PUBLISHED,
          course: { status: ContentStatus.PUBLISHED },
        },
      },
      select: {
        id: true,
        moduleId: true,
        module: { select: { courseId: true } },
      },
    });
    return Boolean(
      lesson &&
        hasLessonAccess(
          scope,
          lesson.module.courseId,
          lesson.moduleId,
          lesson.id
        )
    );
  }
  const asset = await database.lessonAsset.findFirst({
    where: {
      id: targetId,
      lesson: {
        status: ContentStatus.PUBLISHED,
        module: {
          status: ContentStatus.PUBLISHED,
          course: { status: ContentStatus.PUBLISHED },
        },
      },
    },
    select: {
      id: true,
      lessonId: true,
      lesson: {
        select: {
          moduleId: true,
          module: { select: { courseId: true } },
        },
      },
    },
  });
  return Boolean(
    asset &&
      hasLessonAccess(
        scope,
        asset.lesson.module.courseId,
        asset.lesson.moduleId,
        asset.lessonId
      )
  );
};

const bookmarkWhereForTarget = (
  targetType: LibraryBookmarkTargetType,
  targetId: string,
  memberId: string
) => {
  switch (targetType) {
    case LibraryBookmarkTargetType.LIBRARY_ITEM:
      return { itemId: targetId, memberId };
    case LibraryBookmarkTargetType.COURSE:
      return { courseId: targetId, memberId };
    case LibraryBookmarkTargetType.MODULE:
      return { moduleId: targetId, memberId };
    case LibraryBookmarkTargetType.LESSON:
      return { lessonId: targetId, memberId };
    case LibraryBookmarkTargetType.ASSET:
      return { assetId: targetId, memberId };
    default:
      throw new Error("Unsupported saved-library target.");
  }
};

const bookmarkCreateData = (
  targetType: LibraryBookmarkTargetType,
  targetId: string,
  memberId: string
) => ({
  memberId,
  targetType,
  ...(targetType === LibraryBookmarkTargetType.LIBRARY_ITEM
    ? { itemId: targetId }
    : {}),
  ...(targetType === LibraryBookmarkTargetType.COURSE
    ? { courseId: targetId }
    : {}),
  ...(targetType === LibraryBookmarkTargetType.MODULE
    ? { moduleId: targetId }
    : {}),
  ...(targetType === LibraryBookmarkTargetType.LESSON
    ? { lessonId: targetId }
    : {}),
  ...(targetType === LibraryBookmarkTargetType.ASSET
    ? { assetId: targetId }
    : {}),
});

export const toggleLearningBookmark = async (
  formData: FormData
): Promise<BookmarkMutationResult> => {
  const memberId = await requireMemberId();
  const targetTypeValue = value(formData.get("targetType"));
  const targetId = value(formData.get("targetId"));
  const desired = value(formData.get("desired"));
  if (
    !targetId ||
    (desired !== "on" && desired !== "off") ||
    !Object.values(LibraryBookmarkTargetType).includes(
      targetTypeValue as LibraryBookmarkTargetType
    )
  ) {
    return { ok: false };
  }
  const targetType = targetTypeValue as LibraryBookmarkTargetType;
  await consumeMutationRateLimit({
    action: "library.bookmark",
    memberId,
  });
  if (!(await bookmarkTargetIsAvailable(targetType, targetId, memberId))) {
    return { ok: false };
  }
  const where = bookmarkWhereForTarget(targetType, targetId, memberId);
  if (desired === "on") {
    await database.libraryBookmark.createMany({
      data: [bookmarkCreateData(targetType, targetId, memberId)],
      skipDuplicates: true,
    });
  } else {
    await database.libraryBookmark.deleteMany({ where });
  }
  revalidatePath("/aprender");
  revalidatePath("/biblioteca");
  revalidatePath("/biblioteca/pessoal");
  revalidatePath("/comunidade/salvos");
  return { ok: true, saved: desired === "on" };
};

export const submitLearningBookmark = async (
  formData: FormData
): Promise<void> => {
  await toggleLearningBookmark(formData);
};

export const openLibraryItem = async (formData: FormData) => {
  const memberId = await requireMemberId();
  const id = value(formData.get("itemId"));
  if (
    !(
      id &&
      (await bookmarkTargetIsAvailable(
        LibraryBookmarkTargetType.LIBRARY_ITEM,
        id,
        memberId
      ))
    )
  ) {
    return;
  }
  const item = await database.libraryItem.findUnique({
    where: { id },
    select: { id: true, storagePath: true, url: true },
  });
  if (!item) {
    return;
  }
  const now = new Date();
  await database.libraryItemView.upsert({
    where: { itemId_memberId: { itemId: id, memberId } },
    create: {
      itemId: id,
      memberId,
      firstViewedAt: now,
      lastViewedAt: now,
      openCount: 1,
    },
    update: { lastViewedAt: now, openCount: { increment: 1 } },
  });
  redirect(item.storagePath ? memberAssetUrl(item.storagePath) : item.url);
};
