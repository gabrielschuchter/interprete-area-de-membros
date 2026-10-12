import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  preferences: vi.fn(),
  columns: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
  studyTrackingSessionFindMany: vi.fn(),
  resolveCalendar: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  database: {
    plannerPreferences: { findUnique: mocks.preferences },
    plannerBoardColumn: { findMany: mocks.columns },
    plannerTask: { findMany: mocks.findMany, count: mocks.count },
    plannerEvent: { findMany: mocks.findMany },
    meeting: { findMany: mocks.findMany },
    studyGoal: { findMany: mocks.findMany },
    studyActivityInterval: { aggregate: mocks.aggregate },
    studyTrackingSession: { findMany: mocks.studyTrackingSessionFindMany },
    lessonProgress: { count: mocks.count },
    activitySubmission: { count: mocks.count },
    learningTaskCompletion: { count: mocks.count },
  },
  FocusTimerMode: {},
  PlannerEventKind: { PERSONAL: "PERSONAL" },
  PlannerPriority: { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" },
  PlannerRecurrence: {
    NONE: "NONE",
    DAILY: "DAILY",
    WEEKLY: "WEEKLY",
    MONTHLY: "MONTHLY",
  },
  PlannerTaskStatus: { TODO: "TODO", IN_PROGRESS: "IN_PROGRESS", DONE: "DONE" },
  StudyGoalPeriod: { WEEKLY: "WEEKLY", MONTHLY: "MONTHLY" },
}));
vi.mock("./student-calendar", () => ({
  resolveCalendar: mocks.resolveCalendar,
}));
vi.mock("@repo/member-domain", async () => ({
  ...(await vi.importActual(
    "../../../packages/member-domain/src/planner-recurrence"
  )),
  enqueueDomainEvent: vi.fn(),
  notificationOutboxConsumerKey: "notifications",
}));

import { getPlannerDashboard } from "./planner";

describe("planner dashboard reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.preferences.mockResolvedValue(null);
    mocks.columns.mockResolvedValue([]);
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.aggregate.mockResolvedValue({ _sum: { seconds: null } });
    mocks.studyTrackingSessionFindMany.mockResolvedValue([]);
    mocks.resolveCalendar.mockResolvedValue([]);
  });

  it("opens with defaults without any database writes for a new member", async () => {
    const dashboard = await getPlannerDashboard("member-qa");
    expect(dashboard.preferences.timezone).toBe("America/Sao_Paulo");
    expect(dashboard.columns.map((column) => column.status)).toEqual([
      "TODO",
      "IN_PROGRESS",
      "DONE",
    ]);
    expect(dashboard.tasks).toEqual([]);
    expect(dashboard.stats.weeklyMinutes).toBe(0);
    expect(mocks.preferences).toHaveBeenCalledWith({
      where: { memberId: "member-qa" },
      select: { timezone: true },
    });
  });

  it("preserves saved timezone and edited columns when other defaults are absent", async () => {
    mocks.preferences.mockResolvedValue({ timezone: "UTC" });
    mocks.columns.mockResolvedValue([
      {
        id: "column-qa",
        status: "IN_PROGRESS",
        label: "Estudando",
        color: "#410230",
        position: 1,
      },
    ]);
    const dashboard = await getPlannerDashboard("member-qa");
    expect(dashboard.preferences.timezone).toBe("UTC");
    expect(dashboard.columns).toHaveLength(3);
    expect(dashboard.columns[1].label).toBe("Estudando");
    expect(dashboard.columns[1].id).toBe("column-qa");
  });

  it("uses the shared calendar resolver for activity deadlines in a requested range", async () => {
    const start = "2026-10-01T00:00:00.000Z";
    const end = "2026-11-01T00:00:00.000Z";
    const deadline = new Date("2026-10-20T12:00:00.000Z");
    mocks.resolveCalendar.mockResolvedValue([
      {
        id: "cohort-activity:activity-a",
        activityId: "activity-a",
        title: "Atividade da turma",
        slug: "atividade-da-turma",
        dueAt: deadline,
        status: "NEW",
        href: "/atividades/atividade-da-turma",
      },
    ]);

    const dashboard = await getPlannerDashboard("member-qa", { start, end });

    expect(mocks.resolveCalendar).toHaveBeenCalledWith(
      "member-qa",
      { start: new Date(start), end: new Date(end) },
      expect.any(Date)
    );
    expect(dashboard.activities).toEqual([
      {
        id: "cohort-activity:activity-a",
        activityId: "activity-a",
        title: "Atividade da turma",
        slug: "atividade-da-turma",
        dueAt: deadline,
        status: "NEW",
        href: "/atividades/atividade-da-turma",
      },
    ]);
  });
});
