"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedMemberId as requireMemberId } from "@/lib/authorization";
import {
  addManualStudyEntry,
  deleteManualStudyEntry,
} from "@/lib/study-manual";

const refreshStudyViews = () => {
  revalidatePath("/ferramentas");
  revalidatePath("/");
};

export const addManualStudyEntryAction = async (input: {
  group: "lesson" | "reading" | "exercise";
  minutes: number;
}) => {
  const result = await addManualStudyEntry(await requireMemberId(), input);
  refreshStudyViews();
  return result;
};

export const deleteManualStudyEntryAction = async (sessionId: string) => {
  const result = await deleteManualStudyEntry(
    await requireMemberId(),
    sessionId
  );
  refreshStudyViews();
  return result;
};
