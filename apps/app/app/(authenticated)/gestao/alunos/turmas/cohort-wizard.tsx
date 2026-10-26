"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { GestaoCrumbTail } from "../../gestao-crumbs";
import { GestaoIcon } from "../../gestao-icon";
import {
  type CourseOption,
  firstInvalidStep,
  newWizardKeys,
  runCreateFlow,
  type StudentMode,
  type TeacherOption,
  validateStep,
  type WizardDraft,
  type WizardErrors,
  type WizardKeys,
  type WizardOutcome,
} from "./cohort-wizard-model";
import {
  ContentStep,
  DataStep,
  PeopleStep,
  Stepper,
} from "./cohort-wizard-steps";

interface CohortWizardProperties {
  readonly actorId: string;
  readonly actorName: string;
  readonly courses: readonly CourseOption[];
  readonly initialStudentMode?: StudentMode;
  readonly isAdmin: boolean;
  readonly teachers: readonly TeacherOption[];
}

type Partial_ = Extract<WizardOutcome, { kind: "partial" }>;

const PartialResult = ({ result }: { readonly result: Partial_ }) => (
  <output className="gk-result">
    <strong>Turma criada com {result.added} aluno(s) da planilha.</strong>
    <span>
      {result.skipped.length} e-mail(s) não têm conta de aluno e ficaram de
      fora: {result.skipped.slice(0, 5).join(", ")}
      {result.skipped.length > 5 ? "…" : ""}. Gere um convite por link na aba
      Alunos da turma para quem ainda não entrou.
    </span>
    <a
      className="gk-btn gk-btn--primary gk-btn--wide"
      href={`/gestao/alunos/turmas/${result.cohortId}/alunos`}
    >
      Abrir a turma
    </a>
  </output>
);

export const CohortWizard = ({
  actorId,
  actorName,
  courses,
  initialStudentMode = "later",
  isAdmin,
  teachers,
}: CohortWizardProperties) => {
  const router = useRouter();
  const keys = useRef<WizardKeys | null>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>({
    courseIds: [],
    csv: null,
    csvName: "",
    endsAt: "",
    lateJoin: "ALL_ACTIVE",
    name: "",
    releaseMode: "ALL_AT_ONCE",
    startsAt: "",
    studentMode: initialStudentMode,
    teacherIds: [actorId],
  });
  const [errors, setErrors] = useState<WizardErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [partial, setPartial] = useState<Partial_ | null>(null);
  const [pending, startTransition] = useTransition();

  const patch = (change: Partial<WizardDraft>) =>
    setDraft((current) => ({ ...current, ...change }));
  const close = () => router.push("/gestao/alunos/turmas");

  const goNext = () => {
    const found = validateStep(step, draft);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      setStep((current) => Math.min(2, current + 1));
    }
  };

  const settle = (outcome: WizardOutcome) => {
    if (outcome.kind === "done") {
      router.push(outcome.destination);
      return;
    }
    if (outcome.kind === "partial") {
      setCreatedId(outcome.cohortId);
      setPartial(outcome);
      return;
    }
    setCreatedId(outcome.cohortId);
    setFailure(outcome.message);
    if (outcome.fields) {
      setErrors(outcome.fields);
      setStep(0);
    }
  };

  const submit = () => {
    const invalid = firstInvalidStep(draft);
    if (invalid >= 0) {
      setErrors(validateStep(invalid, draft));
      setStep(invalid);
      return;
    }
    setFailure(null);
    keys.current ??= newWizardKeys();
    const activeKeys = keys.current;
    startTransition(async () => {
      settle(await runCreateFlow(draft, activeKeys, createdId));
    });
  };

  return (
    <Dialog onOpenChange={(open) => (open ? null : close())} open>
      <GestaoCrumbTail items={[{ label: "Nova turma" }]} />
      <DialogContent
        className="gk-modal"
        onInteractOutside={(event) => {
          if (pending) {
            event.preventDefault();
          }
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("cohort-wizard-first")?.focus();
        }}
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <div className="gk-modal-head">
          <div>
            <DialogTitle className="gk-modal-title">Nova turma</DialogTitle>
            <DialogDescription className="gk-modal-sub">
              Passo {step + 1} de 3
            </DialogDescription>
          </div>
          <button
            aria-label="Fechar"
            className="gk-modal-close"
            disabled={pending}
            onClick={close}
            type="button"
          >
            <GestaoIcon name="x" size={18} />
          </button>
        </div>
        <div className="gk-modal-body" data-done={partial ? "true" : undefined}>
          <Stepper current={step} />
          {step === 0 ? (
            <DataStep draft={draft} errors={errors} patch={patch} />
          ) : null}
          {step === 1 ? (
            <ContentStep courses={courses} draft={draft} patch={patch} />
          ) : null}
          {step === 2 ? (
            <PeopleStep
              actorName={actorName}
              draft={draft}
              errors={errors}
              isAdmin={isAdmin}
              patch={patch}
              teachers={teachers}
            />
          ) : null}
          {partial ? <PartialResult result={partial} /> : null}
          {failure ? (
            <p className="gk-error-box" role="alert">
              {failure}
              {createdId ? (
                <>
                  {" "}
                  <a href={`/gestao/alunos/turmas/${createdId}`}>
                    Abrir a turma criada
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="gk-modal-foot" hidden={Boolean(partial)}>
          {step > 0 ? (
            <button
              className="gk-btn"
              disabled={pending}
              onClick={() => setStep((current) => current - 1)}
              type="button"
            >
              Voltar
            </button>
          ) : null}
          <span className="gk-spacer" />
          <button
            className="gk-link-btn"
            disabled={pending}
            onClick={close}
            type="button"
          >
            Cancelar
          </button>
          {step < 2 ? (
            <button
              className="gk-btn gk-btn--primary gk-btn--wide"
              onClick={goNext}
              type="button"
            >
              Continuar
            </button>
          ) : (
            <button
              className="gk-btn gk-btn--primary gk-btn--wide"
              disabled={pending}
              onClick={submit}
              type="button"
            >
              {pending ? "Criando…" : "Criar turma"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
