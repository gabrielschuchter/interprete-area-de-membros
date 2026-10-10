import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleIcon,
  XCircleIcon,
} from "lucide-react";

export interface ExerciseAnswerOption {
  readonly content: string;
  readonly id: string;
  readonly label: string;
}

type AnswerOptionState =
  | "correct-selected"
  | "correct-unselected"
  | "incorrect-selected"
  | "unselected";

const optionIcon = (state: AnswerOptionState) => {
  switch (state) {
    case "correct-selected":
      return CircleCheckIcon;
    case "correct-unselected":
      return CircleDashedIcon;
    case "incorrect-selected":
      return XCircleIcon;
    default:
      return CircleIcon;
  }
};

const optionStatus = (state: AnswerOptionState) => {
  switch (state) {
    case "correct-selected":
      return "Correta · sua resposta";
    case "correct-unselected":
      return "Correta · não selecionada";
    case "incorrect-selected":
      return "Incorreta · sua resposta";
    default:
      return null;
  }
};

const optionClassName = (state: AnswerOptionState) => {
  switch (state) {
    case "correct-selected":
      return "border-success bg-success/5 text-foreground";
    case "correct-unselected":
      return "border-2 border-success border-dashed text-foreground";
    case "incorrect-selected":
      return "border-destructive bg-destructive/5 text-foreground";
    default:
      return "border-border text-muted-foreground";
  }
};

const OptionResult = ({
  option,
  state,
}: {
  readonly option: ExerciseAnswerOption;
  readonly state: AnswerOptionState;
}) => {
  const Icon = optionIcon(state);
  const status = optionStatus(state);
  let iconColor = "text-muted-foreground/50";
  if (state === "correct-selected" || state === "correct-unselected") {
    iconColor = "text-success";
  } else if (state === "incorrect-selected") {
    iconColor = "text-destructive";
  }

  return (
    <li
      className={`grid min-h-14 grid-cols-[1.5rem_1.875rem_minmax(0,1fr)] items-center gap-3 rounded-lg border px-4 py-3 text-[15px] leading-[1.45] md:grid-cols-[1.5rem_1.875rem_minmax(0,1fr)_10rem] md:text-base ${optionClassName(state)}`}
    >
      <Icon aria-hidden="true" className={`size-6 ${iconColor}`} />
      <span className="inline-flex size-[1.875rem] items-center justify-center rounded-md border bg-muted/60 font-mono font-semibold text-[13px]">
        {option.label}
      </span>
      <span className="whitespace-pre-wrap leading-[1.45]">
        {option.content}
      </span>
      {status && (
        <span className="col-start-2 text-center font-mono text-[0.58rem] uppercase leading-3 tracking-[0.1em] md:col-start-4 md:text-right">
          {status}
        </span>
      )}
    </li>
  );
};

export const ExerciseAnswerOptions = ({
  correctOptionIds,
  className = "mt-6 grid gap-2.5",
  options,
  selectedOptionIds,
}: {
  readonly correctOptionIds: readonly string[];
  readonly className?: string;
  readonly options: readonly ExerciseAnswerOption[];
  readonly selectedOptionIds: readonly string[];
}) => {
  const correctIds = new Set(correctOptionIds);
  const selectedIds = new Set(selectedOptionIds);

  return (
    <ul aria-label="Alternativas e resultado da resposta" className={className}>
      {options.map((option) => {
        const isCorrect = correctIds.has(option.id);
        const isSelected = selectedIds.has(option.id);
        let state: AnswerOptionState = "unselected";
        if (isCorrect && isSelected) {
          state = "correct-selected";
        } else if (isCorrect) {
          state = "correct-unselected";
        } else if (isSelected) {
          state = "incorrect-selected";
        }
        return <OptionResult key={option.id} option={option} state={state} />;
      })}
    </ul>
  );
};
