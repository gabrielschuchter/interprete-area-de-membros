import { describe, expect, test } from "vitest";
import {
  expandPlannerOccurrences,
  firstPlannerOccurrenceOnOrAfter,
  isPlannerSeriesOccurrence,
  plannerOccurrenceAtIndex,
} from "./planner-recurrence";

const timezone = "America/Sao_Paulo";

describe("planner recurrence", () => {
  test("keeps the local clock time when daily instances cross a year boundary", () => {
    const startsAt = new Date("2026-12-31T14:30:00.000Z");

    expect(
      expandPlannerOccurrences(
        startsAt,
        "DAILY",
        null,
        startsAt,
        new Date("2027-01-02T23:59:59.000Z"),
        timezone
      )
    ).toEqual([
      new Date("2026-12-31T14:30:00.000Z"),
      new Date("2027-01-01T14:30:00.000Z"),
      new Date("2027-01-02T14:30:00.000Z"),
    ]);
  });

  test("anchors monthly occurrences to the original day of month", () => {
    const startsAt = new Date("2027-01-31T14:30:00.000Z");

    expect(
      expandPlannerOccurrences(
        startsAt,
        "MONTHLY",
        null,
        startsAt,
        new Date("2027-04-01T00:00:00.000Z"),
        timezone
      )
    ).toEqual([
      new Date("2027-01-31T14:30:00.000Z"),
      new Date("2027-02-28T14:30:00.000Z"),
      new Date("2027-03-31T14:30:00.000Z"),
    ]);
  });

  test("preserves the event's local clock time when a timezone enters daylight time", () => {
    const startsAt = new Date("2026-03-07T14:30:00.000Z");

    expect(
      expandPlannerOccurrences(
        startsAt,
        "DAILY",
        null,
        startsAt,
        new Date("2026-03-10T00:00:00.000Z"),
        "America/New_York"
      )
    ).toEqual([
      new Date("2026-03-07T14:30:00.000Z"),
      new Date("2026-03-08T13:30:00.000Z"),
      new Date("2026-03-09T13:30:00.000Z"),
    ]);
  });

  test("applies inclusive range bounds and the series end date", () => {
    expect(
      expandPlannerOccurrences(
        new Date("2027-05-01T14:00:00.000Z"),
        "DAILY",
        new Date("2027-05-03T14:00:00.000Z"),
        new Date("2027-05-02T14:00:00.000Z"),
        new Date("2027-05-05T14:00:00.000Z"),
        timezone
      )
    ).toEqual([
      new Date("2027-05-02T14:00:00.000Z"),
      new Date("2027-05-03T14:00:00.000Z"),
    ]);
  });

  test("treats a nonrecurring event as its single inclusive occurrence", () => {
    const startsAt = new Date("2027-06-01T10:00:00.000Z");
    expect(
      expandPlannerOccurrences(
        startsAt,
        "NONE",
        null,
        startsAt,
        startsAt,
        timezone
      )
    ).toEqual([startsAt]);
    expect(
      expandPlannerOccurrences(
        startsAt,
        "NONE",
        null,
        new Date(startsAt.getTime() + 1),
        new Date(startsAt.getTime() + 86_400_000),
        timezone
      )
    ).toEqual([]);
  });

  test("finds the next weekly instance and respects the series end date", () => {
    const startsAt = new Date("2027-01-04T12:00:00.000Z");
    const recurrenceUntil = new Date("2027-01-18T12:00:00.000Z");

    expect(
      firstPlannerOccurrenceOnOrAfter(
        startsAt,
        "WEEKLY",
        new Date("2027-01-05T12:00:00.000Z"),
        timezone,
        recurrenceUntil
      )
    ).toEqual(new Date("2027-01-11T12:00:00.000Z"));
    expect(
      firstPlannerOccurrenceOnOrAfter(
        startsAt,
        "WEEKLY",
        new Date("2027-01-19T12:00:00.000Z"),
        timezone,
        recurrenceUntil
      )
    ).toBeNull();
  });

  test("recognizes only exact valid series instances", () => {
    const startsAt = new Date("2027-01-04T12:00:00.000Z");

    expect(
      isPlannerSeriesOccurrence(
        startsAt,
        "WEEKLY",
        new Date("2027-01-11T12:00:00.000Z"),
        timezone,
        null
      )
    ).toBe(true);
    expect(
      isPlannerSeriesOccurrence(
        startsAt,
        "WEEKLY",
        new Date("2027-01-12T12:00:00.000Z"),
        timezone,
        null
      )
    ).toBe(false);
    expect(plannerOccurrenceAtIndex(startsAt, "NONE", 1, timezone)).toBeNull();
  });
});
