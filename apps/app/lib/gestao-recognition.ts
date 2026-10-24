import "server-only";
import { database } from "@repo/database";
import { forbidden } from "next/navigation";
import { requireGestaoAction } from "./gestao-authorization";
import {
  getGestaoCorrectionCohortScope,
  getGestaoCorrectionRecipientScope,
} from "./gestao-correction-scope";

export const listGestaoRecognition = async (input: {
  readonly badgeId?: string;
  readonly cohortId?: string;
}) => {
  const { actor } = await requireGestaoAction("students.read");
  const cohortId = input.cohortId?.trim();
  const badgeId = input.badgeId?.trim();
  if ((cohortId?.length ?? 0) > 255 || (badgeId?.length ?? 0) > 255) {
    forbidden();
  }
  const cohortScope = getGestaoCorrectionCohortScope(actor);
  const recipient = getGestaoCorrectionRecipientScope(actor);
  const memberFilter = cohortId
    ? {
        AND: [
          recipient,
          {
            cohortMemberships: {
              some: {
                cohortId,
                status: "ACTIVE" as const,
                leftAt: null,
                cohort: { is: cohortScope },
              },
            },
          },
        ],
      }
    : recipient;
  const [badges, cohorts] = await Promise.all([
    database.badgeDefinition.findMany({
      where: { status: "PUBLISHED", ...(badgeId ? { id: badgeId } : {}) },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        awards: {
          where: { member: { is: memberFilter } },
          orderBy: [{ awardedAt: "desc" }, { id: "asc" }],
          select: {
            id: true,
            awardedAt: true,
            member: { select: { id: true, displayName: true } },
          },
        },
      },
    }),
    database.cohort.findMany({
      where: cohortScope,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
      take: 200,
    }),
  ]);
  const allBadges = badgeId
    ? await database.badgeDefinition.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ title: "asc" }, { id: "asc" }],
        select: { id: true, title: true },
      })
    : badges.map(({ id, title }) => ({ id, title }));
  return { actor, badges, cohorts, allBadges };
};
