import "server-only";

import { database, Prisma } from "@repo/database";
import {
  buildShelfDays,
  groupForActivity,
  MANUAL_SESSION_PREFIX,
  parseManualGroup,
  type ShelfDay,
  type ShelfGroup,
  type ShelfRow,
} from "./study-week-shelf-model";

export interface ManualStudyEntry {
  readonly at: string;
  readonly group: ShelfGroup;
  readonly id: string;
  readonly minutes: number;
}

export interface StudyWeekShelf {
  readonly days: ShelfDay[];
  readonly manualEntries: ManualStudyEntry[];
  readonly weekNumberKey: string;
}

interface WeekRow {
  readonly dayKey: string;
  readonly kind: string;
  readonly seconds: number;
  readonly sessionKey: string | null;
}

const dayKeyFormatter = (timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  });

/**
 * Tempo da semana por dia e por prateleira. Usa o mesmo filtro da meta
 * semanal (`isPlayback = false`, janela da semana do planner), então a soma da
 * estante é sempre igual aos minutos que a meta enxerga.
 */
export const getStudyWeekShelf = async (
  memberId: string,
  window: { readonly weekEnd: Date; readonly weekStart: Date },
  timezone: string,
  now = new Date()
): Promise<StudyWeekShelf> => {
  const formatter = dayKeyFormatter(timezone);
  const weekStartKey = formatter.format(window.weekStart);
  const todayKey = formatter.format(now);

  const [rows, manualSessions] = await Promise.all([
    database.$queryRaw<WeekRow[]>(Prisma.sql`
      SELECT
        TO_CHAR((study_interval."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS "dayKey",
        tracking."activityKind"::text AS "kind",
        CASE WHEN tracking."clientSessionId" LIKE ${`${MANUAL_SESSION_PREFIX}%`}
          THEN tracking."clientSessionId" ELSE NULL END AS "sessionKey",
        SUM(study_interval."seconds")::int AS "seconds"
      FROM "StudyActivityInterval" AS study_interval
      JOIN "StudyTrackingSession" AS tracking ON tracking."id" = study_interval."sessionId"
      WHERE study_interval."memberId" = ${memberId}
        AND study_interval."isPlayback" = false
        AND study_interval."startedAt" >= ${window.weekStart}
        AND study_interval."startedAt" < ${window.weekEnd}
      GROUP BY 1, 2, 3
    `),
    database.studyTrackingSession.findMany({
      where: {
        memberId,
        clientSessionId: { startsWith: MANUAL_SESSION_PREFIX },
        startedAt: { gte: window.weekStart, lt: window.weekEnd },
      },
      orderBy: { startedAt: "desc" },
      take: 40,
      select: {
        id: true,
        clientSessionId: true,
        startedAt: true,
        intervals: { select: { seconds: true } },
      },
    }),
  ]);

  const shelfRows: ShelfRow[] = rows.map((row) => ({
    dayKey: row.dayKey,
    seconds: Number(row.seconds),
    group: groupForActivity(row.kind, row.sessionKey),
  }));

  const manualEntries: ManualStudyEntry[] = [];
  for (const session of manualSessions) {
    const group = parseManualGroup(session.clientSessionId);
    if (!group) {
      continue;
    }
    manualEntries.push({
      id: session.id,
      group,
      at: session.startedAt.toISOString(),
      minutes: Math.round(
        session.intervals.reduce((sum, item) => sum + item.seconds, 0) / 60
      ),
    });
  }

  return {
    days: buildShelfDays(shelfRows, weekStartKey, todayKey),
    manualEntries,
    weekNumberKey: weekStartKey,
  };
};
