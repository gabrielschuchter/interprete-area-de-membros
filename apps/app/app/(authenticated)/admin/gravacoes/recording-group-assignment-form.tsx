"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useRef, useState } from "react";
import { RecordingMemberPicker } from "./recording-member-picker";

interface MemberOption {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly id: string;
  readonly profile: {
    readonly username: string;
    readonly displayName: string | null;
  } | null;
}

interface RecordingGroupAssignmentFormProperties {
  readonly action: (formData: FormData) => Promise<void>;
  readonly attachmentCount: number;
  readonly defaultMemberId: string | null;
  readonly groupId: string;
  readonly members: readonly MemberOption[];
  readonly recordingCount: number;
}

export const RecordingGroupAssignmentForm = ({
  action,
  attachmentCount,
  defaultMemberId,
  groupId,
  members,
  recordingCount,
}: RecordingGroupAssignmentFormProperties) => {
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  let submitLabel = "Confirmar vínculo";
  if (defaultMemberId) {
    submitLabel = "Reatribuir grupo";
  }
  if (confirming) {
    submitLabel = "Confirmar reatribuição";
  }

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={(event) => {
        if (!defaultMemberId) {
          return;
        }
        const selectedMemberId = new FormData(event.currentTarget).get(
          "memberId"
        );
        if (
          typeof selectedMemberId === "string" &&
          selectedMemberId !== defaultMemberId
        ) {
          if (!confirming) {
            event.preventDefault();
            setConfirming(true);
            return;
          }
          if (confirmationRef.current) {
            confirmationRef.current.value = "true";
          }
        }
      }}
    >
      <input name="groupId" type="hidden" value={groupId} />
      <input
        name="confirmReassignment"
        ref={confirmationRef}
        type="hidden"
        value="false"
      />
      <RecordingMemberPicker defaultValue={defaultMemberId} members={members} />
      <p className="text-muted-foreground text-xs leading-5">
        Este vínculo libera {recordingCount} gravações e {attachmentCount}{" "}
        materiais somente para a conta escolhida.
      </p>
      <div className="space-y-3 border bg-muted/20 p-4">
        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            className="mt-1 size-4 shrink-0 accent-brand-action"
            name="identityConfirmed"
            required
            type="checkbox"
            value="true"
          />
          <span>
            Confirmei a identidade do titular com uma fonte confiável; o nome
            histórico sozinho não foi usado para escolher a conta.
          </span>
        </label>
        <label
          className="font-data text-muted-foreground text-xs uppercase tracking-[0.12em]"
          htmlFor={`recording-evidence-${groupId}`}
        >
          Evidência consultada
        </label>
        <Textarea
          id={`recording-evidence-${groupId}`}
          maxLength={1000}
          minLength={20}
          name="identityEvidence"
          placeholder="Registre a fonte e o critério conferido. Não inclua senhas, tokens ou dados desnecessários."
          required
          rows={3}
        />
        <p className="text-muted-foreground text-xs leading-5">
          Esse registro ficará no histórico administrativo do grupo.
        </p>
      </div>
      {confirming ? (
        <div className="border border-brand-action/40 bg-brand-action/5 p-4 text-sm leading-6">
          <p>
            Você está prestes a trocar a conta autorizada para {recordingCount}{" "}
            gravações e {attachmentCount} materiais.
          </p>
          <button
            className="mt-2 text-muted-foreground text-xs underline underline-offset-4"
            onClick={() => setConfirming(false)}
            type="button"
          >
            Cancelar
          </button>
        </div>
      ) : null}
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
};
