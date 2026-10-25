"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { GestaoCrumbTail } from "../../../gestao-crumbs";
import { GestaoIcon } from "../../../gestao-icon";
import { createGestaoAssignment } from "../actions";
import {
  type AudienceMode,
  AudienceStep,
  type CohortOption,
  type ContentOption,
  ContentStep,
  contentKey,
  type StudentOption,
  type TermsDraft,
  TermsStep,
} from "./assignment-wizard-steps";

const stepLabels = [
  "Conteúdo",
  "Destinatários",
  "Orientação e prazos",
  "Conferir",
] as const;

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const readable = (value: string) =>
  value ? dateTime.format(new Date(value)) : null;

const stepState = (index: number, current: number) => {
  if (index < current) {
    return "done";
  }
  return index === current ? "current" : "todo";
};

const Steps = ({ current }: { readonly current: number }) => (
  <ol aria-label="Passos" className="gk-steps">
    {stepLabels.map((label, index) => (
      <li
        aria-current={index === current ? "step" : undefined}
        data-state={stepState(index, current)}
        key={label}
      >
        <span className="gk-step-dot">
          {index < current ? (
            <GestaoIcon name="check" size={14} strokeWidth={2} />
          ) : (
            index + 1
          )}
        </span>
        <span className="gk-step-label">{label}</span>
        {index < stepLabels.length - 1 ? (
          <span aria-hidden="true" className="gk-step-line" />
        ) : null}
      </li>
    ))}
  </ol>
);

const validateStep = (
  index: number,
  draft: {
    readonly chosen: boolean;
    readonly recipients: number;
    readonly terms: TermsDraft;
  }
) => {
  const { chosen, recipients, terms } = draft;
  if (index === 0 && !chosen) {
    return "Escolha o conteúdo que será atribuído.";
  }
  if (index === 1 && recipients === 0) {
    return "Escolha ao menos uma turma ou um aluno.";
  }
  if (index !== 2) {
    return null;
  }
  if (terms.availableAt && terms.dueAt && terms.dueAt < terms.availableAt) {
    return "O prazo não pode vir antes da liberação.";
  }
  if (terms.dueAt && terms.expiresAt && terms.dueAt > terms.expiresAt) {
    return "O prazo não pode vir depois do fim do acesso.";
  }
  return null;
};

const ReviewStep = ({
  chosen,
  recipientCount,
  recipientLine,
  terms,
}: {
  readonly chosen: ContentOption | undefined;
  readonly recipientCount: string;
  readonly recipientLine: string;
  readonly terms: TermsDraft;
}) => (
  <div className="gk-form-stack">
    <h2 className="gk-wiz-title">Conferir e enviar</h2>
    <dl className="gk-review">
      <div>
        <dt>Conteúdo</dt>
        <dd>
          {chosen?.label} <small>{chosen?.meta}</small>
        </dd>
      </div>
      <div>
        <dt>Destinatários</dt>
        <dd>
          {recipientCount} · {recipientLine}
        </dd>
      </div>
      <div>
        <dt>Disponível em</dt>
        <dd>{readable(terms.availableAt) ?? "Ao enviar"}</dd>
      </div>
      <div>
        <dt>Prazo</dt>
        <dd>{readable(terms.dueAt) ?? "Sem prazo"}</dd>
      </div>
      <div>
        <dt>Acesso até</dt>
        <dd>{readable(terms.expiresAt) ?? "Sem data final"}</dd>
      </div>
      <div>
        <dt>Orientação</dt>
        <dd>{terms.message || "Nenhuma"}</dd>
      </div>
    </dl>
  </div>
);

interface Props {
  readonly cohorts: readonly CohortOption[];
  readonly content: readonly ContentOption[];
  readonly initialKey: string;
  readonly initialMessage: string;
  readonly initialStudents: readonly StudentOption[];
}

export const AssignmentWizard = ({
  cohorts,
  content,
  initialKey,
  initialMessage,
  initialStudents,
}: Props) => {
  const [state, formAction, pending] = useActionState(createGestaoAssignment, {
    error: null,
  });
  const [step, setStep] = useState(initialKey ? 1 : 0);
  const [target, setTarget] = useState(initialKey);
  const [mode, setMode] = useState<AudienceMode>("both");
  const [cohortIds, setCohortIds] = useState<readonly string[]>([]);
  const [students, setStudents] =
    useState<readonly StudentOption[]>(initialStudents);
  const [terms, setTerms] = useState<TermsDraft>({
    availableAt: "",
    dueAt: "",
    expiresAt: "",
    message: initialMessage,
  });
  const [stepError, setStepError] = useState<string | null>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const chosen = content.find((option) => contentKey(option) === target);
  const chosenCohorts = cohorts.filter((cohort) =>
    cohortIds.includes(cohort.id)
  );
  const recipients =
    chosenCohorts.reduce((sum, cohort) => sum + cohort.students, 0) +
    students.length;
  const recipientCount =
    chosenCohorts.length > 0 && students.length > 0
      ? `até ${recipients}`
      : `${recipients}`;

  const validate = (index: number) =>
    validateStep(index, { chosen: Boolean(chosen), recipients, terms });

  const next = () => {
    const problem = validate(step);
    setStepError(problem);
    if (!problem) {
      setStep((current) => Math.min(3, current + 1));
    }
  };

  const recipientLine = [
    ...chosenCohorts.map((cohort) => `${cohort.name} (${cohort.students})`),
    ...students.map((student) => student.name),
  ].join(", ");

  return (
    <section className="gt-page gk-wizard-page">
      <GestaoCrumbTail items={[{ label: "Nova atribuição" }]} />
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Nova atribuição</h1>
        </div>
        <div className="gk-head-actions">
          <Link
            className="gk-link-btn"
            href="/gestao/alunos/atribuicoes"
            prefetch={false}
          >
            Cancelar
          </Link>
        </div>
      </header>
      <div className="gk-wizard-grid">
        <form
          action={formAction}
          className="gk-panel gk-wizard-card"
          onSubmit={(event) => {
            if (step < 3) {
              event.preventDefault();
            }
          }}
        >
          <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
          <input name="target" type="hidden" value={target} />
          {cohortIds.map((id) => (
            <input key={id} name="cohortIds" type="hidden" value={id} />
          ))}
          {students.map((student) => (
            <input
              key={student.id}
              name="memberIds"
              type="hidden"
              value={student.id}
            />
          ))}
          <input name="message" type="hidden" value={terms.message} />
          <input name="availableAt" type="hidden" value={terms.availableAt} />
          <input name="dueAt" type="hidden" value={terms.dueAt} />
          <input name="expiresAt" type="hidden" value={terms.expiresAt} />
          <Steps current={step} />
          <div className="gk-wizard-body">
            {step === 0 ? (
              <ContentStep
                content={content}
                onSelect={(option) => setTarget(contentKey(option))}
                selected={target}
              />
            ) : null}
            {step === 1 ? (
              <AudienceStep
                cohorts={cohorts}
                mode={mode}
                onCohorts={setCohortIds}
                onMode={setMode}
                onStudents={setStudents}
                selectedCohorts={cohortIds}
                selectedStudents={students}
              />
            ) : null}
            {step === 2 ? (
              <TermsStep
                draft={terms}
                onChange={(patch) =>
                  setTerms((current) => ({ ...current, ...patch }))
                }
              />
            ) : null}
            {step === 3 ? (
              <ReviewStep
                chosen={chosen}
                recipientCount={recipientCount}
                recipientLine={recipientLine}
                terms={terms}
              />
            ) : null}
            {stepError || state.error ? (
              <p className="gk-error-box" role="alert">
                {stepError ?? state.error}
              </p>
            ) : null}
          </div>
          <div className="gk-wizard-foot">
            {step > 0 ? (
              <button
                className="gk-btn"
                disabled={pending}
                onClick={() => {
                  setStepError(null);
                  setStep((current) => current - 1);
                }}
                type="button"
              >
                Voltar
              </button>
            ) : null}
            <span className="gk-spacer" />
            {step < 3 ? (
              <button
                className="gk-btn gk-btn--primary gk-btn--wide"
                key="next"
                onClick={next}
                type="button"
              >
                Continuar
              </button>
            ) : (
              <button
                className="gk-btn gk-btn--primary gk-btn--wide"
                disabled={pending}
                key="submit"
                type="submit"
              >
                {pending ? "Enviando…" : "Enviar atribuição"}
              </button>
            )}
          </div>
        </form>
        <aside aria-label="Resumo" className="gk-panel gk-wizard-summary">
          <h2>Resumo</h2>
          <p>
            <strong>Conteúdo:</strong>{" "}
            {chosen
              ? `${chosen.label} (${chosen.meta.toLowerCase()})`
              : "a definir"}
          </p>
          <p>
            <strong>Destinatários:</strong>{" "}
            {recipients > 0 ? recipientCount : "a definir"}
          </p>
          <p>
            <strong>Prazo:</strong> {readable(terms.dueAt) ?? "a definir"}
          </p>
          <div className="gk-note">
            <GestaoIcon name="check-circle" size={18} />
            <p>
              <strong>
                O aluno recebe o aviso e a pendência ao mesmo tempo.
              </strong>
              <br />
              Se você revogar a atribuição, a pendência some; acessos que o
              aluno já tem por turma ou curso continuam.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};
