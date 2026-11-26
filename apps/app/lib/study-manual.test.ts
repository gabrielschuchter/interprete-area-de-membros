import { beforeEach, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const transaction = {
  studyTrackingSession: { findMany: vi.fn(), create: vi.fn() },
};
const database = {
  $transaction: vi.fn((run: (tx: typeof transaction) => unknown) =>
    run(transaction)
  ),
  studyTrackingSession: { deleteMany: vi.fn() },
};
vi.mock("@repo/database", () => ({
  BadgeCriterion: {
    STUDY_MINUTES: "STUDY_MINUTES",
    STUDY_STREAK_DAYS: "STUDY_STREAK_DAYS",
    STUDY_GOALS_MET: "STUDY_GOALS_MET",
  },
  database,
  StudyActivityKind: { PERSONAL_TIMER: "PERSONAL_TIMER" },
}));
vi.mock("./badges", () => ({ evaluateMemberBadges: vi.fn() }));

const EIGHT_HOURS = /8 horas/;

const { addManualStudyEntry, deleteManualStudyEntry } = await import(
  "./study-manual"
);

beforeEach(() => {
  vi.clearAllMocks();
  transaction.studyTrackingSession.findMany.mockResolvedValue([]);
  transaction.studyTrackingSession.create.mockResolvedValue({ id: "s1" });
});

test("grava a sessão manual como cronômetro pessoal com um intervalo contável", async () => {
  await addManualStudyEntry("m1", { group: "reading", minutes: 30 });
  const data = transaction.studyTrackingSession.create.mock.calls[0]?.[0]
    .data as {
    activityKind: string;
    clientSessionId: string;
    intervals: { create: { isPlayback: boolean; seconds: number } };
    memberId: string;
  };
  expect(data.memberId).toBe("m1");
  expect(data.activityKind).toBe("PERSONAL_TIMER");
  expect(data.clientSessionId.startsWith("manual:reading:")).toBe(true);
  expect(data.intervals.create.seconds).toBe(1800);
  expect(data.intervals.create.isPlayback).toBe(false);
});

test("recusa minutos fora do limite e grupos desconhecidos", async () => {
  await expect(
    addManualStudyEntry("m1", { group: "reading", minutes: 0 })
  ).rejects.toThrow();
  await expect(
    addManualStudyEntry("m1", { group: "reading", minutes: 181 })
  ).rejects.toThrow();
  await expect(
    addManualStudyEntry("m1", { group: "outro", minutes: 10 })
  ).rejects.toThrow();
  expect(transaction.studyTrackingSession.create).not.toHaveBeenCalled();
});

test("barra o excesso de lançamentos manuais no mesmo dia", async () => {
  transaction.studyTrackingSession.findMany.mockResolvedValue([
    { intervals: [{ seconds: 470 * 60 }] },
  ]);
  await expect(
    addManualStudyEntry("m1", { group: "lesson", minutes: 15 })
  ).rejects.toThrow(EIGHT_HOURS);
});

test("só desfaz lançamento manual do próprio membro", async () => {
  database.studyTrackingSession.deleteMany.mockResolvedValue({ count: 1 });
  await deleteManualStudyEntry("m1", "s1");
  expect(database.studyTrackingSession.deleteMany).toHaveBeenCalledWith({
    where: {
      id: "s1",
      memberId: "m1",
      clientSessionId: { startsWith: "manual:" },
    },
  });
  database.studyTrackingSession.deleteMany.mockResolvedValue({ count: 0 });
  await expect(deleteManualStudyEntry("m1", "real")).rejects.toThrow(
    "Lançamento não encontrado."
  );
});
