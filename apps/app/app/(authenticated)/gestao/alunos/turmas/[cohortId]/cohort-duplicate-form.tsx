"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CopyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useRef, useState, useTransition } from "react";
import { cohortDateInput } from "@/lib/cohort-domain";
import type { GestaoCohortDetail } from "@/lib/gestao-cohorts";
import { type CohortActionResult, duplicateGestaoCohort } from "../actions";

export const CohortDuplicateForm = ({
  cohort,
}: {
  readonly cohort: GestaoCohortDetail;
}) => {
  const router = useRouter();
  const key = useRef("");
  const [result, setResult] = useState<CohortActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    key.current ||= crypto.randomUUID();
    startTransition(async () => {
      const response = await duplicateGestaoCohort({
        cohortId: cohort.id,
        expectedVersion: cohort.version,
        name: String(form.get("name") ?? ""),
        startsAt: String(form.get("startsAt") ?? ""),
        endsAt: String(form.get("endsAt") ?? ""),
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
    <form className="gt-form gt-duplicate-form" onSubmit={submit}>
      <div className="gt-form-section">
        <span className="gt-step">04</span>
        <div>
          <h2>Duplicar turma</h2>
          <p>
            Copia responsáveis, cursos e liberações. Alunos, convites e acessos
            históricos não são copiados.
          </p>
        </div>
      </div>
      <label className="gt-field">
        <span>Nome da nova turma</span>
        <input
          defaultValue={`${cohort.name} (cópia)`}
          maxLength={120}
          minLength={3}
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
      {result?.ok === false ? (
        <p className="gt-error-summary" role="alert">
          {result.message}
        </p>
      ) : null}
      <div className="gt-form-actions">
        <Button disabled={pending} type="submit" variant="outline">
          {pending ? (
            "Duplicando…"
          ) : (
            <>
              <CopyIcon aria-hidden="true" />
              Duplicar turma
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
