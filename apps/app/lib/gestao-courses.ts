import "server-only";

import {
  ContentStatus,
  CourseExperience,
  database,
  MemberRole,
  type Prisma,
} from "@repo/database";
import { collectionCoverPresets } from "./collection-covers";
import { requireGestaoAction } from "./gestao-authorization";
import {
  gestaoCourseStatusWhere,
  normalizeGestaoCourseFilters,
  resolveGestaoCourseState,
} from "./gestao-course-catalog";
import { memberAssetUrl } from "./member-storage";

const pageSize = 25;
const activeMemberships = {
  where: { status: "ACTIVE" as const, leftAt: null },
};

export const listGestaoCourses = async (input: {
  readonly page?: number;
  readonly pathId?: string;
  readonly query?: string;
  readonly status?: string;
  readonly view?: string;
}) => {
  const { actor } = await requireGestaoAction("content.manage");
  const filters = normalizeGestaoCourseFilters(input);
  const now = new Date();
  const baseWhere: Prisma.CourseWhereInput = {
    experience: CourseExperience.ASYNC,
    ...(filters.pathId !== "ALL" ? { learningPathId: filters.pathId } : {}),
    ...(filters.query
      ? { title: { contains: filters.query, mode: "insensitive" } }
      : {}),
  };
  const statusWhere = (status: typeof filters.status) =>
    gestaoCourseStatusWhere(status, now) as Prisma.CourseWhereInput;
  const accessWhere: Prisma.CohortCourseAccessWhereInput = {
    revokedAt: null,
    cohort: {
      is: {
        archivedAt: null,
        ...(actor.role === MemberRole.ADMIN
          ? {}
          : { teachers: { some: { memberId: actor.userId } } }),
      },
    },
  };
  const statuses = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
  const [totalCount, statusCountEntries, paths] = await Promise.all([
    database.course.count({
      where: { AND: [baseWhere, statusWhere(filters.status)] },
    }),
    Promise.all(
      statuses.map(
        async (status) =>
          [
            status,
            await database.course.count({
              where: { AND: [baseWhere, statusWhere(status)] },
            }),
          ] as const
      )
    ),
    database.learningPath.findMany({
      where: { courses: { some: { experience: CourseExperience.ASYNC } } },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        _count: {
          select: {
            courses: { where: { experience: CourseExperience.ASYNC } },
          },
        },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(filters.page, totalPages);
  const courses = await database.course.findMany({
    where: { AND: [baseWhere, statusWhere(filters.status)] },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      learningPath: { select: { id: true, title: true } },
      modules: { select: { _count: { select: { lessons: true } } } },
      cohortCourseAccesses: {
        where: accessWhere,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 3,
        select: {
          cohort: {
            select: {
              id: true,
              name: true,
              _count: { select: { memberships: activeMemberships } },
            },
          },
        },
      },
      _count: { select: { cohortCourseAccesses: { where: accessWhere } } },
    },
  });

  return {
    courses: courses.map((course) => ({
      id: course.id,
      title: course.title,
      slug: course.slug,
      state: resolveGestaoCourseState(course, now),
      updatedAt: course.updatedAt,
      path: course.learningPath,
      moduleCount: course.modules.length,
      lessonCount: course.modules.reduce(
        (total, module) => total + module._count.lessons,
        0
      ),
      cohorts: course.cohortCourseAccesses.map(({ cohort }) => ({
        id: cohort.id,
        name: cohort.name,
        studentCount: cohort._count.memberships,
      })),
      cohortCount: course._count.cohortCourseAccesses,
    })),
    page,
    pageSize,
    totalCount,
    totalPages,
    pathId: filters.pathId,
    query: filters.query,
    status: filters.status,
    view: filters.view,
    statusCounts: Object.fromEntries(statusCountEntries) as Record<
      (typeof statuses)[number],
      number
    >,
    paths: paths.map((path) => ({
      id: path.id,
      title: path.title,
      courseCount: path._count.courses,
    })),
  };
};

const learningPathPageSize = 24;
const learningPathStatuses = new Set<string>([
  "ALL",
  ContentStatus.DRAFT,
  ContentStatus.PUBLISHED,
  ContentStatus.ARCHIVED,
]);

export const listGestaoLearningPaths = async (input: {
  readonly page?: number;
  readonly query?: string;
  readonly status?: string;
}) => {
  await requireGestaoAction("content.manage");
  const query = (input.query ?? "").trim().slice(0, 120);
  const status = learningPathStatuses.has(input.status ?? "")
    ? (input.status ?? "ALL")
    : "ALL";
  const statusFilter =
    status === "ALL" ? {} : { status: status as ContentStatus };
  const where: Prisma.LearningPathWhereInput = {
    ...statusFilter,
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const totalCount = await database.learningPath.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / learningPathPageSize));
  const requestedPage = Number(input.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, totalPages)
      : 1;
  const paths = await database.learningPath.findMany({
    where,
    orderBy: [{ position: "asc" }, { title: "asc" }, { id: "asc" }],
    skip: (page - 1) * learningPathPageSize,
    take: learningPathPageSize,
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      status: true,
      updatedAt: true,
      _count: {
        select: {
          courses: { where: { experience: CourseExperience.ASYNC } },
        },
      },
    },
  });
  return {
    page,
    pageSize: learningPathPageSize,
    query,
    status,
    totalCount,
    totalPages,
    paths,
  };
};

export const gestaoLearningPathCoursePageSize = 25;
export const gestaoLearningPathCandidatePageSize = 8;

export const getGestaoLearningPathCoverOptions = async () => {
  await requireGestaoAction("content.manage");
  const files = await database.libraryItem.findMany({
    where: {
      status: ContentStatus.PUBLISHED,
      storagePath: { not: null },
      mimeType: { in: ["image/jpeg", "image/png", "image/webp"] },
    },
    orderBy: [{ title: "asc" }, { id: "asc" }],
    take: 50,
    select: { id: true, title: true, storagePath: true },
  });
  return [
    ...collectionCoverPresets.map((cover) => ({
      id: cover.value,
      label: cover.label,
      url: cover.value,
    })),
    ...files.flatMap((file) =>
      file.storagePath
        ? [
            {
              id: file.id,
              label: file.title,
              url: memberAssetUrl(file.storagePath),
            },
          ]
        : []
    ),
  ];
};

export const getGestaoLearningPath = async (
  pathId: string,
  requestedPage?: string,
  candidateQueryValue?: string,
  requestedCandidatePage?: string
) => {
  await requireGestaoAction("content.manage", { contentId: pathId });
  const candidateQuery = candidateQueryValue?.trim().slice(0, 100) ?? "";
  const candidateWhere: Prisma.CourseWhereInput = {
    learningPathId: null,
    experience: CourseExperience.ASYNC,
    ...(candidateQuery
      ? { title: { contains: candidateQuery, mode: "insensitive" } }
      : {}),
  };
  const [path, totalCourses, publishedCourseCount] = await Promise.all([
    database.learningPath.findUnique({
      where: { id: pathId },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        coverUrl: true,
        status: true,
        updatedAt: true,
      },
    }),
    database.course.count({
      where: { learningPathId: pathId, experience: CourseExperience.ASYNC },
    }),
    database.course.count({
      where: {
        learningPathId: pathId,
        experience: CourseExperience.ASYNC,
        status: ContentStatus.PUBLISHED,
      },
    }),
  ]);
  if (!path) {
    return null;
  }
  const totalPages = Math.max(
    1,
    Math.ceil(totalCourses / gestaoLearningPathCoursePageSize)
  );
  const requested = Number(requestedPage);
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, totalPages)
      : 1;
  const candidateTotal = await database.course.count({ where: candidateWhere });
  const candidateTotalPages = Math.max(
    1,
    Math.ceil(candidateTotal / gestaoLearningPathCandidatePageSize)
  );
  const requestedCandidates = Number(requestedCandidatePage);
  const candidatePage =
    Number.isSafeInteger(requestedCandidates) && requestedCandidates > 0
      ? Math.min(requestedCandidates, candidateTotalPages)
      : 1;
  const candidateCourses = await database.course.findMany({
    where: candidateWhere,
    orderBy: [{ title: "asc" }, { id: "asc" }],
    skip: (candidatePage - 1) * gestaoLearningPathCandidatePageSize,
    take: gestaoLearningPathCandidatePageSize,
    select: { id: true, title: true, status: true, updatedAt: true },
  });
  const courses = await database.course.findMany({
    where: {
      learningPathId: pathId,
      experience: CourseExperience.ASYNC,
    },
    orderBy: [{ position: "asc" }, { title: "asc" }, { id: "asc" }],
    skip: (page - 1) * gestaoLearningPathCoursePageSize,
    take: gestaoLearningPathCoursePageSize,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      position: true,
      updatedAt: true,
      modules: { select: { _count: { select: { lessons: true } } } },
    },
  });
  const [previousCourse, nextCourse] = await Promise.all([
    page > 1 && courses[0]
      ? database.course.findFirst({
          where: {
            learningPathId: pathId,
            experience: CourseExperience.ASYNC,
            position: { lt: courses[0].position },
          },
          orderBy: { position: "desc" },
          select: { id: true, updatedAt: true },
        })
      : null,
    page < totalPages && courses.at(-1)
      ? database.course.findFirst({
          where: {
            learningPathId: pathId,
            experience: CourseExperience.ASYNC,
            position: { gt: courses.at(-1)?.position ?? 0 },
          },
          orderBy: { position: "asc" },
          select: { id: true, updatedAt: true },
        })
      : null,
  ]);
  return {
    ...path,
    candidateCourses,
    candidatePage,
    candidatePageSize: gestaoLearningPathCandidatePageSize,
    candidateQuery,
    candidateTotal,
    candidateTotalPages,
    courses,
    nextCourse,
    page,
    pageSize: gestaoLearningPathCoursePageSize,
    publishedCourseCount,
    previousCourse,
    totalCourses,
    totalPages,
  };
};

export const gestaoCourseStateLabel: Record<
  "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED",
  string
> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};
