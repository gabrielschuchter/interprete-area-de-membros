"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { type CohortActionResult, createGestaoCohort } from "./actions";

interface TeacherOption {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly id: string;
}

export const GestaoCohortForm = ({
  teachers,
  isAdmin,
}: {
  readonly teachers: readonly TeacherOption[];
  readonly isAdmin: boolean;
}) => {
  const router = useRouter();
  const key = useRef("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CohortActionResult | null>(null);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const fieldError = (name: string) =>
    result?.ok === false ? result.fields?.[name] : undefined;

  const submit = (formData: FormData) => {
    if (!key.current) {
      key.current = crypto.randomUUID();
    }
    startTransition(async () => {
      const response = await createGestaoCohort({
        name: String(formData.get("name") ?? ""),
        startsAt: String(formData.get("startsAt") ?? ""),
        endsAt: String(formData.get("endsAt") ?? ""),
        lateJoinPolicy: String(formData.get("lateJoinPolicy") ?? "ALL_ACTIVE"),
        teacherIds: selectedTeachers,
        idempotencyKey: key.current,
      });
      setResult(response);
      if (response.ok && response.cohortId) {
        router.push(`/gestao/alunos/turmas/${response.cohortId}`);
      }
    });
  };

  return (
    <form action={submit} className="gt-form">
      <div className="gt-form-section">
        <span className="gt-step">01</span>
        <div>
          <h2>Informações da turma</h2>
          <p>Escolha um nome e o período de participação.</p>
        </div>
      </div>
      <label className="gt-field">
        <span>Nome da turma</span>
        <input
          autoComplete="off"
          maxLength={120}
          name="name"
          placeholder="Ex.: Mentoria de clínica"
          required
        />
        {fieldError("name") ? (
          <small className="gt-field-error">{fieldError("name")}</small>
        ) : null}
      </label>
      <div className="gt-field-grid">
        <label className="gt-field">
          <span>Começa em</span>
          <input name="startsAt" required type="date" />
          {fieldError("startsAt") ? (
            <small className="gt-field-error">{fieldError("startsAt")}</small>
          ) : null}
        </label>
        <label className="gt-field">
          <span>
            Termina em <em>opcional</em>
          </span>
          <input name="endsAt" type="date" />
          {fieldError("endsAt") ? (
            <small className="gt-field-error">{fieldError("endsAt")}</small>
          ) : null}
        </label>
      </div>

      <div className="gt-form-section">
        <span className="gt-step">02</span>
        <div>
          <h2>Regra de entrada</h2>
          <p>Defina o que acontece quando um aluno entra depois do início.</p>
        </div>
      </div>
      <label className="gt-choice">
        <input
          defaultChecked
          name="lateJoinPolicy"
          type="radio"
          value="ALL_ACTIVE"
        />
        <span>
          <strong>Receber tudo que já está liberado</strong>
          <small>Os novos alunos recebem o conteúdo atual da turma.</small>
        </span>
      </label>
      <label className="gt-choice">
        <input name="lateJoinPolicy" type="radio" value="FROM_JOIN" />
        <span>
          <strong>Começar a partir da entrada</strong>
          <small>
            Conteúdos liberados antes da matrícula permanecem indisponíveis.
          </small>
        </span>
      </label>

      {isAdmin ? (
        <div className="gt-form-section">
          <span className="gt-step">03</span>
          <div>
            <h2>Responsáveis</h2>
            <p>Você também ficará responsável pela turma.</p>
          </div>
        </div>
      ) : null}
      {isAdmin ? (
        <fieldset className="gt-teacher-options">
          <legend className="sr-only">Adicionar outros responsáveis</legend>
          {teachers
            .filter((teacher) => teacher.id)
            .map((teacher) => (
              <label className="gt-choice" key={teacher.id}>
                <input
                  checked={selectedTeachers.includes(teacher.id)}
                  onChange={(event) =>
                    setSelectedTeachers((current) =>
                      event.target.checked
                        ? [...current, teacher.id]
                        : current.filter((id) => id !== teacher.id)
                    )
                  }
                  type="checkbox"
                />
                <span>
                  <strong>{teacher.displayName ?? "Professor"}</strong>
                  <small>{teacher.email}</small>
                </span>
              </label>
            ))}
        </fieldset>
      ) : null}

      {result?.ok === false ? (
        <p className="gt-error-summary" role="alert">
          {result.message}
        </p>
      ) : null}
      <div className="gt-form-actions">
        <Button asChild type="button" variant="outline">
          <Link href="/gestao/alunos/turmas">
            <ArrowLeftIcon aria-hidden="true" />
            Cancelar
          </Link>
        </Button>
        <Button disabled={pending} type="submit">
          {pending ? (
            "Salvando…"
          ) : (
            <>
              <CheckIcon aria-hidden="true" />
              Criar turma
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
