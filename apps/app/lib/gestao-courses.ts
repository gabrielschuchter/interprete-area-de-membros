import "server-only";

import {
  CourseExperience,
  database,
  MemberRole,
  type Prisma,
} from "@repo/database";
import { requireGestaoAction } from "./gestao-authorization";
import {
  gestaoCourseStatusWhere,
  normalizeGestaoCourseFilters,
  resolveGestaoCourseState,
} from "./gestao-course-catalog";

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

export const listGestaoLearningPaths = async () => {
  await requireGestaoAction("content.manage");
  return database.learningPath.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      status: true,
      updatedAt: true,
      courses: {
        where: { experience: CourseExperience.ASYNC },
        orderBy: [{ position: "asc" }, { title: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          modules: { select: { _count: { select: { lessons: true } } } },
        },
      },
    },
  });
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
