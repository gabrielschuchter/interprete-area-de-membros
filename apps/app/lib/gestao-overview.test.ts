import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  cohortCount: vi.fn(),
  cohortFind: vi.fn(),
  cohortList: vi.fn(),
  pendingCount: vi.fn(),
  pendingList: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ActivitySubmissionStatus: { SUBMITTED: "SUBMITTED" },
  database: {
    cohort: {
      count: mocks.cohortCount,
      findFirst: mocks.cohortFind,
      findMany: mocks.cohortList,
    },
    activitySubmission: {
      count: mocks.pendingCount,
      findMany: mocks.pendingList,
    },
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

import { getGestaoCorrectionSubmissionScope } from "./gestao-correction-scope";
import { getGestaoOverviewAttention } from "./gestao-overview";

const actor = {
  userId: "teacher-qa",
  role: "TEACHER" as const,
  displayName: "Docente QA",
  avatarUrl: null,
  email: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ actor });
  mocks.cohortCount.mockResolvedValue(2);
  mocks.cohortFind.mockResolvedValue({
    id: "cohort-own",
    name: "Turma própria",
  });
  mocks.cohortList.mockResolvedValue([
    { id: "cohort-own", name: "Turma própria" },
  ]);
  mocks.pendingCount.mockResolvedValue(9);
  mocks.pendingList.mockResolvedValue([
    { activity: { title: "Atividade A" } },
    { activity: { title: "Atividade B" } },
  ]);
});

test("counts all pending submissions rather than the two rendered titles and links to the same scope", async () => {
  const data = await getGestaoOverviewAttention({ cohortId: "cohort-own" });
  expect(data.pendingCount).toBe(9);
  expect(data.pendingActivityTitles).toEqual(["Atividade A", "Atividade B"]);
  expect(data.correctionsHref).toBe(
    "/gestao/alunos/correcoes?estado=PENDING&turma=cohort-own"
  );
  expect(mocks.pendingCount).toHaveBeenCalledWith({
    where: {
      AND: [
        getGestaoCorrectionSubmissionScope(actor, { cohortId: "cohort-own" }),
        { status: "SUBMITTED" },
      ],
    },
  });
});

test("does not fall back to every cohort when a selected cohort is outside the current scope", async () => {
  mocks.cohortFind.mockResolvedValue(null);
  await expect(
    getGestaoOverviewAttention({ cohortId: "cohort-foreign" })
  ).rejects.toThrow("forbidden");
  expect(mocks.pendingCount).not.toHaveBeenCalled();
  expect(mocks.pendingList).not.toHaveBeenCalled();
});

test("does not read any overview data before authorization succeeds", async () => {
  mocks.authorize.mockRejectedValue(new Error("forbidden"));
  await expect(getGestaoOverviewAttention({})).rejects.toThrow("forbidden");
  expect(mocks.cohortCount).not.toHaveBeenCalled();
  expect(mocks.pendingCount).not.toHaveBeenCalled();
});

test("paginates cohort search while keeping the selected cohort outside the visible page", async () => {
  mocks.cohortCount.mockResolvedValueOnce(20).mockResolvedValueOnce(11);
  mocks.cohortList.mockResolvedValue([
    { id: "cohort-other", name: "Outro resultado" },
  ]);
  const data = await getGestaoOverviewAttention({
    cohortId: "cohort-own",
    cohortQuery: "resultado",
    cohortPage: 999,
  });
  expect(data.cohortFilter).toMatchObject({
    page: 2,
    pages: 2,
    selectedCohort: { id: "cohort-own" },
  });
  expect(mocks.cohortList).toHaveBeenCalledWith(
    expect.objectContaining({ skip: 10, take: 10 })
  );
  expect(data.correctionsHref).toContain("turma=cohort-own");
});

test("an empty cohort search does not erase pending submissions in the chosen scope", async () => {
  mocks.cohortCount.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
  mocks.cohortList.mockResolvedValue([]);
  const data = await getGestaoOverviewAttention({ cohortQuery: "nenhuma" });
  expect(data.pendingCount).toBe(9);
  expect(data.cohortCount).toBe(2);
  expect(data.cohortFilter.total).toBe(0);
  expect(data.correctionsHref).toBe("/gestao/alunos/correcoes?estado=PENDING");
});
