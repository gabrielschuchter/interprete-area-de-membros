import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  list: vi.fn(),
  scope: vi.fn(),
  started: vi.fn(),
  criteria: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  LearningAssignmentStatus: { REVOKED: "REVOKED" },
  LearningAssignmentTargetType: { ACTIVITY: "ACTIVITY" },
  MemberRole: { ADMIN: "ADMIN" },
  database: {
    activity: { findFirst: mocks.find, findMany: mocks.list },
    activityRubricCriterion: { findMany: mocks.criteria },
  },
}));
vi.mock("./content-access", () => ({
  getLearningAccessScope: mocks.scope,
  hasLessonAccess: () => false,
}));
vi.mock("@/lib/learning-assignments", () => ({
  markLearningAssignmentStarted: mocks.started,
}));

import {
  canAccessPublishedActivity,
  filterAccessibleLessonActivities,
  getPublishedActivities,
  getPublishedActivity,
  lessonActivitySelect,
} from "./activities";

const activity = {
  id: "activity",
  courseId: null,
  lesson: null,
  assignments: [],
  cohortTargets: [],
  submissions: [],
  _count: { assignments: 0, cohortTargets: 1 },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.scope.mockResolvedValue({
    fullAccess: false,
    fullCourseIds: new Set(),
  });
  mocks.find.mockResolvedValue(activity);
  mocks.list.mockResolvedValue([activity]);
  mocks.criteria.mockResolvedValue([]);
});

test("denies submission access to a targeted standalone activity outside the cohort", async () => {
  expect(await canAccessPublishedActivity("activity", "outsider")).toBe(false);
});
test("does not list or return a targeted standalone activity to an outsider", async () => {
  expect(await getPublishedActivities("outsider")).toEqual([]);
  expect(await getPublishedActivity("slug", "outsider")).toBeNull();
  expect(mocks.started).not.toHaveBeenCalled();
});
test("expired or revoked individual assignment does not turn the activity global", async () => {
  mocks.find.mockResolvedValue({
    ...activity,
    _count: { assignments: 1, cohortTargets: 0 },
  });
  expect(await canAccessPublishedActivity("activity", "outsider")).toBe(false);
});
test("preserves legacy global activities that have never had recipients", async () => {
  mocks.find.mockResolvedValue({
    ...activity,
    _count: { assignments: 0, cohortTargets: 0 },
  });
  expect(await canAccessPublishedActivity("activity", "member")).toBe(true);
});
test("an effective individual assignment remains an independent source", async () => {
  mocks.find.mockResolvedValue({ ...activity, assignments: [{ dueAt: null }] });
  expect(await canAccessPublishedActivity("activity", "assigned-member")).toBe(
    true
  );
});
test("an active cohort member can read the targeted activity", async () => {
  mocks.find.mockResolvedValue({
    ...activity,
    cohortTargets: [
      {
        assignedAt: new Date("2026-10-12"),
        cohort: {
          archivedAt: null,
          endsAt: null,
          startsAt: new Date("2026-10-01"),
          lateJoinPolicy: "ALL_ACTIVE",
          readAfterEndDays: 90,
          memberships: [{ joinedAt: new Date("2026-10-01") }],
        },
      },
    ],
  });
  expect(await canAccessPublishedActivity("activity", "enrolled-member")).toBe(
    true
  );
});
test("FROM_JOIN still denies an older assignment instead of falling back to global", async () => {
  mocks.find.mockResolvedValue({
    ...activity,
    cohortTargets: [
      {
        assignedAt: new Date("2026-10-01"),
        cohort: {
          archivedAt: null,
          endsAt: null,
          startsAt: new Date("2026-10-01"),
          lateJoinPolicy: "FROM_JOIN",
          readAfterEndDays: 90,
          memberships: [{ joinedAt: new Date("2026-10-12") }],
        },
      },
    ],
  });
  expect(await canAccessPublishedActivity("activity", "late-member")).toBe(
    false
  );
});
test("course entitlement and staff access keep their independent authorization", async () => {
  mocks.find.mockResolvedValue({ ...activity, courseId: "course" });
  mocks.scope.mockResolvedValue({
    fullAccess: false,
    fullCourseIds: new Set(["course"]),
  });
  expect(await canAccessPublishedActivity("activity", "course-member")).toBe(
    true
  );
  mocks.scope.mockResolvedValue({ fullAccess: true, fullCourseIds: new Set() });
  expect(await canAccessPublishedActivity("activity", "staff")).toBe(true);
});

test("lesson links include only activities authorized for the member", () => {
  const restricted = {
    ...activity,
    id: "restricted",
    title: "Restrita",
    slug: "restrita",
    dueAt: null,
  };
  const legacy = {
    ...activity,
    id: "legacy",
    title: "Global legada",
    slug: "global-legada",
    dueAt: null,
    _count: { assignments: 0, cohortTargets: 0 },
  };
  const visible = filterAccessibleLessonActivities([restricted, legacy], {
    assetIds: new Set(),
    courseIds: new Set(),
    fullAccess: false,
    fullCourseIds: new Set(),
    lessonIds: new Set(),
    moduleIds: new Set(),
    recordingIds: new Set(),
  });

  expect(visible).toEqual([
    {
      id: "legacy",
      slug: "global-legada",
      title: "Global legada",
      dueAt: null,
    },
  ]);
  const select = lessonActivitySelect("outsider");
  expect(select.assignments.where).toEqual(
    expect.objectContaining({ memberId: "outsider" })
  );
  expect(select.cohortTargets.where.cohort.is.memberships.some.memberId).toBe(
    "outsider"
  );
});
