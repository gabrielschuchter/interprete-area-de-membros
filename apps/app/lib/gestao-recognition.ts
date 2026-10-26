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
  readonly periodDays?: number | null;
  readonly query?: string;
}) => {
  const { actor } = await requireGestaoAction("students.read");
  const cohortId = input.cohortId?.trim();
  const badgeId = input.badgeId?.trim();
  if ((cohortId?.length ?? 0) > 255 || (badgeId?.length ?? 0) > 255) {
    forbidden();
  }
  const since = input.periodDays
    ? new Date(Date.now() - input.periodDays * 86_400_000)
    : null;
  const needle = (input.query ?? "").trim().slice(0, 120).toLowerCase();
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
          where: {
            member: { is: memberFilter },
            ...(since ? { awardedAt: { gte: since } } : {}),
          },
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
  const matching = needle
    ? badges.flatMap((badge) => {
        if (badge.title.toLowerCase().includes(needle)) {
          return [badge];
        }
        const awards = badge.awards.filter((award) =>
          (award.member.displayName ?? "").toLowerCase().includes(needle)
        );
        return awards.length > 0 ? [{ ...badge, awards }] : [];
      })
    : badges;
  const allBadges = badgeId
    ? await database.badgeDefinition.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ title: "asc" }, { id: "asc" }],
        select: { id: true, title: true },
      })
    : badges.map(({ id, title }) => ({ id, title }));
  const ranked = [...matching].sort(
    (a, b) =>
      b.awards.length - a.awards.length ||
      a.title.localeCompare(b.title, "pt-BR")
  );
  return { actor, badges: ranked, cohorts, allBadges };
};
