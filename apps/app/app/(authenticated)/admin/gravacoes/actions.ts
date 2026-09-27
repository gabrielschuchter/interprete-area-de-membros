"use server";

import { randomUUID } from "node:crypto";
import {
  database,
  ImportedRecordingGroupAssignmentAction,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authorization";
import {
  consumeMutationRateLimit,
  mutationLog,
} from "@/lib/mutation-reliability";

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
  if (!(groupId && memberId)) {
    finish("error", "Escolha um membro existente antes de confirmar.");
  }

  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const startedAt = Date.now();

  try {
    await database.$transaction(async (transaction) => {
      const [group, member] = await Promise.all([
        transaction.importedRecordingGroup.findUnique({
          where: { id: groupId },
          select: { id: true, memberId: true },
        }),
        transaction.member.findUnique({
          where: { id: memberId },
          select: { id: true },
        }),
      ]);

      if (!(group && member)) {
        throw new Error("Grupo ou membro não encontrado.");
      }
      if (group.memberId === memberId) {
        return;
      }

      const action = group.memberId
        ? ImportedRecordingGroupAssignmentAction.REASSIGNED
        : ImportedRecordingGroupAssignmentAction.ASSIGNED;
      await transaction.importedRecordingGroup.update({
        where: { id: group.id },
        data: {
          memberId,
          assignedAt: new Date(),
          assignedByMemberId: userId,
        },
      });
      await transaction.importedRecordingGroupAssignment.create({
        data: {
          id: randomUUID(),
          groupId: group.id,
          previousMemberId: group.memberId,
          memberId,
          changedByMemberId: userId,
          action,
        },
      });
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
    await database.$transaction(async (transaction) => {
      const group = await transaction.importedRecordingGroup.findUnique({
        where: { id: groupId },
        select: { id: true, memberId: true },
      });
      if (!group) {
        throw new Error("Grupo não encontrado.");
      }
      if (!group.memberId) {
        return;
      }

      await transaction.importedRecordingGroup.update({
        where: { id: group.id },
        data: { memberId: null, assignedAt: null, assignedByMemberId: userId },
      });
      await transaction.importedRecordingGroupAssignment.create({
        data: {
          id: randomUUID(),
          groupId: group.id,
          previousMemberId: group.memberId,
          memberId: null,
          changedByMemberId: userId,
          action: ImportedRecordingGroupAssignmentAction.REVOKED,
        },
      });
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
