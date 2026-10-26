"use server";

import { ContentStatus, database, LessonKind } from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";
import {
  duplicateCourse,
  duplicateLesson,
  duplicateModule,
  moveLesson,
  moveModule,
  setContentStatus,
  setGestaoLessonStatus,
  updateCourse,
} from "../../../../admin/actions";

export type StructureResult =
  | { readonly ok: true; readonly lessonId?: string }
  | { readonly ok: false; readonly message: string };

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "item";

const emptyDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const refresh = (courseId: string) => {
  revalidatePath(`/gestao/ensino/cursos/${courseId}`);
  revalidatePath(`/gestao/ensino/cursos/${courseId}/turmas`);
  revalidatePath(`/gestao/ensino/cursos/${courseId}/configuracoes`);
  revalidatePath(`/gestao/ensino/cursos/${courseId}/publicacao`);
  revalidatePath("/gestao/ensino/cursos");
  revalidatePath("/cursos");
};

const authorizeCourse = async (courseId: string) => {
  const { actor } = await requireGestaoAction("content.manage", {
    contentId: courseId,
  });
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  return actor;
};

const courseOfModule = async (moduleId: string) => {
  const found = await database.module.findUnique({
    where: { id: moduleId },
    select: { courseId: true },
  });
  return found?.courseId ?? null;
};

const courseOfLesson = async (lessonId: string) => {
  const found = await database.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  return found?.module.courseId ?? null;
};

const uniqueSlug = (base: string, taken: readonly string[]) => {
  if (!taken.includes(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.includes(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};

export const addGestaoModule = async (
  formData: FormData
): Promise<StructureResult> => {
  const courseId = text(formData.get("courseId"));
  const title = text(formData.get("title")).slice(0, 160);
  if (!(courseId && title)) {
    return { ok: false, message: "Informe o título do módulo." };
  }
  const actor = await authorizeCourse(courseId);
  const course = await database.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    return { ok: false, message: "Curso não encontrado." };
  }
  const created = await database.$transaction(async (transaction) => {
    const existing = await transaction.module.findMany({
      where: { courseId },
      orderBy: { position: "desc" },
      select: { position: true, slug: true },
    });
    return transaction.module.create({
      data: {
        courseId,
        title,
        slug: uniqueSlug(
          slugify(title),
          existing.map((item) => item.slug)
        ),
        position: (existing[0]?.position ?? -1) + 1,
      },
      select: { id: true },
    });
  });
  await recordAuditEvent({
    eventType: "gestao.module.created",
    actorId: actor.userId,
    aggregateType: "Module",
    aggregateId: created.id,
    payload: { courseId, moduleId: created.id },
  });
  refresh(courseId);
  return { ok: true };
};

const lessonKindOf = (value: string) =>
  Object.values(LessonKind).includes(value as LessonKind)
    ? (value as LessonKind)
    : LessonKind.VIDEO;

export const addGestaoLesson = async (
  formData: FormData
): Promise<StructureResult> => {
  const moduleId = text(formData.get("moduleId"));
  const title = text(formData.get("title")).slice(0, 180);
  if (!(moduleId && title)) {
    return { ok: false, message: "Informe o título da aula." };
  }
  const courseId = await courseOfModule(moduleId);
  if (!courseId) {
    return { ok: false, message: "Módulo não encontrado." };
  }
  const actor = await authorizeCourse(courseId);
  const created = await database.$transaction(async (transaction) => {
    const existing = await transaction.lesson.findMany({
      where: { moduleId },
      orderBy: { position: "desc" },
      select: { position: true, slug: true },
    });
    return transaction.lesson.create({
      data: {
        moduleId,
        title,
        slug: uniqueSlug(
          slugify(title),
          existing.map((item) => item.slug)
        ),
        content: emptyDocument,
        kind: lessonKindOf(text(formData.get("kind"))),
        position: (existing[0]?.position ?? -1) + 1,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
      select: { id: true },
    });
  });
  await recordAuditEvent({
    eventType: "gestao.lesson.created",
    actorId: actor.userId,
    aggregateType: "Lesson",
    aggregateId: created.id,
    payload: { courseId, lessonId: created.id, moduleId },
  });
  refresh(courseId);
  return { ok: true, lessonId: created.id };
};

export const renameGestaoModule = async (
  formData: FormData
): Promise<StructureResult> => {
  const moduleId = text(formData.get("moduleId"));
  const title = text(formData.get("title")).slice(0, 160);
  const description = text(formData.get("description")).slice(0, 600);
  if (!(moduleId && title)) {
    return { ok: false, message: "Informe o título do módulo." };
  }
  const courseId = await courseOfModule(moduleId);
  if (!courseId) {
    return { ok: false, message: "Módulo não encontrado." };
  }
  const actor = await authorizeCourse(courseId);
  await database.module.update({
    where: { id: moduleId },
    data: { title, description: description || null },
  });
  await recordAuditEvent({
    eventType: "gestao.module.updated",
    actorId: actor.userId,
    aggregateType: "Module",
    aggregateId: moduleId,
    payload: { courseId, moduleId },
  });
  refresh(courseId);
  return { ok: true };
};

export const moveGestaoItem = async (
  formData: FormData
): Promise<StructureResult> => {
  const kind = text(formData.get("kind"));
  const id = text(formData.get("id"));
  const courseId =
    kind === "module" ? await courseOfModule(id) : await courseOfLesson(id);
  if (!courseId) {
    return { ok: false, message: "Item não encontrado." };
  }
  await authorizeCourse(courseId);
  const legacy = new FormData();
  legacy.set(kind === "module" ? "moduleId" : "lessonId", id);
  legacy.set("direction", text(formData.get("direction")));
  await (kind === "module" ? moveModule(legacy) : moveLesson(legacy));
  refresh(courseId);
  return { ok: true };
};

export const duplicateGestaoItem = async (
  formData: FormData
): Promise<StructureResult> => {
  const kind = text(formData.get("kind"));
  const id = text(formData.get("id"));
  const courseId =
    kind === "module" ? await courseOfModule(id) : await courseOfLesson(id);
  if (!courseId) {
    return { ok: false, message: "Item não encontrado." };
  }
  await authorizeCourse(courseId);
  const legacy = new FormData();
  legacy.set(kind === "module" ? "moduleId" : "lessonId", id);
  await (kind === "module" ? duplicateModule(legacy) : duplicateLesson(legacy));
  refresh(courseId);
  return { ok: true };
};

export const setGestaoModuleStatus = async (
  formData: FormData
): Promise<StructureResult> => {
  const moduleId = text(formData.get("id"));
  const status = text(formData.get("status"));
  if (status !== ContentStatus.PUBLISHED && status !== ContentStatus.ARCHIVED) {
    return { ok: false, message: "Estado inválido." };
  }
  const courseId = await courseOfModule(moduleId);
  if (!courseId) {
    return { ok: false, message: "Módulo não encontrado." };
  }
  await authorizeCourse(courseId);
  const legacy = new FormData();
  legacy.set("entity", "module");
  legacy.set("id", moduleId);
  legacy.set("status", status);
  await setContentStatus(legacy);
  refresh(courseId);
  return { ok: true };
};

export const setGestaoLessonState = async (
  formData: FormData
): Promise<StructureResult> => {
  const lessonId = text(formData.get("id"));
  const courseId = await courseOfLesson(lessonId);
  if (!courseId) {
    return { ok: false, message: "Aula não encontrada." };
  }
  await authorizeCourse(courseId);
  const lesson = await database.lesson.findUnique({
    where: { id: lessonId },
    select: { updatedAt: true },
  });
  if (!lesson) {
    return { ok: false, message: "Aula não encontrada." };
  }
  const forward = new FormData();
  forward.set("lessonId", lessonId);
  forward.set("status", text(formData.get("status")));
  forward.set("expectedUpdatedAt", lesson.updatedAt.toISOString());
  forward.set("idempotencyKey", crypto.randomUUID());
  const result = await setGestaoLessonStatus(
    { message: "", status: "blocked", idempotencyKey: crypto.randomUUID() },
    forward
  );
  refresh(courseId);
  return result.status === "saved"
    ? { ok: true }
    : { ok: false, message: result.message };
};

export const setGestaoCourseState = async (
  formData: FormData
): Promise<StructureResult> => {
  const courseId = text(formData.get("id"));
  const status = text(formData.get("status"));
  if (
    !courseId ||
    (status !== ContentStatus.PUBLISHED &&
      status !== ContentStatus.ARCHIVED &&
      status !== ContentStatus.DRAFT)
  ) {
    return { ok: false, message: "Estado inválido." };
  }
  await authorizeCourse(courseId);
  const legacy = new FormData();
  legacy.set("entity", "course");
  legacy.set("id", courseId);
  legacy.set("status", status);
  await setContentStatus(legacy);
  refresh(courseId);
  return { ok: true };
};

export const duplicateGestaoCourse = async (formData: FormData) => {
  const courseId = text(formData.get("courseId"));
  await authorizeCourse(courseId);
  const legacy = new FormData();
  legacy.set("courseId", courseId);
  legacy.set("gestaoReturn", "GESTAO");
  await duplicateCourse(legacy);
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const httpUrl = (value: string) => {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

export const saveGestaoCourseSettings = async (formData: FormData) => {
  const courseId = text(formData.get("courseId"));
  const actor = await authorizeCourse(courseId);
  const back = `/gestao/ensino/cursos/${courseId}/configuracoes`;
  const cover = httpUrl(text(formData.get("coverUrl")));
  const slug = text(formData.get("slug")).toLowerCase();
  if (!(text(formData.get("title")) && slugPattern.test(slug))) {
    redirect(`${back}?erro=dados`);
  }
  if (cover === undefined) {
    redirect(`${back}?erro=capa`);
  }
  const taken = await database.course.findFirst({
    where: { slug, NOT: { id: courseId } },
    select: { id: true },
  });
  if (taken) {
    redirect(`${back}?erro=endereco`);
  }
  await updateCourse(formData);
  await database.course.update({
    where: { id: courseId },
    data: { coverUrl: cover },
  });
  await recordAuditEvent({
    eventType: "gestao.course.updated",
    actorId: actor.userId,
    aggregateType: "Course",
    aggregateId: courseId,
    payload: { courseId },
  });
  refresh(courseId);
  redirect(`${back}?salvo=1`);
};

export const reorderGestaoItems = async (
  formData: FormData
): Promise<StructureResult> => {
  const kind = text(formData.get("kind"));
  const parentId = text(formData.get("parentId"));
  const ids = text(formData.get("ids"))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!(parentId && ids.length > 1) || new Set(ids).size !== ids.length) {
    return { ok: false, message: "Ordem inválida." };
  }
  const courseId =
    kind === "module"
      ? parentId
      : ((
          await database.module.findUnique({
            where: { id: parentId },
            select: { courseId: true },
          })
        )?.courseId ?? null);
  if (!courseId) {
    return { ok: false, message: "Item não encontrado." };
  }
  const actor = await authorizeCourse(courseId);
  const reordered = await database.$transaction(async (transaction) => {
    const current =
      kind === "module"
        ? await transaction.module.findMany({
            where: { courseId: parentId },
            select: { id: true },
          })
        : await transaction.lesson.findMany({
            where: { moduleId: parentId },
            select: { id: true },
          });
    const known = new Set(current.map((item) => item.id));
    if (known.size !== ids.length || ids.some((id) => !known.has(id))) {
      return false;
    }
    // A restrição única (pai, posição) exige duas fases: posições negativas e depois as finais.
    for (const [index, id] of ids.entries()) {
      const data = { position: -(index + 1) };
      if (kind === "module") {
        await transaction.module.update({ where: { id }, data });
      } else {
        await transaction.lesson.update({ where: { id }, data });
      }
    }
    for (const [index, id] of ids.entries()) {
      const data = { position: index };
      if (kind === "module") {
        await transaction.module.update({ where: { id }, data });
      } else {
        await transaction.lesson.update({ where: { id }, data });
      }
    }
    return true;
  });
  if (!reordered) {
    return { ok: false, message: "A lista mudou. Recarregue a página." };
  }
  await recordAuditEvent({
    eventType: `gestao.${kind}.reordered`,
    actorId: actor.userId,
    aggregateType: kind === "module" ? "Course" : "Module",
    aggregateId: parentId,
    payload: { courseId, parentId, ids },
  });
  refresh(courseId);
  return { ok: true };
};
