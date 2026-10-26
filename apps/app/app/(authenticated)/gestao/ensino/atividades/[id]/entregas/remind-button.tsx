"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MenuNote } from "../../../cursos/[id]/structure-controls";
import { remindGestaoActivityPending } from "../../delivery-actions";

export const RemindButton = ({
  activityId,
  className,
  label,
  memberId,
}: {
  readonly activityId: string;
  readonly className: string;
  readonly label: string;
  readonly memberId?: string;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [sentOnce, setSentOnce] = useState(false);
  const send = () => {
    setNote(null);
    const data = new FormData();
    data.set("activityId", activityId);
    if (memberId) {
      data.set("memberId", memberId);
    }
    startTransition(async () => {
      const result = await remindGestaoActivityPending(data);
      if (result.ok) {
        setSentOnce(true);
        setNote(
          result.sent === 1
            ? "Lembrete enviado a 1 aluno."
            : `Lembrete enviado a ${result.sent} alunos.`
        );
        router.refresh();
      } else {
        setNote(result.message);
      }
    });
  };
  let buttonLabel = label;
  if (pending) {
    buttonLabel = "Enviando…";
  } else if (sentOnce && memberId) {
    buttonLabel = "Lembrado";
  }
  return (
    <span className="gk-menu-anchor">
      <button
        className={className}
        disabled={pending}
        onClick={send}
        type="button"
      >
        {buttonLabel}
      </button>
      {note ? (
        <MenuNote message={note} onDismiss={() => setNote(null)} />
      ) : null}
    </span>
  );
};
