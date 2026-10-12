import { describe, expect, it } from "vitest";
import {
  cohortCalendarEventDateRange,
  cohortCalendarEventLastDate,
  isCohortCalendarEventColor,
  parseCohortCalendarDateTime,
  resolveCohortCalendarDateConflicts,
} from "./cohort-calendar-domain";

describe("cohort calendar domain", () => {
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
        titles: ["Imersão", "Roda de conversa"],
      },
    ]);
  });
});
