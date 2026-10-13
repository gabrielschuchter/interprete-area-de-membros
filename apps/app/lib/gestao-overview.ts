import "server-only";
import {
  ActivitySubmissionStatus,
  database,
  type Prisma,
} from "@repo/database";
import { forbidden } from "next/navigation";
import { requireGestaoAction } from "./gestao-authorization";
import {
  getGestaoCorrectionCohortScope,
  getGestaoCorrectionSubmissionScope,
} from "./gestao-correction-scope";

const cohortPageSize = 10;
export const getGestaoOverviewAttention = async (input: {
  readonly cohortId?: string;
  readonly cohortPage?: number;
  readonly cohortQuery?: string;
}) => {
  const { actor } = await requireGestaoAction("assignments.manage");
  const cohortId = (input.cohortId ?? "").trim();
  if (cohortId.length > 255) {
    forbidden();
  }
  const cohortQuery = (input.cohortQuery ?? "").trim().slice(0, 120);
  const scope = getGestaoCorrectionCohortScope(actor);
  const selectedCohort = cohortId
    ? await database.cohort.findFirst({
        where: { AND: [scope, { id: cohortId }] },
        select: { id: true, name: true },
      })
    : null;
  if (cohortId && !selectedCohort) {
    forbidden();
  }
  const cohortWhere: Prisma.CohortWhereInput = {
    AND: [
      scope,
      ...(cohortQuery
        ? [{ name: { contains: cohortQuery, mode: "insensitive" as const } }]
        : []),
    ],
  };
  const pendingWhere: Prisma.ActivitySubmissionWhereInput = {
    AND: [
      getGestaoCorrectionSubmissionScope(actor, { cohortId }),
      { status: ActivitySubmissionStatus.SUBMITTED },
    ],
  };
  const [cohortCount, matchingCohortCount, pendingCount, pending] =
    await Promise.all([
      database.cohort.count({ where: scope }),
      database.cohort.count({ where: cohortWhere }),
      database.activitySubmission.count({ where: pendingWhere }),
      database.activitySubmission.findMany({
        where: pendingWhere,
        orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
        take: 2,
        select: { activity: { select: { title: true } } },
      }),
    ]);
  const cohortPages = Math.max(
    1,
    Math.ceil(matchingCohortCount / cohortPageSize)
  );
  const cohortPage = Math.min(
    cohortPages,
    Math.max(1, Math.trunc(Number(input.cohortPage) || 1))
  );
  const cohorts = await database.cohort.findMany({
    where: cohortWhere,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (cohortPage - 1) * cohortPageSize,
    take: cohortPageSize,
    select: { id: true, name: true },
  });
  const correctionParams = new URLSearchParams({ estado: "PENDING" });
  if (cohortId) {
    correctionParams.set("turma", cohortId);
  }
  return {
    actor,
    cohortCount,
    cohortFilter: {
      cohorts,
      selectedCohort,
      query: cohortQuery,
      page: cohortPage,
      pages: cohortPages,
      total: matchingCohortCount,
    },
    pendingCount,
    pendingActivityTitles: [
      ...new Set(pending.map((submission) => submission.activity.title)),
    ],
    correctionsHref: `/gestao/alunos/correcoes?${correctionParams}`,
  };
};
