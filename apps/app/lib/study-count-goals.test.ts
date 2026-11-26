import { beforeEach, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const database = {
  $queryRaw: vi.fn(),
  lessonProgress: { findMany: vi.fn() },
  studyCountGoal: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
};
vi.mock("@repo/database", () => ({
  database,
  Prisma: { sql: (...args: unknown[]) => args },
  StudyGoalPeriod: { WEEKLY: "WEEKLY" },
}));

const {
  deleteCountGoal,
  getCountGoalsOverview,
  getWeekActivityCounts,
  saveCountGoal,
} = await import("./study-count-goals");
const window = {
  weekEnd: new Date("2026-11-30T03:00:00Z"),
  weekStart: new Date("2026-11-23T03:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  database.studyCountGoal.upsert.mockResolvedValue({});
});

test("combina heartbeat, cronômetro ligado, aulas concluídas e questões respondidas", async () => {
  database.$queryRaw
    .mockResolvedValueOnce([
      {
        activityKind: "LESSON",
        dayKey: "2026-11-24",
        resourceId: "l1",
        seconds: 120n,
      },
      {
        activityKind: "COMMUNITY",
        dayKey: "2026-11-24",
        resourceId: "c1",
        seconds: 500,
      },
    ])
    .mockResolvedValueOnce([
      {
        dayKey: "2026-11-25",
        linkedType: "LIBRARY_ITEM",
        resourceId: "b1",
        seconds: 30,
      },
    ])
    .mockResolvedValueOnce([{ dayKey: "2026-11-26", count: 8n }]);
  database.lessonProgress.findMany.mockResolvedValue([
    { lessonId: "l2", completedAt: new Date("2026-11-26T15:00:00Z") },
  ]);
  const counts = await getWeekActivityCounts("m1", window, "America/Sao_Paulo");
  expect(counts.week).toEqual({ LESSONS: 2, READINGS: 1, EXERCISES: 8 });
  expect(counts.perDay["2026-11-26"]).toEqual({
    LESSONS: 1,
    READINGS: 0,
    EXERCISES: 8,
  });
});

test("junta as metas salvas com a contagem", async () => {
  database.studyCountGoal.findMany.mockResolvedValue([
    { kind: "EXERCISES", target: 10 },
  ]);
  const overview = await getCountGoalsOverview("m1", {
    perDay: {},
    week: { LESSONS: 0, READINGS: 0, EXERCISES: 12 },
  });
  expect(overview.EXERCISES).toEqual({ done: 12, target: 10 });
  expect(overview.LESSONS.target).toBeNull();
});

test("salva a meta semanal do tipo escolhido", async () => {
  await saveCountGoal("m1", { kind: "READINGS", target: 6 });
  const args = database.studyCountGoal.upsert.mock.calls[0]?.[0];
  expect(args.where.memberId_period_kind).toEqual({
    memberId: "m1",
    period: "WEEKLY",
    kind: "READINGS",
  });
  expect(args.update).toEqual({ target: 6 });
});

test("rejeita alvo inválido e tipo desconhecido", async () => {
  await expect(
    saveCountGoal("m1", { kind: "LESSONS", target: 0 })
  ).rejects.toThrow();
  await expect(
    saveCountGoal("m1", { kind: "MINUTES", target: 3 })
  ).rejects.toThrow();
  await expect(deleteCountGoal("m1", "X")).rejects.toThrow();
  expect(database.studyCountGoal.upsert).not.toHaveBeenCalled();
});

test("remove só a meta semanal do tipo do próprio membro", async () => {
  await deleteCountGoal("m1", "EXERCISES");
  expect(database.studyCountGoal.deleteMany).toHaveBeenCalledWith({
    where: { memberId: "m1", period: "WEEKLY", kind: "EXERCISES" },
  });
});
