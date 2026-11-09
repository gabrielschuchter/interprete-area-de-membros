"use server";

import { EvidenceToolKind } from "@repo/database";
import { revalidatePath } from "next/cache";
import { requireOnboardedMemberId as requireMemberId } from "@/lib/authorization";
import {
  deleteEvidenceAssessment,
  EvidenceAssessmentError,
  saveGradeAssessment,
  saveRob2Assessment,
} from "@/lib/evidence-assessments";

export type EvidenceActionResult =
  | { readonly id: string; readonly ok: true; readonly version: number }
  | { readonly error: string; readonly ok: false };

const run = async (
  save: () => Promise<{ readonly id: string; readonly version: number }>
): Promise<EvidenceActionResult> => {
  try {
    const saved = await save();
    revalidatePath("/ferramentas");
    return { ok: true, id: saved.id, version: saved.version };
  } catch (error) {
    if (error instanceof EvidenceAssessmentError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
};

export const saveRob2AssessmentAction = async (input: unknown) => {
  const memberId = await requireMemberId();
  return run(() => saveRob2Assessment(memberId, input));
};

export const saveGradeAssessmentAction = async (input: unknown) => {
  const memberId = await requireMemberId();
  return run(() => saveGradeAssessment(memberId, input));
};

export const deleteEvidenceAssessmentAction = async (input: {
  readonly id: string;
  readonly tool: "GRADE" | "ROB2";
}): Promise<{ readonly error?: string; readonly ok: boolean }> => {
  const memberId = await requireMemberId();
  const tool =
    input.tool === "GRADE" ? EvidenceToolKind.GRADE : EvidenceToolKind.ROB2;
  try {
    await deleteEvidenceAssessment(memberId, tool, String(input.id));
    revalidatePath("/ferramentas");
    return { ok: true };
  } catch (error) {
    if (error instanceof EvidenceAssessmentError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
};
