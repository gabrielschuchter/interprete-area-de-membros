interface ExerciseProgressQuestion {
  readonly answer: { readonly isCorrect: boolean } | null;
  readonly id?: string;
}

export const ExerciseProgress = ({
  captionPlacement = "none",
  className = "mt-3",
  currentQuestionId,
  size = "default",
  showAnswerStatus = true,
  questions,
}: {
  readonly captionPlacement?: "below" | "none";
  readonly className?: string;
  readonly currentQuestionId?: string;
  readonly size?: "default" | "result";
  readonly showAnswerStatus?: boolean;
  readonly questions: readonly ExerciseProgressQuestion[];
}) => {
  const total = questions.length;
  const answered = questions.filter(({ answer }) => answer !== null).length;
  const progressText = `${answered} de ${total} questões respondidas`;

  const progress =
    total > 30 ? (
      <div
        aria-label={progressText}
        aria-valuemax={total}
        aria-valuemin={0}
        aria-valuenow={answered}
        className={`overflow-hidden rounded-sm bg-muted ${size === "result" ? "h-2 md:h-2.5" : "h-2"}`}
        role="progressbar"
      >
        <div
          className="h-full bg-primary transition-[width] motion-reduce:transition-none"
          style={{ width: `${(answered / total) * 100}%` }}
        />
      </div>
    ) : (
      <div aria-label={progressText} className="flex gap-1" role="img">
        {questions.map((question, index) => {
          const isCurrent = question.id === currentQuestionId;
          let statusClass = "bg-muted";
          if (question.answer) {
            if (!showAnswerStatus) {
              statusClass = "bg-primary";
            } else if (question.answer.isCorrect) {
              statusClass = "bg-success";
            } else {
              statusClass = "bg-destructive";
            }
          } else if (isCurrent) {
            statusClass = "border-2 border-primary bg-transparent";
          }
          return (
            <span
              aria-hidden="true"
              className={`min-w-0 flex-1 rounded-[2px] ${size === "result" ? "h-2 md:h-2.5" : "h-2"} ${statusClass}`}
              key={question.id ?? index}
            />
          );
        })}
      </div>
    );

  if (captionPlacement === "below") {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {progress}
        <span className="text-muted-foreground text-sm leading-[1.4]">
          {progressText}
        </span>
      </div>
    );
  }

  return <div className={className}>{progress}</div>;
};
