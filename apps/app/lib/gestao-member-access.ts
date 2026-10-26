import "server-only";
import {
  AccessGrantOrigin,
  ContentStatus,
  database,
  LearningAssignmentTargetType,
} from "@repo/database";
import {
  type AccessOriginKey,
  accessOriginHints,
  accessOriginLabels,
  revocableOrigins,
  validityLabel,
} from "./gestao-member-access-domain";
import { resolveLearningAssignmentTargets } from "./learning-assignments";

export interface AccessRow {
  readonly hint: string;
  readonly id: string;
  readonly kind: "legacy" | "source" | null;
  readonly origin: AccessOriginKey;
  readonly originLabel: string;
  readonly resourceId: string;
  readonly resourceType: LearningAssignmentTargetType;
  readonly subtitle: string;
  readonly title: string;
  readonly validity: string;
}

export const listAccessMembers = async (query: string) => {
  const needle = query.trim().slice(0, 120);
  const members = await database.member.findMany({
    where: {
      role: "MEMBER",
      deactivatedAt: null,
      ...(needle
        ? {
            OR: [
              { displayName: { contains: needle, mode: "insensitive" } },
              { email: { contains: needle, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ displayName: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    take: 60,
    select: { id: true, displayName: true, email: true },
  });
  const direct = await database.accessGrantSource.groupBy({
    by: ["subjectMemberId"],
    where: {
      subjectMemberId: { in: members.map((member) => member.id) },
      revokedAt: null,
      origin: AccessGrantOrigin.DIRECT,
    },
    _count: { _all: true },
  });
  const counts = new Map(
    direct.map((row) => [row.subjectMemberId, row._count._all])
  );
  return members.map((member) => ({
    ...member,
    directCount: counts.get(member.id) ?? 0,
  }));
};

const originKey = (value: string): AccessOriginKey =>
  value in accessOriginLabels ? (value as AccessOriginKey) : "DIRECT";

export const getMemberAccessRows = async (memberId: string) => {
  const now = new Date();
  const validNow = {
    OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    revokedAt: null,
    validFrom: { lte: now },
  };
  const [member, memberships, sources, legacy, enrollments, assignments] =
    await Promise.all([
      database.member.findUnique({
        where: { id: memberId },
        select: { id: true, displayName: true },
      }),
      database.cohortMembership.findMany({
        where: { memberId, status: "ACTIVE", leftAt: null },
        select: { cohortId: true, cohort: { select: { name: true } } },
      }),
      database.accessGrantSource.findMany({
        where: { subjectMemberId: memberId, ...validNow },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          origin: true,
          resourceId: true,
          resourceType: true,
          validUntil: true,
        },
      }),
      database.accessGrant.findMany({
        where: {
          memberId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          resourceId: true,
          resourceType: true,
          expiresAt: true,
        },
      }),
      database.enrollment.findMany({
        where: { memberId, status: "ACTIVE" },
        select: { id: true, courseId: true },
      }),
      database.activityAssignment.findMany({
        where: {
          memberId,
          revokedAt: null,
          status: { not: "REVOKED" },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true, targetId: true, targetType: true, expiresAt: true },
      }),
    ]);
  if (!member) {
    return null;
  }
  const cohortIds = memberships.map((membership) => membership.cohortId);
  const [cohortSources, cohortCourses] = await Promise.all([
    cohortIds.length
      ? database.accessGrantSource.findMany({
          where: { subjectCohortId: { in: cohortIds }, ...validNow },
          select: {
            id: true,
            resourceId: true,
            resourceType: true,
            subjectCohort: { select: { name: true } },
            validUntil: true,
          },
        })
      : [],
    cohortIds.length
      ? database.cohortCourseAccess.findMany({
          where: { cohortId: { in: cohortIds }, revokedAt: null },
          select: {
            id: true,
            courseId: true,
            cohort: { select: { name: true } },
          },
        })
      : [],
  ]);

  const draft: {
    id: string;
    kind: AccessRow["kind"];
    origin: AccessOriginKey;
    resourceId: string;
    resourceType: LearningAssignmentTargetType;
    subtitle: string;
    until: Date | null;
  }[] = [
    ...sources.map((source) => ({
      id: source.id,
      kind: "source" as const,
      origin: originKey(source.origin),
      resourceId: source.resourceId,
      resourceType: source.resourceType as LearningAssignmentTargetType,
      subtitle: "acesso individual",
      until: source.validUntil,
    })),
    ...legacy.map((grant) => ({
      id: grant.id,
      kind: "legacy" as const,
      origin: "LEGACY_GRANT" as const,
      resourceId: grant.resourceId,
      resourceType: grant.resourceType as LearningAssignmentTargetType,
      subtitle: "concessão anterior à nova gestão",
      until: grant.expiresAt,
    })),
    ...cohortSources.map((source) => ({
      id: `cs-${source.id}`,
      kind: null,
      origin: "COHORT" as const,
      resourceId: source.resourceId,
      resourceType: source.resourceType as LearningAssignmentTargetType,
      subtitle: `liberado pela ${source.subjectCohort?.name ?? "turma"}`,
      until: source.validUntil,
    })),
    ...cohortCourses.map((access) => ({
      id: `cc-${access.id}`,
      kind: null,
      origin: "COHORT" as const,
      resourceId: access.courseId,
      resourceType: LearningAssignmentTargetType.COURSE,
      subtitle: `liberado pela ${access.cohort.name}`,
      until: null,
    })),
    ...enrollments.map((enrollment) => ({
      id: `en-${enrollment.id}`,
      kind: null,
      origin: "ENROLLMENT" as const,
      resourceId: enrollment.courseId,
      resourceType: LearningAssignmentTargetType.COURSE,
      subtitle: "matrícula no curso",
      until: null,
    })),
    ...assignments.map((assignment) => ({
      id: `as-${assignment.id}`,
      kind: null,
      origin: "ASSIGNMENT" as const,
      resourceId: assignment.targetId,
      resourceType: assignment.targetType,
      subtitle: "recebido por atribuição",
      until: assignment.expiresAt,
    })),
  ];
  const targets = await resolveLearningAssignmentTargets(
    database,
    draft.map((row) => ({ id: row.resourceId, type: row.resourceType }))
  );
  const rows: AccessRow[] = draft.map((row) => {
    const target = targets.get(`${row.resourceType}:${row.resourceId}`);
    return {
      hint: accessOriginHints[row.origin],
      id: row.id,
      kind: revocableOrigins.includes(row.origin) ? row.kind : null,
      origin: row.origin,
      originLabel: accessOriginLabels[row.origin],
      resourceId: row.resourceId,
      resourceType: row.resourceType,
      subtitle: row.subtitle,
      title: target?.title ?? "Conteúdo indisponível",
      validity: validityLabel(row.origin, row.until),
    };
  });
  return { member, rows };
};

export const getGrantTree = async () => {
  const courses = await database.course.findMany({
    where: { status: { not: ContentStatus.ARCHIVED } },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    take: 150,
    select: {
      id: true,
      title: true,
      modules: {
        where: { status: { not: ContentStatus.ARCHIVED } },
        orderBy: [{ position: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          lessons: {
            where: { status: { not: ContentStatus.ARCHIVED } },
            orderBy: [{ position: "asc" }, { title: "asc" }],
            select: { id: true, title: true },
          },
        },
      },
    },
  });
  return courses;
};

export const getContentAccessRows = async (courseId: string) => {
  const now = new Date();
  const [course, cohorts, sources, legacy] = await Promise.all([
    database.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    }),
    database.cohortCourseAccess.findMany({
      where: { courseId, revokedAt: null },
      select: {
        cohort: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                memberships: { where: { status: "ACTIVE", leftAt: null } },
              },
            },
          },
        },
      },
    }),
    database.accessGrantSource.findMany({
      where: {
        resourceId: courseId,
        resourceType: "COURSE",
        subjectMemberId: { not: null },
        revokedAt: null,
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      take: 200,
      select: {
        origin: true,
        validUntil: true,
        subjectMember: { select: { id: true, displayName: true } },
      },
    }),
    database.accessGrant.findMany({
      where: {
        resourceId: courseId,
        resourceType: "COURSE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      take: 200,
      select: {
        expiresAt: true,
        member: { select: { id: true, displayName: true } },
      },
    }),
  ]);
  return { cohorts, course, legacy, sources };
};
