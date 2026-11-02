"use server";

import { revalidatePath } from "next/cache";
import { setSavedCommunityLabels } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

export const setSavedLabelsAction = async (
  postId: string,
  labels: readonly string[]
) => {
  if (typeof postId !== "string" || !Array.isArray(labels)) {
    throw new Error("Pedido inválido.");
  }
  const saved = await setSavedCommunityLabels(
    await requireMemberId(),
    postId,
    labels
  );
  revalidatePath("/comunidade/salvos");
  return saved;
};
