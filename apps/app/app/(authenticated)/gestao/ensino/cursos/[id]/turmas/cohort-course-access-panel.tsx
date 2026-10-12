"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { PlusIcon, UsersRoundIcon } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { setGestaoCourseCohortAccess } from "../../access-actions";
import {
  type ActiveCourseCohortAccess,
  type CourseAccessCohort,
  CourseAccessConfirmDialog,
  CourseAccessFeedback,
  CourseAccessPager,
  CourseAccessSearch,
  courseAccessDateTimeValue,
  courseAccessPeriod,
  courseCohortStatus,
  useCourseAccessMutation,
} from "./course-access-ui";

interface PendingConfirmation {
  readonly description: string;
  readonly operation: string;
  readonly title: string;
  readonly values: Record<string, unknown>;
}

export const CohortCourseAccessPanel = ({
  candidateCohorts,
  candidateCohortPage,
  candidateCohortQuery,
  candidateCohortTotalCount,
  candidateCohortTotalPages,
  cohortAccesses,
  cohortPage,
  cohortQuery,
  cohortTotalCount,
  cohortTotalPages,
  courseId,
  courseStatus,
}: {
  readonly candidateCohorts: readonly CourseAccessCohort[];
  readonly candidateCohortPage: number;
  readonly candidateCohortQuery: string;
  readonly candidateCohortTotalCount: number;
  readonly candidateCohortTotalPages: number;
  readonly cohortAccesses: readonly ActiveCourseCohortAccess[];
  readonly cohortPage: number;
  readonly cohortQuery: string;
  readonly cohortTotalCount: number;
  readonly cohortTotalPages: number;
  readonly courseId: string;
  readonly courseStatus: string;
}) => {
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(
    null
  );
  const mutation = useCourseAccessMutation();
  const coursePath = `/gestao/ensino/cursos/${encodeURIComponent(courseId)}/turmas`;
  const now = Date.now();

  const requestConfirmation = (
    operation: string,
    values: Record<string, unknown>,
    title: string,
    description: string
  ) => setConfirmation({ operation, values, title, description });

  const submitCohortAccess = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cohortId = String(form.get("cohortId") ?? "");
    const cohort = candidateCohorts.find((item) => item.id === cohortId);
    if (!cohort) {
      return;
    }
    const releaseMode = String(form.get("releaseMode") ?? "ALL_AT_ONCE") as
      | "ALL_AT_ONCE"
      | "SCHEDULE";
    requestConfirmation(
      `cohort:${cohort.id}`,
      {
        cohortId: cohort.id,
        courseId,
        enabled: true,
        expectedCohortVersion: cohort.version,
        releaseMode,
        startsAt: String(form.get("startsAt") ?? ""),
      },
      "Liberar curso para esta turma?",
      `O curso ficará disponível para ${cohort.name} segundo a liberação escolhida.`
    );
  };

  const requestEdit = (access: ActiveCourseCohortAccess, form: FormData) => {
    const releaseMode = String(form.get("releaseMode") ?? "ALL_AT_ONCE") as
      | "ALL_AT_ONCE"
      | "SCHEDULE";
    requestConfirmation(
      `cohort:${access.cohort.id}`,
      {
        cohortId: access.cohort.id,
        courseId,
        enabled: true,
        expectedCohortVersion: access.cohort.version,
        releaseMode,
        startsAt: String(form.get("startsAt") ?? ""),
      },
      "Salvar nova liberação?",
      `A configuração de acesso de ${access.cohort.name} será atualizada.`
    );
  };

  const requestRevoke = (access: ActiveCourseCohortAccess) =>
    requestConfirmation(
      `cohort:${access.cohort.id}`,
      {
        cohortId: access.cohort.id,
        courseId,
        enabled: false,
        expectedCohortVersion: access.cohort.version,
        releaseMode: access.releaseMode,
        startsAt: "",
      },
      "Revogar acesso da turma?",
      `Os alunos de ${access.cohort.name} deixarão de receber este curso por esta turma. Outros acessos individuais ou de turmas permanecem ativos.`
    );

  const confirm = () => {
    if (confirmation) {
      mutation.run(
        confirmation.operation,
        setGestaoCourseCohortAccess,
        confirmation.values
      );
      setConfirmation(null);
    }
  };

  return (
    <section aria-labelledby="gca-cohorts-title" className="gca-panel">
      <CourseAccessFeedback result={mutation.result} />
      <div className="gca-panel-heading">
        <div>
          <h2 id="gca-cohorts-title">Turmas com este curso</h2>
          <p>
            O acesso acompanha a turma e é calculado junto às outras origens do
            aluno.
          </p>
        </div>
        <details className="gca-add-cohort">
          <summary>
            <PlusIcon aria-hidden="true" /> Liberar para uma turma
          </summary>
          <div className="gca-details-panel">
            <form
              action={coursePath}
              className="gca-filter-inline"
              method="get"
            >
              <label>
                <span>Encontrar turma</span>
                <input
                  defaultValue={candidateCohortQuery}
                  maxLength={120}
                  name="candidata_busca"
                  placeholder="Buscar pelo nome"
                  type="search"
                />
              </label>
              <input name="candidata_pagina" type="hidden" value="1" />
              <Button size="sm" type="submit" variant="outline">
                Buscar
              </Button>
            </form>
            <form className="gca-editor-form" onSubmit={submitCohortAccess}>
              {candidateCohorts.length ? (
                <label className="gca-field">
                  <span>Turma</span>
                  <select disabled={mutation.pending} name="cohortId" required>
                    {candidateCohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.name} ·{" "}
                        {courseAccessPeriod(cohort.startsAt, cohort.endsAt)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="gca-empty-copy">
                  {candidateCohortQuery
                    ? "Nenhuma turma corresponde à busca."
                    : "Não há outras turmas disponíveis para receber este curso."}
                </p>
              )}
              <fieldset
                className="gca-choice-group"
                disabled={mutation.pending}
              >
                <legend>Liberação</legend>
                <label>
                  <input
                    defaultChecked
                    name="releaseMode"
                    type="radio"
                    value="ALL_AT_ONCE"
                  />
                  <span>
                    <strong>Tudo de uma vez</strong>
                    <small>
                      Disponibilizar imediatamente aos alunos ativos.
                    </small>
                  </span>
                </label>
                <label>
                  <input name="releaseMode" type="radio" value="SCHEDULE" />
                  <span>
                    <strong>Por cronograma</strong>
                    <small>
                      Definir o início da liberação para esta turma.
                    </small>
                  </span>
                </label>
              </fieldset>
              <label className="gca-field">
                <span>Início do cronograma</span>
                <input
                  disabled={mutation.pending}
                  name="startsAt"
                  type="datetime-local"
                />
              </label>
              {courseStatus !== "PUBLISHED" ? (
                <p className="gca-inline-note">
                  Publique o curso para criar um novo acesso de turma.
                </p>
              ) : null}
              <Button
                disabled={
                  mutation.pending ||
                  candidateCohorts.length === 0 ||
                  courseStatus !== "PUBLISHED"
                }
                size="sm"
                type="submit"
              >
                Continuar
              </Button>
            </form>
            <CourseAccessPager
              field="candidata_pagina"
              label="Turmas disponíveis"
              page={candidateCohortPage}
              totalPages={candidateCohortTotalPages}
            />
            <span className="gca-result-count">
              {candidateCohortTotalCount} turma(s) disponível(is)
            </span>
          </div>
        </details>
      </div>

      <div className="gca-table-toolbar">
        <CourseAccessSearch
          action={coursePath}
          label="Buscar turma vinculada"
          name="turma_busca"
          pageField="turma_pagina"
          value={cohortQuery}
        />
        <span className="gca-result-count">{cohortTotalCount} turma(s)</span>
      </div>
      {cohortAccesses.length ? (
        <section
          aria-label="Turmas com acesso ao curso"
          className="gca-table-scroll"
        >
          <table className="gca-table">
            <thead>
              <tr>
                <th scope="col">Turma</th>
                <th scope="col">Alunos</th>
                <th scope="col">Liberação</th>
                <th scope="col">Período</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cohortAccesses.map((access) => {
                const status = courseCohortStatus(access, now);
                return (
                  <tr key={access.id}>
                    <td>
                      <Link
                        className="gca-cohort-pill"
                        href={`/gestao/alunos/turmas/${encodeURIComponent(access.cohort.id)}`}
                        prefetch={false}
                      >
                        <UsersRoundIcon aria-hidden="true" />
                        {access.cohort.name}
                      </Link>
                    </td>
                    <td>{access.cohort.studentCount}</td>
                    <td>
                      {access.releaseMode === "SCHEDULE"
                        ? "Por cronograma"
                        : "Tudo de uma vez"}
                    </td>
                    <td>
                      {courseAccessPeriod(
                        access.cohort.startsAt,
                        access.cohort.endsAt
                      )}
                    </td>
                    <td>
                      <span className={`gca-state is-${status.state}`}>
                        <span aria-hidden="true" />
                        {status.label}
                      </span>
                    </td>
                    <td>
                      <details className="gca-row-actions">
                        <summary
                          aria-label={`Ações para ${access.cohort.name}`}
                        >
                          <span aria-hidden="true">···</span>
                        </summary>
                        <div className="gca-details-panel">
                          <form
                            className="gca-editor-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              requestEdit(
                                access,
                                new FormData(event.currentTarget)
                              );
                            }}
                          >
                            <strong>Editar liberação</strong>
                            <label className="gca-field">
                              <span>Modo</span>
                              <select
                                defaultValue={access.releaseMode}
                                disabled={mutation.pending}
                                name="releaseMode"
                              >
                                <option value="ALL_AT_ONCE">
                                  Tudo de uma vez
                                </option>
                                <option value="SCHEDULE">Por cronograma</option>
                              </select>
                            </label>
                            <label className="gca-field">
                              <span>Disponível a partir de</span>
                              <input
                                defaultValue={courseAccessDateTimeValue(
                                  access.startsAt
                                )}
                                disabled={mutation.pending}
                                name="startsAt"
                                type="datetime-local"
                              />
                            </label>
                            <Button
                              disabled={mutation.pending}
                              size="sm"
                              type="submit"
                              variant="outline"
                            >
                              Continuar
                            </Button>
                          </form>
                          <button
                            className="gca-danger-action"
                            disabled={mutation.pending}
                            onClick={() => requestRevoke(access)}
                            type="button"
                          >
                            Revogar acesso da turma
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : (
        <div className="gca-empty-state">
          <UsersRoundIcon aria-hidden="true" />
          <p>
            {cohortQuery
              ? "Nenhuma turma vinculada corresponde à busca."
              : "Este curso ainda não foi liberado para uma turma."}
          </p>
        </div>
      )}
      <CourseAccessPager
        field="turma_pagina"
        label="Turmas com este curso"
        page={cohortPage}
        totalPages={cohortTotalPages}
      />
      <CourseAccessConfirmDialog
        description={confirmation?.description ?? ""}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirm}
        open={Boolean(confirmation)}
        title={confirmation?.title ?? "Confirmar alteração"}
      />
    </section>
  );
};
