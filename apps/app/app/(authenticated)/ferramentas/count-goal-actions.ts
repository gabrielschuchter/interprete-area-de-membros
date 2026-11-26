"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedMemberId as requireMemberId } from "@/lib/authorization";
import { deleteCountGoal, saveCountGoal } from "@/lib/study-count-goals";

export const saveCountGoalAction = async (input: {
  kind: "LESSONS" | "READINGS" | "EXERCISES";
  target: number;
}) => {
  const result = await saveCountGoal(await requireMemberId(), input);
  revalidatePath("/ferramentas");
  return result;
};

export const deleteCountGoalAction = async (
  kind: "LESSONS" | "READINGS" | "EXERCISES"
) => {
  await deleteCountGoal(await requireMemberId(), kind);
  revalidatePath("/ferramentas");
};
