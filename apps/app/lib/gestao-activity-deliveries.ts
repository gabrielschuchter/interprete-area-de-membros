import "server-only";

import { ActivitySubmissionStatus, database } from "@repo/database";
import { requireGestaoAction } from "./gestao-authorization";
import {
  getGestaoCorrectionCohortScope,
  getGestaoCorrectionRecipientScope,
} from "./gestao-correction-scope";

const pageSize = 25;
const recipientCap = 2000;

export type DeliveryState = "DELIVERED" | "LATE" | "NOT_DELIVERED";
export type CorrectionState = "PENDING" | "REVIEWED" | "WAITING";

export interface DeliveryRow {
  readonly cohort: string | null;
  readonly correction: CorrectionState;
  readonly delivery: DeliveryState;
  readonly memberId: string;
  readonly name: string;
  readonly submissionId: string | null;
  readonly submittedAt: Date | null;
}

const deliveryStates: readonly DeliveryState[] = [
  "DELIVERED",
  "LATE",
  "NOT_DELIVERED",
];
const correctionStates: readonly CorrectionState[] = [
  "PENDING",
  "REVIEWED",
  "WAITING",
];

const rowFor = (
  recipient: {
    readonly id: string;
    readonly displayName: string | null;
    readonly email: string | null;
    readonly cohortMemberships: readonly {
      readonly cohortId: string;
      readonly cohort: { readonly name: string };
    }[];
  },
  submission:
    | {
        readonly id: string;
        readonly status: ActivitySubmissionStatus;
        readonly submittedAt: Date | null;
      }
    | undefined,
  targetCohortIds: ReadonlySet<string>,
  dueAt: Date | null,
  now: Date
): DeliveryRow => {
  const delivered =
    submission !== undefined &&
    submission.status !== ActivitySubmissionStatus.DRAFT;
  let delivery: DeliveryState = "NOT_DELIVERED";
  if (delivered) {
    delivery = "DELIVERED";
  } else if (dueAt && dueAt < now) {
    delivery = "LATE";
  }
  let correction: CorrectionState = "WAITING";
  if (delivered) {
    correction =
      submission.status === ActivitySubmissionStatus.REVIEWED
        ? "REVIEWED"
        : "PENDING";
  }
  const membership =
    recipient.cohortMemberships.find(({ cohortId }) =>
      targetCohortIds.has(cohortId)
    ) ?? recipient.cohortMemberships[0];
  return {
    cohort: membership?.cohort.name ?? null,
    correction,
    delivery,
    memberId: recipient.id,
    name: recipient.displayName ?? recipient.email ?? "Aluno",
    submissionId: delivered ? submission.id : null,
    submittedAt: delivered ? submission.submittedAt : null,
  };
};

export const getGestaoActivityDeliveries = async (input: {
  readonly activityId: string;
  readonly cohortId?: string;
  readonly correction?: string;
  readonly delivery?: string;
  readonly page?: number;
  readonly query?: string;
}) => {
  const { actor } = await requireGestaoAction("assignments.manage");
  const activity = await database.activity.findUnique({
    where: { id: input.activityId },
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
      deliveryKind: true,
      cohortTargets: {
        where: { activeKey: { not: null }, revokedAt: null },
        select: {
          cohortId: true,
          cohort: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!activity) {
    return null;
  }
  const query = (input.query ?? "").trim().slice(0, 120);
  const recipientScope = getGestaoCorrectionRecipientScope(actor);
  const memberFilter = {
    ...recipientScope,
    ...(query
      ? {
          OR: [
            { displayName: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(input.cohortId
      ? {
          cohortMemberships: {
            some: {
              cohortId: input.cohortId,
              status: "ACTIVE" as const,
              leftAt: null,
            },
          },
        }
      : {}),
  };
  const memberSelect = {
    id: true,
    displayName: true,
    email: true,
    cohortMemberships: {
      where: { status: "ACTIVE" as const, leftAt: null },
      select: { cohortId: true, cohort: { select: { name: true } } },
    },
  };
  // Destinatários = quem recebeu a atividade (atribuição) ou já entregou.
  const [assignedRows, submitterRows] = await Promise.all([
    database.activityAssignment.findMany({
      where: {
        activityId: activity.id,
        revokedAt: null,
        status: { not: "REVOKED" },
        member: { is: memberFilter },
      },
      take: recipientCap,
      select: { member: { select: memberSelect } },
    }),
    database.activitySubmission.findMany({
      where: {
        activityId: activity.id,
        status: { not: ActivitySubmissionStatus.DRAFT },
        member: { is: memberFilter },
      },
      take: recipientCap,
      select: { member: { select: memberSelect } },
    }),
  ]);
  const assigned = [
    ...new Map(
      [...assignedRows, ...submitterRows].map(({ member }) => [
        member.id,
        { member },
      ])
    ).values(),
  ].sort((left, right) =>
    (left.member.displayName ?? left.member.email ?? "").localeCompare(
      right.member.displayName ?? right.member.email ?? "",
      "pt-BR"
    )
  );
  const submissions = await database.activitySubmission.findMany({
    where: {
      activityId: activity.id,
      memberId: { in: assigned.map(({ member }) => member.id) },
    },
    select: { id: true, memberId: true, status: true, submittedAt: true },
  });
  const byMember = new Map(submissions.map((row) => [row.memberId, row]));
  const targetCohortIds = new Set(
    activity.cohortTargets.map(({ cohortId }) => cohortId)
  );
  const now = new Date();
  const all = assigned.map(({ member }) =>
    rowFor(
      member,
      byMember.get(member.id),
      targetCohortIds,
      activity.dueAt,
      now
    )
  );
  const delivery = deliveryStates.find((state) => state === input.delivery);
  const correction = correctionStates.find(
    (state) => state === input.correction
  );
  const filtered = all.filter(
    (row) =>
      (!delivery || row.delivery === delivery) &&
      (!correction || row.correction === correction)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.trunc(input.page || 1)));
  const cohortOptions = await database.cohort.findMany({
    where: getGestaoCorrectionCohortScope(actor),
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true },
  });
  return {
    activity,
    cohortOptions,
    page,
    pageSize,
    query,
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    stats: {
      delivered: all.filter((row) => row.delivery === "DELIVERED").length,
      late: all.filter((row) => row.delivery === "LATE").length,
      pending: all.filter((row) => row.correction === "PENDING").length,
      reviewed: all.filter((row) => row.correction === "REVIEWED").length,
      total: all.length,
    },
    totalCount: filtered.length,
    totalPages,
  };
};
