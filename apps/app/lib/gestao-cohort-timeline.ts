import "server-only";
import { database } from "@repo/database";
import { requireGestaoCohortActor } from "./gestao-authorization";

export type TimelineKind = "lesson" | "course" | "activity" | "meeting";
export type TimelineStatus =
  | "released"
  | "scheduled"
  | "open"
  | "closed"
  | "draft";

export interface TimelineItem {
  readonly at: Date;
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly kind: TimelineKind;
  readonly status: TimelineStatus;
  readonly title: string;
}
export interface TimelineWeek {
  readonly end: Date;
  readonly items: readonly TimelineItem[];
  readonly label: string;
  readonly start: Date;
}

const dayMs = 86_400_000;
const weekMs = 7 * dayMs;
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const short = (date: Date) => dateFormat.format(date).replace(".", "");

const activityStatus = (
  status: string,
  dueAt: Date,
  now: Date
): TimelineStatus => {
  if (status === "DRAFT") {
    return "draft";
  }
  return dueAt < now ? "closed" : "open";
};
const meetingStatus = (
  status: string,
  startsAt: Date,
  now: Date
): TimelineStatus => {
  if (status === "DRAFT") {
    return "draft";
  }
  return startsAt < now ? "closed" : "scheduled";
};

const weeksOf = (startsAt: Date, items: readonly TimelineItem[]) => {
  const groups = new Map<number, TimelineItem[]>();
  for (const item of items) {
    const index = Math.floor((item.at.getTime() - startsAt.getTime()) / weekMs);
    groups.set(index, [...(groups.get(index) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, group]): TimelineWeek => {
      const start = new Date(startsAt.getTime() + index * weekMs);
      const end = new Date(start.getTime() + 6 * dayMs);
      return {
        label: index < 0 ? "Antes do início" : `Semana ${index + 1}`,
        start,
        end,
        items: group.sort(
          (left, right) => left.at.getTime() - right.at.getTime()
        ),
      };
    });
};

/** Cronograma da turma: aulas com data, cursos, atividades e encontros por semana. */
export const getGestaoCohortTimeline = async (cohortId: string) => {
  await requireGestaoCohortActor(cohortId);
  const target = { cohortId, revokedAt: null };
  const now = new Date();
  const [cohort, releases, accesses, activities, meetings] = await Promise.all([
    database.cohort.findUniqueOrThrow({
      where: { id: cohortId },
      select: { startsAt: true },
    }),
    database.cohortLessonRelease.findMany({
      where: { cohortId },
      orderBy: { releaseAt: "asc" },
      take: 200,
      select: {
        id: true,
        releaseAt: true,
        lesson: {
          select: {
            title: true,
            module: { select: { course: { select: { title: true } } } },
          },
        },
      },
    }),
    database.cohortCourseAccess.findMany({
      where: { cohortId, revokedAt: null },
      take: 100,
      select: {
        id: true,
        releaseMode: true,
        startsAt: true,
        createdAt: true,
        course: { select: { title: true } },
      },
    }),
    database.activity.findMany({
      where: {
        status: { in: ["DRAFT", "PUBLISHED"] },
        dueAt: { not: null },
        cohortTargets: { some: { ...target, activeKey: { not: null } } },
      },
      orderBy: { dueAt: "asc" },
      take: 200,
      select: { id: true, title: true, status: true, dueAt: true },
    }),
    database.meeting.findMany({
      where: {
        status: { in: ["DRAFT", "PUBLISHED"] },
        cohortTargets: { some: target },
      },
      orderBy: { startsAt: "asc" },
      take: 200,
      select: { id: true, title: true, status: true, startsAt: true },
    }),
  ]);
  const base = `/gestao/alunos/turmas/${cohortId}`;
  const items: TimelineItem[] = [
    ...releases.map(
      (release): TimelineItem => ({
        id: `lesson-${release.id}`,
        kind: "lesson",
        at: release.releaseAt,
        title: release.lesson.title,
        detail: `Curso: ${release.lesson.module.course.title} · ${
          release.releaseAt <= now
            ? "liberada"
            : `libera em ${short(release.releaseAt)}`
        }`,
        status: release.releaseAt <= now ? "released" : "scheduled",
        href: `${base}/conteudo?visao=cursos`,
      })
    ),
    ...accesses.map((access): TimelineItem => {
      const at =
        access.releaseMode === "SCHEDULE" && access.startsAt
          ? access.startsAt
          : access.createdAt;
      return {
        id: `course-${access.id}`,
        kind: "course",
        at,
        title: access.course.title,
        detail: `Curso liberado${at > now ? ` em ${short(at)}` : ""}`,
        status: at <= now ? "released" : "scheduled",
        href: `${base}/conteudo?visao=cursos`,
      };
    }),
    ...activities.flatMap((activity): TimelineItem[] =>
      activity.dueAt
        ? [
            {
              id: `activity-${activity.id}`,
              kind: "activity",
              at: activity.dueAt,
              title: activity.title,
              detail: `Atividade · prazo ${short(activity.dueAt)}`,
              status: activityStatus(activity.status, activity.dueAt, now),
              href: `/gestao/ensino/atividades/${activity.id}`,
            },
          ]
        : []
    ),
    ...meetings.map(
      (meeting): TimelineItem => ({
        id: `meeting-${meeting.id}`,
        kind: "meeting",
        at: meeting.startsAt,
        title: meeting.title,
        detail: `Encontro · ${dateTimeFormat.format(meeting.startsAt)}`,
        status: meetingStatus(meeting.status, meeting.startsAt, now),
        href: `${base}/calendario`,
      })
    ),
  ];
  return { weeks: weeksOf(cohort.startsAt, items), total: items.length };
};
