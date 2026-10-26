"use server";

import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";
import {
  cursosSettingKey,
  maxBlockSubtitle,
  maxBlockTitle,
  maxNoteText,
  portalNoteSettingKey,
} from "@/lib/personalization-domain";
import { productSettingKeys } from "@/lib/product-config";

const listPath = "/gestao/administracao/personalizacao";

export interface PublishState {
  readonly error: string | null;
}

const blockSchema = z.object({
  enabled: z.boolean(),
  id: z.enum(["resume", "recordings", "collections"]),
  subtitle: z.string().max(maxBlockSubtitle).nullable(),
  title: z.string().max(maxBlockTitle).nullable(),
});

const draftSchema = z.object({
  blocks: z.array(blockSchema).length(3),
  note: z.object({
    enabled: z.boolean(),
    mode: z.enum(["auto", "manual"]),
    text: z.string().max(maxNoteText),
  }),
  recordingsExperienceV2: z.boolean(),
  showLearnNavigation: z.boolean(),
});

const parsePayload = (formData: FormData) => {
  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > 20_000) {
    return null;
  }
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const publishGestaoPersonalization = async (
  _previous: PublishState,
  formData: FormData
): Promise<PublishState> => {
  const { actor } = await requireGestaoAction("customization.manage");
  const draft = parsePayload(formData);
  if (!draft) {
    return {
      error: "Não foi possível ler as alterações. Recarregue a página.",
    };
  }
  if (new Set(draft.blocks.map((block) => block.id)).size !== 3) {
    return { error: "A lista de blocos está incompleta." };
  }
  if (
    draft.note.enabled &&
    draft.note.mode === "manual" &&
    draft.note.text.trim().length < 3
  ) {
    return { error: "Escreva a nota manual ou volte para o modo automático." };
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const blocks = [
    ...draft.blocks.filter((block) => block.id === "resume"),
    ...draft.blocks.filter((block) => block.id !== "resume"),
  ].map((block) => ({
    ...block,
    subtitle: block.subtitle?.trim() || null,
    title: block.title?.trim() || null,
  }));
  const note = { ...draft.note, text: draft.note.text.trim() };
  const settings: [string, boolean | object][] = [
    [productSettingKeys.recordingsExperienceV2, draft.recordingsExperienceV2],
    [productSettingKeys.showLearnNavigation, draft.showLearnNavigation],
    [cursosSettingKey, blocks],
    [portalNoteSettingKey, note],
  ];
  await database.$transaction(async (transaction) => {
    for (const [key, value] of settings) {
      await transaction.productSetting.upsert({
        where: { key },
        create: { key, updatedByMemberId: actor.userId, value },
        update: { updatedByMemberId: actor.userId, value },
      });
    }
    await recordAuditEvent(
      {
        actorId: actor.userId,
        aggregateId: "personalizacao",
        aggregateType: "ProductSetting",
        eventType: "gestao.personalization.published",
        payload: {
          blocks: blocks.map(({ enabled, id }) => ({ enabled, id })),
          noteEnabled: note.enabled,
          noteMode: note.mode,
          recordingsExperienceV2: draft.recordingsExperienceV2,
          showLearnNavigation: draft.showLearnNavigation,
        },
      },
      transaction
    );
  });
  for (const path of ["/", "/cursos", listPath]) {
    revalidatePath(path);
  }
  redirect(`${listPath}?resultado=publicado`);
};
