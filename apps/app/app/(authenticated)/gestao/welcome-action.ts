"use server";

import { database } from "@repo/database";
import { requireGestaoActor } from "@/lib/gestao-authorization";

/** Guarda no cadastro que a mensagem de boas-vindas da Gestão já foi vista. */
export const markGestaoWelcomeSeen = async () => {
  const actor = await requireGestaoActor();
  await database.member.updateMany({
    where: { id: actor.userId, gestaoWelcomeSeenAt: null },
    data: { gestaoWelcomeSeenAt: new Date() },
  });
};
