import "server-only";

import {
  AccessGrantOrigin,
  AccessResourceType,
  database,
  LearningAssignmentTargetType,
  MemberRole,
} from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import { cache } from "react";
import { getMemberRole } from "./authorization";
import {
  accessGrantSourceIsEffective,
  cohortEndedReadUntil,
  resolveCohortCourseAccess,
  resolveLockedCohortLessons,
} from "./cohort-domain";
import { activeAssignmentStatuses } from "./learning-assignments";
import type { MeetingCohortMembership } from "./meeting-cohort-access";
import { getAccessibleRecordingIds } from "./recordings";

export const activeGrantFilter = (now: Date) => ({
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

export interface LearningAccessOrigin {
  readonly origin: string;
  readonly originRefId: string | null;
  readonly resourceId: string;
  readonly resourceType: string;
  readonly validUntil: Date | null;
}

export interface LearningAccessScope {
  readonly assetIds: ReadonlySet<string>;
  readonly cohortIds?: ReadonlySet<string>;
  readonly cohortMemberships?: ReadonlyMap<string, MeetingCohortMembership>;
  readonly courseIds: ReadonlySet<string>;
  readonly fullAccess: boolean;
  readonly fullCourseIds: ReadonlySet<string>;
  readonly lessonIds: ReadonlySet<string>;
  readonly moduleIds: ReadonlySet<string>;
  readonly origins?: readonly LearningAccessOrigin[];
  readonly readOnlyCourseIds?: ReadonlySet<string>;
  readonly recordingIds: ReadonlySet<string>;
  readonly unavailableLessonIds?: ReadonlySet<string>;
}

const emptyScope = (): LearningAccessScope => ({
  fullAccess: false,
  fullCourseIds: new Set(),
  courseIds: new Set(),
  cohortIds: new Set(),
  cohortMemberships: new Map(),
  moduleIds: new Set(),
  unavailableLessonIds: new Set(),
  lessonIds: new Set(),
  recordingIds: new Set(),
  assetIds: new Set(),
  origins: [],
  readOnlyCourseIds: new Set(),
});

interface MutableAccessScope {
  assetIds: Set<string>;
  courseIds: Set<string>;
  fullAccess: false;
  fullCourseIds: Set<string>;
  lessonIds: Set<string>;
  moduleIds: Set<string>;
  origins: LearningAccessOrigin[];
  readOnlyCourseIds: Set<string>;
  recordingIds: Set<string>;
  unavailableLessonIds: Set<string>;
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
    case LearningAssignmentTargetType.RECORDING:
      scope.recordingIds.add(resourceId);
      break;
    default:
      return;
  }
};

const addImmediateCohortLessonAccessPath = (
  paths: Array<{
    courseId: string;
    releases: Array<{ lessonId: string; releaseAt: Date }>;
  }>,
  hasMembership: boolean,
  resourceType: AccessResourceType,
  courseId: string
) => {
  if (hasMembership && resourceType === AccessResourceType.COURSE) {
    paths.push({ courseId, releases: [] });
  }
};

const addCohortResourceAccess = (
  scope: MutableAccessScope,
  grant: {
    readonly origin: string;
    readonly originRefId: string | null;
    readonly resourceId: string;
    readonly resourceType: AccessResourceType;
    readonly validUntil: Date | null;
  },
  readOnly: boolean,
  hasIndependentFullCourseAccess: boolean
) => {
  addResourceAccess(scope, grant.resourceType, grant.resourceId);
  scope.origins.push({
    origin: grant.origin,
    originRefId: grant.originRefId,
    resourceId: grant.resourceId,
    resourceType: grant.resourceType,
    validUntil: grant.validUntil,
  });
  if (grant.resourceType === AccessResourceType.COURSE) {
    if (readOnly && !hasIndependentFullCourseAccess) {
      scope.readOnlyCourseIds.add(grant.resourceId);
    } else {
      scope.readOnlyCourseIds.delete(grant.resourceId);
    }
  }
};

const buildScopedResources = (
  enrollments: readonly { courseId: string }[],
  grants: readonly {
    readonly resourceType: AccessResourceType;
    readonly resourceId: string;
    readonly sourceId?: string | null;
    readonly expiresAt?: Date | null;
  }[],
  assignments: readonly {
    readonly id?: string;
    readonly targetType: LearningAssignmentTargetType;
    readonly targetId: string;
  }[],
  directSources: readonly {
    readonly origin: string;
    readonly originRefId: string | null;
    readonly resourceId: string;
    readonly resourceType: AccessResourceType;
    readonly validUntil: Date | null;
  }[]
): MutableAccessScope => {
  const fullCourseIds = new Set(enrollments.map(({ courseId }) => courseId));
  const scope: MutableAccessScope = {
    ...emptyScope(),
    fullAccess: false,
    fullCourseIds,
    courseIds: new Set(fullCourseIds),
    moduleIds: new Set(),
    unavailableLessonIds: new Set(),
    lessonIds: new Set(),
    recordingIds: new Set(),
    assetIds: new Set(),
    origins: [],
    readOnlyCourseIds: new Set(),
  };
  for (const enrollment of enrollments) {
    scope.origins.push({
      origin: "ENROLLMENT",
      originRefId: null,
      resourceId: enrollment.courseId,
      resourceType: AccessResourceType.COURSE,
      validUntil: null,
    });
  }
  for (const grant of grants) {
    addResourceAccess(scope, grant.resourceType, grant.resourceId);
    scope.origins.push({
      origin: "LEGACY_GRANT",
      originRefId: grant.sourceId ?? null,
      resourceId: grant.resourceId,
      resourceType: grant.resourceType,
      validUntil: grant.expiresAt ?? null,
    });
  }
  for (const assignment of assignments) {
    addResourceAccess(scope, assignment.targetType, assignment.targetId);
    scope.origins.push({
      origin: "ASSIGNMENT",
      originRefId: assignment.id ?? null,
      resourceId: assignment.targetId,
      resourceType: assignment.targetType,
      validUntil: null,
    });
  }
  for (const grant of directSources) {
    addResourceAccess(scope, grant.resourceType, grant.resourceId);
    if (
      grant.origin === "HISTORICAL" &&
      grant.resourceType === AccessResourceType.COURSE &&
      !scope.fullCourseIds.has(grant.resourceId)
    ) {
      scope.readOnlyCourseIds.add(grant.resourceId);
    }
    scope.origins.push({
      origin: grant.origin,
      originRefId: grant.originRefId,
      resourceId: grant.resourceId,
      resourceType: grant.resourceType,
      validUntil: grant.validUntil,
    });
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
  const [enrollments, grants, assignments, memberships, grantSources] =
    await Promise.all([
      database.enrollment.findMany({
        where: {
          memberId,
          status: { in: ["ACTIVE", "COMPLETED"] },
        },
        select: { courseId: true },
      }),
      database.accessGrant.findMany({
        where: { memberId, ...activeGrantFilter(now) },
        select: {
          resourceType: true,
          resourceId: true,
          sourceId: true,
          expiresAt: true,
        },
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
        select: { id: true, targetType: true, targetId: true },
      }),
      database.cohortMembership.findMany({
        where: {
          memberId,
          status: "ACTIVE",
          leftAt: null,
          cohort: {},
        },
        select: {
          cohortId: true,
          joinedAt: true,
          includePastReadOnly: true,
          cohort: {
            select: {
              archivedAt: true,
              endsAt: true,
              lateJoinPolicy: true,
              readAfterEndDays: true,
              startsAt: true,
              lessonReleases: {
                where: { releaseAt: { gt: now } },
                select: {
                  lessonId: true,
                  releaseAt: true,
                  lesson: {
                    select: { module: { select: { courseId: true } } },
                  },
                },
              },
              courseAccesses: {
                where: { revokedAt: null },
                select: {
                  courseId: true,
                  createdAt: true,
                  releaseMode: true,
                  startsAt: true,
                  revokedAt: true,
                },
              },
            },
          },
        },
      }),
      database.accessGrantSource.findMany({
        where: {
          revokedAt: null,
          validFrom: { lte: now },
          AND: [
            { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
            {
              OR: [
                { subjectMemberId: memberId },
                {
                  subjectCohort: {
                    is: {
                      memberships: {
                        some: { memberId, status: "ACTIVE", leftAt: null },
                      },
                    },
                  },
                },
                {
                  origin: AccessGrantOrigin.OPEN_ACCESS,
                  resourceType: AccessResourceType.COURSE,
                  subjectMemberId: null,
                  subjectCohortId: null,
                },
              ],
            },
          ],
        },
        select: {
          createdAt: true,
          origin: true,
          originRefId: true,
          resourceId: true,
          resourceType: true,
          validFrom: true,
          validUntil: true,
          revokedAt: true,
          subjectMemberId: true,
          subjectCohortId: true,
          subjectCohort: {
            select: {
              archivedAt: true,
              endsAt: true,
              lateJoinPolicy: true,
              readAfterEndDays: true,
            },
          },
        },
      }),
    ]);

  const eligibleMemberships = memberships.filter((membership) => {
    const readUntil = cohortEndedReadUntil(
      membership.cohort.endsAt ?? membership.cohort.archivedAt,
      membership.cohort.readAfterEndDays
    );
    return membership.cohort.startsAt <= now && (!readUntil || now < readUntil);
  });
  const membershipByCohort = new Map(
    eligibleMemberships.map((membership) => [membership.cohortId, membership])
  );
  const effectiveSources = grantSources.filter((grant) => {
    if (
      !accessGrantSourceIsEffective({
        now,
        validFrom: grant.validFrom,
        validUntil: grant.validUntil,
        revokedAt: grant.revokedAt,
      })
    ) {
      return false;
    }
    if (grant.subjectMemberId === memberId) {
      return true;
    }
    if (
      grant.origin === AccessGrantOrigin.OPEN_ACCESS &&
      grant.resourceType === AccessResourceType.COURSE &&
      grant.subjectMemberId === null &&
      grant.subjectCohortId === null
    ) {
      return true;
    }
    if (!(grant.subjectCohortId && grant.subjectCohort)) {
      return false;
    }
    const membership = membershipByCohort.get(grant.subjectCohortId);
    return Boolean(
      membership &&
        (grant.subjectCohort.lateJoinPolicy !== "FROM_JOIN" ||
          grant.createdAt >= membership.joinedAt)
    );
  });
  const directSources = effectiveSources.filter(
    (grant) =>
      grant.subjectMemberId === memberId ||
      (grant.origin === AccessGrantOrigin.OPEN_ACCESS &&
        grant.resourceType === AccessResourceType.COURSE &&
        grant.subjectMemberId === null &&
        grant.subjectCohortId === null)
  );
  const cohortSources = effectiveSources.filter(
    (grant) => grant.subjectCohortId !== null
  );
  const scope = buildScopedResources(
    enrollments,
    grants,
    assignments,
    directSources
  );
  const independentlyGrantedCourses = new Set(scope.fullCourseIds);
  const lessonAccessPaths: Array<{
    courseId: string;
    releases: Array<{ lessonId: string; releaseAt: Date }>;
  }> = [];

  for (const grant of cohortSources) {
    const membership = grant.subjectCohortId
      ? membershipByCohort.get(grant.subjectCohortId)
      : undefined;
    const cohort = grant.subjectCohort;
    const readUntil = cohort
      ? cohortEndedReadUntil(
          cohort.endsAt ?? cohort.archivedAt,
          cohort.readAfterEndDays
        )
      : null;
    const readOnly = Boolean(
      readUntil && now >= (cohort?.endsAt ?? cohort?.archivedAt ?? now)
    );
    addCohortResourceAccess(
      scope,
      grant,
      readOnly,
      independentlyGrantedCourses.has(grant.resourceId)
    );
    addImmediateCohortLessonAccessPath(
      lessonAccessPaths,
      Boolean(membership),
      grant.resourceType,
      grant.resourceId
    );
  }

  for (const membership of eligibleMemberships) {
    for (const access of membership.cohort.courseAccesses) {
      const resolution = resolveCohortCourseAccess({
        access,
        cohort: membership.cohort,
        membership: { joinedAt: membership.joinedAt, leftAt: null },
        now,
      });
      if (!resolution.available) {
        continue;
      }
      addCohortResourceAccess(
        scope,
        {
          origin: "COHORT",
          originRefId: membership.cohortId,
          resourceId: access.courseId,
          resourceType: AccessResourceType.COURSE,
          validUntil: cohortEndedReadUntil(
            membership.cohort.endsAt ?? membership.cohort.archivedAt,
            membership.cohort.readAfterEndDays
          ),
        },
        resolution.readOnly,
        independentlyGrantedCourses.has(access.courseId)
      );
      lessonAccessPaths.push({
        courseId: access.courseId,
        releases: membership.cohort.lessonReleases
          .filter(({ lesson }) => lesson.module.courseId === access.courseId)
          .map(({ lessonId, releaseAt }) => ({ lessonId, releaseAt })),
      });
    }
  }

  await expandParentResources(scope);
  const scheduledCourseIds = [
    ...new Set(lessonAccessPaths.map(({ courseId }) => courseId)),
  ];
  const lessons = scheduledCourseIds.length
    ? await database.lesson.findMany({
        where: {
          status: "PUBLISHED",
          module: {
            is: {
              courseId: { in: scheduledCourseIds },
              status: "PUBLISHED",
            },
          },
        },
        select: {
          id: true,
          moduleId: true,
          module: { select: { courseId: true } },
        },
      })
    : [];
  scope.unavailableLessonIds = resolveLockedCohortLessons({
    accessPaths: lessonAccessPaths,
    independentlyGrantedCourseIds: independentlyGrantedCourses,
    independentlyGrantedLessonIds: scope.lessonIds,
    independentlyGrantedModuleIds: scope.moduleIds,
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      moduleId: lesson.moduleId,
      courseId: lesson.module.courseId,
    })),
    now,
  });

  return {
    fullAccess: false,
    fullCourseIds: scope.fullCourseIds,
    courseIds: scope.courseIds,
    cohortIds: new Set(
      eligibleMemberships
        .filter(({ joinedAt }) => joinedAt <= now)
        .map(({ cohortId }) => cohortId)
    ),
    cohortMemberships: new Map(
      eligibleMemberships
        .filter(({ joinedAt }) => joinedAt <= now)
        .map((membership) => [
          membership.cohortId,
          {
            joinedAt: membership.joinedAt,
            lateJoinPolicy: membership.cohort.lateJoinPolicy,
            includePastReadOnly: membership.includePastReadOnly,
          },
        ])
    ),
    moduleIds: scope.moduleIds,
    unavailableLessonIds: scope.unavailableLessonIds,
    lessonIds: scope.lessonIds,
    assetIds: scope.assetIds,
    recordingIds: scope.recordingIds,
    origins: scope.origins,
    readOnlyCourseIds: scope.readOnlyCourseIds,
  };
};
export const getLearningAccessScope = cache((memberId: string) =>
  tracePerformance("member.learning.access-scope", () =>
    getLearningAccessScopeUncached(memberId)
  )
);

export const resolveAccess = getLearningAccessScope;

export const isCourseReadOnly = (
  scope: LearningAccessScope,
  courseId: string
) => !scope.fullAccess && (scope.readOnlyCourseIds?.has(courseId) ?? false);

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
  (scope.unavailableLessonIds?.has(lessonId) ?? false)
    ? false
    : scope.fullAccess ||
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
      youtubeStartAtSeconds: true,
      youtubeEndAtSeconds: true,
      ownerMemberId: true,
      importedRecording: {
        select: { id: true },
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

  if (asset.importedRecording) {
    const accessibleRecordingIds = await getAccessibleRecordingIds(memberId, [
      asset.importedRecording.id,
    ]);
    return accessibleRecordingIds.has(asset.importedRecording.id)
      ? asset
      : null;
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

/** Historical recordings have an independent audience check from lesson assets. */
export const getAccessibleRecording = async (
  assetId: string,
  memberId: string
) => {
  const asset = await getAccessibleAsset(assetId, memberId);
  return asset?.importedRecording ? asset : null;
};

export const getAccessiblePlaybackAsset = async (
  assetId: string,
  memberId: string
) => {
  const asset = await getAccessibleAsset(assetId, memberId);
  return asset && (asset.kind === "VIDEO" || asset.importedRecording !== null)
    ? asset
    : null;
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
  const asset = await database.lessonAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      importedRecording: { select: { id: true } },
    },
  });
  const importedRecordingId = asset?.importedRecording?.id;
  if (!importedRecordingId) {
    return false;
  }

  const accessibleRecordingIds = await getAccessibleRecordingIds(memberId, [
    importedRecordingId,
  ]);
  return accessibleRecordingIds.has(importedRecordingId);
};
