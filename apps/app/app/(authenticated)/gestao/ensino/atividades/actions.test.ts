import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  rateLimit: vi.fn(),
  transaction: vi.fn(),
  cohortTarget: vi.fn(),
  memberships: vi.fn(),
  submissions: vi.fn(),
  enqueue: vi.fn(),
  dispatch: vi.fn(),
  revalidate: vi.fn(),
}));

const transactionClient = {
  activityCohortTarget: { findFirst: mocks.cohortTarget },
  cohortMembership: { findMany: mocks.memberships },
  activitySubmission: { findMany: mocks.submissions },
};

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ActivityDeliveryKind: {
    TEXT: "TEXT",
    FILE: "FILE",
    TEXT_AND_FILE: "TEXT_AND_FILE",
  },
  ActivitySubmissionStatus: { SUBMITTED: "SUBMITTED", REVIEWED: "REVIEWED" },
  ContentStatus: {
    DRAFT: "DRAFT",
    PUBLISHED: "PUBLISHED",
    ARCHIVED: "ARCHIVED",
  },
  LearningAssignmentStatus: { REVOKED: "REVOKED" },
  LearningAssignmentTargetType: { ACTIVITY: "ACTIVITY" },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER", MEMBER: "MEMBER" },
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
  database: {
    $transaction: mocks.transaction,
    activity: { findUnique: vi.fn() },
    activityCohortTarget: { findFirst: mocks.cohortTarget },
    activitySubmission: { findMany: mocks.submissions },
    cohort: { findMany: vi.fn() },
    cohortMembership: { findMany: mocks.memberships },
    learningAssignment: { findMany: vi.fn() },
  },
}));
vi.mock("@repo/member-domain", () => ({
  enqueueNotificationBatch: mocks.enqueue,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));
vi.mock("@/lib/gestao-authorization", () => ({
  requireGestaoAction: mocks.authorize,
}));
vi.mock("@/lib/learning-assignments", () => ({
  enqueueLearningAssignmentNotifications: vi.fn(),
  reconcileActivityAssignments: vi.fn(),
}));
vi.mock("@/lib/mutation-reliability", () => ({
  consumeMutationRateLimit: mocks.rateLimit,
  isUniqueConstraintError: () => false,
}));
vi.mock("@/lib/notification-outbox-dispatch", () => ({
  dispatchPendingNotifications: mocks.dispatch,
}));

import { remindGestaoActivityCohort, saveGestaoActivity } from "./actions";

const idempotencyKey = "f1f40553-c3ae-4dc6-a16b-3e4bb522ac40";
const activity = {
  id: "activity-qa",
  slug: "atividade-qa",
  title: "Atividade QA",
};
const cohortId = "cohort-qa";
const publishedTarget = {
  assignedAt: new Date("2026-10-10T12:00:00Z"),
  cohortId,
  cohort: {
    archivedAt: null,
    endsAt: null,
    lateJoinPolicy: "ALL_ACTIVE",
    readAfterEndDays: 90,
    startsAt: new Date("2026-10-01T00:00:00Z"),
  },
  activity,
};

const reminderForm = (overrides: Record<string, string> = {}) => {
  const form = new FormData();
  for (const [name, value] of Object.entries({
    activityId: activity.id,
    cohortId,
    idempotencyKey,
    ...overrides,
  })) {
    form.set(name, value);
  }
  return form;
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({
    actor: { userId: "teacher-qa", role: "TEACHER" },
  });
  mocks.transaction.mockImplementation(
    (run: (transaction: typeof transactionClient) => unknown) =>
      run(transactionClient)
  );
  mocks.cohortTarget.mockResolvedValue(publishedTarget);
  mocks.memberships.mockResolvedValue([
    {
      cohortId,
      joinedAt: new Date("2026-10-02T00:00:00Z"),
      memberId: "student-submitted",
    },
    {
      cohortId,
      joinedAt: new Date("2026-10-02T00:00:00Z"),
      memberId: "student-pending-1",
    },
    {
      cohortId,
      joinedAt: new Date("2026-10-02T00:00:00Z"),
      memberId: "student-pending-2",
    },
    {
      cohortId: "another-cohort",
      joinedAt: new Date("2026-10-02T00:00:00Z"),
      memberId: "student-outside",
    },
  ]);
  mocks.submissions.mockResolvedValue([{ memberId: "student-submitted" }]);
});

describe("Gestão activity publication and reminders", () => {
  it("rejects a 99% rubric before any activity or audience write", async () => {
    const form = new FormData();
    for (const [name, value] of Object.entries({
      intent: "publish",
      idempotencyKey,
      title: "Atividade QA",
      slug: "atividade-qa",
      prompt: "Explique o raciocínio.",
      instructions: "",
      deliveryKind: "TEXT",
      dueAt: "2026-10-20T18:00",
      cohortIds: cohortId,
      courseId: "",
      lessonId: "",
      relatedLibraryItemId: "",
    })) {
      form.set(name, value);
    }
    form.append("rubricTitle", "Critério principal");
    form.append("rubricWeight", "49");
    form.append("rubricTitle", "Evidência");
    form.append("rubricWeight", "50");

    await expect(saveGestaoActivity(form)).rejects.toThrow(
      "REDIRECT:/gestao/ensino/atividades/nova?resultado=criteria"
    );

    expect(mocks.authorize).toHaveBeenCalledWith("content.manage");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("reminds only eligible cohort members without a submitted or reviewed delivery", async () => {
    mocks.transaction.mockImplementation(
      (
        run: (transaction: typeof transactionClient) => Promise<unknown>,
        options: unknown
      ) => {
        expect(options).toEqual({ isolationLevel: "Serializable" });
        return run(transactionClient);
      }
    );

    await expect(remindGestaoActivityCohort(reminderForm())).rejects.toThrow(
      `REDIRECT:/gestao/ensino/atividades/${activity.id}?resultado=lembretes-enviados`
    );

    expect(mocks.authorize).toHaveBeenCalledWith("assignments.manage");
    expect(mocks.cohortTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activityId: activity.id,
          cohortId,
          activeKey: { not: null },
          revokedAt: null,
          activity: { is: { status: "PUBLISHED" } },
          cohort: {
            is: {
              archivedAt: null,
              teachers: { some: { memberId: "teacher-qa" } },
            },
          },
        }),
      })
    );
    expect(mocks.memberships.mock.calls[0]?.[0]).toMatchObject({
      where: {
        cohortId,
        status: "ACTIVE",
        leftAt: null,
        member: {
          is: {
            role: "MEMBER",
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
      },
    });
    expect(mocks.submissions.mock.calls[0]?.[0]).toMatchObject({
      where: {
        activityId: activity.id,
        status: { in: ["SUBMITTED", "REVIEWED"] },
        submittedAt: { not: null },
      },
    });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        aggregateId: activity.id,
        aggregateType: "activity.reminder",
        notifications: [
          expect.objectContaining({
            recipientId: "student-pending-1",
            type: "ACTIVITY_DEADLINE",
            href: "/atividades/atividade-qa",
          }),
          expect.objectContaining({
            recipientId: "student-pending-2",
            type: "ACTIVITY_DEADLINE",
            href: "/atividades/atividade-qa",
          }),
        ],
      })
    );
    expect(mocks.dispatch).toHaveBeenCalledOnce();
    expect(mocks.revalidate).toHaveBeenCalledWith(
      `/gestao/ensino/atividades/${activity.id}`
    );
  });

  it("does not enqueue reminders when the selected activity target is no longer authorized", async () => {
    mocks.cohortTarget.mockResolvedValue(null);

    await expect(remindGestaoActivityCohort(reminderForm())).rejects.toThrow(
      "NOT_FOUND"
    );

    expect(mocks.memberships).not.toHaveBeenCalled();
    expect(mocks.submissions).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("returns an explicit empty state when every eligible learner has submitted", async () => {
    mocks.memberships.mockResolvedValue([
      {
        cohortId,
        joinedAt: new Date("2026-10-02T00:00:00Z"),
        memberId: "student-submitted",
      },
    ]);

    await expect(remindGestaoActivityCohort(reminderForm())).rejects.toThrow(
      `REDIRECT:/gestao/ensino/atividades/${activity.id}?resultado=sem-pendentes`
    );

    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("distinguishes a cohort with no current activity access from completed submissions", async () => {
    mocks.cohortTarget.mockResolvedValue({
      ...publishedTarget,
      cohort: {
        ...publishedTarget.cohort,
        startsAt: new Date("2026-10-15T00:00:00Z"),
      },
    });

    await expect(remindGestaoActivityCohort(reminderForm())).rejects.toThrow(
      `REDIRECT:/gestao/ensino/atividades/${activity.id}?resultado=sem-elegiveis`
    );

    expect(mocks.submissions).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
