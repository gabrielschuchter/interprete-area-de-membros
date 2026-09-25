import "server-only";

import { AccessResourceType, database, MemberRole } from "@repo/database";
import { getMemberRole } from "./authorization";

const activeGrant = {
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
};

export interface LearningAccessScope {
  readonly assetIds: ReadonlySet<string>;
  readonly courseIds: ReadonlySet<string>;
  readonly fullAccess: boolean;
  readonly fullCourseIds: ReadonlySet<string>;
  readonly lessonIds: ReadonlySet<string>;
  readonly moduleIds: ReadonlySet<string>;
}

const emptyScope = (): LearningAccessScope => ({
  fullAccess: false,
  fullCourseIds: new Set(),
  courseIds: new Set(),
  moduleIds: new Set(),
  lessonIds: new Set(),
  assetIds: new Set(),
});

export const getLearningAccessScope = async (
  memberId: string
): Promise<LearningAccessScope> => {
  const role = await getMemberRole(memberId);

  if (role === MemberRole.TEACHER || role === MemberRole.ADMIN) {
    return {
      ...emptyScope(),
      fullAccess: true,
    };
  }

  const [enrollments, grants] = await Promise.all([
    database.enrollment.findMany({
      where: {
        memberId,
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
      select: { courseId: true },
    }),
    database.accessGrant.findMany({
      where: { memberId, ...activeGrant },
      select: { resourceType: true, resourceId: true },
    }),
  ]);

  const fullCourseIds = new Set(enrollments.map(({ courseId }) => courseId));
  const courseIds = new Set(fullCourseIds);
  const moduleIds = new Set<string>();
  const lessonIds = new Set<string>();
  const assetIds = new Set<string>();

  for (const grant of grants) {
    if (grant.resourceType === AccessResourceType.COURSE) {
      fullCourseIds.add(grant.resourceId);
      courseIds.add(grant.resourceId);
    }
    if (grant.resourceType === AccessResourceType.MODULE) {
      moduleIds.add(grant.resourceId);
    }
    if (grant.resourceType === AccessResourceType.LESSON) {
      lessonIds.add(grant.resourceId);
    }
    if (grant.resourceType === AccessResourceType.ASSET) {
      assetIds.add(grant.resourceId);
    }
  }

  const [grantedModules, grantedLessons, grantedAssets] = await Promise.all([
    moduleIds.size
      ? database.module.findMany({
          where: { id: { in: [...moduleIds] } },
          select: { id: true, courseId: true },
        })
      : [],
    lessonIds.size
      ? database.lesson.findMany({
          where: { id: { in: [...lessonIds] } },
          select: {
            id: true,
            moduleId: true,
            module: { select: { courseId: true } },
          },
        })
      : [],
    assetIds.size
      ? database.lessonAsset.findMany({
          where: { id: { in: [...assetIds] } },
          select: {
            id: true,
            lessonId: true,
            lesson: {
              select: {
                moduleId: true,
                module: { select: { courseId: true } },
              },
            },
          },
        })
      : [],
  ]);

  for (const module of grantedModules) {
    courseIds.add(module.courseId);
  }
  for (const lesson of grantedLessons) {
    moduleIds.add(lesson.moduleId);
    courseIds.add(lesson.module.courseId);
  }
  for (const asset of grantedAssets) {
    lessonIds.add(asset.lessonId);
    moduleIds.add(asset.lesson.moduleId);
    courseIds.add(asset.lesson.module.courseId);
  }

  return {
    fullAccess: false,
    fullCourseIds,
    courseIds,
    moduleIds,
    lessonIds,
    assetIds,
  };
};

export const hasCourseAccess = (scope: LearningAccessScope, courseId: string) =>
  scope.fullAccess || scope.courseIds.has(courseId);

export const hasFullCourseAccess = (
  scope: LearningAccessScope,
  courseId: string
) => scope.fullAccess || scope.fullCourseIds.has(courseId);

export const hasModuleAccess = (
  scope: LearningAccessScope,
  courseId: string,
  moduleId: string
) =>
  scope.fullAccess ||
  scope.fullCourseIds.has(courseId) ||
  scope.moduleIds.has(moduleId);

export const hasLessonAccess = (
  scope: LearningAccessScope,
  courseId: string,
  moduleId: string,
  lessonId: string
) =>
  scope.fullAccess ||
  scope.fullCourseIds.has(courseId) ||
  scope.moduleIds.has(moduleId) ||
  scope.lessonIds.has(lessonId);

export const filterAccessibleAssets = <
  T extends {
    id: string;
    scope: string;
    ownerMemberId: string | null;
  },
>(
  assets: readonly T[],
  scope: LearningAccessScope,
  memberId: string
) =>
  assets.filter(
    (asset) =>
      scope.fullAccess ||
      asset.scope === "GENERAL" ||
      asset.ownerMemberId === memberId ||
      scope.assetIds.has(asset.id)
  );

export const getAccessibleAsset = async (assetId: string, memberId: string) => {
  const asset = await database.lessonAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      title: true,
      kind: true,
      scope: true,
      storagePath: true,
      externalUrl: true,
      mimeType: true,
      ownerMemberId: true,
      lesson: {
        select: {
          id: true,
          moduleId: true,
          module: { select: { courseId: true } },
        },
      },
    },
  });

  if (!asset) {
    return null;
  }

  const scope = await getLearningAccessScope(memberId);
  const canReadLesson = hasLessonAccess(
    scope,
    asset.lesson.module.courseId,
    asset.lesson.moduleId,
    asset.lesson.id
  );
  const canReadAsset =
    scope.fullAccess ||
    (asset.scope === "GENERAL" && canReadLesson) ||
    asset.ownerMemberId === memberId ||
    scope.assetIds.has(asset.id);

  return canReadAsset ? asset : null;
};
