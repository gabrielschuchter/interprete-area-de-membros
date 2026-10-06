import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import Link from "next/link";

interface ExerciseAnswerFeedbackProperties {
  readonly correctOptionLabels: readonly string[];
  readonly explanation: string | null;
  readonly isCorrect: boolean;
  readonly isSessionComplete: boolean;
  readonly nextHref: string | null;
  readonly resultHref: string;
}

export const ExerciseAnswerFeedback = ({
  correctOptionLabels,
  explanation,
  isCorrect,
  isSessionComplete,
  nextHref,
  resultHref,
}: ExerciseAnswerFeedbackProperties) => (
  <output
    aria-live="polite"
    className={`mt-7 block rounded-lg border p-5 ${isCorrect ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}
  >
    <span className="flex items-center gap-2 font-medium">
      {isCorrect ? (
        <CheckCircle2Icon aria-hidden="true" className="size-5" />
      ) : (
        <XCircleIcon aria-hidden="true" className="size-5" />
      )}
      {isCorrect ? "Resposta correta" : "Resposta incorreta"}
    </span>
    <span className="mt-3 block text-muted-foreground text-sm">
      Resposta(s) correta(s): {correctOptionLabels.join(", ")}
    </span>
    {explanation && (
      <span className="mt-4 block whitespace-pre-wrap text-sm leading-6">
        {explanation}
      </span>
    )}
    {isSessionComplete ? (
      <Button asChild className="mt-5">
        <Link href={resultHref}>Ver resultado final</Link>
      </Button>
    ) : (
      nextHref && (
        <Button asChild className="mt-5">
          <Link href={nextHref}>Ir para próxima questão</Link>
        </Button>
      )
    )}
  </output>
);
