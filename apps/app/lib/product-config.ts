import "server-only";

import {
  ContentStatus,
  CourseExperience,
  database,
  MemberRole,
  Prisma,
} from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import { cache } from "react";
import { getMemberRole } from "./authorization";
import type { LearningAccessScope } from "./content-access";

export const productSettingKeys = {
  recordingsExperienceV2: "recordingsExperienceV2",
  showLearnNavigation: "showLearnNavigation",
} as const;

export interface MemberProductConfig {
  readonly recordingsExperienceV2: boolean;
  readonly showLearnNavigation: boolean;
}

const defaults: MemberProductConfig = {
  recordingsExperienceV2: true,
  showLearnNavigation: true,
};

const booleanValue = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export const getProductConfig = cache(async () => {
  const settings = await database.productSetting.findMany({
    where: {
      key: { in: Object.values(productSettingKeys) },
    },
    select: { key: true, value: true },
  });
  const values = new Map(
    settings.map((setting) => [setting.key, setting.value])
  );

  return {
    recordingsExperienceV2: booleanValue(
      values.get(productSettingKeys.recordingsExperienceV2),
      defaults.recordingsExperienceV2
    ),
    showLearnNavigation: booleanValue(
      values.get(productSettingKeys.showLearnNavigation),
      defaults.showLearnNavigation
    ),
  } satisfies MemberProductConfig;
});

export const buildPublishedLearningContentWhere = (
  scope: LearningAccessScope
): Prisma.CourseWhereInput => ({
  status: ContentStatus.PUBLISHED,
  experience: CourseExperience.ASYNC,
  learningPath: { is: { status: ContentStatus.PUBLISHED } },
  ...(scope.fullAccess ? {} : { id: { in: [...scope.courseIds] } }),
});

const hasPublishedLearningPath = () =>
  database.course.findFirst({
    where: {
      status: ContentStatus.PUBLISHED,
      experience: CourseExperience.ASYNC,
      learningPath: { is: { status: ContentStatus.PUBLISHED } },
    },
    select: { id: true },
  });

/**
 * The navigation only needs to know whether one published async course is
 * reachable. Building the full access scope here used to read enrollments,
 * grants and assignments, then expand parents in up to three more queries on
 * every authenticated route. Keep the authorization conditions in one
 * parameterized PostgreSQL existence query instead.
 */
const hasAccessiblePublishedLearningContent = async (memberId: string) => {
  const role = await getMemberRole(memberId);
  if (role === MemberRole.TEACHER || role === MemberRole.ADMIN) {
    return Boolean(await hasPublishedLearningPath());
  }

  const now = new Date();
  const rows = await database.$queryRaw<Array<{ accessible: boolean }>>(
    Prisma.sql`
      WITH active_grants AS (
        SELECT "resourceType", "resourceId"
        FROM "AccessGrant"
        WHERE "memberId" = ${memberId}
          AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
      ),
      active_assignments AS (
        SELECT "targetType", "targetId"
        FROM "ActivityAssignment"
        WHERE "memberId" = ${memberId}
          AND "targetType" IN ('COURSE', 'MODULE', 'LESSON', 'ASSET')
          AND "status" IN ('NEW', 'VIEWED', 'STARTED', 'COMPLETED')
          AND "revokedAt" IS NULL
          AND ("availableAt" IS NULL OR "availableAt" <= ${now})
          AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
      ),
      accessible_course_ids AS (
        SELECT "courseId"
        FROM "Enrollment"
        WHERE "memberId" = ${memberId}
          AND "status" IN ('ACTIVE', 'COMPLETED')
        UNION ALL
        SELECT "resourceId" AS "courseId"
        FROM active_grants
        WHERE "resourceType" = 'COURSE'
        UNION ALL
        SELECT module."courseId"
        FROM "Module" AS module
        JOIN active_grants AS grant_row
          ON grant_row."resourceId" = module."id"
         AND grant_row."resourceType" = 'MODULE'
        UNION ALL
        SELECT module."courseId"
        FROM "Lesson" AS lesson
        JOIN "Module" AS module ON module."id" = lesson."moduleId"
        JOIN active_grants AS grant_row
          ON grant_row."resourceId" = lesson."id"
         AND grant_row."resourceType" = 'LESSON'
        UNION ALL
        SELECT module."courseId"
        FROM "LessonAsset" AS asset
        JOIN "Lesson" AS lesson ON lesson."id" = asset."lessonId"
        JOIN "Module" AS module ON module."id" = lesson."moduleId"
        JOIN active_grants AS grant_row
          ON grant_row."resourceId" = asset."id"
         AND grant_row."resourceType" = 'ASSET'
        UNION ALL
        SELECT "targetId" AS "courseId"
        FROM active_assignments
        WHERE "targetType" = 'COURSE'
        UNION ALL
        SELECT module."courseId"
        FROM "Module" AS module
        JOIN active_assignments AS assignment
          ON assignment."targetId" = module."id"
         AND assignment."targetType" = 'MODULE'
        UNION ALL
        SELECT module."courseId"
        FROM "Lesson" AS lesson
        JOIN "Module" AS module ON module."id" = lesson."moduleId"
        JOIN active_assignments AS assignment
          ON assignment."targetId" = lesson."id"
         AND assignment."targetType" = 'LESSON'
        UNION ALL
        SELECT module."courseId"
        FROM "LessonAsset" AS asset
        JOIN "Lesson" AS lesson ON lesson."id" = asset."lessonId"
        JOIN "Module" AS module ON module."id" = lesson."moduleId"
        JOIN active_assignments AS assignment
          ON assignment."targetId" = asset."id"
         AND assignment."targetType" = 'ASSET'
      )
      SELECT EXISTS (
        SELECT 1
        FROM "Course" AS course
        JOIN "LearningPath" AS path
          ON path."id" = course."learningPathId"
        WHERE course."status" = 'PUBLISHED'
          AND course."experience" = 'ASYNC'
          AND path."status" = 'PUBLISHED'
          AND course."id" IN (SELECT "courseId" FROM accessible_course_ids)
      ) AS "accessible"
    `
  );

  return rows[0]?.accessible === true;
};

export const getMemberProductConfig = cache(async (memberId: string) => {
  const [config, hasAccessibleContent] = await Promise.all([
    getProductConfig(),
    tracePerformance("member.navigation.learning-access", () =>
      hasAccessiblePublishedLearningContent(memberId)
    ),
  ]);

  return {
    ...config,
    // A flag can intentionally turn Learn off, but it cannot make an empty
    // learning area look available to members.
    showLearnNavigation: config.showLearnNavigation && hasAccessibleContent,
  } satisfies MemberProductConfig;
});
