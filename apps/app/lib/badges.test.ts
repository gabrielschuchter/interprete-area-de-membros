import { beforeEach, expect, test, vi } from "vitest";

const { enqueueNotificationBatchMock, withMemberIdentityLockMock } = vi.hoisted(
  () => ({
    enqueueNotificationBatchMock: vi.fn(),
    withMemberIdentityLockMock: vi.fn(
      async (
        _transaction: unknown,
        _memberId: string,
        callback: () => unknown
      ) => callback()
    ),
  })
);

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  BadgeCriterion: {
    STUDY_MINUTES: "STUDY_MINUTES",
    STUDY_STREAK_DAYS: "STUDY_STREAK_DAYS",
    STUDY_GOALS_MET: "STUDY_GOALS_MET",
    EXERCISE_ANSWERS: "EXERCISE_ANSWERS",
  },
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  Prisma: { empty: {}, sql: vi.fn() },
  database: {},
  StudyGoalPeriod: { WEEKLY: "WEEKLY", MONTHLY: "MONTHLY" },
}));
vi.mock("@repo/member-domain", () => ({
  enqueueNotificationBatch: enqueueNotificationBatchMock,
  withMemberIdentityLock: withMemberIdentityLockMock,
}));

import { BadgeCriterion, type Prisma } from "@repo/database";
import { evaluateMemberBadges, shouldThrottleBadgeEvaluation } from "./badges";

beforeEach(() => {
  enqueueNotificationBatchMock.mockReset().mockResolvedValue([]);
  withMemberIdentityLockMock.mockClear();
});

test("throttles only repeated full or study-only evaluations", () => {
  expect(shouldThrottleBadgeEvaluation(undefined, false)).toBe(true);
  expect(
    shouldThrottleBadgeEvaluation(
      [BadgeCriterion.STUDY_MINUTES, BadgeCriterion.STUDY_GOALS_MET],
      false
    )
  ).toBe(true);
  expect(
    shouldThrottleBadgeEvaluation([BadgeCriterion.EXERCISE_ANSWERS], false)
  ).toBe(false);
  expect(
    shouldThrottleBadgeEvaluation([BadgeCriterion.EXERCISE_ANSWERS], true)
  ).toBe(false);
});

test("awards a qualifying event badge once despite a recent study evaluation", async () => {
  let awarded = false;
  const transaction = {
    badgeAward: {
      createMany: vi.fn(() => {
        awarded = true;
        return { count: 1 };
      }),
      findMany: vi.fn(async () =>
        awarded ? [{ badgeId: "badge_exercise" }] : []
      ),
    },
    badgeDefinition: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "badge_exercise",
          slug: "primeira-sessao",
          title: "Primeira sessão",
          criterion: BadgeCriterion.EXERCISE_ANSWERS,
          threshold: 1,
          version: 1,
        },
      ]),
    },
    badgeDefinitionRevision: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "revision_1", badgeId: "badge_exercise", version: 1 },
        ]),
    },
    badgeEvaluationState: {
      findUnique: vi.fn().mockResolvedValue({
        id: "member_1",
        lastEvaluatedAt: new Date("2026-10-03T14:59:30.000Z"),
      }),
      upsert: vi.fn(),
    },
    exerciseAnswer: { count: vi.fn().mockResolvedValue(1) },
  } as unknown as Prisma.TransactionClient;

  const now = new Date("2026-10-03T15:00:00.000Z");
  await expect(
    evaluateMemberBadges(transaction, "member_1", now, {
      criteria: [BadgeCriterion.EXERCISE_ANSWERS],
    })
  ).resolves.toHaveLength(1);
  await expect(
    evaluateMemberBadges(transaction, "member_1", now, {
      criteria: [BadgeCriterion.EXERCISE_ANSWERS],
    })
  ).resolves.toEqual([]);

  expect(transaction.badgeEvaluationState.findUnique).not.toHaveBeenCalled();
  expect(transaction.badgeEvaluationState.upsert).not.toHaveBeenCalled();
  expect(transaction.badgeAward.createMany).toHaveBeenCalledTimes(1);
  expect(enqueueNotificationBatchMock).toHaveBeenCalledTimes(1);
});
