"use server";

import {
  AccessPermission,
  AccessResourceType,
  ContentStatus,
  database,
  LessonKind,
  MemberRole,
  type Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/authorization";
import { sanitizeRichDocument } from "@/lib/community-content";

const PARAGRAPH_SPLIT = /\r?\n\r?\n/;

const asText = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const revalidateMemberSurfaces = (username?: string) => {
  revalidatePath("/admin/membros");
  revalidatePath("/membros");
  revalidatePath("/comunidade");
  revalidatePath("/perfil");
  if (username) {
    revalidatePath(`/membros/${username}`);
  }
};

export const setMemberRole = async (formData: FormData) => {
  const { userId } = await requireAdmin();
  const memberId = asText(formData.get("memberId"));
  const nextRole = asText(formData.get("role"));

  if (
    !(memberId && Object.values(MemberRole).includes(nextRole as MemberRole))
  ) {
    return;
  }

  if (memberId === userId && nextRole !== MemberRole.ADMIN) {
    const adminCount = await database.member.count({
      where: { role: MemberRole.ADMIN },
    });

    if (adminCount <= 1) {
      return;
    }
  }

  const member = await database.member.update({
    where: { id: memberId },
    data: { role: nextRole as MemberRole },
    select: { profile: { select: { username: true } } },
  });

  revalidateMemberSurfaces(member.profile?.username);
};

const isAccessResourceType = (value: string): value is AccessResourceType =>
  Object.values(AccessResourceType).includes(value as AccessResourceType);

const resourceExists = async (
  resourceType: AccessResourceType,
  resourceId: string
) => {
  switch (resourceType) {
    case AccessResourceType.COURSE:
      return Boolean(
        await database.course.findUnique({
          where: { id: resourceId },
          select: { id: true },
        })
      );
    case AccessResourceType.MODULE:
      return Boolean(
        await database.module.findUnique({
          where: { id: resourceId },
          select: { id: true },
        })
      );
    case AccessResourceType.LESSON:
      return Boolean(
        await database.lesson.findUnique({
          where: { id: resourceId },
          select: { id: true },
        })
      );
    case AccessResourceType.ASSET:
      return Boolean(
        await database.lessonAsset.findUnique({
          where: { id: resourceId },
          select: { id: true },
        })
      );
    default:
      return false;
  }
};

export const setAccessGrant = async (formData: FormData) => {
  await requireAdmin();

  const memberId = asText(formData.get("memberId"));
  const resourceTypeValue = asText(formData.get("resourceType"));
  let resourceId = asText(formData.get("resourceId"));
  let normalizedResourceType = resourceTypeValue;

  if (!normalizedResourceType && resourceId.includes(":")) {
    const separator = resourceId.indexOf(":");
    normalizedResourceType = resourceId.slice(0, separator);
    resourceId = resourceId.slice(separator + 1);
  }

  if (
    !(memberId && resourceId && isAccessResourceType(normalizedResourceType))
  ) {
    return;
  }

  const resourceType = normalizedResourceType as AccessResourceType;
  const [member, exists] = await Promise.all([
    database.member.findUnique({
      where: { id: memberId },
      select: { id: true },
    }),
    resourceExists(resourceType, resourceId),
  ]);

  if (!(member && exists)) {
    return;
  }

  await database.accessGrant.upsert({
    where: {
      memberId_resourceType_resourceId: {
        memberId,
        resourceType,
        resourceId,
      },
    },
    update: { permission: AccessPermission.VIEW },
    create: {
      memberId,
      resourceType,
      resourceId,
      permission: AccessPermission.VIEW,
    },
  });

  revalidatePath("/admin/acessos");
  revalidatePath("/aprender");
};

export const removeAccessGrant = async (formData: FormData) => {
  await requireAdmin();
  const grantId = asText(formData.get("grantId"));

  if (!grantId) {
    return;
  }

  await database.accessGrant.deleteMany({ where: { id: grantId } });
  revalidatePath("/admin/acessos");
  revalidatePath("/aprender");
};

const asContent = (value: string): Prisma.InputJsonValue => {
  if (value) {
    try {
      const parsed: unknown = JSON.parse(value);
      const sanitized = sanitizeRichDocument(parsed);

      if (sanitized) {
        return sanitized as Prisma.InputJsonValue;
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

  await database.$transaction(async (transaction) => {
    const lastPath = await transaction.learningPath.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await transaction.learningPath.create({
      data: {
        title,
        slug,
        description: description || null,
        position: (lastPath?.position ?? -1) + 1,
      },
    });
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

  const course = await database.$transaction(async (transaction) => {
    const lastCourse = await transaction.course.findFirst({
      where: { learningPathId: learningPathId || null },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    return transaction.course.create({
      data: {
        title,
        slug,
        description: description || null,
        learningPathId: learningPathId || null,
        position: (lastCourse?.position ?? -1) + 1,
        createdBy: userId,
        updatedBy: userId,
      },
    });
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

  await database.$transaction(async (transaction) => {
    const lastModule = await transaction.module.findFirst({
      where: { courseId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await transaction.module.create({
      data: {
        courseId,
        title,
        slug,
        position: (lastModule?.position ?? -1) + 1,
      },
    });
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
  const content =
    asText(formData.get("contentJson")) || asText(formData.get("content"));
  const kind = asText(formData.get("kind"));

  if (!(moduleId && title && slug && content)) {
    return;
  }

  const selectedKind = Object.values(LessonKind).includes(kind as LessonKind)
    ? (kind as LessonKind)
    : LessonKind.TEXT;

  const lesson = await database.$transaction(async (transaction) => {
    const lastLesson = await transaction.lesson.findFirst({
      where: { moduleId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    return transaction.lesson.create({
      data: {
        moduleId,
        title,
        slug,
        description: description || null,
        content: asContent(content),
        kind: selectedKind,
        position: (lastLesson?.position ?? -1) + 1,
        createdBy: userId,
        updatedBy: userId,
      },
      select: { module: { select: { courseId: true } } },
    });
  });

  revalidatePath(`/admin/learning/courses/${lesson.module.courseId}`);
};

export const updateLesson = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const lessonId = asText(formData.get("lessonId"));
  const title = asText(formData.get("title"));
  const description = asText(formData.get("description"));
  const content =
    asText(formData.get("contentJson")) || asText(formData.get("content"));

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

export const updateLearningPath = async (formData: FormData) => {
  await requireStaff();
  const pathId = asText(formData.get("pathId"));
  const title = asText(formData.get("title"));
  const slug = asText(formData.get("slug")).toLowerCase();
  const description = asText(formData.get("description"));

  if (!(pathId && title && slug)) {
    return;
  }

  await database.learningPath.update({
    where: { id: pathId },
    data: { title, slug, description: description || null },
  });

  revalidatePath("/admin/learning");
  revalidatePath("/aprender");
};

export const updateCourse = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const courseId = asText(formData.get("courseId"));
  const title = asText(formData.get("title"));
  const slug = asText(formData.get("slug")).toLowerCase();
  const description = asText(formData.get("description"));

  if (!(courseId && title && slug)) {
    return;
  }

  await database.course.update({
    where: { id: courseId },
    data: {
      title,
      slug,
      description: description || null,
      updatedBy: userId,
    },
  });

  revalidatePath(`/admin/learning/courses/${courseId}`);
  revalidatePath(`/admin/learning/courses/${courseId}/preview`);
  revalidatePath("/admin/learning");
  revalidatePath("/aprender");
};

export const updateModule = async (formData: FormData) => {
  await requireStaff();
  const moduleId = asText(formData.get("moduleId"));
  const title = asText(formData.get("title"));
  const slug = asText(formData.get("slug")).toLowerCase();

  if (!(moduleId && title && slug)) {
    return;
  }

  const module = await database.module.update({
    where: { id: moduleId },
    data: { title, slug },
    select: { courseId: true },
  });

  revalidatePath(`/admin/learning/courses/${module.courseId}`);
  revalidatePath("/aprender");
};

export const moveModule = async (formData: FormData) => {
  await requireStaff();
  const moduleId = asText(formData.get("moduleId"));
  const direction = asText(formData.get("direction")) === "up" ? -1 : 1;

  if (!moduleId) {
    return;
  }

  const module = await database.module.findUnique({
    where: { id: moduleId },
    select: { courseId: true, position: true },
  });

  if (!module) {
    return;
  }

  const neighbor = await database.module.findFirst({
    where: { courseId: module.courseId, position: module.position + direction },
    select: { id: true, position: true },
  });

  if (!neighbor) {
    return;
  }

  await database.$transaction(async (transaction) => {
    await transaction.module.update({
      where: { id: moduleId },
      data: { position: -1 },
    });
    await transaction.module.update({
      where: { id: neighbor.id },
      data: { position: module.position },
    });
    await transaction.module.update({
      where: { id: moduleId },
      data: { position: neighbor.position },
    });
  });

  revalidatePath(`/admin/learning/courses/${module.courseId}`);
  revalidatePath("/aprender");
};

export const moveLesson = async (formData: FormData) => {
  await requireStaff();
  const lessonId = asText(formData.get("lessonId"));
  const direction = asText(formData.get("direction")) === "up" ? -1 : 1;

  if (!lessonId) {
    return;
  }

  const lesson = await database.lesson.findUnique({
    where: { id: lessonId },
    select: {
      moduleId: true,
      position: true,
      module: { select: { courseId: true } },
    },
  });

  if (!lesson) {
    return;
  }

  const neighbor = await database.lesson.findFirst({
    where: { moduleId: lesson.moduleId, position: lesson.position + direction },
    select: { id: true, position: true },
  });

  if (!neighbor) {
    return;
  }

  await database.$transaction(async (transaction) => {
    await transaction.lesson.update({
      where: { id: lessonId },
      data: { position: -1 },
    });
    await transaction.lesson.update({
      where: { id: neighbor.id },
      data: { position: lesson.position },
    });
    await transaction.lesson.update({
      where: { id: lessonId },
      data: { position: neighbor.position },
    });
  });

  revalidatePath(`/admin/learning/courses/${lesson.module.courseId}`);
  revalidatePath("/aprender");
};

export const setContentStatus = async (formData: FormData) => {
  const { userId } = await requireStaff();
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
      data: { status, publishedAt, updatedBy: userId },
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
      data: { status, publishedAt, updatedBy: userId },
      select: { module: { select: { courseId: true } } },
    });
    revalidatePath(`/admin/learning/courses/${lesson.module.courseId}`);
    revalidatePath("/aprender", "page");
  }
};
