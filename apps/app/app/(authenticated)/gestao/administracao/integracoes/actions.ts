"use server";

import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  parseYouTubePolicy,
  youtubePolicySettingKey,
} from "@/lib/integrations-domain";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const listPath = "/gestao/administracao/integracoes";

export interface YouTubeSettingsState {
  readonly error: string | null;
}

export const saveGestaoYouTubeSettings = async (
  _previous: YouTubeSettingsState,
  formData: FormData
): Promise<YouTubeSettingsState> => {
  const { actor } = await requireGestaoAction("integrations.manage");
  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > 2000) {
    return {
      error: "Não foi possível ler as alterações. Recarregue a página.",
    };
  }
  let policy: ReturnType<typeof parseYouTubePolicy>;
  try {
    policy = parseYouTubePolicy(JSON.parse(raw));
  } catch {
    return {
      error: "Não foi possível ler as alterações. Recarregue a página.",
    };
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const value = { ...policy };
  await database.$transaction(async (transaction) => {
    await transaction.productSetting.upsert({
      where: { key: youtubePolicySettingKey },
      create: {
        key: youtubePolicySettingKey,
        updatedByMemberId: actor.userId,
        value,
      },
      update: { updatedByMemberId: actor.userId, value },
    });
    await recordAuditEvent(
      {
        actorId: actor.userId,
        aggregateId: "youtube",
        aggregateType: "ProductSetting",
        eventType: "gestao.integration.updated",
        payload: value,
      },
      transaction
    );
  });
  revalidatePath(listPath);
  redirect(`${listPath}?resultado=salvo`);
};
