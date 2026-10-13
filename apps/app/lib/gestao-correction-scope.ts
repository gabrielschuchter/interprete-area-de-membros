import type { Prisma } from "@repo/database";
import type { GestaoActor } from "./gestao-authorization";

export const getGestaoCorrectionCohortScope = (
  actor: Pick<GestaoActor, "role" | "userId">
): Prisma.CohortWhereInput => ({
  archivedAt: null,
  ...(actor.role === "ADMIN"
    ? {}
    : { teachers: { some: { memberId: actor.userId } } }),
});

export const getGestaoCorrectionRecipientScope = (
  actor: Pick<GestaoActor, "role" | "userId">
): Prisma.MemberWhereInput =>
  actor.role === "ADMIN"
    ? { deactivatedAt: null }
    : {
        deactivatedAt: null,
        cohortMemberships: {
          some: {
            status: "ACTIVE",
            leftAt: null,
            cohort: { is: getGestaoCorrectionCohortScope(actor) },
          },
        },
      };

export const getGestaoCorrectionSubmissionScope = (
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
        in: ["SUBMITTED", "REVIEWED"],
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
              cohort: { is: getGestaoCorrectionCohortScope(actor) },
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
