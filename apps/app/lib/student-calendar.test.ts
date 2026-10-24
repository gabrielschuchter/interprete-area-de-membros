import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveStudentFeed: vi.fn(),
  cohortEventFindMany: vi.fn(),
  cohortLessonReleaseFindMany: vi.fn(),
  cohortMembershipFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  database: {
    cohortEvent: { findMany: mocks.cohortEventFindMany },
    cohortLessonRelease: { findMany: mocks.cohortLessonReleaseFindMany },
    cohortMembership: { findMany: mocks.cohortMembershipFindMany },
  },
}));
vi.mock("@repo/observability/performance", () => ({
  tracePerformance: (_name: string, operation: () => unknown) => operation(),
}));
vi.mock("./student-feed", () => ({
  resolveStudentFeed: mocks.resolveStudentFeed,
}));

import { resolveCalendar } from "./student-calendar";

describe("resolveCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveStudentFeed.mockResolvedValue([]);
    mocks.cohortEventFindMany.mockResolvedValue([]);
    mocks.cohortLessonReleaseFindMany.mockResolvedValue([]);
    mocks.cohortMembershipFindMany.mockResolvedValue([]);
  });

  it("projects deduplicated due activities in range and hides scheduled items", async () => {
    const start = new Date("2026-10-01T00:00:00.000Z");
    const end = new Date("2026-11-01T00:00:00.000Z");
    const at = new Date("2026-10-12T12:00:00.000Z");
    const dueAt = new Date("2026-10-20T12:00:00.000Z");
    mocks.resolveStudentFeed.mockResolvedValue([
      {
        id: "cohort-activity:activity-a",
        targetId: "activity-a",
        title: "Atividade da turma",
        slug: "atividade-da-turma",
        href: "/atividades/atividade-da-turma",
        status: "NEW",
        message: null,
        availableAt: null,
        dueAt,
        assignedAt: new Date("2026-10-11T12:00:00.000Z"),
      },
      {
        id: "assignment-scheduled",
        targetId: "activity-scheduled",
        title: "Atividade agendada",
        slug: "atividade-agendada",
        href: "/cursos/atribuicoes/assignment-scheduled",
        status: "NEW",
        message: null,
        availableAt: new Date("2026-10-19T12:00:00.000Z"),
        dueAt,
        assignedAt: new Date("2026-10-11T12:00:00.000Z"),
      },
      {
        id: "outside-range",
        targetId: "activity-outside",
        title: "Fora do período",
        slug: "atividade-fora",
        href: "/atividades/atividade-fora",
        status: "NEW",
        message: null,
        availableAt: null,
        dueAt: new Date("2026-11-10T12:00:00.000Z"),
        assignedAt: new Date("2026-10-11T12:00:00.000Z"),
      },
    ]);

    await expect(
      resolveCalendar("member-a", { start, end }, at)
    ).resolves.toEqual({
      activities: [
        {
          id: "cohort-activity:activity-a",
          activityId: "activity-a",
          title: "Atividade da turma",
          slug: "atividade-da-turma",
          dueAt,
          status: "NEW",
          href: "/atividades/atividade-da-turma",
        },
      ],
      lessonReleases: [],
      cohortEvents: [],
    });
    expect(mocks.resolveStudentFeed).toHaveBeenCalledWith("member-a", at, {
      assignmentLimit: 200,
      dueRange: { start, end },
    });
  });

  it("rejects invalid or oversized ranges before querying learner data", async () => {
    await expect(
      resolveCalendar("member-a", {
        start: new Date("2026-10-12T00:00:00.000Z"),
        end: new Date("2028-01-01T00:00:00.000Z"),
      })
    ).rejects.toThrow("O período solicitado não é válido.");
    expect(mocks.resolveStudentFeed).not.toHaveBeenCalled();
  });

  it("resolves published lesson releases only through a current cohort course grant", async () => {
    const start = new Date("2026-10-01T00:00:00.000Z");
    const end = new Date("2026-11-01T00:00:00.000Z");
    const at = new Date("2026-10-12T12:00:00.000Z");
    const releaseAt = new Date("2026-10-20T12:00:00.000Z");
    const joinedAt = new Date("2026-09-10T12:00:00.000Z");
    mocks.cohortLessonReleaseFindMany.mockResolvedValue([
      {
        id: "release-a",
        cohortId: "cohort-a",
        lessonId: "lesson-a",
        releaseAt,
        lesson: {
          title: "Aula de avaliação",
          slug: "aula-de-avaliacao",
          module: {
            courseId: "course-a",
            course: { id: "course-a", slug: "curso-clinico" },
          },
        },
      },
    ]);
    mocks.cohortMembershipFindMany.mockResolvedValue([
      {
        cohortId: "cohort-a",
        joinedAt,
        includePastReadOnly: false,
        cohort: {
          archivedAt: null,
          endsAt: null,
          startsAt: new Date("2026-09-01T00:00:00.000Z"),
          lateJoinPolicy: "FROM_JOIN",
          readAfterEndDays: 90,
          courseAccesses: [
            {
              courseId: "course-a",
              createdAt: new Date("2026-09-12T00:00:00.000Z"),
              releaseMode: "SCHEDULE",
              startsAt: new Date("2026-10-19T00:00:00.000Z"),
              revokedAt: null,
            },
          ],
        },
      },
    ]);
    mocks.cohortEventFindMany.mockResolvedValue([
      {
        id: "event-a",
        cohortId: "cohort-a",
        title: "Encontro aberto",
        description: "Revisão da semana",
        startsAt: releaseAt,
        endsAt: new Date("2026-10-20T13:00:00.000Z"),
        allDay: false,
        color: "#6B5B64",
        createdAt: new Date("2026-09-15T12:00:00.000Z"),
        publishedAt: new Date("2026-09-15T12:00:00.000Z"),
        status: "PUBLISHED",
      },
    ]);

    await expect(
      resolveCalendar("member-a", { start, end }, at)
    ).resolves.toMatchObject({
      lessonReleases: [
        {
          id: "release-a",
          lessonId: "lesson-a",
          title: "Aula de avaliação",
          releaseAt,
          href: "/cursos/curso-clinico/aula-de-avaliacao",
        },
      ],
      cohortEvents: [
        {
          id: "event-a",
          cohortId: "cohort-a",
          title: "Encontro aberto",
          description: "Revisão da semana",
          startsAt: releaseAt,
          endsAt: new Date("2026-10-20T13:00:00.000Z"),
          allDay: false,
          color: "#6B5B64",
        },
      ],
    });
    expect(mocks.cohortLessonReleaseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cohortId: { in: ["cohort-a"] },
          releaseAt: { gte: start, lte: end },
        }),
      })
    );
    expect(mocks.cohortMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberId: "member-a",
          status: "ACTIVE",
          leftAt: null,
          joinedAt: { lte: at },
        }),
      })
    );
    expect(mocks.cohortEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cohortId: { in: ["cohort-a"] },
          status: "PUBLISHED",
          OR: [
            { startsAt: { gte: start, lte: end } },
            { startsAt: { lt: start }, endsAt: { gte: start } },
            {
              recurrence: { not: "NONE" },
              OR: [
                { recurrenceUntil: null },
                { recurrenceUntil: { gte: start } },
              ],
            },
          ],
        }),
      })
    );
  });

  it("does not query lesson releases when the member has no active cohorts", async () => {
    await resolveCalendar(
      "member-a",
      {
        start: new Date("2026-10-01T00:00:00.000Z"),
        end: new Date("2026-11-01T00:00:00.000Z"),
      },
      new Date("2026-10-12T12:00:00.000Z")
    );

    expect(mocks.cohortMembershipFindMany).toHaveBeenCalled();
    expect(mocks.cohortLessonReleaseFindMany).not.toHaveBeenCalled();
    expect(mocks.cohortEventFindMany).not.toHaveBeenCalled();
  });
});
