"use server";

import {
  ContentStatus,
  database,
  LessonKind,
  type Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/authorization";

const PARAGRAPH_SPLIT = /\r?\n\r?\n/;

const asText = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const asContent = (value: string): Prisma.InputJsonValue => {
  if (value) {
    try {
      const parsed: unknown = JSON.parse(value);

      if (parsed && typeof parsed === "object") {
        return parsed as Prisma.InputJsonValue;
      }
    } catch {
      // Plain text is deliberately converted to a safe document below.
    }
  }

  return {
    type: "doc",
    content: value
      .split(PARAGRAPH_SPLIT)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => ({
        type: "paragraph",
        content: [{ type: "text", text: paragraph }],
      })),
  };
};

export const createLearningPath = async (formData: FormData) => {
  await requireStaff();
  const title = asText(formData.get("title"));
  const slug = asText(formData.get("slug")).toLowerCase();
  const description = asText(formData.get("description"));

  if (!(title && slug)) {
    return;
  }

  await database.learningPath.create({
    data: {
      title,
      slug,
      description: description || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  revalidatePath("/admin/learning");
  revalidatePath("/aprender");
};

export const createCourse = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const title = asText(formData.get("title"));
  const slug = asText(formData.get("slug")).toLowerCase();
  const description = asText(formData.get("description"));
  const learningPathId = asText(formData.get("learningPathId"));

  if (!(title && slug)) {
    return;
  }

  const course = await database.course.create({
    data: {
      title,
      slug,
      description: description || null,
      learningPathId: learningPathId || null,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  revalidatePath("/admin/learning");
  redirect(`/admin/learning/courses/${course.id}`);
};

export const createModule = async (formData: FormData) => {
  await requireStaff();
  const courseId = asText(formData.get("courseId"));
  const title = asText(formData.get("title"));
  const slug = asText(formData.get("slug")).toLowerCase();

  if (!(courseId && title && slug)) {
    return;
  }

  await database.module.create({
    data: {
      courseId,
      title,
      slug,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  revalidatePath(`/admin/learning/courses/${courseId}`);
  revalidatePath("/aprender", "page");
};

export const createLesson = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const moduleId = asText(formData.get("moduleId"));
  const title = asText(formData.get("title"));
  const slug = asText(formData.get("slug")).toLowerCase();
  const description = asText(formData.get("description"));
  const content = asText(formData.get("content"));
  const kind = asText(formData.get("kind"));

  if (!(moduleId && title && slug && content)) {
    return;
  }

  const selectedKind = Object.values(LessonKind).includes(kind as LessonKind)
    ? (kind as LessonKind)
    : LessonKind.TEXT;

  const lesson = await database.lesson.create({
    data: {
      moduleId,
      title,
      slug,
      description: description || null,
      content: asContent(content),
      kind: selectedKind,
      createdBy: userId,
      updatedBy: userId,
    },
    select: { module: { select: { courseId: true } } },
  });

  revalidatePath(`/admin/learning/courses/${lesson.module.courseId}`);
};

export const updateLesson = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const lessonId = asText(formData.get("lessonId"));
  const title = asText(formData.get("title"));
  const description = asText(formData.get("description"));
  const content = asText(formData.get("content"));

  if (!(lessonId && title && content)) {
    return;
  }

  const lesson = await database.lesson.update({
    where: { id: lessonId },
    data: {
      title,
      description: description || null,
      content: asContent(content),
      updatedBy: userId,
    },
    select: { module: { select: { courseId: true } } },
  });

  revalidatePath(`/admin/learning/courses/${lesson.module.courseId}`);
};

export const setContentStatus = async (formData: FormData) => {
  await requireStaff();
  const entity = asText(formData.get("entity"));
  const id = asText(formData.get("id"));
  const nextStatus = asText(formData.get("status"));

  if (
    !(id && Object.values(ContentStatus).includes(nextStatus as ContentStatus))
  ) {
    return;
  }

  const status = nextStatus as ContentStatus;
  const publishedAt = status === ContentStatus.PUBLISHED ? new Date() : null;

  if (entity === "path") {
    await database.learningPath.update({
      where: { id },
      data: { status, publishedAt },
    });
    revalidatePath("/admin/learning");
    revalidatePath("/aprender");
    return;
  }

  if (entity === "course") {
    await database.course.update({
      where: { id },
      data: { status, publishedAt },
    });
    revalidatePath("/admin/learning");
    revalidatePath(`/admin/learning/courses/${id}`);
    revalidatePath("/aprender");
    return;
  }

  if (entity === "module") {
    const module = await database.module.update({
      where: { id },
      data: { status },
      select: { courseId: true },
    });
    revalidatePath(`/admin/learning/courses/${module.courseId}`);
    return;
  }

  if (entity === "lesson") {
    const lesson = await database.lesson.update({
      where: { id },
      data: { status, publishedAt },
      select: { module: { select: { courseId: true } } },
    });
    revalidatePath(`/admin/learning/courses/${lesson.module.courseId}`);
    revalidatePath("/aprender", "page");
  }
};
