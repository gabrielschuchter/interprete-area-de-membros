import "server-only";
import { ContentStatus, database } from "@repo/database";
import type { GestaoActor } from "./gestao-authorization";
import { getGestaoCorrectionCohortScope } from "./gestao-correction-scope";
import {
  type GestaoNoticeAudienceKind,
  type GestaoNoticeState,
  type GestaoNoticeTab,
  gestaoNoticeAudienceKind,
  gestaoNoticeAudienceLabel,
  gestaoNoticeState,
} from "./gestao-notices-domain";

export const noticeAudienceEvent = "gestao.notice.audience";
const legacyCohortNoticeEvent = "gestao.cohort_notice.created";
const pageSize = 20;
const maxNotices = 600;

export interface GestaoNoticeRow {
  readonly audienceKind: GestaoNoticeAudienceKind;
  readonly audienceLabel: string;
  readonly body: string;
  readonly endsAt: Date | null;
  readonly href: string | null;
  readonly id: string;
  readonly isPinned: boolean;
  readonly recipients: number;
  readonly startsAt: Date | null;
  readonly state: GestaoNoticeState;
  readonly title: string;
}

const readStrings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const readPayload = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readEventCohortIds = (eventType: string, payload: unknown) => {
  const data = readPayload(payload);
  if (eventType === noticeAudienceEvent) {
    return readStrings(data.cohortIds);
  }
  return typeof data.cohortId === "string" ? [data.cohortId] : [];
};

/** Turmas de cada aviso: o último registro de público, ou o aviso por turma antigo. */
const getNoticeCohortIds = async (noticeIds: readonly string[]) => {
  const result = new Map<string, string[]>();
  if (noticeIds.length === 0) {
    return result;
  }
  const events = await database.domainEvent.findMany({
    where: {
      aggregateType: "Announcement",
      aggregateId: { in: [...noticeIds] },
      eventType: { in: [noticeAudienceEvent, legacyCohortNoticeEvent] },
    },
    orderBy: { occurredAt: "desc" },
    select: { aggregateId: true, eventType: true, payload: true },
  });
  // O registro de público é a decisão final; sem ele, valem os registros
  // por turma de avisos criados na aba da turma.
  const audience = events.filter(
    (event) => event.eventType === noticeAudienceEvent
  );
  const decided = new Set<string>();
  for (const event of audience) {
    if (!decided.has(event.aggregateId)) {
      decided.add(event.aggregateId);
      result.set(
        event.aggregateId,
        readEventCohortIds(event.eventType, event.payload)
      );
    }
  }
  for (const event of events) {
    if (
      event.eventType === legacyCohortNoticeEvent &&
      !decided.has(event.aggregateId)
    ) {
      result.set(event.aggregateId, [
        ...(result.get(event.aggregateId) ?? []),
        ...readEventCohortIds(event.eventType, event.payload),
      ]);
    }
  }
  return result;
};

interface ListInput {
  readonly audience: GestaoNoticeAudienceKind | null;
  readonly page: string | undefined;
  readonly query: string | undefined;
  readonly tab: GestaoNoticeTab;
}

export const getGestaoNoticeList = async (input: ListInput) => {
  const now = new Date();
  const notices = await database.announcement.findMany({
    where: { deletedAt: null },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: maxNotices,
    select: {
      id: true,
      title: true,
      body: true,
      href: true,
      audience: true,
      recipientIds: true,
      status: true,
      startsAt: true,
      endsAt: true,
      isPinned: true,
    },
  });
  const cohortIdsByNotice = await getNoticeCohortIds(
    notices.map((notice) => notice.id)
  );
  const allCohortIds = [...new Set([...cohortIdsByNotice.values()].flat())];
  const cohorts = allCohortIds.length
    ? await database.cohort.findMany({
        where: { id: { in: allCohortIds } },
        select: { id: true, name: true },
      })
    : [];
  const cohortNames = new Map(
    cohorts.map((cohort) => [cohort.id, cohort.name])
  );

  const rows = notices.map((notice): GestaoNoticeRow => {
    const names = (cohortIdsByNotice.get(notice.id) ?? [])
      .map((id) => cohortNames.get(id))
      .filter((name): name is string => Boolean(name));
    const audience = {
      audience: notice.audience,
      cohortNames: names,
      people: notice.recipientIds.length,
    };
    return {
      audienceKind: gestaoNoticeAudienceKind(audience),
      audienceLabel: gestaoNoticeAudienceLabel(audience),
      body: notice.body,
      endsAt: notice.endsAt,
      href: notice.href,
      id: notice.id,
      isPinned: notice.isPinned,
      recipients: notice.recipientIds.length,
      startsAt: notice.startsAt,
      state: gestaoNoticeState(notice, now),
      title: notice.title,
    };
  });

  const needle = input.query?.trim().toLowerCase().slice(0, 120) ?? "";
  const searched = rows.filter(
    (row) =>
      (!input.audience || row.audienceKind === input.audience) &&
      (!needle ||
        row.title.toLowerCase().includes(needle) ||
        row.body.toLowerCase().includes(needle))
  );
  const tabCounts: Record<GestaoNoticeTab, number> = {
    all: searched.length,
    draft: 0,
    ended: 0,
    published: 0,
    scheduled: 0,
  };
  for (const row of searched) {
    tabCounts[row.state] += 1;
  }
  const visible =
    input.tab === "all"
      ? searched
      : searched.filter((row) => row.state === input.tab);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const requested = Number.parseInt(input.page ?? "1", 10);
  const page = Math.min(
    pageCount,
    Number.isFinite(requested) && requested > 0 ? requested : 1
  );
  return {
    page,
    pageCount,
    pageSize,
    query: needle,
    rows: visible.slice((page - 1) * pageSize, page * pageSize),
    tabCounts,
    total: visible.length,
  };
};

export interface GestaoNoticeLinkOption {
  readonly group: string;
  readonly href: string;
  readonly label: string;
}

export const getGestaoNoticeEditor = async (
  actor: GestaoActor,
  id: string | null
) => {
  const [notice, cohorts, meetings, courses, activeMembers] = await Promise.all(
    [
      id
        ? database.announcement.findFirst({
            where: { id, deletedAt: null },
            select: {
              id: true,
              title: true,
              body: true,
              href: true,
              audience: true,
              recipientIds: true,
              status: true,
              startsAt: true,
              endsAt: true,
              isPinned: true,
              createdAt: true,
            },
          })
        : null,
      database.cohort.findMany({
        where: getGestaoCorrectionCohortScope(actor),
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 200,
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              memberships: {
                where: {
                  status: "ACTIVE",
                  leftAt: null,
                  member: { is: { role: "MEMBER", deactivatedAt: null } },
                },
              },
            },
          },
        },
      }),
      database.meeting.findMany({
        where: {
          status: ContentStatus.PUBLISHED,
          startsAt: { gte: new Date() },
        },
        orderBy: { startsAt: "asc" },
        take: 30,
        select: { id: true, title: true },
      }),
      database.course.findMany({
        where: { status: ContentStatus.PUBLISHED },
        orderBy: { title: "asc" },
        take: 60,
        select: { slug: true, title: true },
      }),
      database.member.count({ where: { deactivatedAt: null } }),
    ]
  );
  const cohortIds = notice
    ? ((await getNoticeCohortIds([notice.id])).get(notice.id) ?? [])
    : [];
  const people =
    notice && notice.audience === "SELECTED" && cohortIds.length === 0
      ? await database.member.findMany({
          where: { id: { in: notice.recipientIds } },
          select: { id: true, displayName: true },
        })
      : [];
  const links: GestaoNoticeLinkOption[] = [
    { group: "Comunidade", href: "/comunidade", label: "Comunidade" },
    ...meetings.map((meeting) => ({
      group: "Encontros",
      href: `/encontros/${meeting.id}`,
      label: `Encontro: ${meeting.title}`,
    })),
    ...courses.map((course) => ({
      group: "Cursos",
      href: `/cursos/${course.slug}`,
      label: `Curso: ${course.title}`,
    })),
  ];
  return {
    activeMembers,
    cohortIds,
    cohorts: cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      students: cohort._count.memberships,
    })),
    links,
    notice,
    people: people.map((person) => ({
      id: person.id,
      name: person.displayName ?? "Aluno",
    })),
  };
};
