"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ArchiveIcon, CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useRef, useState, useTransition } from "react";
import { cohortDateInput } from "@/lib/cohort-domain";
import {
  archiveGestaoCohort,
  type CohortActionResult,
  updateGestaoCohort,
} from "../actions";

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
  const [teacherIds, setTeacherIds] = useState(
    cohort.teachers.map(({ member }) => member.id)
  );
  const [result, setResult] = useState<CohortActionResult | null>(null);
  const [archiveResult, setArchiveResult] = useState<CohortActionResult | null>(
    null
  );
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pending, startTransition] = useTransition();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (!key.current) {
      key.current = crypto.randomUUID();
    }
    startTransition(async () => {
      const response = await updateGestaoCohort({
        cohortId: cohort.id,
        expectedVersion: cohort.version,
        name: String(values.get("name") ?? ""),
        startsAt: String(values.get("startsAt") ?? ""),
        endsAt: String(values.get("endsAt") ?? ""),
        lateJoinPolicy: String(values.get("lateJoinPolicy") ?? "ALL_ACTIVE"),
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
  const archive = () => {
    if (!archiveKey.current) {
      archiveKey.current = crypto.randomUUID();
    }
    startTransition(async () => {
      const response = await archiveGestaoCohort({
        cohortId: cohort.id,
        expectedVersion: cohort.version,
        idempotencyKey: archiveKey.current,
      });
      setArchiveResult(response);
      if (response.ok) {
        router.push("/gestao/alunos/turmas?status=ARCHIVED");
      }
    });
  };
  return (
    <div className="gt-settings-layout">
      <form className="gt-form" onSubmit={submit}>
        <div className="gt-form-section">
          <span className="gt-step">01</span>
          <div>
            <h2>Informações</h2>
            <p>
              Versão atual {cohort.version}. A confirmação é validada no
              servidor para evitar sobrescrever alterações recentes.
            </p>
          </div>
        </div>
        <label className="gt-field">
          <span>Nome da turma</span>
          <input
            defaultValue={cohort.name}
            maxLength={120}
            name="name"
            required
          />
        </label>
        <div className="gt-field-grid">
          <label className="gt-field">
            <span>Começa em</span>
            <input
              defaultValue={cohortDateInput(cohort.startsAt)}
              name="startsAt"
              required
              type="date"
            />
          </label>
          <label className="gt-field">
            <span>
              Termina em <em>opcional</em>
            </span>
            <input
              defaultValue={cohortDateInput(cohort.endsAt)}
              name="endsAt"
              type="date"
            />
          </label>
        </div>
        <div className="gt-form-section">
          <span className="gt-step">02</span>
          <div>
            <h2>Regra de entrada</h2>
            <p>
              Alunos novos entram no conteúdo atual ou só no que for liberado
              após a entrada.
            </p>
          </div>
        </div>
        <label className="gt-field">
          <span>Quando alguém entrar depois</span>
          <select defaultValue={cohort.lateJoinPolicy} name="lateJoinPolicy">
            <option value="ALL_ACTIVE">Receber o conteúdo já liberado</option>
            <option value="FROM_JOIN">
              Começar a partir da data de entrada
            </option>
          </select>
        </label>
        <div className="gt-form-section">
          <span className="gt-step">03</span>
          <div>
            <h2>Responsáveis</h2>
            <p>
              {isAdmin
                ? "Professores responsáveis podem acompanhar os alunos desta turma."
                : "Somente administradores alteram os responsáveis. Os atuais permanecem vinculados."}
            </p>
          </div>
        </div>
        {isAdmin ? (
          <fieldset className="gt-teacher-options">
            <legend className="sr-only">Responsáveis da turma</legend>
            {teachers.map((teacher) => (
              <label className="gt-choice" key={teacher.id}>
                <input
                  checked={teacherIds.includes(teacher.id)}
                  onChange={(event) =>
                    setTeacherIds((current) =>
                      event.target.checked
                        ? [...new Set([...current, teacher.id])]
                        : current.filter((id) => id !== teacher.id)
                    )
                  }
                  type="checkbox"
                />
                <span>
                  <strong>{teacher.displayName ?? "Professor"}</strong>
                  <small>{teacher.email ?? teacher.role}</small>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <ul className="gt-teacher-list">
            {cohort.teachers.map(({ member }) => (
              <li key={member.id}>
                <span aria-hidden="true" className="gt-avatar">
                  {member.displayName?.slice(0, 1) ?? "R"}
                </span>
                <span>
                  <strong>{member.displayName ?? "Professor"}</strong>
                  <small>{member.email}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
        {result?.ok === false ? (
          <p className="gt-error-summary" role="alert">
            {result.message}
          </p>
        ) : null}
        {result?.ok === true ? (
          <output className="gt-success-message">Configurações salvas.</output>
        ) : null}{" "}
        <div className="gt-form-actions">
          <Button
            disabled={pending || cohort.archivedAt !== null}
            type="submit"
          >
            {pending ? (
              "Salvando…"
            ) : (
              <>
                <CheckIcon aria-hidden="true" />
                Salvar alterações
              </>
            )}
          </Button>
        </div>
      </form>
      <section className="gt-panel gt-archive-panel">
        <div className="gt-panel-heading">
          <div>
            <h2>Encerrar turma</h2>
            <p>
              Encerre uma turma quando o ciclo terminar. O encerramento mantém
              leitura do conteúdo por {90} dias e preserva as atribuições
              individuais.
            </p>
          </div>
        </div>
        {cohort.archivedAt ? (
          <p className="gt-panel-copy">
            Arquivada em{" "}
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
              cohort.archivedAt
            )}
            .
          </p>
        ) : null}
        {!cohort.archivedAt && confirmArchive ? (
          <div className="gt-confirm-panel">
            <strong>Confirmar encerramento?</strong>
            <p>
              A turma deixa de receber novas matrículas. Os alunos atuais mantêm
              leitura por 90 dias. Após esse período, o acesso herdado termina.
            </p>
            <div>
              <Button
                disabled={pending}
                onClick={archive}
                type="button"
                variant="destructive"
              >
                {pending ? "Encerrando…" : "Encerrar e arquivar"}
              </Button>
              <Button
                disabled={pending}
                onClick={() => setConfirmArchive(false)}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
        {cohort.archivedAt || confirmArchive ? null : (
          <Button
            disabled={pending}
            onClick={() => setConfirmArchive(true)}
            type="button"
            variant="outline"
          >
            <ArchiveIcon aria-hidden="true" />
            Encerrar turma
          </Button>
        )}{" "}
        {archiveResult?.ok === false ? (
          <p className="gt-error-summary" role="alert">
            {archiveResult.message}
          </p>
        ) : null}
      </section>
    </div>
  );
};
