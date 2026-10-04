import "server-only";

import {
  AccessResourceType,
  database,
  LearningAssignmentTargetType,
  MemberRole,
} from "@repo/database";
import { cache } from "react";
import { getMemberRole } from "./authorization";
import { activeAssignmentStatuses } from "./learning-assignments";

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

interface MutableAccessScope {
  assetIds: Set<string>;
  courseIds: Set<string>;
  fullAccess: false;
  fullCourseIds: Set<string>;
  lessonIds: Set<string>;
  moduleIds: Set<string>;
}

const addResourceAccess = (
  scope: MutableAccessScope,
  resourceType: AccessResourceType | LearningAssignmentTargetType,
  resourceId: string
) => {
  switch (resourceType) {
    case AccessResourceType.COURSE:
    case LearningAssignmentTargetType.COURSE:
      scope.fullCourseIds.add(resourceId);
      scope.courseIds.add(resourceId);
      break;
    case AccessResourceType.MODULE:
    case LearningAssignmentTargetType.MODULE:
      scope.moduleIds.add(resourceId);
      break;
    case AccessResourceType.LESSON:
    case LearningAssignmentTargetType.LESSON:
      scope.lessonIds.add(resourceId);
      break;
    case AccessResourceType.ASSET:
    case LearningAssignmentTargetType.ASSET:
      scope.assetIds.add(resourceId);
      break;
    default:
      return;
  }
};

const buildScopedResources = (
  enrollments: readonly { courseId: string }[],
  grants: readonly { resourceType: AccessResourceType; resourceId: string }[],
  assignments: readonly {
    targetType: LearningAssignmentTargetType;
    targetId: string;
  }[]
): MutableAccessScope => {
  const fullCourseIds = new Set(enrollments.map(({ courseId }) => courseId));
  const scope: MutableAccessScope = {
    ...emptyScope(),
    fullAccess: false,
    fullCourseIds,
    courseIds: new Set(fullCourseIds),
    moduleIds: new Set(),
    lessonIds: new Set(),
    assetIds: new Set(),
  };
  for (const grant of grants) {
    addResourceAccess(scope, grant.resourceType, grant.resourceId);
  }
  for (const assignment of assignments) {
    addResourceAccess(scope, assignment.targetType, assignment.targetId);
  }
  return scope;
};

const expandParentResources = async (scope: MutableAccessScope) => {
  const [modules, lessons, assets] = await Promise.all([
    scope.moduleIds.size
      ? database.module.findMany({
          where: { id: { in: [...scope.moduleIds] } },
          select: { id: true, courseId: true },
        })
      : [],
    scope.lessonIds.size
      ? database.lesson.findMany({
          where: { id: { in: [...scope.lessonIds] } },
          select: {
            id: true,
            moduleId: true,
            module: { select: { courseId: true } },
          },
        })
      : [],
    scope.assetIds.size
      ? database.lessonAsset.findMany({
          where: { id: { in: [...scope.assetIds] } },
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

  for (const module of modules) {
    scope.courseIds.add(module.courseId);
  }
  for (const lesson of lessons) {
    scope.moduleIds.add(lesson.moduleId);
    scope.courseIds.add(lesson.module.courseId);
  }
  for (const asset of assets) {
    scope.lessonIds.add(asset.lessonId);
    scope.moduleIds.add(asset.lesson.moduleId);
    scope.courseIds.add(asset.lesson.module.courseId);
  }
};

const getLearningAccessScopeUncached = async (
  memberId: string
): Promise<LearningAccessScope> => {
  const role = await getMemberRole(memberId);

  if (role === MemberRole.TEACHER || role === MemberRole.ADMIN) {
    return {
      ...emptyScope(),
      fullAccess: true,
    };
  }

  const now = new Date();
  const [enrollments, grants, assignments] = await Promise.all([
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
    database.activityAssignment.findMany({
      where: {
        memberId,
        status: { in: [...activeAssignmentStatuses] },
        revokedAt: null,
        AND: [
          { OR: [{ availableAt: null }, { availableAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      select: { targetType: true, targetId: true },
    }),
  ]);

  const scope = buildScopedResources(enrollments, grants, assignments);
  await expandParentResources(scope);

  return {
    fullAccess: false,
    fullCourseIds: scope.fullCourseIds,
    courseIds: scope.courseIds,
    moduleIds: scope.moduleIds,
    lessonIds: scope.lessonIds,
    assetIds: scope.assetIds,
  };
};

export const getLearningAccessScope = cache(getLearningAccessScopeUncached);

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
      mediaProvider: true,
      mediaExternalId: true,
      mimeType: true,
      durationSeconds: true,
      ownerMemberId: true,
      importedRecording: {
        select: {
          id: true,
          group: { select: { memberId: true } },
        },
      },
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
  const canReadAsset = asset.importedRecording
    ? scope.fullAccess ||
      asset.importedRecording.group.memberId === memberId ||
      scope.assetIds.has(asset.id)
    : scope.fullAccess ||
      (asset.scope === "GENERAL" && canReadLesson) ||
      asset.ownerMemberId === memberId ||
      scope.assetIds.has(asset.id);

  return canReadAsset ? asset : null;
};

/**
 * Playback progress belongs to the historical-recording domain only. Keeping
 * this guard separate prevents an async LessonAsset from accidentally being
 * treated as a recording merely because it is video-shaped.
 */
export const getAccessibleRecording = async (
  assetId: string,
  memberId: string
) => {
  const asset = await getAccessibleAsset(assetId, memberId);
  return asset?.importedRecording ? asset : null;
};

/**
 * Lightweight authorization check for the short-lived HLS segment capability.
 *
 * Playlist requests perform the full asset lookup and issue the capability.
 * Segment requests still re-check the current recording-group pointer so an
 * assignment revocation takes effect immediately instead of waiting for a
 * previously issued playlist token to expire.
 */
export const canReadRecordingAsset = async (
  assetId: string,
  memberId: string
) => {
  const [role, asset, scope] = await Promise.all([
    getMemberRole(memberId),
    database.lessonAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        importedRecording: {
          select: { group: { select: { memberId: true } } },
        },
      },
    }),
    getLearningAccessScope(memberId),
  ]);

  if (role === MemberRole.ADMIN || role === MemberRole.TEACHER) {
    return Boolean(asset?.importedRecording);
  }

  return (
    asset?.importedRecording?.group.memberId === memberId ||
    Boolean(asset?.importedRecording && scope.assetIds.has(asset.id))
  );
};
