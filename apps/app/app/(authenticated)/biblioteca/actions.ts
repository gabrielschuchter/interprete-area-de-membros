"use server";

import { createHash } from "node:crypto";
import {
  ContentStatus,
  database,
  LibraryBookmarkTargetType,
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
import {
  type LibraryItemFormState,
  libraryFormError,
  libraryFormSuccess,
  normalizeLibraryLanguage,
  parseLibraryItemInput,
} from "@/lib/gestao-library-form-domain";
import { requireMemberId } from "@/lib/learning";
import {
  createMemberAssetPath,
  deleteMemberAsset,
  memberAssetUrl,
  uploadMemberAsset,
} from "@/lib/member-storage";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";

const value = (entry: FormDataEntryValue | null) =>
  typeof entry === "string" ? entry.trim() : "";

const staffLibraryPath = (formData: FormData) =>
  value(formData.get("surface")) === "gestao"
    ? "/gestao/ensino/biblioteca"
    : "/admin/library";

const revalidateStaffLibrary = () => {
  revalidatePath("/admin/library");
  revalidatePath("/gestao/ensino/biblioteca");
  revalidatePath("/biblioteca");
};

const redirectToStaffLibrary = (
  formData: FormData,
  query: Record<string, string>
) => {
  const params = new URLSearchParams(query).toString();
  redirect(`${staffLibraryPath(formData)}?${params}`);
};

export type BookmarkMutationResult =
  | { readonly ok: true; readonly saved: boolean }
  | { readonly ok: false };

const libraryCatalogKey = (url: string) =>
  `curated:v1:${createHash("sha256").update(url).digest("hex")}`;

const libraryLessonExists = async (lessonId: string) =>
  !lessonId ||
  Boolean(
    await database.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    })
  );

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

const tryUploadLibraryFile = async (file: File | null, memberId: string) => {
  if (!file) {
    return { ok: true, uploaded: null } as const;
  }
  try {
    const uploaded = await uploadLibraryFile(file, memberId);
    return uploaded
      ? ({ ok: true, uploaded } as const)
      : ({
          ok: false,
          state: libraryFormError(
            "file",
            "O arquivo não passou na validação de conteúdo. Escolha outro arquivo."
          ),
        } as const);
  } catch {
    return {
      ok: false,
      state: libraryFormError(
        "file",
        "Não foi possível enviar o arquivo. Verifique o Storage e tente novamente."
      ),
    } as const;
  }
};

const deleteReplacedLibraryAsset = async (input: {
  readonly currentPath: string | null;
  readonly newPath: string | null;
  readonly hasExternalUrl: boolean;
}) => {
  if (
    input.currentPath &&
    ((input.newPath && input.currentPath !== input.newPath) ||
      (!input.newPath && input.hasExternalUrl))
  ) {
    await deleteMemberAsset(input.currentPath);
  }
};

const statusForSaveMode = (saveMode: "draft" | "publish" | null) => {
  if (saveMode === "publish") {
    return ContentStatus.PUBLISHED;
  }
  return saveMode === "draft" ? ContentStatus.DRAFT : null;
};

const savedLibraryState = (
  saveMode: "draft" | "publish" | null,
  fallback: { readonly message: string; readonly result: string }
) =>
  saveMode === "publish"
    ? libraryFormSuccess("material-publicado", "Material publicado.")
    : libraryFormSuccess(fallback.result, fallback.message);

const createLibraryItemRecord = async (
  formData: FormData
): Promise<LibraryItemFormState> => {
  const { userId } = await requireStaff();
  const fileEntry = formData.get("file");
  const hasUpload = fileEntry instanceof File && fileEntry.size > 0;
  if (
    shouldPauseStorageUploadDuringRollback({
      enabled: env.UPLOADS_PAUSED_FOR_ROLLBACK === "true",
      hasFile: hasUpload,
    })
  ) {
    return libraryFormError(
      "file",
      "O envio de arquivos está temporariamente pausado. Nenhuma alteração foi aplicada.",
      "upload-paused"
    );
  }

  await consumeMutationRateLimit({
    action: "library.mutation",
    memberId: userId,
  });
  const parsed = parseLibraryItemInput(formData, {
    requireIdempotencyKey: true,
    requireSource: true,
  });
  if (!parsed.ok) {
    return parsed.state;
  }
  const input = parsed.input;
  const {
    file,
    idempotencyKey: _idempotencyKey,
    saveMode,
    ...inputData
  } = input;
  const idempotencyKey = input.idempotencyKey as string;
  if (!(await libraryLessonExists(input.lessonId))) {
    return libraryFormError(
      "lessonId",
      "A aula relacionada não está disponível."
    );
  }

  const existingItem = await database.libraryItem.findUnique({
    where: {
      createdBy_idempotencyKey: { createdBy: userId, idempotencyKey },
    },
    select: { id: true },
  });
  if (existingItem) {
    revalidateStaffLibrary();
    return libraryFormSuccess(
      "material-existente",
      "Este material já tinha sido salvo; nenhum duplicado foi criado."
    );
  }

  const uploadResult = await tryUploadLibraryFile(file, userId);
  if (!uploadResult.ok) {
    return uploadResult.state;
  }
  const uploaded = uploadResult.uploaded;

  try {
    await database.libraryItem.create({
      data: {
        ...inputData,
        idempotencyKey,
        url: uploaded?.url ?? input.url ?? "",
        storagePath: uploaded?.path ?? null,
        mimeType: uploaded?.mimeType ?? null,
        sizeBytes: uploaded?.sizeBytes ?? null,
        lessonId: input.lessonId || null,
        status: statusForSaveMode(saveMode) ?? ContentStatus.DRAFT,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      if (uploaded?.path) {
        await deleteMemberAsset(uploaded.path);
      }
      throw error;
    }
    if (uploaded?.path) {
      await deleteMemberAsset(uploaded.path);
    }
    revalidateStaffLibrary();
    return libraryFormSuccess(
      "material-existente",
      "Uma referência equivalente já foi salva; nenhum duplicado foi criado."
    );
  }
  revalidateStaffLibrary();
  return savedLibraryState(saveMode, {
    message: "Material salvo como rascunho.",
    result: "material-criado",
  });
};

export const createGestaoLibraryItem = async (
  _previousState: LibraryItemFormState,
  formData: FormData
) => createLibraryItemRecord(formData);

export const createLibraryItem = async (formData: FormData) => {
  const result = await createLibraryItemRecord(formData);
  if (result.status === "success") {
    if (staffLibraryPath(formData) === "/gestao/ensino/biblioteca") {
      redirectToStaffLibrary(formData, {
        resultado: result.result ?? "material-criado",
      });
    }
    return;
  }
  if (result.result === "upload-paused") {
    redirectToStaffLibrary(formData, { uploadPaused: "1" });
  }
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
  revalidateStaffLibrary();
};

const updateLibraryItemRecord = async (
  formData: FormData
): Promise<LibraryItemFormState> => {
  const { userId } = await requireStaff();
  const id = value(formData.get("id"));
  if (!id) {
    return libraryFormError("id", "O material não foi identificado.");
  }
  const fileEntry = formData.get("file");
  const hasUpload = fileEntry instanceof File && fileEntry.size > 0;
  if (
    shouldPauseStorageUploadDuringRollback({
      enabled: env.UPLOADS_PAUSED_FOR_ROLLBACK === "true",
      hasFile: hasUpload,
    })
  ) {
    return libraryFormError(
      "file",
      "O envio de arquivos está temporariamente pausado. Nenhuma alteração foi aplicada.",
      "upload-paused"
    );
  }

  await consumeMutationRateLimit({
    action: "library.mutation",
    memberId: userId,
  });
  const parsed = parseLibraryItemInput(formData, {
    requireIdempotencyKey: false,
    requireSource: false,
  });
  if (!parsed.ok) {
    return parsed.state;
  }
  const input = parsed.input;
  const {
    file,
    idempotencyKey: _idempotencyKey,
    saveMode,
    ...inputData
  } = input;
  if (!(await libraryLessonExists(input.lessonId))) {
    return libraryFormError(
      "lessonId",
      "A aula relacionada não está disponível."
    );
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
    return libraryFormError("id", "Este material não está mais disponível.");
  }
  const uploadResult = await tryUploadLibraryFile(file, userId);
  if (!uploadResult.ok) {
    return uploadResult.state;
  }
  const uploaded = uploadResult.uploaded;
  const nextUrl = uploaded?.url ?? input.url ?? current.url;
  try {
    await database.libraryItem.update({
      where: { id },
      data: {
        ...inputData,
        url: nextUrl,
        storagePath: uploaded?.path ?? (input.url ? null : current.storagePath),
        mimeType: uploaded?.mimeType ?? (input.url ? null : current.mimeType),
        sizeBytes:
          uploaded?.sizeBytes ?? (input.url ? null : current.sizeBytes),
        lessonId: input.lessonId || null,
        ...(statusForSaveMode(saveMode)
          ? { status: statusForSaveMode(saveMode) as ContentStatus }
          : {}),
        updatedBy: userId,
      },
    });
  } catch (error) {
    if (uploaded?.path) {
      await deleteMemberAsset(uploaded.path);
    }
    throw error;
  }
  await deleteReplacedLibraryAsset({
    currentPath: current.storagePath,
    hasExternalUrl: Boolean(input.url),
    newPath: uploaded?.path ?? null,
  });
  revalidateStaffLibrary();
  revalidatePath(`/biblioteca/${id}`);
  return savedLibraryState(saveMode, {
    message: "Material atualizado.",
    result: "material-atualizado",
  });
};

export const updateGestaoLibraryItem = async (
  _previousState: LibraryItemFormState,
  formData: FormData
) => updateLibraryItemRecord(formData);

export const updateLibraryItem = async (formData: FormData) => {
  const result = await updateLibraryItemRecord(formData);
  if (result.status === "success") {
    if (staffLibraryPath(formData) === "/gestao/ensino/biblioteca") {
      redirectToStaffLibrary(formData, {
        resultado: result.result ?? "material-atualizado",
      });
    }
    return;
  }
  if (result.result === "upload-paused") {
    redirectToStaffLibrary(formData, { uploadPaused: "1" });
  }
};

export const importCuratedLibraryCatalog = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "library.catalog-import",
    memberId: userId,
  });

  const rows = libraryCatalog.map((reference) => ({
    ...reference,
    catalogKey: libraryCatalogKey(reference.url),
    language: normalizeLibraryLanguage(reference.language),
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

  revalidateStaffLibrary();
  redirectToStaffLibrary(formData, { catalog: "imported" });
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
  revalidatePath("/cursos");
  revalidatePath("/biblioteca");
  revalidatePath("/biblioteca/pessoal");
  revalidatePath("/salvos");
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
