import "server-only";

import {
  AccessGrantOrigin,
  AccessResourceType,
  CohortMemberStatus,
  database,
  MemberRole,
  type Prisma,
} from "@repo/database";
import { requireGestaoAction } from "./gestao-authorization";

const accessPageSize = 20;
const memberPageSize = 20;

const resolvePage = (
  requested: string | undefined,
  total: number,
  pageSize = accessPageSize
) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const parsed = Number(requested);
  const page =
    Number.isSafeInteger(parsed) && parsed > 0
      ? Math.min(parsed, totalPages)
      : 1;
  return { page, totalPages };
};

export const getGestaoCourseAccessPage = async (input: {
  readonly courseId: string;
  readonly cohortPage?: string;
  readonly cohortQuery?: string;
  readonly cohortCandidatePage?: string;
  readonly cohortCandidateQuery?: string;
  readonly memberQuery?: string;
  readonly memberPage?: string;
  readonly directSourcePage?: string;
  readonly directLegacyPage?: string;
}) => {
  const { actor } = await requireGestaoAction("content.manage", {
    contentId: input.courseId,
  });
  const isAdmin = actor.role === "ADMIN";
  const actorRole: "ADMIN" | "TEACHER" = isAdmin ? "ADMIN" : "TEACHER";
  const now = new Date();
  const cohortQuery = (input.cohortQuery ?? "").trim().slice(0, 120);
  const cohortCandidateQuery = (input.cohortCandidateQuery ?? "")
    .trim()
    .slice(0, 120);
  const memberQuery = (input.memberQuery ?? "").trim().slice(0, 120);
  const cohortScope = {
    archivedAt: null,
    ...(isAdmin ? {} : { teachers: { some: { memberId: actor.userId } } }),
  } satisfies Prisma.CohortWhereInput;
  const cohortAccessWhere: Prisma.CohortCourseAccessWhereInput = {
    courseId: input.courseId,
    revokedAt: null,
    cohort: {
      is: {
        archivedAt: null,
        ...(isAdmin ? {} : { teachers: { some: { memberId: actor.userId } } }),
        ...(cohortQuery
          ? { name: { contains: cohortQuery, mode: "insensitive" } }
          : {}),
      },
    },
  };
  const candidateWhere: Prisma.CohortWhereInput = {
    ...cohortScope,
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    NOT: {
      courseAccesses: {
        some: { courseId: input.courseId, revokedAt: null },
      },
    },
    ...(cohortCandidateQuery
      ? { name: { contains: cohortCandidateQuery, mode: "insensitive" } }
      : {}),
  };
  const grantWindow = {
    OR: [{ validUntil: null }, { validUntil: { gt: now } }],
  } satisfies Prisma.AccessGrantSourceWhereInput;
  const sourceGrantWhere: Prisma.AccessGrantSourceWhereInput = {
    origin: AccessGrantOrigin.DIRECT,
    resourceType: AccessResourceType.COURSE,
    resourceId: input.courseId,
    subjectMemberId: { not: null },
    revokedAt: null,
    validFrom: { lte: now },
    ...grantWindow,
    subjectMember: { is: { deactivatedAt: null } },
  };
  const legacyGrantWhere: Prisma.AccessGrantWhereInput = {
    resourceType: AccessResourceType.COURSE,
    resourceId: input.courseId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    member: { is: { deactivatedAt: null } },
  };
  const memberWhere: Prisma.MemberWhereInput = {
    role: MemberRole.MEMBER,
    deactivatedAt: null,
    ...(memberQuery
      ? {
          OR: [
            { displayName: { contains: memberQuery, mode: "insensitive" } },
            { email: { contains: memberQuery, mode: "insensitive" } },
            {
              profile: {
                is: {
                  username: { contains: memberQuery, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),
  };
  const course = await database.course.findUnique({
    where: { id: input.courseId },
    select: {
      id: true,
      title: true,
      status: true,
      slug: true,
      updatedAt: true,
    },
  });
  if (!course) {
    return null;
  }

  const [
    cohortCount,
    candidateCohortCount,
    openSource,
    sourceGrantCount,
    legacyGrantCount,
    memberCount,
  ] = await Promise.all([
    database.cohortCourseAccess.count({ where: cohortAccessWhere }),
    database.cohort.count({ where: candidateWhere }),
    database.accessGrantSource.findFirst({
      where: {
        origin: AccessGrantOrigin.OPEN_ACCESS,
        originRefId: course.id,
        resourceType: AccessResourceType.COURSE,
        resourceId: course.id,
        subjectMemberId: null,
        subjectCohortId: null,
        revokedAt: null,
        validFrom: { lte: now },
        ...grantWindow,
      },
      select: { id: true },
    }),
    isAdmin ? database.accessGrantSource.count({ where: sourceGrantWhere }) : 0,
    isAdmin ? database.accessGrant.count({ where: legacyGrantWhere }) : 0,
    isAdmin ? database.member.count({ where: memberWhere }) : 0,
  ]);

  const cohortPagination = resolvePage(input.cohortPage, cohortCount);
  const candidatePagination = resolvePage(
    input.cohortCandidatePage,
    candidateCohortCount
  );
  const sourceGrantPagination = resolvePage(
    input.directSourcePage,
    sourceGrantCount,
    memberPageSize
  );
  const legacyGrantPagination = resolvePage(
    input.directLegacyPage,
    legacyGrantCount,
    memberPageSize
  );
  const memberPagination = resolvePage(
    input.memberPage,
    memberCount,
    memberPageSize
  );

  const [
    cohortAccesses,
    candidateCohorts,
    sourceGrants,
    legacyGrants,
    members,
  ] = await Promise.all([
    database.cohortCourseAccess.findMany({
      where: cohortAccessWhere,
      orderBy: [{ cohort: { name: "asc" } }, { id: "asc" }],
      skip: (cohortPagination.page - 1) * accessPageSize,
      take: accessPageSize,
      select: {
        id: true,
        releaseMode: true,
        startsAt: true,
        cohort: {
          select: {
            id: true,
            name: true,
            startsAt: true,
            endsAt: true,
            version: true,
            _count: {
              select: {
                memberships: {
                  where: {
                    status: CohortMemberStatus.ACTIVE,
                    leftAt: null,
                  },
                },
              },
            },
          },
        },
      },
    }),
    database.cohort.findMany({
      where: candidateWhere,
      orderBy: [{ startsAt: "desc" }, { name: "asc" }, { id: "asc" }],
      skip: (candidatePagination.page - 1) * accessPageSize,
      take: accessPageSize,
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        version: true,
      },
    }),
    isAdmin
      ? database.accessGrantSource.findMany({
          where: sourceGrantWhere,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: (sourceGrantPagination.page - 1) * memberPageSize,
          take: memberPageSize,
          select: {
            id: true,
            createdAt: true,
            validUntil: true,
            subjectMember: {
              select: {
                id: true,
                displayName: true,
                email: true,
                profile: { select: { username: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    isAdmin
      ? database.accessGrant.findMany({
          where: legacyGrantWhere,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: (legacyGrantPagination.page - 1) * memberPageSize,
          take: memberPageSize,
          select: {
            id: true,
            expiresAt: true,
            createdAt: true,
            member: {
              select: {
                id: true,
                displayName: true,
                email: true,
                profile: { select: { username: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    isAdmin
      ? database.member.findMany({
          where: memberWhere,
          orderBy: [{ displayName: "asc" }, { id: "asc" }],
          skip: (memberPagination.page - 1) * memberPageSize,
          take: memberPageSize,
          select: {
            id: true,
            displayName: true,
            email: true,
            profile: { select: { username: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const directGrants = [
    ...sourceGrants.flatMap((grant) =>
      grant.subjectMember
        ? [
            {
              id: grant.id,
              kind: "SOURCE" as const,
              member: grant.subjectMember,
              createdAt: grant.createdAt,
              expiresAt: grant.validUntil,
            },
          ]
        : []
    ),
    ...legacyGrants.map((grant) => ({
      id: grant.id,
      kind: "LEGACY" as const,
      member: grant.member,
      createdAt: grant.createdAt,
      expiresAt: grant.expiresAt,
    })),
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return {
    actorRole,
    course,
    cohortAccesses: cohortAccesses.map((access) => ({
      id: access.id,
      releaseMode: access.releaseMode,
      startsAt: access.startsAt,
      cohort: {
        ...access.cohort,
        studentCount: access.cohort._count.memberships,
      },
    })),
    cohortPage: cohortPagination.page,
    cohortPageSize: accessPageSize,
    cohortQuery,
    cohortTotalCount: cohortCount,
    cohortTotalPages: cohortPagination.totalPages,
    openAccess: Boolean(openSource),
    candidateCohorts,
    candidateCohortPage: candidatePagination.page,
    candidateCohortQuery: cohortCandidateQuery,
    candidateCohortTotalCount: candidateCohortCount,
    candidateCohortTotalPages: candidatePagination.totalPages,
    directGrants,
    directGrantCount: sourceGrantCount + legacyGrantCount,
    directSourceGrantCount: sourceGrantCount,
    directLegacyGrantCount: legacyGrantCount,
    directSourceGrantPage: sourceGrantPagination.page,
    directSourceGrantTotalPages: sourceGrantPagination.totalPages,
    directLegacyGrantPage: legacyGrantPagination.page,
    directLegacyGrantTotalPages: legacyGrantPagination.totalPages,
    members,
    memberPage: memberPagination.page,
    memberTotalPages: memberPagination.totalPages,
    memberCount,
    memberQuery,
  };
};
