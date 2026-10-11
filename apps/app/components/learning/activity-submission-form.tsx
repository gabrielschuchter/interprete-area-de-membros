"use client";
import { Button } from "@repo/design-system/components/ui/button";
import { type ReactNode, useActionState, useRef } from "react";
import {
  type ActivitySubmissionState,
  submitActivity,
} from "@/app/(authenticated)/atividades/actions";

const initialState: ActivitySubmissionState = { ok: false };
export const ActivitySubmissionForm = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const locked = useRef(false);
  const [state, action, pending] = useActionState(
    async (previous: ActivitySubmissionState, data: FormData) => {
      try {
        return await submitActivity(previous, data);
      } finally {
        locked.current = false;
      }
    },
    initialState
  );
  return (
    <form
      action={action}
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        if (locked.current) {
          event.preventDefault();
          return;
        }
        locked.current = true;
      }}
    >
      {children}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Enviando…" : "Enviar resposta"}
      </Button>
      {state.message && (
        <p
          aria-live="polite"
          className={
            state.ok
              ? "text-brand-action-text text-sm"
              : "text-destructive text-sm"
          }
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      <p className="text-muted-foreground text-xs leading-5">
        O envio substitui a versão anterior e fica visível apenas para você e
        para a equipe docente.
      </p>
    </form>
  );
};
