import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cohortList: vi.fn(),
  cohortFind: vi.fn(),
  count: vi.fn(),
  list: vi.fn(),
  authorize: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ActivitySubmissionStatus: { SUBMITTED: "SUBMITTED", REVIEWED: "REVIEWED" },
  database: {
    cohort: { findMany: mocks.cohortList, findFirst: mocks.cohortFind },
    activitySubmission: { count: mocks.count, findMany: mocks.list },
  },
}));
vi.mock("./gestao-authorization", () => ({
  requireGestaoAction: mocks.authorize,
}));
vi.mock("next/navigation", () => ({
  forbidden: () => {
    throw new Error("forbidden");
  },
}));

import { getGestaoCorrectionQueue } from "./gestao-corrections";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({
    actor: { role: "TEACHER", userId: "qa" },
  });
  mocks.cohortList.mockResolvedValue([{ id: "own", name: "Turma própria" }]);
  mocks.cohortFind.mockResolvedValue(null);
  mocks.count.mockResolvedValue(0);
  mocks.list.mockImplementation((input) => {
    if (!Number.isInteger(input.skip)) {
      throw new Error("Prisma skip must be an integer");
    }
    return Promise.resolve([]);
  });
});
test.each([
  undefined,
  Number(undefined),
  0,
  -1,
])("opens the dashboard queue link on page one when pagina is %s", async (page) => {
  const queue = await getGestaoCorrectionQueue({ page });
  expect(queue.page).toBe(1);
  expect(queue.submissions).toEqual([]);
});
test("denies a foreign cohort filter before querying submissions", async () => {
  await expect(
    getGestaoCorrectionQueue({ cohortId: "foreign" })
  ).rejects.toThrow("forbidden");
  expect(mocks.count).not.toHaveBeenCalled();
  expect(mocks.list).not.toHaveBeenCalled();
});
test("retains an authorized selection beyond the initial cohort option page", async () => {
  mocks.cohortFind.mockResolvedValue({
    id: "own-beyond-options",
    name: "Outra turma própria",
  });
  const queue = await getGestaoCorrectionQueue({
    cohortId: "own-beyond-options",
  });
  expect(queue.cohortId).toBe("own-beyond-options");
  expect(queue.cohorts).toContainEqual({
    id: "own-beyond-options",
    name: "Outra turma própria",
  });
});
