import "server-only";
import { database, type Prisma } from "@repo/database";
import {
  memberSituation,
  parseMemberRole,
  parseMemberSituation,
} from "./gestao-members-domain";

const pageSize = 25;
const memberWindow = 1000;

export interface GestaoMemberQuery {
  readonly page?: string;
  readonly query?: string;
  readonly role?: string;
  readonly situation?: string;
}

export const getGestaoMembers = async (input: GestaoMemberQuery) => {
  const role = parseMemberRole(input.role);
  const situation = parseMemberSituation(input.situation);
  const query = (input.query ?? "").trim().slice(0, 120);
  const now = new Date();
  const where: Prisma.MemberWhereInput = {
    ...(role ? { role } : {}),
    ...(query
      ? {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [members, roleCounts] = await Promise.all([
    database.member.findMany({
      where,
      orderBy: [{ displayName: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: memberWindow,
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        createdAt: true,
        deactivatedAt: true,
        cohortMemberships: {
          where: { status: "ACTIVE", leftAt: null },
          select: { cohort: { select: { name: true } } },
          take: 4,
        },
        cohortTeaching: { select: { cohort: { select: { name: true } } } },
      },
    }),
    database.member.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);
  const ids = members.map((member) => member.id);
  const [studied, grants] = await Promise.all([
    database.studyActivityInterval.groupBy({
      by: ["memberId"],
      where: { memberId: { in: ids } },
      _max: { endedAt: true },
    }),
    database.accessGrant.groupBy({
      by: ["memberId"],
      where: { memberId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  const lastStudy = new Map(
    studied.map((row) => [row.memberId, row._max.endedAt])
  );
  const directAccess = new Map(
    grants.map((row) => [row.memberId, row._count._all])
  );
  const rows = members
    .map((member) => {
      const lastStudyAt = lastStudy.get(member.id) ?? null;
      return {
        cohorts: [
          ...new Set([
            ...member.cohortMemberships.map(({ cohort }) => cohort.name),
            ...member.cohortTeaching.map(({ cohort }) => cohort.name),
          ]),
        ],
        createdAt: member.createdAt,
        directAccess: directAccess.get(member.id) ?? 0,
        displayName: member.displayName,
        email: member.email,
        id: member.id,
        lastStudyAt,
        role: member.role,
        situation: memberSituation({
          createdAt: member.createdAt,
          deactivatedAt: member.deactivatedAt,
          lastStudyAt,
          now,
          role: member.role,
        }),
      };
    })
    .filter((row) => !situation || row.situation === situation);
  const counts = { ADMIN: 0, MEMBER: 0, TEACHER: 0 };
  for (const row of roleCounts) {
    counts[row.role] = row._count._all;
  }
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(
    pageCount,
    Math.max(1, Math.trunc(Number(input.page) || 1))
  );
  return {
    counts,
    page,
    pageCount,
    pageSize,
    query,
    role,
    rows,
    situation,
    total: rows.length,
  };
};

export const getGestaoMemberDetail = async (memberId: string) => {
  const member = await database.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
      createdAt: true,
      deactivatedAt: true,
    },
  });
  if (!member) {
    return null;
  }
  const events = await database.domainEvent.findMany({
    where: {
      aggregateId: memberId,
      aggregateType: "Member",
      eventType: { startsWith: "gestao." },
    },
    orderBy: { occurredAt: "desc" },
    take: 12,
    select: { actorId: true, eventType: true, occurredAt: true, payload: true },
  });
  const actors = await database.member.findMany({
    where: { id: { in: events.flatMap((event) => event.actorId ?? []) } },
    select: { id: true, displayName: true },
  });
  const names = new Map(actors.map((actor) => [actor.id, actor.displayName]));
  return {
    ...member,
    history: events.map((event) => ({
      actor: event.actorId ? (names.get(event.actorId) ?? "Equipe") : "Sistema",
      at: event.occurredAt,
      payload: event.payload,
      type: event.eventType,
    })),
  };
};
