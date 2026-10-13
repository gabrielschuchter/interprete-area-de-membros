import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  actor: vi.fn(),
  rate: vi.fn(),
  notify: vi.fn(),
  dispatch: vi.fn(),
  invalidate: vi.fn(),
  preview: vi.fn(),
  criteria: vi.fn(),
  tx: {
    member: { findUnique: vi.fn() },
    activitySubmission: { findFirst: vi.fn(), updateMany: vi.fn() },
    activityFeedbackDraft: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    feedback: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@repo/database", () => ({
  ActivitySubmissionStatus: { SUBMITTED: "SUBMITTED", REVIEWED: "REVIEWED" },
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
  database: {
    activitySubmission: { findFirst: mocks.preview },
    activityRubricCriterion: { findMany: mocks.criteria },
    $transaction: (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx),
  },
}));
vi.mock("@repo/member-domain", () => ({
  enqueueNotificationBatch: mocks.notify,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    mocks.redirect(href);
    throw new Error("REDIRECT");
  },
  forbidden: () => {
    throw new Error("FORBIDDEN");
  },
}));
vi.mock("@/lib/gestao-authorization", () => ({
  requireGestaoAction: mocks.actor,
}));
vi.mock("@/lib/mutation-reliability", () => ({
  consumeMutationRateLimit: mocks.rate,
}));
vi.mock("@/lib/notification-outbox-dispatch", () => ({
  dispatchPendingNotifications: mocks.dispatch,
}));

import { saveGestaoCorrection } from "./gestao-correction-actions";

const submittedAt = new Date("2026-10-12T10:00:00Z");
const updatedAt = new Date("2026-10-12T11:00:00Z");
const record = {
  id: "first",
  activityId: "activity",
  memberId: "student",
  status: "SUBMITTED",
  submittedAt,
  updatedAt,
  rubricVersion: 1,
  activity: { slug: "activity", title: "Activity" },
};
const form = (intent = "send") => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    submissionId: "first",
    intent,
    submittedAt: submittedAt.toISOString(),
    submissionUpdatedAt: updatedAt.toISOString(),
    draftVersion: "0",
    feedbackVersion: "0",
    content: "feedback",
    "score:criterion": "8",
    returnTo:
      "/gestao/ensino/atividades/activity/entregas?turma=cohort&q=Activity&pagina=9",
  })) {
    data.set(key, value);
  }
  return data;
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({
    actor: { userId: "teacher", role: "TEACHER" },
  });
  mocks.preview.mockResolvedValue(record);
  mocks.criteria.mockResolvedValue([{ id: "criterion", weight: 100 }]);
  mocks.tx.member.findUnique.mockResolvedValue({
    role: "TEACHER",
    deactivatedAt: null,
  });
  mocks.tx.activitySubmission.findFirst
    .mockResolvedValueOnce(record)
    .mockResolvedValue({ id: "next" });
  mocks.tx.activitySubmission.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.activityFeedbackDraft.findUnique.mockResolvedValue(null);
  mocks.tx.feedback.findUnique.mockResolvedValue(null);
  mocks.tx.activityFeedbackDraft.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.activityFeedbackDraft.deleteMany.mockResolvedValue({ count: 1 });
});
test("draft does not send, review or choose another submission", async () => {
  const result = await saveGestaoCorrection({ status: "idle" }, form("draft"));
  expect(result).toMatchObject({ status: "success", code: "rascunho-salvo" });
  expect(
    new URL(result.href ?? "", "http://local").searchParams.get("entrega")
  ).toBe("first");
  expect(mocks.tx.activityFeedbackDraft.create).toHaveBeenCalledOnce();
  expect(mocks.tx.feedback.create).not.toHaveBeenCalled();
  expect(mocks.tx.activitySubmission.updateMany).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
  expect(mocks.dispatch).not.toHaveBeenCalled();
  expect(mocks.tx.activitySubmission.findFirst).toHaveBeenCalledTimes(1);
});
test("sending selects only pending recipients in the same authorized filters", async () => {
  await expect(
    saveGestaoCorrection({ status: "idle" }, form())
  ).rejects.toThrow("REDIRECT");
  const next = mocks.tx.activitySubmission.findFirst.mock.calls[1][0];
  expect(next.select).toEqual({ id: true });
  expect(next.orderBy).toEqual([{ submittedAt: "asc" }, { id: "asc" }]);
  const scope = JSON.stringify(next.where);
  for (const value of [
    "teacher",
    "cohort",
    "activity",
    "Activity",
    "SUBMITTED",
  ]) {
    expect(scope).toContain(value);
  }
  expect(next.where.AND).toContainEqual({ id: { not: "first" } });
  expect(
    new URL(mocks.redirect.mock.calls[0][0], "http://local").searchParams.get(
      "entrega"
    )
  ).toBe("next");
  expect(mocks.notify).toHaveBeenCalledOnce();
});
test("a stale draft cannot overwrite or send", async () => {
  mocks.tx.activityFeedbackDraft.findUnique.mockResolvedValue({ version: 2 });
  expect(await saveGestaoCorrection({ status: "idle" }, form())).toEqual({
    status: "error",
    code: "conflito",
  });
  expect(mocks.tx.feedback.create).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
});
test("a submission changed after opening cannot send", async () => {
  mocks.tx.activitySubmission.findFirst
    .mockReset()
    .mockResolvedValue({ ...record, updatedAt: new Date() });
  expect(await saveGestaoCorrection({ status: "idle" }, form())).toEqual({
    status: "error",
    code: "conflito",
  });
  expect(mocks.tx.feedback.create).not.toHaveBeenCalled();
});
test.each([
  null,
  { role: "MEMBER", deactivatedAt: null },
  { role: "TEACHER", deactivatedAt: new Date() },
])("fresh actor revocation rejects writes", async (actor) => {
  mocks.tx.member.findUnique.mockResolvedValue(actor);
  await expect(
    saveGestaoCorrection({ status: "idle" }, form())
  ).rejects.toThrow("FORBIDDEN");
  expect(mocks.tx.feedback.create).not.toHaveBeenCalled();
  expect(mocks.tx.activityFeedbackDraft.create).not.toHaveBeenCalled();
});
test("foreign recipient cannot save a draft", async () => {
  mocks.tx.activitySubmission.findFirst.mockReset().mockResolvedValue(null);
  await expect(
    saveGestaoCorrection({ status: "idle" }, form("draft"))
  ).rejects.toThrow("FORBIDDEN");
  expect(mocks.tx.activityFeedbackDraft.create).not.toHaveBeenCalled();
});
test("sending consumes exactly the loaded draft version", async () => {
  mocks.tx.activityFeedbackDraft.findUnique.mockResolvedValue({ version: 1 });
  const data = form();
  data.set("draftVersion", "1");
  await expect(saveGestaoCorrection({ status: "idle" }, data)).rejects.toThrow(
    "REDIRECT"
  );
  expect(mocks.tx.activityFeedbackDraft.deleteMany).toHaveBeenCalledWith({
    where: { submissionId: "first", version: 1 },
  });
});
