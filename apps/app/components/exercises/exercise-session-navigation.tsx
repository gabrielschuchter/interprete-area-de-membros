"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import { ArrowLeftIcon, CheckIcon, CircleIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useExerciseSessionDrafts } from "./exercise-session-drafts";

export interface ExerciseNavigationQuestion {
  readonly answer: { readonly isCorrect: boolean } | null;
  readonly id: string;
  readonly position: number;
}

const hrefForQuestion = (
  sessionId: string,
  question: ExerciseNavigationQuestion
) =>
  question.answer
    ? `/exercicios/sessoes/${sessionId}/revisao/${question.position + 1}`
    : `/exercicios/sessoes/${sessionId}?questao=${encodeURIComponent(question.id)}`;

const QuestionStatusIcon = ({
  answer,
  current,
}: {
  readonly answer: ExerciseNavigationQuestion["answer"];
  readonly current: boolean;
}) => {
  if (answer?.isCorrect) {
    return <CheckIcon aria-hidden="true" className="size-3.5" />;
  }
  if (answer && !answer.isCorrect) {
    return <XIcon aria-hidden="true" className="size-3.5" />;
  }
  if (current) {
    return (
      <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
    );
  }
  return <CircleIcon aria-hidden="true" className="size-3.5" />;
};

const QuestionNavigationGrid = ({
  currentQuestionId,
  onChoose,
  questions,
  sessionId,
}: {
  readonly currentQuestionId: string;
  readonly onChoose: () => void;
  readonly questions: readonly ExerciseNavigationQuestion[];
  readonly sessionId: string;
}) => (
  <>
    <ul
      aria-label="Legenda de status"
      className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-muted-foreground text-xs"
    >
      <li className="inline-flex items-center gap-1.5">
        <CheckIcon aria-hidden="true" className="size-3.5 text-success" />
        Correta
      </li>
      <li className="inline-flex items-center gap-1.5">
        <XIcon aria-hidden="true" className="size-3.5 text-destructive" />
        Incorreta
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-3 border border-primary" />
        Atual
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-3 rounded-sm border bg-muted"
        />
        Pendente
      </li>
    </ul>
    <ol className="mt-4 grid grid-cols-5 gap-2 md:grid-cols-5">
      {questions.map((question) => {
        const isCurrent = question.id === currentQuestionId;
        let className = "border-border bg-muted/70 text-muted-foreground";
        let status = "pendente";
        if (question.answer) {
          className = question.answer.isCorrect
            ? "border-success bg-success/5 text-success"
            : "border-destructive bg-destructive/5 text-destructive";
          status = question.answer.isCorrect ? "correta" : "incorreta";
        } else if (isCurrent) {
          className = "border-2 border-primary bg-card text-primary";
          status = "atual";
        }
        return (
          <li key={question.id}>
            <Link
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Questão ${question.position + 1}, ${status}`}
              className={`relative flex size-11 items-center justify-center rounded-md border font-mono font-semibold text-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
              href={hrefForQuestion(sessionId, question)}
              onClick={onChoose}
            >
              {question.position + 1}
              <QuestionStatusIcon
                answer={question.answer}
                current={isCurrent}
              />
            </Link>
          </li>
        );
      })}
    </ol>
    <p className="mt-4 text-muted-foreground text-sm leading-6">
      As questões pendentes seguem a ordem da lista. Toque numa questão
      respondida para rever o gabarito.
    </p>
  </>
);

export const ExerciseQuestionNavigator = ({
  currentQuestionId,
  questions,
  sessionId,
}: {
  readonly currentQuestionId: string;
  readonly questions: readonly ExerciseNavigationQuestion[];
  readonly sessionId: string;
}) => {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const content = (
    <QuestionNavigationGrid
      currentQuestionId={currentQuestionId}
      onChoose={() => {
        setDesktopOpen(false);
        setMobileOpen(false);
      }}
      questions={questions}
      sessionId={sessionId}
    />
  );

  return (
    <>
      <Popover onOpenChange={setDesktopOpen} open={desktopOpen}>
        <PopoverTrigger asChild>
          <Button
            className="hidden h-11 px-[14px] text-[13px] md:inline-flex"
            variant="outline"
          >
            <span
              aria-hidden="true"
              className="grid size-4 grid-cols-2 gap-0.5"
            >
              <i className="border" />
              <i className="border" />
              <i className="border" />
              <i className="border" />
            </span>
            Questões
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          aria-label="Questões da sessão"
          className="w-[380px] p-5"
          sideOffset={8}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display font-semibold text-xl">
              Questões da sessão
            </h2>
            <Button
              aria-label="Fechar questões da sessão"
              className="size-8 px-0"
              onClick={() => setDesktopOpen(false)}
              variant="ghost"
            >
              <XIcon aria-hidden="true" className="size-4" />
            </Button>
          </div>
          {content}
        </PopoverContent>
      </Popover>
      <Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
        <SheetTrigger asChild>
          <Button
            className="h-11 px-[14px] text-[13px] md:hidden"
            variant="outline"
          >
            <span
              aria-hidden="true"
              className="grid size-4 grid-cols-2 gap-0.5"
            >
              <i className="border" />
              <i className="border" />
              <i className="border" />
              <i className="border" />
            </span>
            Questões
          </Button>
        </SheetTrigger>
        <SheetContent
          aria-describedby="exercise-question-navigation-description"
          className="max-h-[78dvh] gap-0 overflow-y-auto overscroll-contain rounded-t-2xl px-5 pt-9 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          side="bottom"
        >
          <div
            aria-hidden="true"
            className="absolute top-3 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/50"
          />
          <SheetTitle className="font-display text-xl">
            Questões da sessão
          </SheetTitle>
          <div id="exercise-question-navigation-description">{content}</div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export const ExerciseSessionExitControl = ({
  destination = "/exercicios",
  label = "Exercícios",
  backLabel,
  iconOnly = false,
}: {
  readonly backLabel?: string;
  readonly destination?: string;
  readonly iconOnly?: boolean;
  readonly label?: string;
}) => {
  const { requestExit } = useExerciseSessionDrafts();

  return (
    <Button
      aria-label={iconOnly ? (backLabel ?? `Voltar para ${label}`) : undefined}
      className={`${iconOnly ? "size-11 px-0" : "h-11 px-0"} shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground`}
      onClick={(event) => requestExit(destination, event.currentTarget)}
      variant="ghost"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      <span className={iconOnly ? "sr-only" : undefined}>{label}</span>
    </Button>
  );
};

export const ExerciseMobileExitHeader = ({
  backLabel,
  destination,
  title,
}: {
  readonly backLabel: string;
  readonly destination: string;
  readonly title: string;
}) => (
  <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 border-b bg-background px-4 md:hidden">
    <ExerciseSessionExitControl
      backLabel={backLabel}
      destination={destination}
      iconOnly
      label={title}
    />
    <p className="truncate font-display font-semibold text-lg">{title}</p>
  </header>
);

export const ExerciseSessionMobileHeader = ({
  sessionId,
}: {
  readonly sessionId: string;
}) => {
  const pathname = usePathname();
  const isActiveSession = pathname === `/exercicios/sessoes/${sessionId}`;

  return (
    <ExerciseMobileExitHeader
      backLabel="Voltar para Exercícios"
      destination="/exercicios"
      title={isActiveSession ? "Pratique no seu ritmo" : "Exercícios"}
    />
  );
};
