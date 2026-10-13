import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => {
  const sql = (parts: TemplateStringsArray, ...inputs: unknown[]) => {
    let text = "";
    const values: unknown[] = [];
    for (let index = 0; index < parts.length; index += 1) {
      text += parts[index];
      if (index < inputs.length) {
        const input = inputs[index];
        if (
          input &&
          typeof input === "object" &&
          "text" in input &&
          "values" in input
        ) {
          text += input.text;
          values.push(...(input.values as unknown[]));
        } else {
          text += "?";
          values.push(input);
        }
      }
    }
    return { text, values };
  };
  return { Prisma: { sql }, database: { $queryRaw: mocks.query } };
});
vi.mock("./gestao-authorization", () => ({
  requireGestaoAction: mocks.authorize,
}));
vi.mock("next/navigation", () => ({
  forbidden: () => {
    throw new Error("forbidden");
  },
}));

import { getGestaoOverviewWeek } from "./gestao-overview-week";

const row = {
  accessible: true,
  activeCohorts: 2n,
  activeStudents: 10n,
  students: 12n,
  submissions: 9n,
  reviewed: 5n,
  lessons: 42n,
  previousLessons: 21n,
  studySeconds: 136800n,
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({
    actor: { role: "TEACHER", userId: "qa-teacher" },
  });
  mocks.query.mockResolvedValue([row]);
});
afterEach(() => vi.useRealTimers());
test("returns exact SQL totals and divides merged study time by every scoped student", async () => {
  expect(await getGestaoOverviewWeek({})).toMatchObject({
    activeCohorts: 2,
    activeStudents: 10,
    students: 12,
    submissions: 9,
    reviewed: 5,
    lessons: 42,
    lessonChangePercent: 100,
    averageStudySeconds: 11_400,
  });
});
test("does not invent a percentage or average with an empty baseline or audience", async () => {
  mocks.query.mockResolvedValue([
    { ...row, students: 0n, previousLessons: 0n, studySeconds: 0n },
  ]);
  expect(await getGestaoOverviewWeek({})).toMatchObject({
    lessonChangePercent: null,
    averageStudySeconds: null,
  });
});
test("zero study time with actual students remains a measured zero", async () => {
  mocks.query.mockResolvedValue([{ ...row, studySeconds: 0n }]);
  expect((await getGestaoOverviewWeek({})).averageStudySeconds).toBe(0);
});
test("authorizes before executing the aggregate", async () => {
  mocks.authorize.mockRejectedValue(new Error("forbidden"));
  await expect(getGestaoOverviewWeek({})).rejects.toThrow("forbidden");
  expect(mocks.query).not.toHaveBeenCalled();
});
test("rejects a cohort outside the SQL scope rather than widening the statistics", async () => {
  mocks.query.mockResolvedValue([{ ...row, accessible: false }]);
  await expect(getGestaoOverviewWeek({ cohortId: "foreign" })).rejects.toThrow(
    "forbidden"
  );
});
test("bounds selector input before the query", async () => {
  await expect(
    getGestaoOverviewWeek({ cohortId: "x".repeat(256) })
  ).rejects.toThrow("forbidden");
  expect(mocks.query).not.toHaveBeenCalled();
});
test("uses parameterized scope and UTC timestamp comparisons with equal elapsed weeks", async () => {
  await getGestaoOverviewWeek({ cohortId: "cohort' OR true--" });
  const query = mocks.query.mock.calls[0][0];
  expect(query.text).not.toContain("cohort' OR true--");
  expect(query.values).toContain("cohort' OR true--");
  expect(query.values).toContain("qa-teacher");
  expect(query.values).toContain("2026-10-12T03:00:00.000Z");
  expect(query.values).toContain("2026-10-05T03:00:00.000Z");
  expect(query.values).toContain("2026-10-06T12:00:00.000Z");
  expect(query.text).toContain("AT TIME ZONE 'UTC'");
});
test.each([
  ["2026-10-12T02:59:59Z", "2026-10-05T03:00:00.000Z"],
  ["2026-10-12T03:00:00Z", "2026-10-12T03:00:00.000Z"],
])("starts the week in São Paulo at the Monday boundary %s", async (now, start) => {
  vi.setSystemTime(new Date(now));
  expect((await getGestaoOverviewWeek({})).startsAt).toBe(start);
});
