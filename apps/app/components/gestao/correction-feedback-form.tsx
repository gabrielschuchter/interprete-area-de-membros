"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { SingleFlightSubmit } from "@/components/mutations/single-flight-form";
import { saveGestaoCorrection } from "@/lib/gestao-correction-actions";
import {
  type CorrectionActionState,
  correctionResultMessages,
} from "@/lib/gestao-correction-contract";

interface CorrectionCriterion {
  readonly id: string;
  readonly title: string;
  readonly weight: number;
}

const initialState: CorrectionActionState = { status: "idle" };
const scoreValues = Array.from({ length: 11 }, (_, value) => value);

const CorrectionFeedbackFields = ({
  content,
  criteria,
  formAction,
  state,
  draftCurrent,
  draftVersion,
  feedbackVersion,
  initialScores,
  returnTo,
  submissionId,
  submittedAt,
  submissionUpdatedAt,
}: {
  readonly formAction: (formData: FormData) => void;
  readonly state: CorrectionActionState;
  readonly content: string;
  readonly criteria: readonly CorrectionCriterion[];
  readonly draftCurrent: boolean;
  readonly draftVersion: number;
  readonly feedbackVersion: number;
  readonly initialScores: Readonly<Record<string, number>>;
  readonly returnTo: string;
  readonly submissionId: string;
  readonly submittedAt: string;
  readonly submissionUpdatedAt: string;
}) => {
  const [comment, setComment] = useState(content);
  const [scores, setScores] = useState<Record<string, number>>({
    ...initialScores,
  });
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const allScoresPresent = criteria.every(({ id }) => scores[id] !== undefined);
  const weightTotal = criteria.reduce(
    (sum, criterion) => sum + criterion.weight,
    0
  );
  const weightedAverage =
    allScoresPresent && weightTotal > 0
      ? Number(
          (
            criteria.reduce(
              (sum, criterion) =>
                sum + (scores[criterion.id] ?? 0) * criterion.weight,
              0
            ) / weightTotal
          ).toFixed(1)
        )
      : null;
  const message =
    state.status === "error" && state.code
      ? correctionResultMessages[state.code]
      : null;

  const changeScore = (criterionId: string, value: string) => {
    setScores((current) => {
      const next = { ...current };
      if (value) {
        next[criterionId] = Number(value);
      } else {
        delete next[criterionId];
      }
      return next;
    });
  };

  return (
    <form action={formAction} className="gc-feedback-form">
      <input name="submissionId" type="hidden" value={submissionId} />
      <input name="submittedAt" type="hidden" value={submittedAt} />
      <input
        name="submissionUpdatedAt"
        type="hidden"
        value={submissionUpdatedAt}
      />
      <input name="draftVersion" type="hidden" value={draftVersion} />
      <input name="feedbackVersion" type="hidden" value={feedbackVersion} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <header className="gc-feedback-heading">
        <h2>Feedback</h2>
        {draftCurrent ? <span>Rascunho salvo</span> : null}
      </header>
      {criteria.length ? (
        <div className="gc-rubric">
          {criteria.map((criterion) => (
            <label
              className="gc-rubric-row"
              htmlFor={criterion.id}
              key={criterion.id}
            >
              <span>
                {criterion.title}
                <small>{criterion.weight}%</small>
              </span>
              <select
                aria-describedby={
                  fieldErrors?.scores ? "gc-score-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors?.scores)}
                id={criterion.id}
                name={["score", criterion.id].join(":")}
                onChange={(event) =>
                  changeScore(criterion.id, event.currentTarget.value)
                }
                value={scores[criterion.id]?.toString() ?? ""}
              >
                <option value="">—</option>
                {scoreValues.map((score) => (
                  <option key={score} value={score}>
                    {score} / 10
                  </option>
                ))}
              </select>
            </label>
          ))}
          {weightedAverage !== null ? (
            <p className="gc-weighted-average">
              Média ponderada informativa:{" "}
              <strong>{weightedAverage} / 10</strong>
            </p>
          ) : null}
          {fieldErrors?.scores ? (
            <p className="gc-field-error" id="gc-score-error">
              {fieldErrors.scores}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="gc-no-rubric">
          Esta entrega foi enviada sem uma rubrica vinculada.
        </p>
      )}
      <label className="gc-comment-label" htmlFor="gc-comment">
        Comentário ao aluno
        <textarea
          aria-describedby={
            fieldErrors?.content ? "gc-comment-error" : undefined
          }
          aria-invalid={Boolean(fieldErrors?.content)}
          id="gc-comment"
          maxLength={20_000}
          name="content"
          onChange={(event) => setComment(event.currentTarget.value)}
          placeholder="Escreva uma orientação breve e concreta..."
          rows={8}
          value={comment}
        />
      </label>
      {fieldErrors?.content ? (
        <p className="gc-field-error" id="gc-comment-error">
          {fieldErrors.content}
        </p>
      ) : null}
      {message ? (
        <output
          aria-live={state.status === "error" ? "assertive" : "polite"}
          className={state.status === "error" ? "gc-field-error" : "gc-result"}
        >
          {message}
        </output>
      ) : null}
      <div className="gc-feedback-actions">
        <SingleFlightSubmit
          name="intent"
          pendingLabel="Enviando feedback…"
          value="send"
        >
          Enviar feedback
        </SingleFlightSubmit>
        <SingleFlightSubmit
          name="intent"
          pendingLabel="Salvando…"
          value="draft"
          variant="outline"
        >
          Rascunho
        </SingleFlightSubmit>
      </div>
      <p className="gc-feedback-note">
        Ao enviar, a entrega fica corrigida e o aluno recebe uma notificação.
      </p>
    </form>
  );
};

export const CorrectionFeedbackForm = (
  properties: Omit<
    Parameters<typeof CorrectionFeedbackFields>[0],
    "formAction" | "state"
  >
) => {
  const router = useRouter();
  const [result, formAction] = useActionState(
    async (
      previous: { state: CorrectionActionState; submissionId: string },
      formData: FormData
    ) => ({
      state: await saveGestaoCorrection(previous.state, formData),
      submissionId: String(formData.get("submissionId") ?? ""),
    }),
    { state: initialState, submissionId: "" }
  );
  useEffect(() => {
    if (result.state.status === "success" && result.state.href) {
      router.replace(result.state.href);
    }
  }, [router, result]);
  return (
    <CorrectionFeedbackFields
      {...properties}
      formAction={formAction}
      key={properties.submissionId}
      state={
        result.submissionId === properties.submissionId
          ? result.state
          : initialState
      }
    />
  );
};
