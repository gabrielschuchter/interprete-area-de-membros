"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { cohortDateInput } from "@/lib/cohort-domain";
import { GestaoSwitch } from "../../../gestao-switch";
import { type CohortActionResult, duplicateGestaoCohort } from "../actions";

export const CohortDuplicateDialog = ({
  cohort,
}: {
  readonly cohort: {
    readonly endsAt: Date | null;
    readonly id: string;
    readonly name: string;
    readonly startsAt: Date;
    readonly version: number;
  };
}) => {
  const router = useRouter();
  const key = useRef("");
  const [open, setOpen] = useState(false);
  const [copySchedule, setCopySchedule] = useState(true);
  const [copyActivities, setCopyActivities] = useState(true);
  const [name, setName] = useState(`${cohort.name} (nova edição)`);
  const [startsAt, setStartsAt] = useState(cohortDateInput(cohort.startsAt));
  const [endsAt, setEndsAt] = useState(cohortDateInput(cohort.endsAt));
  const [result, setResult] = useState<CohortActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const changeStart = (next: string) => {
    // A data final acompanha o novo início, mantendo a duração da turma.
    if (endsAt && startsAt && next) {
      const delta = Date.parse(next) - Date.parse(startsAt);
      if (!Number.isNaN(delta)) {
        setEndsAt(
          new Date(Date.parse(endsAt) + delta).toISOString().slice(0, 10)
        );
      }
    }
    setStartsAt(next);
  };

  const submit = () => {
    key.current ||= crypto.randomUUID();
    startTransition(async () => {
      const response = await duplicateGestaoCohort({
        cohortId: cohort.id,
        expectedVersion: cohort.version,
        name,
        startsAt,
        endsAt,
        copySchedule,
        copyActivities,
        idempotencyKey: key.current,
      });
      setResult(response);
      if (response.ok && response.cohortId) {
        key.current = "";
        router.push(`/gestao/alunos/turmas/${response.cohortId}`);
      }
    });
  };

  return (
    <section className="gk-panel gk-settings-card">
      <h2 className="gk-panel-title">Duplicar para uma nova edição</h2>
      <p className="gk-hint">
        Cria uma turma nova com o mesmo conteúdo. Os alunos não são copiados.
      </p>
      <GestaoSwitch
        checked={copySchedule}
        label="Copiar o cronograma (datas deslocadas)"
        onChange={setCopySchedule}
      />
      <GestaoSwitch
        checked={copyActivities}
        label="Copiar atividades como rascunho"
        onChange={setCopyActivities}
      />
      <button
        className="gk-btn gk-btn--block"
        onClick={() => setOpen(true)}
        type="button"
      >
        Duplicar turma
      </button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent
          className="gk-modal gk-modal--narrow"
          onOpenAutoFocus={(event) => event.preventDefault()}
          overlayClassName="gk-modal-overlay"
          showCloseButton={false}
        >
          <div className="gk-modal-head">
            <div>
              <DialogTitle className="gk-modal-title">
                Duplicar turma
              </DialogTitle>
              <DialogDescription className="gk-modal-sub">
                {copySchedule
                  ? "As datas do cronograma acompanham o novo início."
                  : "As datas do cronograma não serão copiadas."}{" "}
                {copyActivities
                  ? "As atividades entram como rascunho, sem prazo vencido."
                  : "As atividades não serão copiadas."}
              </DialogDescription>
            </div>
          </div>
          <div className="gk-modal-body">
            <label className="gk-label">
              <span>Nome da nova turma</span>
              <input
                className="gk-input gk-input--plain"
                maxLength={120}
                minLength={3}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </label>
            <div className="gk-form-grid">
              <label className="gk-label">
                <span>Começa em</span>
                <input
                  className="gk-input gk-input--plain"
                  onChange={(event) => changeStart(event.target.value)}
                  type="date"
                  value={startsAt}
                />
              </label>
              <label className="gk-label">
                <span>
                  Termina em <em>opcional</em>
                </span>
                <input
                  className="gk-input gk-input--plain"
                  onChange={(event) => setEndsAt(event.target.value)}
                  type="date"
                  value={endsAt}
                />
              </label>
            </div>
            {result?.ok === false ? (
              <p className="gk-error-box" role="alert">
                {result.message}
              </p>
            ) : null}
          </div>
          <div className="gk-modal-foot">
            <button
              className="gk-btn gk-btn--primary"
              disabled={pending}
              onClick={submit}
              type="button"
            >
              {pending ? "Duplicando…" : "Duplicar turma"}
            </button>
            <button
              className="gk-btn gk-btn--dark"
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
