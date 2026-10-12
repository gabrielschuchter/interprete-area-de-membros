"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useActionState } from "react";
import { setGestaoLessonStatus } from "@/app/(authenticated)/admin/actions";

interface GestaoLessonPublicationProperties {
  readonly expectedUpdatedAt: string;
  readonly initialIdempotencyKey: string;
  readonly lessonId: string;
  readonly published: boolean;
}

export const GestaoLessonPublication = ({
  expectedUpdatedAt,
  initialIdempotencyKey,
  lessonId,
  published,
}: GestaoLessonPublicationProperties) => {
  const [state, action, pending] = useActionState(setGestaoLessonStatus, {
    status: "saved" as const,
    message: "",
    idempotencyKey: initialIdempotencyKey,
  });
  const buttonLabel = published ? "Arquivar aula" : "Publicar agora";
  const pendingLabel = published ? "Arquivando…" : "Verificando e publicando…";

  return (
    <form action={action}>
      <input name="lessonId" type="hidden" value={lessonId} />
      <input name="expectedUpdatedAt" type="hidden" value={expectedUpdatedAt} />
      <input name="idempotencyKey" type="hidden" value={state.idempotencyKey} />
      <input
        name="status"
        type="hidden"
        value={published ? "ARCHIVED" : "PUBLISHED"}
      />
      <Button
        className="w-full"
        disabled={pending}
        type="submit"
        variant={published ? "outline" : "default"}
      >
        {pending ? pendingLabel : buttonLabel}
      </Button>
      {state.message ? (
        <output
          aria-live={state.status === "conflict" ? "assertive" : "polite"}
          className={`gl-lesson-publication-message is-${state.status}`}
        >
          {state.message}
        </output>
      ) : null}
    </form>
  );
};
