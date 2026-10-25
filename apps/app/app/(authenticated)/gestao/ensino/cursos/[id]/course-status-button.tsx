"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setGestaoCourseState } from "./structure-actions";
import { MenuNote } from "./structure-controls";
import { CourseAccessConfirmDialog } from "./turmas/course-access-ui";

const copy = {
  DRAFT: {
    label: "Publicar",
    confirm: "Publicar curso",
    next: "PUBLISHED",
    title: "Publicar este curso?",
    description:
      "O curso ficará disponível conforme as turmas, matrículas e demais acessos configurados. Aulas em rascunho continuam ocultas.",
  },
  PUBLISHED: {
    label: "Arquivar",
    confirm: "Arquivar curso",
    next: "ARCHIVED",
    title: "Arquivar este curso?",
    description:
      "Os alunos deixam de ver o curso nas listas. O progresso e os acessos continuam guardados e o curso pode ser publicado de novo.",
  },
  ARCHIVED: {
    label: "Publicar de novo",
    confirm: "Publicar curso",
    next: "PUBLISHED",
    title: "Publicar este curso de novo?",
    description:
      "O curso volta a aparecer para quem já tem acesso, com o progresso preservado.",
  },
} as const;

export const CourseStatusButton = ({
  courseId,
  status,
  tone = "primary",
}: {
  readonly courseId: string;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";
  readonly tone?: "primary" | "plain";
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const entry = copy[status === "SCHEDULED" ? "DRAFT" : status];
  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", courseId);
      formData.set("status", entry.next);
      const result = await setGestaoCourseState(formData);
      setOpen(false);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };
  const isPublish = entry.next === "PUBLISHED";
  const className =
    isPublish && tone === "primary" ? "gk-btn gk-btn--primary" : "gk-btn";
  return (
    <>
      <button
        className={className}
        disabled={pending}
        onClick={() => setOpen(true)}
        type="button"
      >
        {pending ? "Salvando…" : entry.label}
      </button>
      {error ? (
        <MenuNote message={error} onDismiss={() => setError(null)} />
      ) : null}
      <CourseAccessConfirmDialog
        confirmLabel={entry.confirm}
        description={entry.description}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
        open={open}
        title={entry.title}
      />
    </>
  );
};
