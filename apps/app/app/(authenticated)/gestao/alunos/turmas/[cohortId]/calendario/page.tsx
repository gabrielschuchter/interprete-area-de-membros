import { plannerDateFromZonedParts } from "@repo/member-domain";
import { notFound } from "next/navigation";
import {
  getGestaoCohortDetail,
  listGestaoCohortCalendarEvents,
} from "@/lib/gestao-cohorts";
import { CohortCalendarEditor } from "../cohort-calendar-editor";
import { GestaoCohortHeader } from "../cohort-header";

const timezone = "America/Sao_Paulo";
const monthPartsAt = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? 0),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 0),
  };
};
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/u;
const zonedMidnight = (date: Date) =>
  plannerDateFromZonedParts(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timezone
  );

const GestaoCohortCalendarPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ cohortId: string }>;
  readonly searchParams: Promise<{ month?: string; page?: string }>;
}) => {
  const [{ cohortId }, query] = await Promise.all([params, searchParams]);
  const now = monthPartsAt(new Date());
  const monthKey =
    query.month && monthPattern.test(query.month)
      ? query.month
      : `${now.year}-${String(now.month).padStart(2, "0")}`;
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const visibleStart = new Date(
    Date.UTC(year, month - 1, 1 - monthStart.getUTCDay())
  );
  const visibleEnd = new Date(
    Date.UTC(
      visibleStart.getUTCFullYear(),
      visibleStart.getUTCMonth(),
      visibleStart.getUTCDate() + 42
    )
  );
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const [cohort, calendar] = await Promise.all([
    getGestaoCohortDetail(cohortId),
    listGestaoCohortCalendarEvents(cohortId, {
      page,
      start: zonedMidnight(visibleStart),
      end: zonedMidnight(visibleEnd),
    }),
  ]);
  if (!(cohort && calendar)) {
    notFound();
  }

  return (
    <section className="gt-page gt-detail-page">
      <GestaoCohortHeader activeTab="calendario" cohort={cohort} />
      <CohortCalendarEditor
        archived={cohort.archivedAt !== null}
        cohortId={cohort.id}
        events={calendar.events}
        expectedCohortVersion={cohort.version}
        monthKey={monthKey}
        page={calendar.page}
        totalCount={calendar.totalCount}
        totalPages={calendar.totalPages}
      />
    </section>
  );
};

export default GestaoCohortCalendarPage;
