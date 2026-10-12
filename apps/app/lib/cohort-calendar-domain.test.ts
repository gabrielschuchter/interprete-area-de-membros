import { describe, expect, it } from "vitest";
import {
  cohortCalendarEventDateRange,
  cohortCalendarEventLastDate,
  cohortCalendarMonthGridLength,
  filterCohortCalendarItems,
  isCohortCalendarEventColor,
  meetingRecurrenceFromRule,
  parseCohortCalendarDateTime,
  resolveCohortCalendarDateConflicts,
  resolveCohortCalendarItems,
} from "./cohort-calendar-domain";

describe("cohort calendar domain", () => {
  it("uses the fewest full calendar weeks needed for the month", () => {
    expect(cohortCalendarMonthGridLength(2026, 10)).toBe(35);
    expect(cohortCalendarMonthGridLength(2026, 8)).toBe(42);
    expect(cohortCalendarMonthGridLength(2026, 2)).toBe(28);
  });

  it("filters the calendar layers without changing the source items", () => {
    const items = [
      { id: "meeting", sourceType: "meeting" as const },
      { id: "activity", sourceType: "activity" as const },
      { id: "lesson", sourceType: "lesson-release" as const },
      { id: "event", sourceType: "event" as const },
    ];

    expect(
      filterCohortCalendarItems(items, ["meeting", "lesson-release"])
    ).toEqual([items[0], items[2]]);
    expect(items).toHaveLength(4);
  });

  it("converts São Paulo wall time to an unambiguous instant", () => {
    expect(parseCohortCalendarDateTime("2026-10-21T09:30")?.toISOString()).toBe(
      "2026-10-21T12:30:00.000Z"
    );
  });

  it("normalizes all-day entries to local midnight", () => {
    expect(
      parseCohortCalendarDateTime("2026-10-21T14:30", {
        allDay: true,
      })?.toISOString()
    ).toBe("2026-10-21T03:00:00.000Z");
  });

  it("rejects impossible local dates and times", () => {
    expect(parseCohortCalendarDateTime("2026-02-30T09:00")).toBeNull();
    expect(parseCohortCalendarDateTime("2026-10-21T25:00")).toBeNull();
    expect(parseCohortCalendarDateTime("not-a-date")).toBeNull();
  });

  it("only accepts the cohort calendar palette", () => {
    expect(isCohortCalendarEventColor("#6B5B64")).toBe(true);
    expect(isCohortCalendarEventColor("url(javascript:alert(1))")).toBe(false);
  });

  it("projects moved and cancelled recurring meetings for staff to manage each occurrence", () => {
    const sourceStartsAt = new Date("2026-10-01T12:00:00.000Z");
    const movedOccurrenceStartsAt = new Date("2026-10-08T12:00:00.000Z");
    const cancelledOccurrenceStartsAt = new Date("2026-10-15T12:00:00.000Z");
    const movedStart = new Date("2026-10-13T14:00:00.000Z");
    const range = {
      start: new Date("2026-10-12T03:00:00.000Z"),
      end: new Date("2026-10-16T03:00:00.000Z"),
    };

    expect(meetingRecurrenceFromRule("FREQ=WEEKLY")).toBe("WEEKLY");
    expect(meetingRecurrenceFromRule("not-a-rule")).toBe("NONE");
    expect(
      resolveCohortCalendarItems(
        [
          {
            id: "meeting-series",
            sourceType: "meeting",
            title: "Revisões",
            description: null,
            startsAt: sourceStartsAt,
            endsAt: new Date("2026-10-01T13:00:00.000Z"),
            recurrenceRule: "WEEKLY",
            recurrenceUntil: new Date("2026-10-29T12:00:00.000Z"),
            status: "PUBLISHED",
            href: "/encontros/meeting-series",
            exceptions: [
              {
                occurrenceStartsAt: movedOccurrenceStartsAt,
                startsAtOverride: movedStart,
                endsAtOverride: new Date("2026-10-13T15:00:00.000Z"),
                titleOverride: "Revisões remarcadas",
                descriptionOverride: null,
                cancelledAt: null,
                version: 2,
              },
              {
                occurrenceStartsAt: cancelledOccurrenceStartsAt,
                startsAtOverride: null,
                endsAtOverride: null,
                titleOverride: null,
                descriptionOverride: null,
                cancelledAt: new Date("2026-10-01T00:00:00.000Z"),
                version: 3,
              },
            ],
          },
        ],
        range
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          occurrenceKey: movedOccurrenceStartsAt.toISOString(),
          startsAt: movedStart,
          title: "Revisões remarcadas",
          cancelled: false,
          exceptionVersion: 2,
        }),
        expect.objectContaining({
          occurrenceKey: cancelledOccurrenceStartsAt.toISOString(),
          startsAt: cancelledOccurrenceStartsAt,
          cancelled: true,
          exceptionVersion: 3,
        }),
      ])
    );
  });

  it("treats an all-day end date as inclusive and a timed midnight as exclusive", () => {
    const startsAt = new Date("2026-10-21T12:00:00.000Z");
    const endsAt = new Date("2026-10-23T03:00:00.000Z");

    expect(
      cohortCalendarEventLastDate({ allDay: true, startsAt, endsAt })
    ).toBe("2026-10-23");
    expect(
      cohortCalendarEventLastDate({ allDay: false, startsAt, endsAt })
    ).toBe("2026-10-22");
  });

  it("keeps all-day dates in São Paulo while timed ranges use the member timezone", () => {
    const startsAt = new Date("2026-10-21T03:00:00.000Z");
    const endsAt = new Date("2026-10-23T03:00:00.000Z");

    expect(
      cohortCalendarEventDateRange(
        { allDay: true, startsAt, endsAt },
        "America/Los_Angeles"
      )
    ).toEqual({ first: "2026-10-21", last: "2026-10-23" });

    expect(
      cohortCalendarEventDateRange(
        {
          allDay: false,
          startsAt: new Date("2026-10-21T23:00:00.000Z"),
          endsAt: new Date("2026-10-22T08:00:00.000Z"),
        },
        "America/Los_Angeles"
      )
    ).toEqual({ first: "2026-10-21", last: "2026-10-22" });

    expect(
      cohortCalendarEventDateRange(
        {
          allDay: false,
          startsAt: new Date("2026-10-21T23:00:00.000Z"),
          endsAt: new Date("2026-10-22T07:00:00.000Z"),
        },
        "America/Los_Angeles"
      )
    ).toEqual({ first: "2026-10-21", last: "2026-10-21" });
  });

  it("reports published events that share a calendar day and excludes drafts", () => {
    const range = {
      start: new Date("2026-10-01T03:00:00.000Z"),
      end: new Date("2026-11-01T03:00:00.000Z"),
    };
    const events = [
      {
        id: "published-a",
        title: "Encontro",
        startsAt: new Date("2026-10-21T12:00:00.000Z"),
        endsAt: new Date("2026-10-21T13:00:00.000Z"),
        allDay: false,
        status: "PUBLISHED" as const,
      },
      {
        id: "published-b",
        title: "Prazo",
        startsAt: new Date("2026-10-21T18:00:00.000Z"),
        endsAt: null,
        allDay: false,
        status: "PUBLISHED" as const,
      },
      {
        id: "draft",
        title: "Rascunho privado",
        startsAt: new Date("2026-10-21T15:00:00.000Z"),
        endsAt: null,
        allDay: false,
        status: "DRAFT" as const,
      },
      {
        id: "archived",
        title: "Evento arquivado",
        startsAt: new Date("2026-10-21T16:00:00.000Z"),
        endsAt: null,
        allDay: false,
        status: "ARCHIVED" as const,
      },
    ];

    expect(resolveCohortCalendarDateConflicts(events, range)).toEqual([
      {
        day: "2026-10-21",
        eventCount: 2,
        sourceCounts: { event: 2 },
        titles: ["Encontro", "Prazo"],
      },
    ]);
  });

  it("finds multi-day date overlaps, clips to the requested window, and ignores distinct days", () => {
    const events = [
      {
        id: "multi-day",
        title: "Imersão",
        startsAt: new Date("2026-10-20T03:00:00.000Z"),
        endsAt: new Date("2026-10-22T03:00:00.000Z"),
        allDay: true,
        status: "PUBLISHED" as const,
      },
      {
        id: "same-second-day",
        title: "Roda de conversa",
        startsAt: new Date("2026-10-21T16:00:00.000Z"),
        endsAt: null,
        allDay: false,
        status: "PUBLISHED" as const,
      },
      {
        id: "later",
        title: "Aula aberta",
        startsAt: new Date("2026-10-24T16:00:00.000Z"),
        endsAt: null,
        allDay: false,
        status: "PUBLISHED" as const,
      },
    ];

    expect(
      resolveCohortCalendarDateConflicts(events, {
        start: new Date("2026-10-21T03:00:00.000Z"),
        end: new Date("2026-10-23T03:00:00.000Z"),
      })
    ).toEqual([
      {
        day: "2026-10-21",
        eventCount: 2,
        sourceCounts: { event: 2 },
        titles: ["Imersão", "Roda de conversa"],
      },
    ]);
  });
});
