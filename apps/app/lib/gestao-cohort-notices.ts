import "server-only";
import { database } from "@repo/database";

export const cohortNoticeCreated = "gestao.cohort_notice.created";

export type CohortNoticeState = "scheduled" | "published" | "ended";

export interface CohortNoticeRow {
  readonly endsAt: Date | null;
  readonly id: string;
  readonly isPinned: boolean;
  readonly recipients: number;
  readonly startsAt: Date | null;
  readonly state: CohortNoticeState;
  readonly title: string;
}

const readCohortId = (payload: unknown) =>
  typeof payload === "object" &&
  payload !== null &&
  !Array.isArray(payload) &&
  "cohortId" in payload &&
  typeof payload.cohortId === "string"
    ? payload.cohortId
    : null;

/** Ids de avisos criados para a turma; o vínculo fica no registro de eventos. */
export const getCohortNoticeIds = async (cohortId: string) => {
  const events = await database.domainEvent.findMany({
    where: {
      eventType: cohortNoticeCreated,
      payload: { path: ["cohortId"], equals: cohortId },
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
    select: { aggregateId: true, payload: true },
  });
  return events
    .filter((event) => readCohortId(event.payload) === cohortId)
    .map((event) => event.aggregateId);
};

export const getCohortNotices = async (cohortId: string, now = new Date()) => {
  const ids = await getCohortNoticeIds(cohortId);
  const notices = await database.announcement.findMany({
    where: { id: { in: ids }, deletedAt: null, status: { not: "DRAFT" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      isPinned: true,
      startsAt: true,
      endsAt: true,
      recipientIds: true,
    },
  });
  return notices.map((notice): CohortNoticeRow => {
    let state: CohortNoticeState = "published";
    if (
      notice.status !== "PUBLISHED" ||
      (notice.endsAt && notice.endsAt <= now)
    ) {
      state = "ended";
    } else if (notice.startsAt && notice.startsAt > now) {
      state = "scheduled";
    }
    return {
      endsAt: notice.endsAt,
      id: notice.id,
      isPinned: notice.isPinned,
      recipients: notice.recipientIds.length,
      startsAt: notice.startsAt,
      state,
      title: notice.title,
    };
  });
};
