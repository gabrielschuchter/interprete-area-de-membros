import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPlannerDashboard: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({ database: {} }));
vi.mock("./planner", () => ({
  getPlannerDashboard: mocks.getPlannerDashboard,
}));

import {
  getPlannerCalendarFeedItems,
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

  it("includes dynamically assigned cohort deadlines in the private calendar projection", async () => {
    const startsAt = new Date("2026-10-20T12:00:00.000Z");
    const endsAt = new Date("2026-10-20T12:30:00.000Z");
    mocks.getPlannerDashboard.mockResolvedValue({
      events: [],
      meetings: [],
      activities: [
        {
          id: "cohort-activity:activity-a",
          activityId: "activity-a",
          title: "Atividade da turma",
          slug: "atividade-da-turma",
          dueAt: startsAt,
          status: "NEW",
          href: "/atividades/atividade-da-turma",
        },
      ],
      lessonReleases: [],
      cohortEvents: [],
      tasks: [],
      studySessions: [],
      goals: [],
      preferences: { timezone: "America/Sao_Paulo" },
    });

    const result = await getPlannerCalendarFeedItems(
      "member-a",
      new Date("2026-10-01T00:00:00.000Z"),
      new Date("2026-11-01T00:00:00.000Z"),
      "https://members.example"
    );

    expect(result.items).toContainEqual({
      uid: "activity-cohort-activity:activity-a",
      title: "Prazo: Atividade da turma",
      startsAt,
      endsAt,
      description: "Atividade atribuída no Interprete. Status: NEW.",
      url: "https://members.example/atividades/atividade-da-turma",
    });
    expect(mocks.getPlannerDashboard).toHaveBeenCalledWith("member-a", {
      start: "2026-10-01T00:00:00.000Z",
      end: "2026-11-01T00:00:00.000Z",
    });
  });

  it("includes cohort lesson-release markers in the private calendar projection", async () => {
    const releaseAt = new Date("2026-10-21T12:00:00.000Z");
    mocks.getPlannerDashboard.mockResolvedValue({
      events: [],
      meetings: [],
      activities: [],
      lessonReleases: [
        {
          id: "release-a",
          lessonId: "lesson-a",
          title: "Escuta inicial",
          lessonSlug: "escuta-inicial",
          courseId: "course-a",
          courseSlug: "curso-clinico",
          releaseAt,
          href: "/aprender/cursos/curso-clinico/escuta-inicial",
        },
      ],
      cohortEvents: [],
      tasks: [],
      studySessions: [],
      goals: [],
      preferences: { timezone: "America/Sao_Paulo" },
    });

    const result = await getPlannerCalendarFeedItems(
      "member-a",
      new Date("2026-10-01T00:00:00.000Z"),
      new Date("2026-11-01T00:00:00.000Z"),
      "https://members.example"
    );

    expect(result.items).toContainEqual({
      uid: "lesson-release-release-a",
      title: "Aula liberada: Escuta inicial",
      startsAt: releaseAt,
      endsAt: new Date("2026-10-21T12:30:00.000Z"),
      description: "Aula liberada na sua turma.",
      url: "https://members.example/aprender/cursos/curso-clinico/escuta-inicial",
    });
  });

  it("keeps an all-day cohort event on its São Paulo date range in the private feed", async () => {
    const startsAt = new Date("2026-10-21T03:00:00.000Z");
    const endsAt = new Date("2026-10-23T03:00:00.000Z");
    mocks.getPlannerDashboard.mockResolvedValue({
      events: [],
      meetings: [],
      activities: [],
      lessonReleases: [],
      cohortEvents: [
        {
          id: "event-a",
          cohortId: "cohort-a",
          title: "Evento da turma",
          description: "Revisão coletiva",
          startsAt,
          endsAt,
          allDay: true,
          color: "#6B5B64",
        },
      ],
      tasks: [],
      studySessions: [],
      goals: [],
      preferences: { timezone: "America/Los_Angeles" },
    });

    const result = await getPlannerCalendarFeedItems(
      "member-a",
      new Date("2026-10-01T00:00:00.000Z"),
      new Date("2026-11-01T00:00:00.000Z"),
      "https://members.example"
    );

    expect(result.items).toContainEqual({
      uid: "cohort-event-event-a",
      title: "Evento da turma",
      startsAt,
      endsAt: new Date("2026-10-24T03:00:00.000Z"),
      allDay: true,
      timezone: "America/Sao_Paulo",
      description: "Revisão coletiva",
      url: "https://members.example/planejamento",
    });
    const ics = serializePlannerCalendarFeed(result.items, result.timezone);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261021\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261024\r\n");
  });
});
