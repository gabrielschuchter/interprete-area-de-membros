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
