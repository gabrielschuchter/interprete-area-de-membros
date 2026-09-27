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
  const confirmReassignment =
    value(formData.get("confirmReassignment")) === "true";
  if (!(groupId && memberId)) {
    finish("error", "Escolha um membro existente antes de confirmar.");
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
