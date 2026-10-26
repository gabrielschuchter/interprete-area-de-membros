"use client";

import { useActionState } from "react";
import { setGestaoLessonStatus } from "@/app/(authenticated)/admin/actions";

interface GestaoLessonPublicationProperties {
  readonly expectedUpdatedAt: string;
  readonly initialIdempotencyKey: string;
  readonly lessonId: string;
  readonly published: boolean;
  readonly variant?: "block" | "inline";
}

export const GestaoLessonPublication = ({
  expectedUpdatedAt,
  initialIdempotencyKey,
  lessonId,
  published,
  variant = "block",
}: GestaoLessonPublicationProperties) => {
  const [state, action, pending] = useActionState(setGestaoLessonStatus, {
    status: "saved" as const,
    message: "",
    idempotencyKey: initialIdempotencyKey,
  });
  let buttonLabel = published ? "Arquivar aula" : "Publicar";
  if (pending) {
    buttonLabel = published ? "Arquivando…" : "Publicando…";
  }
  const buttonClass = published ? "gk-btn" : "gk-btn gk-btn--primary";

  return (
    <form
      action={action}
      className="gl-lesson-publish-form"
      data-variant={variant}
    >
      <input name="lessonId" type="hidden" value={lessonId} />
      <input name="expectedUpdatedAt" type="hidden" value={expectedUpdatedAt} />
      <input name="idempotencyKey" type="hidden" value={state.idempotencyKey} />
      <input
        name="status"
        type="hidden"
        value={published ? "ARCHIVED" : "PUBLISHED"}
      />
      <button className={buttonClass} disabled={pending} type="submit">
        {buttonLabel}
      </button>
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
