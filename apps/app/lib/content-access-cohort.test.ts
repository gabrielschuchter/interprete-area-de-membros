import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { databaseMock, getMemberRole } = vi.hoisted(() => ({
  databaseMock: {
    accessGrant: { findMany: vi.fn() },
    accessGrantSource: { findMany: vi.fn() },
    activityAssignment: { findMany: vi.fn() },
    cohortMembership: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    lesson: { findMany: vi.fn() },
    lessonAsset: { findMany: vi.fn() },
    module: { findMany: vi.fn() },
  },
  getMemberRole: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  AccessResourceType: {
    COURSE: "COURSE",
    MODULE: "MODULE",
    LESSON: "LESSON",
    ASSET: "ASSET",
  },
  AccessGrantOrigin: { OPEN_ACCESS: "OPEN_ACCESS" },
  LearningAssignmentTargetType: {
    COURSE: "COURSE",
    MODULE: "MODULE",
    LESSON: "LESSON",
    ASSET: "ASSET",
    RECORDING: "RECORDING",
    LIBRARY_ITEM: "LIBRARY_ITEM",
  },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER", MEMBER: "MEMBER" },
  database: databaseMock,
}));
vi.mock("@repo/observability/performance", () => ({
  tracePerformance: (_name: string, operation: () => unknown) => operation(),
}));
vi.mock("./authorization", () => ({ getMemberRole }));
vi.mock("./learning-assignments", () => ({
  activeAssignmentStatuses: ["NEW", "VIEWED", "STARTED", "COMPLETED"],
}));
vi.mock("./recordings", () => ({
  getAccessibleRecordingIds: vi.fn().mockResolvedValue([]),
}));

import {
  getLearningAccessScope,
  hasCourseAccess,
  hasFullCourseAccess,
  hasLessonAccess,
  isCourseReadOnly,
} from "./content-access";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

const membership = (input: {
  readonly cohortId?: string;
  readonly lateJoinPolicy?: "ALL_ACTIVE" | "FROM_JOIN";
  readonly courseCreatedDaysAgo?: number;
  readonly endsDaysAgo?: number | null;
  readonly lessonReleases?: readonly {
    readonly lessonId: string;
    readonly releaseAt: Date;
    readonly lesson: { readonly module: { readonly courseId: string } };
  }[];
}) => ({
  cohortId: input.cohortId ?? "cohort-a",
  joinedAt: daysAgo(10),
  cohort: {
    archivedAt: null,
    endsAt:
      input.endsDaysAgo === null || input.endsDaysAgo === undefined
        ? null
        : daysAgo(input.endsDaysAgo),
    lateJoinPolicy: input.lateJoinPolicy ?? "ALL_ACTIVE",
    readAfterEndDays: 90,
    startsAt: daysAgo(30),
    lessonReleases: input.lessonReleases ?? [],
    courseAccesses: [
      {
        courseId: "course-a",
        createdAt: daysAgo(input.courseCreatedDaysAgo ?? 20),
        releaseMode: "ALL_AT_ONCE",
        startsAt: null,
        revokedAt: null,
      },
    ],
  },
});

describe("cohort-backed learning access", () => {
  beforeEach(() => {
    databaseMock.accessGrant.findMany.mockReset().mockResolvedValue([]);
    databaseMock.accessGrantSource.findMany.mockReset().mockResolvedValue([]);
    databaseMock.activityAssignment.findMany.mockReset().mockResolvedValue([]);
    databaseMock.cohortMembership.findMany.mockReset().mockResolvedValue([]);
    databaseMock.enrollment.findMany.mockReset().mockResolvedValue([]);
    databaseMock.lesson.findMany.mockReset().mockResolvedValue([]);
    databaseMock.lessonAsset.findMany.mockReset().mockResolvedValue([]);
    databaseMock.module.findMany.mockReset().mockResolvedValue([]);
    getMemberRole.mockReset().mockResolvedValue("MEMBER");
  });

  it("unions an active cohort course into the existing access resolver", async () => {
    databaseMock.cohortMembership.findMany.mockResolvedValue([membership({})]);

    const scope = await getLearningAccessScope("member-a");

    expect(hasCourseAccess(scope, "course-a")).toBe(true);
    expect(hasFullCourseAccess(scope, "course-a")).toBe(true);
    expect(isCourseReadOnly(scope, "course-a")).toBe(false);
    expect(scope.origins).toContainEqual({
      origin: "COHORT",
      originRefId: "cohort-a",
      resourceId: "course-a",
      resourceType: "COURSE",
      validUntil: null,
    });
  });

  it("grants course access to every member through an open source", async () => {
    const now = new Date();
    databaseMock.accessGrantSource.findMany.mockResolvedValue([
      {
        createdAt: now,
        origin: "OPEN_ACCESS",
        originRefId: "course-a",
        resourceId: "course-a",
        resourceType: "COURSE",
        validFrom: new Date(now.getTime() - 1000),
        validUntil: null,
        revokedAt: null,
        subjectMemberId: null,
        subjectCohortId: null,
        subjectCohort: null,
      },
    ]);

    const scope = await getLearningAccessScope("member-a");

    expect(hasCourseAccess(scope, "course-a")).toBe(true);
    expect(hasFullCourseAccess(scope, "course-a")).toBe(true);
    expect(scope.origins).toContainEqual({
      origin: "OPEN_ACCESS",
      originRefId: "course-a",
      resourceId: "course-a",
      resourceType: "COURSE",
      validUntil: null,
    });
  });

  it("blocks a lesson until its cohort release date", async () => {
    databaseMock.cohortMembership.findMany.mockResolvedValue([
      membership({
        lessonReleases: [
          {
            lessonId: "lesson-a",
            releaseAt: daysAgo(-1),
            lesson: { module: { courseId: "course-a" } },
          },
        ],
      }),
    ]);
    databaseMock.lesson.findMany.mockResolvedValue([
      {
        id: "lesson-a",
        moduleId: "module-a",
        module: { courseId: "course-a" },
      },
    ]);

    const scope = await getLearningAccessScope("member-a");

    expect(scope.unavailableLessonIds?.has("lesson-a")).toBe(true);
    expect(hasLessonAccess(scope, "course-a", "module-a", "lesson-a")).toBe(
      false
    );
  });
  it("applies FROM_JOIN without changing older direct enrollments", async () => {
    databaseMock.cohortMembership.findMany.mockResolvedValue([
      membership({ lateJoinPolicy: "FROM_JOIN", courseCreatedDaysAgo: 20 }),
    ]);

    const scope = await getLearningAccessScope("member-a");

    expect(hasCourseAccess(scope, "course-a")).toBe(false);
  });

  it("keeps ended cohort course access read-only during the configured grace period", async () => {
    databaseMock.cohortMembership.findMany.mockResolvedValue([
      membership({ endsDaysAgo: 10 }),
    ]);

    const scope = await getLearningAccessScope("member-a");

    expect(hasCourseAccess(scope, "course-a")).toBe(true);
    expect(isCourseReadOnly(scope, "course-a")).toBe(true);
  });

  it("expires cohort access immediately after the read window", async () => {
    databaseMock.cohortMembership.findMany.mockResolvedValue([
      membership({ endsDaysAgo: 91 }),
    ]);

    const scope = await getLearningAccessScope("member-a");

    expect(hasCourseAccess(scope, "course-a")).toBe(false);
  });

  it("keeps a library-item assignment scoped to that exact item", async () => {
    databaseMock.activityAssignment.findMany.mockResolvedValue([
      {
        id: "assignment-item-1",
        targetType: "LIBRARY_ITEM",
        targetId: "library-item-1",
      },
    ]);

    const scope = await getLearningAccessScope("member-a");

    expect(scope.libraryItemIds).toEqual(new Set(["library-item-1"]));
    expect(scope.lessonIds.size).toBe(0);
    expect(scope.moduleIds.size).toBe(0);
    expect(scope.courseIds.size).toBe(0);
  });

  it("lets an independent enrollment keep a cohort course writable", async () => {
    databaseMock.enrollment.findMany.mockResolvedValue([
      { courseId: "course-a" },
    ]);
    databaseMock.cohortMembership.findMany.mockResolvedValue([
      membership({ endsDaysAgo: 10 }),
    ]);

    const scope = await getLearningAccessScope("member-a");

    expect(hasFullCourseAccess(scope, "course-a")).toBe(true);
    expect(isCourseReadOnly(scope, "course-a")).toBe(false);
  });
});
