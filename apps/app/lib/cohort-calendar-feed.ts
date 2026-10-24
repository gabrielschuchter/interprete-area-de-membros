import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { database, MemberRole, type Prisma } from "@repo/database";
import {
  type CohortCalendarSource,
  cohortCalendarTimezone,
  resolveCohortCalendarItems,
} from "./cohort-calendar-domain";
import {
  canReadMeetingCohortTarget,
  type MeetingCohortMembership,
} from "./meeting-cohort-access";
import type { PlannerCalendarFeedItem } from "./planner-calendar-feed";
import { serializePlannerCalendarFeed } from "./planner-calendar-feed";

const feedTokenPattern = /^[A-Za-z0-9_-]{40,64}$/u;
const sourceLimit = 1001;
const hashToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

const managerCanAccessCohort = async (memberId: string, cohortId: string) => {
  const member = await database.member.findFirst({
    where: {
      id: memberId,
      deactivatedAt: null,
      onboardingStatus: "COMPLETED",
      role: { in: [MemberRole.ADMIN, MemberRole.TEACHER] },
    },
    select: { role: true },
  });
  if (!member) {
    return false;
  }
  const cohort = await database.cohort.findFirst({
    where: {
      id: cohortId,
      archivedAt: null,
      ...(member.role === MemberRole.ADMIN
        ? {}
        : { teachers: { some: { memberId } } }),
    },
    select: { id: true },
  });
  return cohort !== null;
};

const accessForFeed = async (
  tx: Prisma.TransactionClient,
  memberId: string,
  role: MemberRole,
  cohortId: string,
  at: Date
) => {
  if (role === MemberRole.ADMIN) {
    return true;
  }
  if (role === MemberRole.TEACHER) {
    const assignment = await tx.cohortTeacher.findUnique({
      where: { cohortId_memberId: { cohortId, memberId } },
      select: { cohortId: true },
    });
    return assignment !== null;
  }
  const membership = await tx.cohortMembership.findFirst({
    where: {
      cohortId,
      memberId,
      status: "ACTIVE",
      leftAt: null,
      joinedAt: { lte: at },
    },
    select: { id: true },
  });
  return membership !== null;
};

const buildFeedItems = async (
  tx: Prisma.TransactionClient,
  cohortId: string,
  range: { readonly end: Date; readonly start: Date },
  origin: string,
  membership?: MeetingCohortMembership
) => {
  const [events, meetings, activities, releases] = await Promise.all([
    tx.cohortEvent.findMany({
      where: {
        cohortId,
        status: "PUBLISHED",
        OR: [
          { startsAt: { gte: range.start, lt: range.end } },
          { startsAt: { lt: range.start }, endsAt: { gte: range.start } },
          {
            recurrence: { not: "NONE" },
            OR: [
              { recurrenceUntil: null },
              { recurrenceUntil: { gte: range.start } },
            ],
          },
        ],
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: sourceLimit,
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        color: true,
        status: true,
        recurrence: true,
        recurrenceUntil: true,
        occurrenceExceptions: {
          where: {
            OR: [
              { occurrenceStartsAt: { gte: range.start, lt: range.end } },
              { startsAtOverride: { gte: range.start, lt: range.end } },
            ],
          },
          take: sourceLimit,
          select: {
            occurrenceStartsAt: true,
            startsAtOverride: true,
            endsAtOverride: true,
            titleOverride: true,
            descriptionOverride: true,
            colorOverride: true,
            cancelledAt: true,
            version: true,
          },
        },
      },
    }),
    tx.meeting.findMany({
      where: {
        demoKey: null,
        status: "PUBLISHED",
        cohortTargets: { some: { cohortId, revokedAt: null } },
        OR: [
          { startsAt: { gte: range.start, lt: range.end } },
          { startsAt: { lt: range.start }, endsAt: { gte: range.start } },
          { recurrenceRule: { not: null } },
        ],
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: sourceLimit,
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        recurrenceRule: true,
        recurrenceUntil: true,
        timezone: true,
        createdAt: true,
        publishedAt: true,
        cohortTargets: {
          where: { cohortId, revokedAt: null },
          select: { assignedAt: true },
        },
        occurrenceExceptions: {
          where: {
            OR: [
              { occurrenceStartsAt: { gte: range.start, lt: range.end } },
              { startsAtOverride: { gte: range.start, lt: range.end } },
            ],
          },
          take: sourceLimit,
          select: {
            occurrenceStartsAt: true,
            startsAtOverride: true,
            endsAtOverride: true,
            titleOverride: true,
            descriptionOverride: true,
            cancelledAt: true,
            version: true,
          },
        },
      },
    }),
    tx.activity.findMany({
      where: {
        status: "PUBLISHED",
        dueAt: { gte: range.start, lt: range.end },
        cohortTargets: {
          some: { cohortId, activeKey: { not: null }, revokedAt: null },
        },
      },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      take: sourceLimit,
      select: { id: true, title: true, slug: true, dueAt: true },
    }),
    tx.cohortLessonRelease.findMany({
      where: {
        cohortId,
        releaseAt: { gte: range.start, lt: range.end },
        lesson: {
          is: {
            status: "PUBLISHED",
            module: {
              is: {
                status: "PUBLISHED",
                course: {
                  is: {
                    status: "PUBLISHED",
                    cohortCourseAccesses: {
                      some: { cohortId, revokedAt: null },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ releaseAt: "asc" }, { id: "asc" }],
      take: sourceLimit,
      select: {
        id: true,
        releaseAt: true,
        lesson: {
          select: {
            title: true,
            slug: true,
            module: { select: { course: { select: { slug: true } } } },
          },
        },
      },
    }),
  ]);

  if (
    events.length >= sourceLimit ||
    meetings.length >= sourceLimit ||
    activities.length >= sourceLimit ||
    releases.length >= sourceLimit
  ) {
    throw new Error("A agenda excede o limite de exportação.");
  }

  const sources: CohortCalendarSource[] = [
    ...events.map((event) => ({
      id: event.id,
      sourceType: "event" as const,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      color: event.color,
      status: event.status,
      recurrence: event.recurrence,
      recurrenceUntil: event.recurrenceUntil,
      href: `/gestao/alunos/turmas/${cohortId}/calendario`,
      exceptions: event.occurrenceExceptions,
    })),
    ...meetings.map((meeting) => ({
      id: meeting.id,
      sourceType: "meeting" as const,
      title: meeting.title,
      description: meeting.description,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      recurrenceRule: meeting.recurrenceRule,
      recurrenceUntil: meeting.recurrenceUntil,
      status: "PUBLISHED" as const,
      timezone: meeting.timezone,
      href: `/encontros/${meeting.id}`,
      exceptions: meeting.occurrenceExceptions.map((exception) => ({
        ...exception,
        colorOverride: null,
      })),
    })),
    ...activities.flatMap((activity) =>
      activity.dueAt
        ? [
            {
              id: activity.id,
              sourceType: "activity" as const,
              title: `Prazo: ${activity.title}`,
              description: null,
              startsAt: activity.dueAt,
              endsAt: null,
              status: "PUBLISHED" as const,
              href: `/atividades/${activity.slug}`,
            },
          ]
        : []
    ),
    ...releases.map((release) => ({
      id: release.id,
      sourceType: "lesson-release" as const,
      title: `Liberação: ${release.lesson.title}`,
      description: null,
      startsAt: release.releaseAt,
      endsAt: null,
      status: "PUBLISHED" as const,
      href: `/cursos/${release.lesson.module.course.slug}/${release.lesson.slug}`,
    })),
  ];
  const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  const items = resolveCohortCalendarItems(sources, range).filter((item) => {
    if (item.status !== "PUBLISHED" || item.cancelled) {
      return false;
    }
    if (!membership || item.sourceType !== "meeting") {
      return true;
    }
    const meeting = meetingById.get(item.sourceId);
    return Boolean(
      meeting?.cohortTargets.some((target) =>
        canReadMeetingCohortTarget(
          {
            ...meeting,
            startsAt: item.startsAt,
            endsAt: item.endsAt,
            recurrenceRule: null,
          },
          target,
          membership
        )
      )
    );
  });
  const toAbsoluteUrl = (path: string) => new URL(path, origin).toString();
  const feedItems: PlannerCalendarFeedItem[] = items.map((item) => ({
    uid: `${item.sourceType}-${item.sourceId}-${item.occurrenceKey ?? item.startsAt.toISOString()}`,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt ?? new Date(item.startsAt.getTime() + 30 * 60_000),
    allDay: item.allDay,
    timezone: item.timezone,
    description: item.description,
    url: toAbsoluteUrl(item.href),
  }));
  return feedItems;
};

export const issueCohortCalendarFeedToken = async (
  memberId: string,
  cohortId: string
) => {
  if (!(await managerCanAccessCohort(memberId, cohortId))) {
    return null;
  }
  const token = randomBytes(32).toString("base64url");
  await database.cohortCalendarFeed.upsert({
    where: { memberId_cohortId: { memberId, cohortId } },
    create: { memberId, cohortId, tokenHash: hashToken(token) },
    update: { tokenHash: hashToken(token), revokedAt: null },
    select: { id: true },
  });
  return token;
};

export const revokeCohortCalendarFeedToken = async (
  memberId: string,
  cohortId: string
): Promise<boolean | null> => {
  if (!(await managerCanAccessCohort(memberId, cohortId))) {
    return null;
  }
  const result = await database.cohortCalendarFeed.updateMany({
    where: { memberId, cohortId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
};

export const readCohortCalendarFeed = async (
  token: string,
  range: { readonly end: Date; readonly start: Date },
  origin: string
) => {
  if (
    !feedTokenPattern.test(token) ||
    Number.isNaN(range.start.valueOf()) ||
    Number.isNaN(range.end.valueOf()) ||
    range.end <= range.start ||
    range.end.getTime() - range.start.getTime() > 400 * 86_400_000
  ) {
    return null;
  }
  return await database.$transaction(async (tx) => {
    const feed = await tx.cohortCalendarFeed.findFirst({
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
        member: {
          deactivatedAt: null,
          onboardingStatus: "COMPLETED",
        },
        cohort: { archivedAt: null },
      },
      select: {
        memberId: true,
        cohortId: true,
        member: { select: { role: true } },
        cohort: { select: { name: true } },
      },
    });
    if (!feed) {
      return null;
    }
    const allowed = await accessForFeed(
      tx,
      feed.memberId,
      feed.member.role,
      feed.cohortId,
      new Date()
    );
    if (!allowed) {
      return null;
    }
    const membership =
      feed.member.role === MemberRole.MEMBER
        ? await tx.cohortMembership.findFirst({
            where: {
              memberId: feed.memberId,
              cohortId: feed.cohortId,
              status: "ACTIVE",
              leftAt: null,
              joinedAt: { lte: new Date() },
            },
            select: {
              joinedAt: true,
              includePastReadOnly: true,
              cohort: { select: { lateJoinPolicy: true } },
            },
          })
        : null;
    if (feed.member.role === MemberRole.MEMBER && !membership) {
      return null;
    }
    const items = await buildFeedItems(
      tx,
      feed.cohortId,
      range,
      origin,
      membership
        ? {
            joinedAt: membership.joinedAt,
            includePastReadOnly: membership.includePastReadOnly,
            lateJoinPolicy: membership.cohort.lateJoinPolicy,
          }
        : undefined
    );
    return {
      items,
      name: feed.cohort.name,
      timezone: cohortCalendarTimezone,
    };
  });
};

export const serializeCohortCalendarFeed = (
  items: readonly PlannerCalendarFeedItem[],
  timezone: string,
  cohortName: string,
  generatedAt = new Date()
) =>
  serializePlannerCalendarFeed(
    items,
    timezone,
    generatedAt,
    `Interprete · ${cohortName}`
  );
