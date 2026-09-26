"use server";

import { randomUUID } from "node:crypto";
import {
  AccessPermission,
  AccessResourceType,
  ContentStatus,
  database,
  EnrollmentStatus,
  LessonKind,
  MemberRole,
  type Prisma,
  ResourceKind,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/authorization";
import { sanitizeRichDocument } from "@/lib/community-content";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";
import {
  notifyAnnouncement,
  notifyLessonAvailable,
  notifyModuleAvailable,
} from "@/lib/notifications";

const PARAGRAPH_SPLIT = /\r?\n\r?\n/;
const LIST_SPLIT = /[\n,]/;

const asText = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const asList = (value: FormDataEntryValue | null, limit = 20) =>
  typeof value === "string"
    ? [
        ...new Set(
          value
            .split(LIST_SPLIT)
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      ].slice(0, limit)
    : [];

const asPositiveInteger = (value: FormDataEntryValue | null) => {
  const parsed = Number(asText(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const asHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString().slice(0, 2000)
      : null;
  } catch {
    return null;
  }
};

const revalidateMemberSurfaces = (username?: string) => {
  revalidatePath("/admin/membros");
  revalidatePath("/membros");
  revalidatePath("/comunidade");
  revalidatePath("/perfil");
  if (username) {
    revalidatePath(`/membros/${username}`);
  }
};

const requireStaffMutation = async () => {
  const session = await requireStaff();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: session.userId,
  });
  return session;
};

const requireAdminMutation = async () => {
  const session = await requireAdmin();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: session.userId,
  });
  return session;
};

interface NotificationResource {
  readonly courseIds: string[];
  readonly lesson?: {
    readonly id: string;
    readonly module: {
      readonly course: { readonly slug: string };
      readonly id: string;
    };
    readonly slug: string;
    readonly title: string;
  };
  readonly module?: {
    readonly course: { readonly id: string; readonly slug: string };
    readonly id: string;
    readonly title: string;
  };
  readonly resourceIds: string[];
}

const loadNotificationResource = async (
  resourceType: AccessResourceType,
  resourceId: string
): Promise<NotificationResource | null> => {
  if (resourceType === AccessResourceType.COURSE) {
    const course = await database.course.findUnique({
      where: { id: resourceId },
      select: { id: true, status: true },
    });
    return course?.status === ContentStatus.PUBLISHED
      ? { courseIds: [course.id], resourceIds: [resourceId] }
      : null;
  }

  if (resourceType === AccessResourceType.MODULE) {
    const module = await database.module.findUnique({
      where: { id: resourceId },
      select: {
        id: true,
        title: true,
        status: true,
        course: { select: { id: true, slug: true, status: true } },
      },
    });
    if (
      !module ||
      module.status !== ContentStatus.PUBLISHED ||
      module.course.status !== ContentStatus.PUBLISHED
    ) {
      return null;
    }
    return {
      courseIds: [module.course.id],
      module: {
        course: { id: module.course.id, slug: module.course.slug },
        id: module.id,
        title: module.title,
      },
      resourceIds: [resourceId, module.id],
    };
  }

  if (resourceType === AccessResourceType.LESSON) {
    const lesson = await database.lesson.findUnique({
      where: { id: resourceId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        module: {
          select: {
            id: true,
            status: true,
            course: { select: { id: true, slug: true, status: true } },
          },
        },
      },
    });
    if (
      !lesson ||
      lesson.status !== ContentStatus.PUBLISHED ||
      lesson.module.status !== ContentStatus.PUBLISHED ||
      lesson.module.course.status !== ContentStatus.PUBLISHED
    ) {
      return null;
    }
    return {
      courseIds: [lesson.module.course.id],
      lesson: {
        id: lesson.id,
        module: {
          course: { slug: lesson.module.course.slug },
          id: lesson.module.id,
        },
        slug: lesson.slug,
        title: lesson.title,
      },
      resourceIds: [resourceId, lesson.id, lesson.module.id],
    };
  }

  return null;
};

const notifyAvailableMembers = async (
  resourceType: AccessResourceType,
  resourceId: string,
  actorId: string
) => {
  const resource = await loadNotificationResource(resourceType, resourceId);
  if (!resource) {
    return;
  }

  const accessGrants = await database.accessGrant.findMany({
    where: {
      OR: [
        { resourceType, resourceId: { in: resource.resourceIds } },
        {
          resourceType: AccessResourceType.COURSE,
          resourceId: { in: resource.courseIds },
        },
      ],
    },
    select: { memberId: true },
  });
  const enrollments = await database.enrollment.findMany({
    where: {
      courseId: { in: resource.courseIds },
      status: EnrollmentStatus.ACTIVE,
    },
    select: { memberId: true },
  });
  const memberIds = [
    ...new Set(
      [...accessGrants, ...enrollments].map(({ memberId }) => memberId)
    ),
  ];
  if (resource.module) {
    const module = resource.module;
    await Promise.all(
      memberIds.map((memberId) =>
        notifyModuleAvailable({
          recipientId: memberId,
          actorId,
          moduleId: module.id,
          moduleTitle: module.title,
          href: `/aprender/cursos/${module.course.slug}`,
        })
      )
    );
  }
  if (resource.lesson) {
    const lesson = resource.lesson;
    await Promise.all(
      memberIds.map((memberId) =>
        notifyLessonAvailable({
          recipientId: memberId,
          actorId,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          href: `/aprender/cursos/${lesson.module.course.slug}/${lesson.slug}`,
        })
      )
    );
  }
};

export const setMemberRole = async (formData: FormData) => {
  const { userId } = await requireAdminMutation();
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
  await requireAdminMutation();

  const memberId = asText(formData.get("memberId"));
  const resourceTypeValue = asText(formData.get("resourceType"));
  let resourceId = asText(formData.get("resourceId"));
  let normalizedResourceType = resourceTypeValue;
  const expiresAtValue = asText(formData.get("expiresAt"));

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
  const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;
  if (expiresAt && Number.isNaN(expiresAt.valueOf())) {
    return;
  }
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
    update: { permission: AccessPermission.VIEW, expiresAt },
    create: {
      memberId,
      resourceType,
      resourceId,
      permission: AccessPermission.VIEW,
      expiresAt,
    },
  });

  revalidatePath("/admin/acessos");
  revalidatePath("/aprender");
};

export const removeAccessGrant = async (formData: FormData) => {
  await requireAdminMutation();
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
  await requireStaffMutation();
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
  const { userId } = await requireStaffMutation();
  const title = asText(formData.get("title"));
  const subtitle = asText(formData.get("subtitle"));
  const slug = asText(formData.get("slug")).toLowerCase();
  const description = asText(formData.get("description"));
  const format = asText(formData.get("format"));
  const category = asText(formData.get("category"));
  const level = asText(formData.get("level"));
  const durationMinutes = asPositiveInteger(formData.get("durationMinutes"));
  const tags = asList(formData.get("tags"));
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
        subtitle: subtitle || null,
        slug,
        description: description || null,
        format: format || null,
        category: category || null,
        level: level || null,
        durationMinutes,
        tags,
        teacherId: userId,
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

const copySlug = (slug: string) =>
  `${slug}-copia-${Date.now().toString(36)}`.slice(0, 80);

export const duplicateCourse = async (formData: FormData) => {
  const { userId } = await requireStaffMutation();
  const courseId = asText(formData.get("courseId"));
  if (!courseId) {
    return;
  }
  const source = await database.course.findUnique({
    where: { id: courseId },
    select: {
      title: true,
      subtitle: true,
      description: true,
      coverUrl: true,
      format: true,
      category: true,
      level: true,
      durationMinutes: true,
      tags: true,
      learningPathId: true,
      modules: {
        orderBy: { position: "asc" },
        select: {
          title: true,
          slug: true,
          description: true,
          objectives: true,
          lessons: {
            orderBy: { position: "asc" },
            select: {
              title: true,
              slug: true,
              description: true,
              objectives: true,
              content: true,
              kind: true,
              resources: {
                orderBy: { position: "asc" },
                select: { title: true, kind: true, url: true, position: true },
              },
            },
          },
        },
      },
    },
  });
  if (!source) {
    return;
  }

  const copy = await database.$transaction(async (transaction) => {
    const lastCourse = await transaction.course.findFirst({
      where: { learningPathId: source.learningPathId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const course = await transaction.course.create({
      data: {
        title: `${source.title} (cópia)`,
        subtitle: source.subtitle,
        description: source.description,
        coverUrl: source.coverUrl,
        format: source.format,
        category: source.category,
        level: source.level,
        durationMinutes: source.durationMinutes,
        tags: source.tags,
        slug: copySlug(source.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
        learningPathId: source.learningPathId,
        position: (lastCourse?.position ?? -1) + 1,
        status: ContentStatus.DRAFT,
        createdBy: userId,
        updatedBy: userId,
      },
      select: { id: true },
    });

    for (const [moduleIndex, module] of source.modules.entries()) {
      const createdModule = await transaction.module.create({
        data: {
          courseId: course.id,
          title: module.title,
          slug: copySlug(module.slug),
          description: module.description,
          objectives: module.objectives,
          position: moduleIndex,
          status: ContentStatus.DRAFT,
        },
        select: { id: true },
      });
      for (const [lessonIndex, lesson] of module.lessons.entries()) {
        const createdLesson = await transaction.lesson.create({
          data: {
            moduleId: createdModule.id,
            title: lesson.title,
            slug: copySlug(lesson.slug),
            description: lesson.description,
            objectives: lesson.objectives,
            content: lesson.content as Prisma.InputJsonValue,
            kind: lesson.kind,
            position: lessonIndex,
            status: ContentStatus.DRAFT,
            createdBy: userId,
            updatedBy: userId,
          },
          select: { id: true },
        });
        if (lesson.resources.length > 0) {
          await transaction.lessonResource.createMany({
            data: lesson.resources.map((resource) => ({
              lessonId: createdLesson.id,
              title: resource.title,
              kind: resource.kind,
              url: resource.url,
              position: resource.position,
            })),
          });
        }
      }
    }
    return course;
  });

  revalidatePath("/admin/learning");
  redirect(`/admin/learning/courses/${copy.id}`);
};

export const createModule = async (formData: FormData) => {
  await requireStaffMutation();
  const courseId = asText(formData.get("courseId"));
  const title = asText(formData.get("title"));
  const slug = asText(formData.get("slug")).toLowerCase();
  const description = asText(formData.get("description"));
  const objectives = asList(formData.get("objectives"));

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
        description: description || null,
        objectives,
        position: (lastModule?.position ?? -1) + 1,
      },
    });
  });

  revalidatePath(`/admin/learning/courses/${courseId}`);
  revalidatePath("/aprender", "page");
};

export const duplicateModule = async (formData: FormData) => {
  const { userId } = await requireStaffMutation();
  const moduleId = asText(formData.get("moduleId"));
  if (!moduleId) {
    return;
  }
  const source = await database.module.findUnique({
    where: { id: moduleId },
    select: {
      courseId: true,
      title: true,
      slug: true,
      description: true,
      objectives: true,
      lessons: {
        orderBy: { position: "asc" },
        select: {
          title: true,
          slug: true,
          description: true,
          objectives: true,
          content: true,
          kind: true,
          resources: {
            orderBy: { position: "asc" },
            select: { title: true, kind: true, url: true, position: true },
          },
        },
      },
    },
  });
  if (!source) {
    return;
  }
  const copy = await database.$transaction(async (transaction) => {
    const lastModule = await transaction.module.findFirst({
      where: { courseId: source.courseId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const createdModule = await transaction.module.create({
      data: {
        courseId: source.courseId,
        title: `${source.title} (cópia)`,
        slug: copySlug(source.slug),
        description: source.description,
        objectives: source.objectives,
        position: (lastModule?.position ?? -1) + 1,
        status: ContentStatus.DRAFT,
      },
      select: { id: true },
    });
    for (const [lessonIndex, lesson] of source.lessons.entries()) {
      const createdLesson = await transaction.lesson.create({
        data: {
          moduleId: createdModule.id,
          title: lesson.title,
          slug: copySlug(lesson.slug),
          description: lesson.description,
          objectives: lesson.objectives,
          content: lesson.content as Prisma.InputJsonValue,
          kind: lesson.kind,
          position: lessonIndex,
          status: ContentStatus.DRAFT,
          createdBy: userId,
          updatedBy: userId,
        },
        select: { id: true },
      });
      await transaction.lessonResource.createMany({
        data: lesson.resources.map((resource) => ({
          lessonId: createdLesson.id,
          title: resource.title,
          kind: resource.kind,
          url: resource.url,
          position: resource.position,
        })),
      });
    }
    return createdModule;
  });
  revalidatePath(`/admin/learning/courses/${source.courseId}`);
  redirect(`/admin/learning/courses/${source.courseId}#module-${copy.id}`);
};

export const createLesson = async (formData: FormData) => {
  const { userId } = await requireStaffMutation();
  const moduleId = asText(formData.get("moduleId"));
  const title = asText(formData.get("title"));
  const slug = asText(formData.get("slug")).toLowerCase();
  const description = asText(formData.get("description"));
  const objectives = asList(formData.get("objectives"));
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
        objectives,
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

export const duplicateLesson = async (formData: FormData) => {
  const { userId } = await requireStaffMutation();
  const lessonId = asText(formData.get("lessonId"));
  if (!lessonId) {
    return;
  }
  const source = await database.lesson.findUnique({
    where: { id: lessonId },
    select: {
      moduleId: true,
      title: true,
      slug: true,
      description: true,
      objectives: true,
      content: true,
      kind: true,
      module: { select: { courseId: true } },
      resources: {
        orderBy: { position: "asc" },
        select: { title: true, kind: true, url: true, position: true },
      },
    },
  });
  if (!source) {
    return;
  }
  const copy = await database.$transaction(async (transaction) => {
    const lastLesson = await transaction.lesson.findFirst({
      where: { moduleId: source.moduleId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const createdLesson = await transaction.lesson.create({
      data: {
        moduleId: source.moduleId,
        title: `${source.title} (cópia)`,
        slug: copySlug(source.slug),
        description: source.description,
        objectives: source.objectives,
        content: source.content as Prisma.InputJsonValue,
        kind: source.kind,
        position: (lastLesson?.position ?? -1) + 1,
        status: ContentStatus.DRAFT,
        createdBy: userId,
        updatedBy: userId,
      },
      select: { id: true },
    });
    await transaction.lessonResource.createMany({
      data: source.resources.map((resource) => ({
        lessonId: createdLesson.id,
        title: resource.title,
        kind: resource.kind,
        url: resource.url,
        position: resource.position,
      })),
    });
    return createdLesson;
  });
  revalidatePath(`/admin/learning/courses/${source.module.courseId}`);
  redirect(
    `/admin/learning/courses/${source.module.courseId}#lesson-${copy.id}`
  );
};

export const updateLesson = async (formData: FormData) => {
  const { userId } = await requireStaffMutation();
  const lessonId = asText(formData.get("lessonId"));
  const title = asText(formData.get("title"));
  const slug = asText(formData.get("slug")).toLowerCase();
  const description = asText(formData.get("description"));
  const objectives = asList(formData.get("objectives"));
  const content =
    asText(formData.get("contentJson")) || asText(formData.get("content"));
  const kindValue = asText(formData.get("kind"));

  if (!(lessonId && title && slug && content)) {
    return;
  }
  const kind = Object.values(LessonKind).includes(kindValue as LessonKind)
    ? (kindValue as LessonKind)
    : LessonKind.TEXT;

  const lesson = await database.lesson.update({
    where: { id: lessonId },
    data: {
      title,
      slug,
      description: description || null,
      objectives,
      content: asContent(content),
      kind,
      updatedBy: userId,
    },
    select: { module: { select: { courseId: true } } },
  });

  revalidatePath(`/admin/learning/courses/${lesson.module.courseId}`);
};

export const updateLearningPath = async (formData: FormData) => {
  await requireStaffMutation();
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
  const { userId } = await requireStaffMutation();
  const courseId = asText(formData.get("courseId"));
  const title = asText(formData.get("title"));
  const subtitle = asText(formData.get("subtitle"));
  const slug = asText(formData.get("slug")).toLowerCase();
  const description = asText(formData.get("description"));
  const format = asText(formData.get("format"));
  const category = asText(formData.get("category"));
  const level = asText(formData.get("level"));
  const durationMinutes = asPositiveInteger(formData.get("durationMinutes"));
  const tags = asList(formData.get("tags"));

  if (!(courseId && title && slug)) {
    return;
  }

  await database.course.update({
    where: { id: courseId },
    data: {
      title,
      subtitle: subtitle || null,
      slug,
      description: description || null,
      format: format || null,
      category: category || null,
      level: level || null,
      durationMinutes,
      tags,
      updatedBy: userId,
    },
  });

  revalidatePath(`/admin/learning/courses/${courseId}`);
  revalidatePath(`/admin/learning/courses/${courseId}/preview`);
  revalidatePath("/admin/learning");
  revalidatePath("/aprender");
};

export const updateModule = async (formData: FormData) => {
  await requireStaffMutation();
  const moduleId = asText(formData.get("moduleId"));
  const title = asText(formData.get("title"));
  const slug = asText(formData.get("slug")).toLowerCase();
  const description = asText(formData.get("description"));
  const objectives = asList(formData.get("objectives"));

  if (!(moduleId && title && slug)) {
    return;
  }

  const module = await database.module.update({
    where: { id: moduleId },
    data: { title, slug, description: description || null, objectives },
    select: { courseId: true },
  });

  revalidatePath(`/admin/learning/courses/${module.courseId}`);
  revalidatePath("/aprender");
};

export const createLessonResource = async (formData: FormData) => {
  await requireStaffMutation();
  const lessonId = asText(formData.get("lessonId"));
  const title = asText(formData.get("title"));
  const kindValue = asText(formData.get("kind"));
  const url = asHttpUrl(asText(formData.get("url")));

  if (
    !(
      lessonId &&
      title &&
      url &&
      Object.values(ResourceKind).includes(kindValue as ResourceKind)
    )
  ) {
    return;
  }

  const lesson = await database.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });

  if (!lesson) {
    return;
  }

  const lastResource = await database.lessonResource.findFirst({
    where: { lessonId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await database.lessonResource.create({
    data: {
      lessonId,
      title,
      kind: kindValue as ResourceKind,
      url,
      position: (lastResource?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/admin/learning/courses/${lesson.module.courseId}`);
};

export const updateLessonResource = async (formData: FormData) => {
  await requireStaffMutation();
  const resourceId = asText(formData.get("resourceId"));
  const title = asText(formData.get("title"));
  const kindValue = asText(formData.get("kind"));
  const url = asHttpUrl(asText(formData.get("url")));

  if (
    !(
      resourceId &&
      title &&
      url &&
      Object.values(ResourceKind).includes(kindValue as ResourceKind)
    )
  ) {
    return;
  }

  const resource = await database.lessonResource.findUnique({
    where: { id: resourceId },
    select: {
      lesson: { select: { module: { select: { courseId: true } } } },
    },
  });
  if (!resource) {
    return;
  }

  await database.lessonResource.update({
    where: { id: resourceId },
    data: { title, kind: kindValue as ResourceKind, url },
  });

  revalidatePath(`/admin/learning/courses/${resource.lesson.module.courseId}`);
};

export const removeLessonResource = async (formData: FormData) => {
  await requireStaffMutation();
  const resourceId = asText(formData.get("resourceId"));
  if (!resourceId) {
    return;
  }

  const resource = await database.lessonResource.findUnique({
    where: { id: resourceId },
    select: { lesson: { select: { module: { select: { courseId: true } } } } },
  });

  if (!resource) {
    return;
  }

  await database.lessonResource.delete({ where: { id: resourceId } });
  revalidatePath(`/admin/learning/courses/${resource.lesson.module.courseId}`);
};

export const moveModule = async (formData: FormData) => {
  await requireStaffMutation();
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
  await requireStaffMutation();
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
  const { userId } = await requireStaffMutation();
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
    if (status === ContentStatus.PUBLISHED) {
      await notifyAvailableMembers(AccessResourceType.MODULE, id, userId);
    }
    revalidatePath(`/admin/learning/courses/${module.courseId}`);
    return;
  }

  if (entity === "lesson") {
    const lesson = await database.lesson.update({
      where: { id },
      data: { status, publishedAt, updatedBy: userId },
      select: { module: { select: { courseId: true } } },
    });
    if (status === ContentStatus.PUBLISHED) {
      await notifyAvailableMembers(AccessResourceType.LESSON, id, userId);
    }
    revalidatePath(`/admin/learning/courses/${lesson.module.courseId}`);
    revalidatePath("/aprender", "page");
  }
};

const announcementAudiences = ["ALL", "STAFF", "SELECTED"] as const;
type AnnouncementAudience = (typeof announcementAudiences)[number];

const isAnnouncementAudience = (value: string): value is AnnouncementAudience =>
  announcementAudiences.includes(value as AnnouncementAudience);

export const createAnnouncement = async (formData: FormData) => {
  const { userId } = await requireStaffMutation();
  const title = asText(formData.get("title")).slice(0, 180);
  const body = asText(formData.get("body")).slice(0, 10_000);
  const audienceValue = asText(formData.get("audience"));
  const href = asText(formData.get("href"));
  const recipientIds = asList(formData.get("recipientIds"), 200);

  if (!(title && body && isAnnouncementAudience(audienceValue))) {
    return;
  }

  const audience = audienceValue as AnnouncementAudience;
  let recipients: { id: string }[];
  if (audience === "ALL") {
    recipients = await database.member.findMany({ select: { id: true } });
  } else if (audience === "STAFF") {
    recipients = await database.member.findMany({
      where: { role: { in: [MemberRole.TEACHER, MemberRole.ADMIN] } },
      select: { id: true },
    });
  } else {
    recipients = await database.member.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true },
    });
  }

  if (recipients.length === 0) {
    return;
  }

  const announcementId = randomUUID();
  const safeHref = href.startsWith("/") ? href.slice(0, 500) : asHttpUrl(href);

  await Promise.all(
    recipients.map(({ id }) =>
      notifyAnnouncement({
        actorId: userId,
        announcementId,
        body,
        href: safeHref ?? undefined,
        recipientId: id,
        title,
      })
    )
  );

  revalidatePath("/admin/avisos");
};
