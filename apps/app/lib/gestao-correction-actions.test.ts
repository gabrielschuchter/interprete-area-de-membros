import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  preview: vi.fn(),
  criteria: vi.fn(),
  transaction: vi.fn(),
  enqueue: vi.fn(),
  dispatch: vi.fn(),
  revalidate: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ActivitySubmissionStatus: { SUBMITTED: "SUBMITTED", REVIEWED: "REVIEWED" },
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
  database: {
    activitySubmission: { findFirst: mocks.preview },
    activityRubricCriterion: { findMany: mocks.criteria },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@repo/member-domain", () => ({
  enqueueNotificationBatch: mocks.enqueue,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  forbidden: () => {
    throw new Error("forbidden");
  },
}));
vi.mock("@/lib/gestao-authorization", () => ({
  requireGestaoAction: mocks.authorize,
}));
vi.mock("@/lib/mutation-reliability", () => ({
  consumeMutationRateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/notification-outbox-dispatch", () => ({
  dispatchPendingNotifications: mocks.dispatch,
}));

import { saveGestaoCorrection } from "./gestao-correction-actions";

const submittedAt = new Date("2026-10-12T12:00:00Z");
const updatedAt = new Date("2026-10-12T13:00:00Z");
const submission = {
  id: "submission-qa",
  activityId: "activity-qa",
  memberId: "student-qa",
  rubricVersion: 0,
  status: "SUBMITTED",
  submittedAt,
  updatedAt,
  activity: { title: "Atividade QA", slug: "atividade-qa" },
};
const transaction = {
  member: { findUnique: vi.fn() },
  activitySubmission: { findFirst: vi.fn(), updateMany: vi.fn() },
  activityFeedbackDraft: { findUnique: vi.fn(), deleteMany: vi.fn() },
  feedback: { findUnique: vi.fn(), create: vi.fn() },
};
const review = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    submissionId: submission.id,
    intent: "send",
    submittedAt: submittedAt.toISOString(),
    submissionUpdatedAt: updatedAt.toISOString(),
    draftVersion: "0",
    feedbackVersion: "0",
    content: "Orientação do professor.",
    returnTo: "/gestao/alunos/correcoes?turma=own",
  })) {
    data.set(key, value);
  }
  return data;
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({
    actor: { userId: "teacher-qa", role: "TEACHER" },
  });
  mocks.preview.mockResolvedValue(submission);
  mocks.criteria.mockResolvedValue([]);
  transaction.member.findUnique.mockResolvedValue({
    role: "TEACHER",
    deactivatedAt: null,
  });
  transaction.activitySubmission.findFirst.mockResolvedValue(submission);
  transaction.activitySubmission.updateMany.mockResolvedValue({ count: 1 });
  transaction.activityFeedbackDraft.findUnique.mockResolvedValue(null);
  transaction.feedback.findUnique.mockResolvedValue(null);
  transaction.feedback.create.mockResolvedValue({ id: "feedback-qa" });
  mocks.transaction.mockImplementation((callback) => callback(transaction));
});

test("denies a foreign submission before transaction or notification writes", async () => {
  mocks.preview.mockResolvedValue(null);
  await expect(
    saveGestaoCorrection({ status: "idle" }, review())
  ).rejects.toThrow("forbidden");
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.enqueue).not.toHaveBeenCalled();
});
test.each([
  { role: "MEMBER", deactivatedAt: null },
  { role: "TEACHER", deactivatedAt: new Date() },
  null,
])("rechecks current activation and role in the transaction", async (member) => {
  transaction.member.findUnique.mockResolvedValue(member);
  await expect(
    saveGestaoCorrection({ status: "idle" }, review())
  ).rejects.toThrow("forbidden");
  expect(transaction.activitySubmission.findFirst).not.toHaveBeenCalled();
  expect(transaction.feedback.create).not.toHaveBeenCalled();
  expect(mocks.enqueue).not.toHaveBeenCalled();
});
test("shrinks an initially global admin scope to the current teacher scope", async () => {
  mocks.authorize.mockResolvedValue({
    actor: { userId: "teacher-qa", role: "ADMIN" },
  });
  transaction.activitySubmission.findFirst.mockResolvedValue(null);
  await expect(
    saveGestaoCorrection({ status: "idle" }, review())
  ).rejects.toThrow("forbidden");
  expect(transaction.activitySubmission.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        member: {
          is: {
            deactivatedAt: null,
            cohortMemberships: {
              some: {
                status: "ACTIVE",
                leftAt: null,
                cohort: {
                  is: {
                    archivedAt: null,
                    teachers: { some: { memberId: "teacher-qa" } },
                  },
                },
              },
            },
          },
        },
      }),
    })
  );
  expect(transaction.feedback.create).not.toHaveBeenCalled();
});
test("keeps optimistic version conflicts separate from permission denials", async () => {
  transaction.activitySubmission.findFirst.mockResolvedValue({
    ...submission,
    updatedAt: new Date(updatedAt.getTime() + 1000),
  });
  await expect(
    saveGestaoCorrection({ status: "idle" }, review())
  ).resolves.toMatchObject({ status: "error", code: "conflito" });
  expect(transaction.feedback.create).not.toHaveBeenCalled();
  expect(mocks.enqueue).not.toHaveBeenCalled();
});
test("publishes only after commit, invalidates the overview, and never deletes a draft when none existed", async () => {
  let commit: (() => void) | undefined;
  mocks.transaction.mockImplementation(async (callback) => {
    const result = await callback(transaction);
    await new Promise<void>((resolveCommit) => {
      commit = resolveCommit;
    });
    return result;
  });
  const result = saveGestaoCorrection({ status: "idle" }, review());
  await vi.waitFor(() => expect(commit).toBeTypeOf("function"));
  expect(mocks.revalidate).not.toHaveBeenCalled();
  expect(mocks.dispatch).not.toHaveBeenCalled();
  if (!commit) {
    throw new Error("Commit barrier was not installed");
  }
  commit();
  await expect(result).resolves.toMatchObject({
    status: "success",
    code: "feedback-enviado",
  });
  expect(transaction.activityFeedbackDraft.deleteMany).not.toHaveBeenCalled();
  expect(mocks.revalidate).toHaveBeenCalledWith("/gestao");
  expect(mocks.enqueue).toHaveBeenCalledWith(
    transaction,
    expect.objectContaining({
      idempotencyKey: "activity-feedback:submission-qa:v1",
    })
  );
});
