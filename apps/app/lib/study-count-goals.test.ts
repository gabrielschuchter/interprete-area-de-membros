import { beforeEach, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const database = {
  $queryRaw: vi.fn(),
  exerciseAnswer: { count: vi.fn() },
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

const { deleteCountGoal, getCountGoalsOverview, saveCountGoal } = await import(
  "./study-count-goals"
);
const window = {
  weekEnd: new Date("2026-11-30T03:00:00Z"),
  weekStart: new Date("2026-11-23T03:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  database.studyCountGoal.upsert.mockResolvedValue({});
});

test("aulas somam estudadas e concluídas sem repetir; exercícios contam questões respondidas", async () => {
  database.$queryRaw.mockResolvedValue([
    { activityKind: "LESSON", resourceId: "l1" },
    { activityKind: "RECORDING", resourceId: "r1" },
    { activityKind: "LIBRARY_ITEM", resourceId: "b1" },
    { activityKind: "LIBRARY_ITEM", resourceId: "b2" },
    { activityKind: "ACTIVITY", resourceId: "a1" },
    { activityKind: "COMMUNITY", resourceId: "c1" },
  ]);
  database.lessonProgress.findMany.mockResolvedValue([
    { lessonId: "l1" },
    { lessonId: "l2" },
  ]);
  database.exerciseAnswer.count.mockResolvedValue(8);
  database.studyCountGoal.findMany.mockResolvedValue([
    { kind: "LESSONS", target: 5 },
  ]);
  const overview = await getCountGoalsOverview("m1", window);
  expect(overview.LESSONS).toEqual({ done: 3, target: 5 });
  expect(overview.READINGS).toEqual({ done: 2, target: null });
  expect(overview.EXERCISES).toEqual({ done: 9, target: null });
  expect(database.exerciseAnswer.count.mock.calls[0]?.[0].where).toMatchObject({
    sessionQuestion: { session: { memberId: "m1" } },
  });
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
