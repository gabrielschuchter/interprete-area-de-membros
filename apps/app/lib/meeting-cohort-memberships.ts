import "server-only";

import { database } from "@repo/database";
import { cohortEndedReadUntil } from "./cohort-domain";
import type { MeetingCohortMembership } from "./meeting-cohort-access";

export const getMeetingCohortMemberships = async (
  memberId: string,
  at: Date
) => {
  const rows = await database.cohortMembership.findMany({
    where: {
      memberId,
      status: "ACTIVE",
      leftAt: null,
      joinedAt: { lte: at },
      cohort: { startsAt: { lte: at } },
    },
    select: {
      cohortId: true,
      joinedAt: true,
      includePastReadOnly: true,
      cohort: {
        select: {
          endsAt: true,
          archivedAt: true,
          readAfterEndDays: true,
          lateJoinPolicy: true,
        },
      },
    },
  });
  return new Map<string, MeetingCohortMembership>(
    rows
      .filter((row) => {
        const until = cohortEndedReadUntil(
          row.cohort.endsAt ?? row.cohort.archivedAt,
          row.cohort.readAfterEndDays
        );
        return !until || at < until;
      })
      .map((row) => [
        row.cohortId,
        {
          joinedAt: row.joinedAt,
          includePastReadOnly: row.includePastReadOnly,
          lateJoinPolicy: row.cohort.lateJoinPolicy,
        },
      ])
  );
};
