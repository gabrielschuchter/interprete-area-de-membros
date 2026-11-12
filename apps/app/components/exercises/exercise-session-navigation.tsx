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
import { ArrowLeftIcon, CheckIcon, InfoIcon, XIcon } from "lucide-react";
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

type QuestionState = "correct" | "current" | "incorrect" | "pending";

const stateOf = (
  question: ExerciseNavigationQuestion,
  isCurrent: boolean
): QuestionState => {
  if (question.answer) {
    return question.answer.isCorrect ? "correct" : "incorrect";
  }
  return isCurrent ? "current" : "pending";
};

const STATE_LABEL: Readonly<Record<QuestionState, string>> = {
  correct: "correta",
  current: "atual",
  incorrect: "incorreta",
  pending: "pendente",
};

const CELL_CLASS: Readonly<Record<QuestionState, string>> = {
  correct: "border-success bg-success/10 text-success",
  current: "border-2 border-primary bg-card text-primary",
  incorrect: "border-destructive bg-destructive/10 text-destructive",
  pending:
    "border-dashed border-muted-foreground/40 bg-transparent font-normal text-muted-foreground hover:text-primary",
};

const SEGMENT_CLASS: Readonly<Record<QuestionState, string>> = {
  correct: "bg-success",
  current: "bg-primary",
  incorrect: "bg-destructive",
  pending: "bg-border",
};

const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

const QuestionStatusBadge = ({ state }: { readonly state: QuestionState }) => {
  if (state === "correct") {
    return (
      <span
        aria-hidden="true"
        className="absolute -top-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-full bg-success text-white"
      >
        <CheckIcon className="size-3" />
      </span>
    );
  }
  if (state === "incorrect") {
    return (
      <span
        aria-hidden="true"
        className="absolute -top-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-full bg-destructive text-white"
      >
        <XIcon className="size-3" />
      </span>
    );
  }
  return null;
};

const QuestionNavigationSummary = ({
  currentQuestionId,
  questions,
}: {
  readonly currentQuestionId: string;
  readonly questions: readonly ExerciseNavigationQuestion[];
}) => {
  const states = questions.map((question) =>
    stateOf(question, question.id === currentQuestionId)
  );
  const count = (state: QuestionState) =>
    states.filter((value) => value === state).length;
  const answered = count("correct") + count("incorrect");
  const currentIndex = questions.findIndex(
    (question) => question.id === currentQuestionId
  );

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          Questão{" "}
          <span className="font-medium text-foreground">
            {Math.max(currentIndex, 0) + 1}
          </span>{" "}
          de {questions.length}
        </p>
        <p className="text-muted-foreground text-xs">
          {plural(answered, "respondida", "respondidas")}
        </p>
      </div>
      <div aria-hidden="true" className="mt-2 flex gap-[3px]">
        {states.map((state, index) => (
          <span
            className={`h-1 flex-1 rounded-full ${SEGMENT_CLASS[state]}`}
            key={questions[index]?.id}
          />
        ))}
      </div>
      <ul
        aria-label="Resumo das questões"
        className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-muted-foreground text-xs"
      >
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-success" />
          {plural(count("correct"), "correta", "corretas")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-destructive"
          />
          {plural(count("incorrect"), "incorreta", "incorretas")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-muted-foreground/50"
          />
          {plural(count("pending"), "pendente", "pendentes")}
        </li>
      </ul>
    </div>
  );
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
    <QuestionNavigationSummary
      currentQuestionId={currentQuestionId}
      questions={questions}
    />
    <ol className="mt-5 grid grid-cols-5 gap-x-2.5 gap-y-3">
      {questions.map((question) => {
        const isCurrent = question.id === currentQuestionId;
        const state = stateOf(question, isCurrent);
        return (
          <li key={question.id}>
            <Link
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Questão ${question.position + 1}, ${STATE_LABEL[state]}`}
              className={`relative flex h-11 w-full items-center justify-center rounded-[10px] border font-mono font-semibold text-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${CELL_CLASS[state]}${isCurrent && question.answer ? "border-2" : ""}`}
              href={hrefForQuestion(sessionId, question)}
              onClick={onChoose}
            >
              {question.position + 1}
              <QuestionStatusBadge state={state} />
            </Link>
          </li>
        );
      })}
    </ol>
    <p className="mt-5 flex items-start gap-2 border-t pt-3.5 text-muted-foreground text-sm leading-5">
      <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      Toque numa questão para abri-la. As respondidas mostram o gabarito.
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
