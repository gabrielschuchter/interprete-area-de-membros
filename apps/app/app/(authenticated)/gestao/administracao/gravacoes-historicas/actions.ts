"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { maxEvidence, minEvidence } from "@/lib/gestao-recordings-domain";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";
import {
  assignRecordingGroup,
  revokeRecordingGroup,
} from "@/lib/recording-groups";

const listPath = "/gestao/administracao/gravacoes-historicas";

export interface LinkRecordingState {
  readonly error: string | null;
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const knownErrors: Record<string, string> = {
  recording_group_changed_concurrently:
    "Outra pessoa alterou este grupo agora há pouco. Atualize e confira.",
  recording_group_or_member_not_found:
    "O grupo ou o membro escolhido não existe mais.",
  recording_group_reassignment_requires_confirmation:
    "Este grupo já tem dono. Confirme a reatribuição para continuar.",
};

const refresh = () => {
  revalidatePath(listPath);
  revalidatePath("/encontros/gravacoes");
};

export const linkGestaoRecordingGroup = async (
  _previous: LinkRecordingState,
  formData: FormData
): Promise<LinkRecordingState> => {
  const { actor } = await requireGestaoAction("recordings.manage");
  const groupId = text(formData, "groupId");
  const memberId = text(formData, "memberId");
  const evidence = text(formData, "identityEvidence");
  if (!(groupId && memberId)) {
    return { error: "Escolha um membro existente antes de confirmar." };
  }
  if (text(formData, "identityConfirmed") !== "true") {
    return {
      error:
        "Confirme que verificou a identidade do titular antes de liberar o grupo.",
    };
  }
  if (evidence.length < minEvidence || evidence.length > maxEvidence) {
    return {
      error: `Registre uma evidência de pelo menos ${minEvidence} caracteres e no máximo ${maxEvidence}.`,
    };
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  let result: Awaited<ReturnType<typeof assignRecordingGroup>>;
  try {
    result = await assignRecordingGroup({
      changedByMemberId: actor.userId,
      confirmReassignment: text(formData, "confirmReassignment") === "true",
      groupId,
      identityConfirmed: true,
      identityEvidence: evidence,
      memberId,
    });
  } catch (error) {
    const known = error instanceof Error ? knownErrors[error.message] : null;
    if (!known) {
      console.error("Historical recording group link failed", error);
    }
    return { error: known ?? "Não foi possível vincular este grupo agora." };
  }
  if (result.changed) {
    await recordAuditEvent({
      actorId: actor.userId,
      aggregateId: groupId,
      aggregateType: "ImportedRecordingGroup",
      eventType: "gestao.recording.assigned",
      payload: {
        memberId,
        previousMemberId: result.previousMemberId,
      },
    });
  }
  refresh();
  redirect(`${listPath}?grupo=${groupId}&resultado=vinculado`);
};

export const revokeGestaoRecordingGroup = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("recordings.manage");
  const groupId = text(formData, "groupId");
  if (!groupId) {
    redirect(`${listPath}?resultado=invalido`);
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const result = await revokeRecordingGroup({
    changedByMemberId: actor.userId,
    groupId,
  });
  if (result.changed) {
    await recordAuditEvent({
      actorId: actor.userId,
      aggregateId: groupId,
      aggregateType: "ImportedRecordingGroup",
      eventType: "gestao.recording.revoked",
      payload: { previousMemberId: result.previousMemberId },
    });
  }
  refresh();
  redirect(`${listPath}?grupo=${groupId}&tab=vinculados&resultado=revogado`);
};
