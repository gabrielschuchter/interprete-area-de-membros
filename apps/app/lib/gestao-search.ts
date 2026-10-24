import "server-only";

import { database, type Prisma } from "@repo/database";
import { requireGestaoActor } from "./gestao-authorization";
import {
  getGestaoCorrectionCohortScope,
  getGestaoCorrectionRecipientScope,
} from "./gestao-correction-scope";

export type GestaoSearchGroupKey =
  | "students"
  | "cohorts"
  | "activities"
  | "courses"
  | "lessons"
  | "materials"
  | "notices"
  | "meetings";

export interface GestaoSearchResult {
  readonly href: string;
  readonly id: string;
  readonly meta: string;
  readonly title: string;
}

export interface GestaoSearchGroup {
  readonly key: GestaoSearchGroupKey;
  readonly label: string;
  readonly results: readonly GestaoSearchResult[];
}

const groupLabels: Record<GestaoSearchGroupKey, string> = {
  students: "Alunos",
  cohorts: "Turmas",
  activities: "Atividades",
  courses: "Cursos",
  lessons: "Aulas",
  materials: "Materiais",
  notices: "Avisos",
  meetings: "Encontros",
};

const perGroupLimit = 5;
export const gestaoSearchMinLength = 2;

const contains = (query: string) => ({
  contains: query,
  mode: "insensitive" as const,
});

const statusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

// Staff-wide search scoped like the Gestão lists: teachers only find students
// and cohorts they are responsible for; shared catalog entities stay visible
// to every staff member.
export const searchGestao = async (
  rawQuery: string
): Promise<readonly GestaoSearchGroup[]> => {
  const actor = await requireGestaoActor();
  const query = rawQuery.trim().slice(0, 120);
  if (query.length < gestaoSearchMinLength) {
    return [];
  }
  const cohortScope = getGestaoCorrectionCohortScope(actor);
  const studentScope: Prisma.MemberWhereInput = {
    AND: [
      getGestaoCorrectionRecipientScope(actor),
      {
        OR: [
          { displayName: contains(query) },
          { email: contains(query) },
          { profile: { is: { username: contains(query) } } },
        ],
      },
    ],
  };
  const [
    students,
    cohorts,
    activities,
    courses,
    lessons,
    materials,
    notices,
    meetings,
  ] = await Promise.all([
    database.member.findMany({
      where: studentScope,
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: perGroupLimit,
      select: { id: true, displayName: true, email: true },
    }),
    database.cohort.findMany({
      where: { AND: [cohortScope, { name: contains(query) }] },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: perGroupLimit,
      select: { id: true, name: true, startsAt: true },
    }),
    database.activity.findMany({
      where: { title: contains(query) },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: perGroupLimit,
      select: { id: true, title: true, status: true },
    }),
    database.course.findMany({
      where: { title: contains(query), experience: "ASYNC" },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: perGroupLimit,
      select: { id: true, title: true, status: true },
    }),
    database.lesson.findMany({
      where: {
        title: contains(query),
        module: { is: { course: { is: { experience: "ASYNC" } } } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: perGroupLimit,
      select: {
        id: true,
        title: true,
        status: true,
        module: { select: { course: { select: { id: true, title: true } } } },
      },
    }),
    database.libraryItem.findMany({
      where: {
        OR: [{ title: contains(query) }, { authors: contains(query) }],
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: perGroupLimit,
      select: { id: true, title: true, status: true },
    }),
    database.announcement.findMany({
      where: { title: contains(query), deletedAt: null },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: perGroupLimit,
      select: { id: true, title: true, status: true },
    }),
    database.meeting.findMany({
      where: { title: contains(query) },
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      take: perGroupLimit,
      select: { id: true, title: true, status: true, startsAt: true },
    }),
  ]);
  const dateFormat = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  const groups: GestaoSearchGroup[] = [
    {
      key: "students",
      label: groupLabels.students,
      results: students.map((student) => ({
        id: student.id,
        title: student.displayName ?? student.email ?? "Aluno sem nome",
        meta: student.email ?? "Aluno",
        href: `/gestao/alunos/perfil/${student.id}`,
      })),
    },
    {
      key: "cohorts",
      label: groupLabels.cohorts,
      results: cohorts.map((cohort) => ({
        id: cohort.id,
        title: cohort.name,
        meta: `Começa em ${dateFormat.format(cohort.startsAt)}`,
        href: `/gestao/alunos/turmas/${cohort.id}`,
      })),
    },
    {
      key: "activities",
      label: groupLabels.activities,
      results: activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        meta: statusLabel[activity.status] ?? activity.status,
        href: `/gestao/ensino/atividades/${activity.id}`,
      })),
    },
    {
      key: "courses",
      label: groupLabels.courses,
      results: courses.map((course) => ({
        id: course.id,
        title: course.title,
        meta: statusLabel[course.status] ?? course.status,
        href: `/gestao/ensino/cursos/${course.id}`,
      })),
    },
    {
      key: "lessons",
      label: groupLabels.lessons,
      results: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        meta: `${lesson.module.course.title} · ${statusLabel[lesson.status] ?? lesson.status}`,
        href: `/gestao/ensino/cursos/${lesson.module.course.id}/aulas/${lesson.id}`,
      })),
    },
    {
      key: "materials",
      label: groupLabels.materials,
      results: materials.map((material) => ({
        id: material.id,
        title: material.title,
        meta: statusLabel[material.status] ?? material.status,
        href: `/gestao/ensino/biblioteca/${material.id}`,
      })),
    },
    {
      key: "notices",
      label: groupLabels.notices,
      results: notices.map((notice) => ({
        id: notice.id,
        title: notice.title,
        meta: statusLabel[notice.status] ?? notice.status,
        href: "/gestao/comunidade/avisos",
      })),
    },
    {
      key: "meetings",
      label: groupLabels.meetings,
      results: meetings.map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        meta: `${dateFormat.format(meeting.startsAt)} · ${statusLabel[meeting.status] ?? meeting.status}`,
        href: "/gestao/comunidade/encontros",
      })),
    },
  ];
  return groups.filter((group) => group.results.length > 0);
};
