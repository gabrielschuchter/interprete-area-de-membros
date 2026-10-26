"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { GestaoIcon } from "../../../../gestao-icon";
import {
  moveGestaoCohortMembers,
  removeGestaoCohortMembers,
} from "../../actions";

export interface RosterTarget {
  readonly id: string;
  readonly name: string;
}
interface DialogStudent {
  readonly id: string;
  readonly individualGrants: number;
  readonly name: string;
}

const submitLabel = (mode: "remove" | "move", pending: boolean) => {
  if (pending) {
    return "Salvando…";
  }
  return mode === "move" ? "Mover para a turma" : "Remover da turma";
};
const titleFor = (mode: "remove" | "move", subject: string, cohort: string) =>
  mode === "move"
    ? `Mover ${subject} de ${cohort}?`
    : `Remover ${subject} da ${cohort}?`;

const TargetPicker = ({
  onChange,
  targetId,
  targets,
}: {
  readonly onChange: (id: string) => void;
  readonly targetId: string;
  readonly targets: readonly RosterTarget[];
}) => {
  if (targets.length === 0) {
    return (
      <p className="gk-error-box">
        Você não gerencia outra turma ativa para receber estes alunos.
      </p>
    );
  }
  return (
    <label className="gk-label">
      <span>Turma de destino</span>
      <select
        className="gk-select gk-select--plain"
        onChange={(event) => onChange(event.target.value)}
        value={targetId}
      >
        {targets.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export const RemoveMoveDialog = ({
  cohortId,
  cohortName,
  courseCount,
  initialMode,
  onClose,
  onDone,
  students,
  targets,
}: {
  readonly cohortId: string;
  readonly cohortName: string;
  readonly courseCount: number;
  readonly initialMode: "remove" | "move";
  readonly onClose: () => void;
  readonly onDone: () => void;
  readonly students: readonly DialogStudent[];
  readonly targets: readonly RosterTarget[];
}) => {
  const router = useRouter();
  const key = useRef(crypto.randomUUID());
  const [mode, setMode] = useState(initialMode);
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [keepReading, setKeepReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const grants = students.reduce((sum, item) => sum + item.individualGrants, 0);
  const subject =
    students.length === 1
      ? (students[0]?.name ?? "o aluno")
      : plural(students.length, "aluno", "alunos");
  const target = targets.find((item) => item.id === targetId);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const base = {
        cohortId,
        memberIds: students.map((item) => item.id),
        includePastReadOnly: keepReading,
        idempotencyKey: key.current,
      };
      const result =
        mode === "move"
          ? await moveGestaoCohortMembers({ ...base, targetCohortId: targetId })
          : await removeGestaoCohortMembers(base);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onDone();
    });
  };

  const options = [
    ["remove", "Remover da turma", "Sai desta turma e não entra em outra."],
    [
      "move",
      "Mover para outra turma",
      "Passa a receber o que a outra turma oferece.",
    ],
  ] as const;

  return (
    <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
      <DialogContent
        className="gk-modal gk-modal--narrow"
        onOpenAutoFocus={(event) => event.preventDefault()}
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <div className="gk-modal-head">
          <DialogTitle className="gk-modal-title">
            {titleFor(mode, subject, cohortName)}
          </DialogTitle>
          <button
            aria-label="Fechar"
            className="gk-modal-close"
            disabled={pending}
            onClick={onClose}
            type="button"
          >
            <GestaoIcon name="x" size={18} />
          </button>
        </div>
        <div className="gk-modal-body">
          <DialogDescription className="gk-modal-sub">
            O que fazer {students.length === 1 ? "com ela" : "com eles"}
          </DialogDescription>
          <div className="gk-radio-list">
            {options.map(([value, title, hint]) => (
              <label
                className="gk-radio"
                data-checked={String(mode === value)}
                key={value}
              >
                <input
                  checked={mode === value}
                  name="rosterMode"
                  onChange={() => setMode(value)}
                  type="radio"
                />
                <span>
                  {title}
                  <small>{hint}</small>
                </span>
              </label>
            ))}
          </div>
          {mode === "move" ? (
            <TargetPicker
              onChange={setTargetId}
              targetId={targetId}
              targets={targets}
            />
          ) : null}
          <ul className="gk-consequences">
            <li data-kind="lose">
              <GestaoIcon name="x" size={16} />
              {mode === "move" && target
                ? `Passa a receber encontros, atividades e avisos de ${target.name}`
                : "Deixa de receber encontros, atividades e avisos da turma"}
            </li>
            {courseCount > 0 ? (
              <li data-kind="lose">
                <GestaoIcon name="x" size={16} />
                {courseCount === 1
                  ? "Perde o acesso ao curso liberado pela turma (1)"
                  : `Perde o acesso aos cursos liberados pela turma (${courseCount})`}
              </li>
            ) : null}
            <li data-kind="keep">
              <GestaoIcon name="check" size={16} />
              Mantém entregas, feedbacks e todo o histórico
            </li>
            <li data-kind="keep">
              <GestaoIcon name="check" size={16} />
              {grants > 0
                ? `Mantém acessos individuais (${grants}) e atribuições individuais`
                : "Mantém atribuições individuais"}
            </li>
          </ul>
          <label className="gk-check gk-check--bare">
            <input
              checked={keepReading}
              onChange={(event) => setKeepReading(event.target.checked)}
              type="checkbox"
            />
            <span>Manter leitura do curso por 30 dias.</span>
          </label>
          {error ? (
            <p className="gk-error-box" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="gk-modal-foot">
          <button
            className="gk-btn"
            disabled={pending || (mode === "move" && !targetId)}
            onClick={submit}
            type="button"
          >
            {submitLabel(mode, pending)}
          </button>
          <button
            className="gk-btn gk-btn--dark"
            disabled={pending}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
