import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const database = {
    $queryRaw: vi.fn(),
    course: { findFirst: vi.fn() },
    productSetting: { findMany: vi.fn() },
  };
  const getMemberRole = vi.fn();
  const sql = (parts: TemplateStringsArray, ...values: unknown[]) => ({
    text: parts.reduce(
      (text, part, index) =>
        `${text}${part}${index < values.length ? `$${index + 1}` : ""}`,
      ""
    ),
    values,
  });

  return { database, getMemberRole, sql };
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  CourseExperience: { ASYNC: "ASYNC" },
  MemberRole: { MEMBER: "MEMBER", TEACHER: "TEACHER", ADMIN: "ADMIN" },
  Prisma: { sql: mocks.sql },
  database: mocks.database,
}));
vi.mock("@repo/observability/performance", () => ({
  tracePerformance: (_name: string, operation: () => Promise<unknown>) =>
    operation(),
}));
vi.mock("./authorization", () => ({ getMemberRole: mocks.getMemberRole }));

import {
  buildPublishedLearningContentWhere,
  getMemberProductConfig,
} from "./product-config";

const accessScope = (
  input: Partial<{
    assetIds: string[];
    courseIds: string[];
    fullAccess: boolean;
    fullCourseIds: string[];
    lessonIds: string[];
    moduleIds: string[];
    recordingIds: string[];
  }> = {}
) => ({
  assetIds: new Set(input.assetIds ?? []),
  courseIds: new Set(input.courseIds ?? []),
  fullAccess: input.fullAccess ?? false,
  fullCourseIds: new Set(input.fullCourseIds ?? []),
  lessonIds: new Set(input.lessonIds ?? []),
  moduleIds: new Set(input.moduleIds ?? []),
  recordingIds: new Set(input.recordingIds ?? []),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.database.productSetting.findMany.mockResolvedValue([]);
  mocks.database.course.findFirst.mockResolvedValue({ id: "course_1" });
  mocks.database.$queryRaw.mockResolvedValue([{ accessible: true }]);
  mocks.getMemberRole.mockResolvedValue("MEMBER");
});

test("staff access checks for a published async course on a published path", () => {
  expect(
    buildPublishedLearningContentWhere(accessScope({ fullAccess: true }))
  ).toEqual({
    status: "PUBLISHED",
    experience: "ASYNC",
    learningPath: { is: { status: "PUBLISHED" } },
  });
});

test("member access scopes the existence check to accessible courses", () => {
  const where = buildPublishedLearningContentWhere(
    accessScope({
      courseIds: ["course_1", "course_2", "course_3"],
      fullCourseIds: ["course_1"],
      moduleIds: ["module_2"],
      lessonIds: ["lesson_3"],
    })
  );

  expect(where.id).toEqual({
    in: ["course_1", "course_2", "course_3"],
  });
  expect(where.learningPath).toEqual({ is: { status: "PUBLISHED" } });
});

test("a member without course access cannot see learning content in the menu", () => {
  const where = buildPublishedLearningContentWhere(accessScope());

  expect(where.id).toEqual({ in: [] });
});

test("member menu access uses one parameterized existence query", async () => {
  const config = await getMemberProductConfig("member-1");

  expect(config.showLearnNavigation).toBe(true);
  expect(mocks.database.$queryRaw).toHaveBeenCalledTimes(1);
  expect(mocks.database.course.findFirst).not.toHaveBeenCalled();
  const query = mocks.database.$queryRaw.mock.calls[0]?.[0];
  expect(query.text).toContain('"Enrollment"');
  expect(query.text).toContain('"AccessGrant"');
  expect(query.text).toContain('"ActivityAssignment"');
  expect(query.text).toContain('"LessonAsset"');
  expect(query.text).toContain('"LearningPath"');
  expect(query.values).toContain("member-1");
});

test("staff menu access keeps the published-course existence check", async () => {
  mocks.getMemberRole.mockResolvedValue("TEACHER");

  const config = await getMemberProductConfig("teacher-1");

  expect(config.showLearnNavigation).toBe(true);
  expect(mocks.database.course.findFirst).toHaveBeenCalledWith({
    where: {
      status: "PUBLISHED",
      experience: "ASYNC",
      learningPath: { is: { status: "PUBLISHED" } },
    },
    select: { id: true },
  });
  expect(mocks.database.$queryRaw).not.toHaveBeenCalled();
});
