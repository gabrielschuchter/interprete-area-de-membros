import "server-only";

import { type BadgeCriterion, database } from "@repo/database";
import { evaluateMemberBadges } from "./badges";

const batchSize = 10;

/**
 * Depois que a Gestão muda critério, quantidade ou publicação de uma medalha,
 * todos os membros ativos são reavaliados para esse critério, de modo que a
 * regra nova vale na hora e não só no próximo evento de cada pessoa.
 */
export const reevaluateBadgesForAllMembers = async (
  criteria: readonly BadgeCriterion[]
) => {
  const members = await database.member.findMany({
    where: { deactivatedAt: null },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const now = new Date();
  for (let index = 0; index < members.length; index += batchSize) {
    await Promise.all(
      members.slice(index, index + batchSize).map(({ id }) =>
        database
          .$transaction((transaction) =>
            evaluateMemberBadges(transaction, id, now, {
              criteria,
              force: true,
            })
          )
          .catch(() => [])
      )
    );
  }
};
