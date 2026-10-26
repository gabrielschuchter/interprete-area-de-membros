"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useRef, useState, useTransition } from "react";
import { cohortDateInput } from "@/lib/cohort-domain";
import { GestaoSwitch } from "../../../gestao-switch";
import {
  archiveGestaoCohort,
  type CohortActionResult,
  restoreGestaoCohort,
  updateGestaoCohort,
} from "../actions";
import { CohortDuplicateDialog } from "./cohort-duplicate-dialog";

interface TeacherOption {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly id: string;
  readonly role?: string;
}
interface EditableCohort {
  readonly archivedAt: Date | null;
  readonly endsAt: Date | null;
  readonly id: string;
  readonly lateJoinPolicy: "ALL_ACTIVE" | "FROM_JOIN";
  readonly name: string;
  readonly notifyOnNews: boolean;
  readonly readAfterEndDays: number;
  readonly startsAt: Date;
  readonly teachers: readonly {
    readonly member: {
      readonly id: string;
      readonly displayName: string | null;
      readonly email: string | null;
    };
  }[];
  readonly version: number;
}

export const settingsFormId = "cohort-settings-form";
const readingOptions = [30, 60, 90, 180, 365] as const;
const lateJoinOptions = [
  ["ALL_ACTIVE", "Recebe tudo que está ativo na turma"],
  ["FROM_JOIN", "Recebe só o que for publicado a partir da entrada"],
] as const;

const TeacherSection = ({
  cohort,
  isAdmin,
  onChange,
  selected,
  teachers,
}: {
  readonly cohort: EditableCohort;
  readonly isAdmin: boolean;
  readonly onChange: (ids: readonly string[]) => void;
  readonly selected: readonly string[];
  readonly teachers: readonly TeacherOption[];
}) => (
  <section className="gk-panel gk-settings-card">
    <h2 className="gk-panel-title">Responsáveis</h2>
    <p className="gk-hint">
      {isAdmin
        ? "Professores responsáveis veem e gerenciam esta turma."
        : "Somente administradores alteram os responsáveis."}
    </p>
    {isAdmin ? (
      <fieldset className="gk-check-list gk-fieldset">
        <legend className="sr-only">Responsáveis da turma</legend>
        {teachers.map((teacher) => (
          <label className="gk-check" key={teacher.id}>
            <input
              checked={selected.includes(teacher.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...new Set([...selected, teacher.id])]
                    : selected.filter((value) => value !== teacher.id)
                )
              }
              type="checkbox"
            />
            <span>
              {teacher.displayName ?? "Professor"}
              <small className="gk-muted">
                {" "}
                · {teacher.email ?? teacher.role}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
    ) : (
      <ul className="gk-rows gk-rows--plain">
        {cohort.teachers.map(({ member }) => (
          <li key={member.id}>
            <span aria-hidden="true" className="gk-avatar gk-avatar--lg">
              {(member.displayName ?? "R")
                .slice(0, 2)
                .toLocaleUpperCase("pt-BR")}
            </span>
            <span className="gk-row-copy">
              <strong>{member.displayName ?? "Professor"}</strong>
              <small>{member.email}</small>
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const ArchiveSection = ({
  cohort,
  disabled,
  onConfirm,
  result,
}: {
  readonly cohort: EditableCohort;
  readonly disabled: boolean;
  readonly onConfirm: () => void;
  readonly result: CohortActionResult | null;
}) => {
  const [confirm, setConfirm] = useState(false);
  const archived = cohort.archivedAt !== null;
  return (
    <section className="gk-panel gk-settings-card">
      <h2 className="gk-panel-title">
        {archived ? "Turma arquivada" : "Arquivar turma"}
      </h2>
      <p className="gk-hint">
        {archived
          ? "Esta turma está fora das listas ativas. Entregas, feedbacks e histórico foram preservados. Ao restaurar, ela volta como encerrada; ajuste a data final em Dados da turma se quiser reabri-la."
          : "Some das listas ativas. Entregas, feedbacks e histórico são preservados. Dá para restaurar."}
      </p>
      {confirm ? (
        <div className="gk-confirm">
          <strong>
            {archived ? "Restaurar esta turma?" : "Arquivar esta turma?"}
          </strong>
          <span>
            {archived
              ? "A turma volta para a lista de encerradas."
              : "Ela deixa de aceitar novas matrículas. Os alunos atuais mantêm a leitura conforme o encerramento configurado."}
          </span>
          <div className="gk-confirm-actions">
            <button
              className="gk-btn"
              disabled={disabled}
              onClick={onConfirm}
              type="button"
            >
              {archived ? "Restaurar turma" : "Arquivar turma"}
            </button>
            <button
              className="gk-btn gk-btn--dark"
              disabled={disabled}
              onClick={() => setConfirm(false)}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          className="gk-btn gk-btn--block"
          onClick={() => setConfirm(true)}
          type="button"
        >
          {archived ? "Restaurar turma" : "Arquivar turma"}
        </button>
      )}
      {result?.ok === false ? (
        <p className="gk-error-box" role="alert">
          {result.message}
        </p>
      ) : null}
    </section>
  );
};

export const CohortSettingsForm = ({
  cohort,
  isAdmin,
  teachers,
}: {
  readonly cohort: EditableCohort;
  readonly isAdmin: boolean;
  readonly teachers: readonly TeacherOption[];
}) => {
  const router = useRouter();
  const key = useRef("");
  const archiveKey = useRef("");
  const [name, setName] = useState(cohort.name);
  const [startsAt, setStartsAt] = useState(cohortDateInput(cohort.startsAt));
  const [endsAt, setEndsAt] = useState(cohortDateInput(cohort.endsAt));
  const [lateJoin, setLateJoin] = useState(cohort.lateJoinPolicy);
  const [notify, setNotify] = useState(cohort.notifyOnNews);
  const [keepReading, setKeepReading] = useState(cohort.readAfterEndDays > 0);
  const [readingDays, setReadingDays] = useState(
    cohort.readAfterEndDays > 0 ? cohort.readAfterEndDays : 90
  );
  const [teacherIds, setTeacherIds] = useState<readonly string[]>(
    cohort.teachers.map(({ member }) => member.id)
  );
  const [result, setResult] = useState<CohortActionResult | null>(null);
  const [archiveResult, setArchiveResult] = useState<CohortActionResult | null>(
    null
  );
  const [pending, startTransition] = useTransition();
  const archived = cohort.archivedAt !== null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    key.current ||= crypto.randomUUID();
    startTransition(async () => {
      const response = await updateGestaoCohort({
        cohortId: cohort.id,
        expectedVersion: cohort.version,
        name,
        startsAt,
        endsAt,
        lateJoinPolicy: lateJoin,
        notifyOnNews: notify,
        readAfterEndDays: keepReading ? readingDays : 0,
        teacherIds,
        idempotencyKey: key.current,
      });
      setResult(response);
      if (response.ok) {
        key.current = "";
        router.refresh();
      }
    });
  };

  const toggleArchive = () => {
    archiveKey.current ||= crypto.randomUUID();
    startTransition(async () => {
      const input = {
        cohortId: cohort.id,
        expectedVersion: cohort.version,
        idempotencyKey: archiveKey.current,
      };
      const response = archived
        ? await restoreGestaoCohort(input)
        : await archiveGestaoCohort(input);
      setArchiveResult(response);
      if (response.ok) {
        archiveKey.current = "";
        router.push(
          archived
            ? "/gestao/alunos/turmas?status=ENDED"
            : "/gestao/alunos/turmas?status=ARCHIVED"
        );
      }
    });
  };

  return (
    <div className="gk-settings">
      <form id={settingsFormId} onSubmit={submit}>
        <fieldset className="gk-settings-stack gk-fieldset" disabled={archived}>
          <legend className="sr-only">Configurações da turma</legend>
          <section className="gk-panel gk-settings-card">
            <h2 className="gk-panel-title">Dados da turma</h2>
            <label className="gk-label">
              <span>Nome *</span>
              <input
                className="gk-input gk-input--plain"
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <div className="gk-form-grid">
              <label className="gk-label">
                <span>Início</span>
                <input
                  className="gk-input gk-input--plain"
                  onChange={(event) => setStartsAt(event.target.value)}
                  required
                  type="date"
                  value={startsAt}
                />
              </label>
              <label className="gk-label">
                <span>Fim</span>
                <input
                  className="gk-input gk-input--plain"
                  onChange={(event) => setEndsAt(event.target.value)}
                  type="date"
                  value={endsAt}
                />
              </label>
            </div>
          </section>
          <section className="gk-panel gk-settings-card">
            <h2 className="gk-panel-title">Quem entra depois</h2>
            <div className="gk-radio-list">
              {lateJoinOptions.map(([value, label]) => (
                <label
                  className="gk-radio gk-radio--flat"
                  data-checked={String(lateJoin === value)}
                  key={value}
                >
                  <input
                    checked={lateJoin === value}
                    name="lateJoinPolicy"
                    onChange={() => setLateJoin(value)}
                    type="radio"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <GestaoSwitch
              checked={notify}
              description="Notificação interna, conforme a preferência de cada aluno."
              label="Avisar os alunos quando houver novidade na turma"
              onChange={setNotify}
            />
          </section>
          <TeacherSection
            cohort={cohort}
            isAdmin={isAdmin}
            onChange={setTeacherIds}
            selected={teacherIds}
            teachers={teachers}
          />
          <section className="gk-panel gk-settings-card">
            <h2 className="gk-panel-title">Encerramento</h2>
            <GestaoSwitch
              checked={keepReading}
              description="Os alunos continuam estudando, sem enviar novas entregas."
              label="Ao encerrar, manter leitura dos cursos"
              onChange={setKeepReading}
            />
            {keepReading ? (
              <label className="gk-label">
                <span>Por quanto tempo</span>
                <select
                  className="gk-select gk-select--plain"
                  onChange={(event) =>
                    setReadingDays(Number(event.target.value))
                  }
                  value={readingDays}
                >
                  {readingOptions.map((days) => (
                    <option key={days} value={days}>
                      {days} dias
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </section>
          {result?.ok === false ? (
            <p className="gk-error-box" role="alert">
              {result.message}
            </p>
          ) : null}
          {result?.ok === true ? (
            <output className="gk-hint">Configurações salvas.</output>
          ) : null}
        </fieldset>
      </form>
      {archived ? null : <CohortDuplicateDialog cohort={cohort} />}
      <ArchiveSection
        cohort={cohort}
        disabled={pending}
        onConfirm={toggleArchive}
        result={archiveResult}
      />
    </div>
  );
};
