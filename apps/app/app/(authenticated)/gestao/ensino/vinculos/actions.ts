"use server";

import { revalidatePath } from "next/cache";
import { addContentLink, removeContentLink } from "@/lib/content-links";
import { isLinkSide } from "@/lib/content-links-model";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const authorize = async () => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  return actor;
};

const refresh = () => {
  revalidatePath("/gestao/ensino", "layout");
  revalidatePath("/cursos", "layout");
  revalidatePath("/exercicios", "layout");
  revalidatePath("/biblioteca", "layout");
};

/** Vincula o conteúdo de origem a outro conteúdo (sugestão de estudo). */
export const addContentLinkAction = async (formData: FormData) => {
  const sourceSide = text(formData.get("sourceSide"));
  const targetSide = text(formData.get("targetSide"));
  const sourceId = text(formData.get("sourceId"));
  const targetId = text(formData.get("targetId"));
  if (
    !(isLinkSide(sourceSide) && isLinkSide(targetSide) && sourceId && targetId)
  ) {
    return;
  }
  const actor = await authorize();
  const result = await addContentLink(
    { side: sourceSide, id: sourceId },
    { side: targetSide, id: targetId }
  );
  if (!result.ok) {
    return;
  }
  await recordAuditEvent({
    eventType: "gestao.content-link.added",
    actorId: actor.userId,
    aggregateType: "ContentLink",
    aggregateId: sourceId,
    payload: { sourceId, sourceSide, targetId, targetSide },
  });
  refresh();
};

export const removeContentLinkAction = async (formData: FormData) => {
  const linkId = text(formData.get("linkId"));
  if (!linkId) {
    return;
  }
  const actor = await authorize();
  if (!(await removeContentLink(linkId))) {
    return;
  }
  await recordAuditEvent({
    eventType: "gestao.content-link.removed",
    actorId: actor.userId,
    aggregateType: "ContentLink",
    aggregateId: linkId,
    payload: { linkId },
  });
  refresh();
};
