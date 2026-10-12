import "server-only";

import {
  ActivitySubmissionStatus,
  database,
  type Prisma,
} from "@repo/database";
import { type GestaoActor, requireGestaoAction } from "./gestao-authorization";
import {
  getGestaoCorrectionCohortScope,
  getGestaoCorrectionRecipientScope,
} from "./gestao-correction-scope";

export type GestaoCorrectionStatus = "PENDING" | "REVIEWED" | "ALL";

const pageSize = 30;

const sortOrderForStatus = (
  status: GestaoCorrectionStatus
): Prisma.ActivitySubmissionOrderByWithRelationInput[] => {
  if (status === "PENDING") {
    return [{ submittedAt: "asc" }, { id: "asc" }];
  }
  if (status === "REVIEWED") {
    return [{ updatedAt: "desc" }, { id: "asc" }];
  }
  return [{ status: "asc" }, { submittedAt: "asc" }, { id: "asc" }];
};

const countForStatus = (
  status: GestaoCorrectionStatus,
  counts: {
    readonly all: number;
    readonly pending: number;
    readonly reviewed: number;
  }
) => {
  if (status === "PENDING") {
    return counts.pending;
  }
  if (status === "REVIEWED") {
    return counts.reviewed;
  }
  return counts.all;
};

const normalizeStatus = (value: string | undefined): GestaoCorrectionStatus =>
  value === "REVIEWED" || value === "ALL" ? value : "PENDING";

const cohortScope = getGestaoCorrectionCohortScope;

const submissionScope = (
  actor: GestaoActor,
  input: {
    readonly activityId?: string;
    readonly cohortId?: string;
    readonly query?: string;
  }
) => {
  const filters: Prisma.ActivitySubmissionWhereInput[] = [
    {
      status: {
        in: [
          ActivitySubmissionStatus.SUBMITTED,
          ActivitySubmissionStatus.REVIEWED,
        ],
      },
    },
    { submittedAt: { not: null } },
    { member: { is: getGestaoCorrectionRecipientScope(actor) } },
  ];
  if (input.activityId) {
    filters.push({ activityId: input.activityId });
  }
  if (input.cohortId) {
    filters.push({
      member: {
        is: {
          cohortMemberships: {
            some: {
              cohortId: input.cohortId,
              status: "ACTIVE",
              leftAt: null,
              cohort: { is: cohortScope(actor) },
            },
          },
        },
      },
    });
  }
  if (input.query) {
    filters.push({
      OR: [
        {
          member: {
            is: {
              displayName: { contains: input.query, mode: "insensitive" },
            },
          },
        },
        {
          activity: {
            is: { title: { contains: input.query, mode: "insensitive" } },
          },
        },
      ],
    });
  }
  return { AND: filters } satisfies Prisma.ActivitySubmissionWhereInput;
};

const withStatus = (
  scope: Prisma.ActivitySubmissionWhereInput,
  status: GestaoCorrectionStatus
): Prisma.ActivitySubmissionWhereInput =>
  status === "ALL"
    ? scope
    : {
        AND: [
          scope,
          {
            status:
              status === "PENDING"
                ? ActivitySubmissionStatus.SUBMITTED
                : ActivitySubmissionStatus.REVIEWED,
          },
        ],
      };

export const getGestaoCorrectionQueue = async (input: {
  readonly activityId?: string;
  readonly cohortId?: string;
  readonly page?: number;
  readonly query?: string;
  readonly selectedSubmissionId?: string;
  readonly status?: string;
}) => {
  const { actor } = await requireGestaoAction("assignments.manage");
  const status = normalizeStatus(input.status);
  const query = (input.query ?? "").trim().slice(0, 120);
  const page = Math.min(Math.max(1, Math.floor(input.page ?? 1)), 1000);
  const cohorts = await database.cohort.findMany({
    where: cohortScope(actor),
    orderBy: [{ startsAt: "desc" }, { name: "asc" }],
    take: 200,
    select: { id: true, name: true },
  });
  const cohortId = cohorts.some(({ id }) => id === input.cohortId)
    ? input.cohortId
    : "";
  const scope = submissionScope(actor, {
    activityId: input.activityId,
    cohortId,
    query,
  });
  const where = withStatus(scope, status);
  const activity = input.activityId
    ? await database.activity.findUnique({
        where: { id: input.activityId },
        select: { id: true, title: true },
      })
    : null;
  const [pendingCount, reviewedCount, totalCount, submissions] =
    await Promise.all([
      database.activitySubmission.count({
        where: withStatus(scope, "PENDING"),
      }),
      database.activitySubmission.count({
        where: withStatus(scope, "REVIEWED"),
      }),
      database.activitySubmission.count({ where: scope }),
      database.activitySubmission.findMany({
        where,
        orderBy: sortOrderForStatus(status),
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          activityId: true,
          content: true,
          status: true,
          submittedAt: true,
          attachmentPath: true,
          attachmentName: true,
          rubricVersion: true,
          updatedAt: true,
          member: {
            select: { id: true, displayName: true, email: true },
          },
          activity: {
            select: {
              id: true,
              title: true,
              slug: true,
              prompt: true,
              dueAt: true,
            },
          },
          feedback: {
            select: {
              content: true,
              rubricVersion: true,
              criteriaScores: true,
              version: true,
              submittedAt: true,
            },
          },
          feedbackDraft: {
            select: {
              content: true,
              rubricVersion: true,
              criteriaScores: true,
              version: true,
              updatedAt: true,
            },
          },
        },
      }),
    ]);
  const selectedSubmissionRaw = input.selectedSubmissionId
    ? await database.activitySubmission.findFirst({
        where: {
          AND: [where, { id: input.selectedSubmissionId }],
        },
        select: {
          id: true,
          activityId: true,
          content: true,
          status: true,
          submittedAt: true,
          attachmentPath: true,
          attachmentName: true,
          rubricVersion: true,
          updatedAt: true,
          member: {
            select: { id: true, displayName: true, email: true },
          },
          activity: {
            select: {
              id: true,
              title: true,
              slug: true,
              prompt: true,
              dueAt: true,
            },
          },
          feedback: {
            select: {
              content: true,
              rubricVersion: true,
              criteriaScores: true,
              version: true,
              submittedAt: true,
            },
          },
          feedbackDraft: {
            select: {
              content: true,
              rubricVersion: true,
              criteriaScores: true,
              version: true,
              updatedAt: true,
            },
          },
        },
      })
    : (submissions[0] ?? null);
  type SubmissionPageRow = (typeof submissions)[number];
  const pageSubmissions = submissions.filter(
    (submission): submission is SubmissionPageRow & { submittedAt: Date } =>
      submission.submittedAt !== null
  );
  const selectedSubmission = selectedSubmissionRaw?.submittedAt
    ? (selectedSubmissionRaw as SubmissionPageRow & { submittedAt: Date })
    : (pageSubmissions[0] ?? null);
  const criteria = selectedSubmission?.rubricVersion
    ? await database.activityRubricCriterion.findMany({
        where: {
          activityId: selectedSubmission.activityId,
          version: selectedSubmission.rubricVersion,
        },
        orderBy: { position: "asc" },
        take: 12,
        select: { id: true, title: true, weight: true, position: true },
      })
    : [];
  return {
    activity,
    cohorts,
    counts: { all: totalCount, pending: pendingCount, reviewed: reviewedCount },
    criteria,
    page,
    pageCount: Math.max(
      1,
      Math.ceil(
        countForStatus(status, {
          all: totalCount,
          pending: pendingCount,
          reviewed: reviewedCount,
        }) / pageSize
      )
    ),
    query,
    selectedSubmission,
    selectedSubmissionExplicit: Boolean(
      input.selectedSubmissionId && selectedSubmission
    ),
    status,
    submissions: pageSubmissions,
    cohortId,
  };
};
