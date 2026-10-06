"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authorization";
import {
  consumeMutationRateLimit,
  mutationLog,
} from "@/lib/mutation-reliability";
import {
  assignRecordingGroup,
  revokeRecordingGroup,
} from "@/lib/recording-groups";

const value = (input: FormDataEntryValue | null) =>
  typeof input === "string" ? input.trim() : "";

const finish = (status: "assigned" | "revoked" | "error", message?: string) => {
  const query = new URLSearchParams({ status });
  if (message) {
    query.set("message", message);
  }
  redirect(`/admin/gravacoes?${query.toString()}`);
};

export const assignImportedRecordingGroup = async (formData: FormData) => {
  const { userId } = await requireAdmin();
  const groupId = value(formData.get("groupId"));
  const memberId = value(formData.get("memberId"));
  const identityConfirmed = value(formData.get("identityConfirmed")) === "true";
  const identityEvidence = value(formData.get("identityEvidence"));
  const confirmReassignment =
    value(formData.get("confirmReassignment")) === "true";
  if (!(groupId && memberId)) {
    finish("error", "Escolha um membro existente antes de confirmar.");
  }
  if (!identityConfirmed) {
    finish(
      "error",
      "Confirme que verificou a identidade do titular antes de liberar o grupo."
    );
  }
  if (identityEvidence.trim().length < 20 || identityEvidence.length > 1000) {
    finish(
      "error",
      "Registre uma evidência de pelo menos 20 caracteres e no máximo 1.000."
    );
  }

  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const startedAt = Date.now();

  try {
    await assignRecordingGroup({
      changedByMemberId: userId,
      groupId,
      identityConfirmed,
      identityEvidence,
      memberId,
      confirmReassignment,
    });

    mutationLog({
      action: "admin.recording-group.assign",
      memberId: userId,
      resource: groupId,
      status: "success",
      durationMs: Date.now() - startedAt,
    });
    revalidatePath("/admin/gravacoes");
    revalidatePath("/encontros/gravacoes");
    revalidatePath("/");
    finish("assigned");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    if (
      error instanceof Error &&
      error.message === "recording_identity_confirmation_required"
    ) {
      finish(
        "error",
        "Confirme que verificou a identidade do titular antes de liberar o grupo."
      );
    }
    if (
      error instanceof Error &&
      error.message === "recording_identity_evidence_invalid"
    ) {
      finish(
        "error",
        "Registre uma evidência de pelo menos 20 caracteres e no máximo 1.000."
      );
    }
    mutationLog({
      action: "admin.recording-group.assign",
      memberId: userId,
      resource: groupId,
      status: "error",
      durationMs: Date.now() - startedAt,
    });
    console.error("Imported recording group assignment failed", error);
    finish("error", "Não foi possível vincular este grupo agora.");
  }
};

export const revokeImportedRecordingGroup = async (formData: FormData) => {
  const { userId } = await requireAdmin();
  const groupId = value(formData.get("groupId"));
  if (!groupId) {
    finish("error", "Grupo inválido.");
  }

  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const startedAt = Date.now();

  try {
    await revokeRecordingGroup({
      changedByMemberId: userId,
      groupId,
    });

    mutationLog({
      action: "admin.recording-group.revoke",
      memberId: userId,
      resource: groupId,
      status: "success",
      durationMs: Date.now() - startedAt,
    });
    revalidatePath("/admin/gravacoes");
    revalidatePath("/encontros/gravacoes");
    revalidatePath("/");
    finish("revoked");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    mutationLog({
      action: "admin.recording-group.revoke",
      memberId: userId,
      resource: groupId,
      status: "error",
      durationMs: Date.now() - startedAt,
    });
    console.error("Imported recording group revocation failed", error);
    finish("error", "Não foi possível revogar este grupo agora.");
  }
};
