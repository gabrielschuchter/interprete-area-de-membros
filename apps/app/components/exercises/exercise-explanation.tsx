import { ExternalLinkIcon } from "lucide-react";
import {
  parseExerciseExplanation,
  splitExerciseTextLinks,
} from "@/lib/exercise-references";

const LinkedExplanationText = ({ text }: { readonly text: string }) => (
  <>
    {splitExerciseTextLinks(text).map((part) =>
      part.type === "text" ? (
        <span key={part.key}>{part.text}</span>
      ) : (
        <a
          className="break-all font-medium text-primary underline underline-offset-4"
          href={part.href}
          key={part.key}
          rel="noreferrer noopener"
          target="_blank"
        >
          {part.text}
        </a>
      )
    )}
  </>
);

export const ExerciseExplanation = ({
  explanation,
  tone,
}: {
  readonly explanation: string | null;
  readonly tone: "destructive" | "success";
}) => {
  const parsed = parseExerciseExplanation(explanation);
  if (!(parsed.explanation || parsed.references.length)) {
    return null;
  }

  return (
    <>
      {parsed.explanation && (
        <p className="m-0 whitespace-pre-wrap text-[15px] leading-[1.65]">
          <LinkedExplanationText text={parsed.explanation} />
        </p>
      )}
      {parsed.references.length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3 ${tone === "success" ? "border-success/40" : "border-destructive/40"}`}
        >
          <span className="font-data font-medium text-[10.5px] text-muted-foreground uppercase leading-none tracking-[.1em]">
            Referência
          </span>
          {parsed.references.map((reference) => (
            <span key={`${reference.label}-${reference.href ?? "text"}`}>
              {reference.href ? (
                <a
                  className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-[14px] text-primary leading-[1.3] underline underline-offset-4"
                  href={reference.href}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {reference.label}
                  <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              ) : (
                <span className="inline-flex min-h-11 items-center font-semibold text-[14px] leading-[1.3]">
                  {reference.label}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </>
  );
};
