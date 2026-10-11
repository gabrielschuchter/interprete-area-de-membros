import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({ database: {} }));
vi.mock("./planner", () => ({ getPlannerDashboard: vi.fn() }));

import {
  type PlannerCalendarFeedItem,
  serializePlannerCalendarFeed,
} from "./planner-calendar-feed";

describe("planner calendar feed", () => {
  it("escapes content and emits a valid UTC event with CRLF separators", () => {
    const item: PlannerCalendarFeedItem = {
      uid: "event-1",
      title: "Prova, resumo; segunda linha",
      description: "Primeira linha\nSegunda linha",
      startsAt: new Date("2026-10-10T13:00:00.000Z"),
      endsAt: new Date("2026-10-10T14:00:00.000Z"),
      location: "Sala 2, Centro",
    };

    const feed = serializePlannerCalendarFeed(
      [item],
      "America/Sao_Paulo",
      new Date("2026-10-09T12:00:00.000Z")
    );

    expect(feed).toContain("BEGIN:VCALENDAR\r\n");
    expect(feed).toContain("SUMMARY:Prova\\, resumo\\; segunda linha\r\n");
    expect(feed).toContain("DESCRIPTION:Primeira linha\\nSegunda linha\r\n");
    expect(feed).toContain("LOCATION:Sala 2\\, Centro\r\n");
    expect(feed).toContain("DTSTART:20261010T130000Z\r\n");
    expect(feed.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("folds long UTF-8 lines within the calendar byte limit", () => {
    const item: PlannerCalendarFeedItem = {
      uid: "long-title",
      title: "Estudo clínico 🌿 ".repeat(12),
      startsAt: new Date("2026-10-10T13:00:00.000Z"),
      endsAt: new Date("2026-10-10T14:00:00.000Z"),
    };
    const feed = serializePlannerCalendarFeed([item], "UTC");
    const lines = feed.split("\r\n").filter(Boolean);

    expect(lines.every((line) => Buffer.byteLength(line, "utf8") <= 75)).toBe(
      true
    );
    expect(feed).toContain("\r\n ");
  });

  it("uses exclusive next-day dates for all-day events", () => {
    const item: PlannerCalendarFeedItem = {
      uid: "all-day",
      title: "Evento do dia",
      startsAt: new Date("2026-10-10T03:00:00.000Z"),
      endsAt: new Date("2026-10-11T03:00:00.000Z"),
      allDay: true,
      timezone: "America/Sao_Paulo",
    };
    const feed = serializePlannerCalendarFeed([item], "UTC");

    expect(feed).toContain("DTSTART;VALUE=DATE:20261010\r\n");
    expect(feed).toContain("DTEND;VALUE=DATE:20261011\r\n");
  });
});
