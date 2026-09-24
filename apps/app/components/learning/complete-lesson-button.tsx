"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useActionState } from "react";
import {
  type CompleteLessonState,
  completeLesson,
} from "../../app/(authenticated)/aprender/actions";

const initialState: CompleteLessonState = { ok: false };

const getButtonLabel = (isCompleted: boolean, isPending: boolean) => {
  if (isCompleted) {
    return "Aula concluída";
  }

  if (isPending) {
    return "Salvando...";
  }

  return "Marcar como concluída";
};

interface CompleteLessonButtonProperties {
  readonly isCompleted: boolean;
  readonly lessonId: string;
}

export const CompleteLessonButton = ({
  isCompleted,
  lessonId,
}: CompleteLessonButtonProperties) => {
  const [state, formAction, isPending] = useActionState(
    completeLesson,
    initialState
  );

  return (
    <div className="flex flex-col items-start gap-2">
      <form action={formAction}>
        <input name="lessonId" type="hidden" value={lessonId} />
        <Button
          disabled={isCompleted || isPending}
          size="lg"
          type="submit"
          variant={isCompleted ? "secondary" : "default"}
        >
          {isPending ? (
            <Loader2Icon aria-hidden="true" className="animate-spin" />
          ) : (
            <CheckCircle2Icon aria-hidden="true" />
          )}
          {getButtonLabel(isCompleted, isPending)}
        </Button>
      </form>
      {state.message && (
        <p
          aria-live="polite"
          className={
            state.ok
              ? "text-muted-foreground text-sm"
              : "text-destructive text-sm"
          }
        >
          {state.message}
        </p>
      )}
    </div>
  );
};
