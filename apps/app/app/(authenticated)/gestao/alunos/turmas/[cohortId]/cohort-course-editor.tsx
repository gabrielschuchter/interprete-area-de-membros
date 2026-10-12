"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useRef, useState, useTransition } from "react";
import { type CohortActionResult, setGestaoCohortCourses } from "../actions";

interface CourseOption {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}
interface CohortCourseOption {
  readonly course: {
    readonly title: string;
    readonly slug: string;
    readonly status: string;
  };
  readonly courseId: string;
  readonly releaseMode: "ALL_AT_ONCE" | "SCHEDULE";
  readonly startsAt: Date | null;
}
export const CohortCourseEditor = ({
  cohortId,
  expectedVersion,
  courses,
  currentAccesses,
  archived,
}: {
  readonly cohortId: string;
  readonly expectedVersion: number;
  readonly courses: readonly CourseOption[];
  readonly currentAccesses: readonly CohortCourseOption[];
  readonly archived: boolean;
}) => {
  const router = useRouter();
  const key = useRef("");
  const [selectedIds, setSelectedIds] = useState(() =>
    currentAccesses.map(({ courseId }) => courseId)
  );
  const [releaseMode, setReleaseMode] = useState<"ALL_AT_ONCE" | "SCHEDULE">(
    currentAccesses.find((access) => access.releaseMode === "SCHEDULE")
      ? "SCHEDULE"
      : "ALL_AT_ONCE"
  );
  const [startsAt, setStartsAt] = useState(
    () =>
      currentAccesses
        .find((access) => access.startsAt)
        ?.startsAt?.toISOString()
        .slice(0, 10) ?? ""
  );
  const [result, setResult] = useState<CohortActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!key.current) {
      key.current = crypto.randomUUID();
    }
    startTransition(async () => {
      const response = await setGestaoCohortCourses({
        cohortId,
        expectedVersion,
        courseIds: selectedIds,
        releaseMode,
        startsAt,
        idempotencyKey: key.current,
      });
      setResult(response);
      if (response.ok) {
        key.current = "";
        router.refresh();
      }
    });
  };
  return (
    <form className="gt-course-editor" onSubmit={submit}>
      <div className="gt-panel-heading">
        <div>
          <h2>Cursos para esta turma</h2>
          <p>
            Os alunos recebem a união dos cursos liberados em todas as turmas
            ativas.
          </p>
        </div>
        <span>{selectedIds.length} selecionado(s)</span>
      </div>
      {courses.length || currentAccesses.length ? (
        <div className="gt-course-options">
          {courses.map((course) => (
            <label className="gt-course-option" key={course.id}>
              <input
                checked={selectedIds.includes(course.id)}
                disabled={archived || pending}
                onChange={(event) =>
                  setSelectedIds((current) =>
                    event.target.checked
                      ? [...new Set([...current, course.id])]
                      : current.filter((id) => id !== course.id)
                  )
                }
                type="checkbox"
              />
              <span>
                <strong>{course.title}</strong>
                <small>
                  {currentAccesses.some((item) => item.courseId === course.id)
                    ? "Já liberado para esta turma"
                    : "Curso publicado"}
                </small>
              </span>
            </label>
          ))}
          {currentAccesses
            .filter(
              (item) => !courses.some((course) => course.id === item.courseId)
            )
            .map((access) => (
              <label className="gt-course-option" key={access.courseId}>
                <input checked disabled type="checkbox" />
                <span>
                  <strong>{access.course.title}</strong>
                  <small>
                    Curso indisponível para novas liberações; vínculo atual foi
                    preservado
                  </small>
                </span>
              </label>
            ))}
        </div>
      ) : (
        <p className="gt-panel-empty">
          Não há cursos publicados disponíveis. Publique um curso em Ensino para
          liberá-lo aqui.
        </p>
      )}
      <fieldset className="gt-release-options" disabled={archived || pending}>
        <legend>Liberação da turma</legend>
        <label className="gt-choice">
          <input
            checked={releaseMode === "ALL_AT_ONCE"}
            onChange={() => setReleaseMode("ALL_AT_ONCE")}
            type="radio"
          />
          <span>
            <strong>Imediata</strong>
            <small>Os cursos selecionados ficam disponíveis após salvar.</small>
          </span>
        </label>
        <label className="gt-choice">
          <input
            checked={releaseMode === "SCHEDULE"}
            onChange={() => setReleaseMode("SCHEDULE")}
            type="radio"
          />
          <span>
            <strong>Agendada</strong>
            <small>Os cursos ficam disponíveis na data escolhida.</small>
          </span>
        </label>
        {releaseMode === "SCHEDULE" ? (
          <label className="gt-field">
            <span>Disponível a partir de</span>
            <input
              onChange={(event) => setStartsAt(event.target.value)}
              required
              type="date"
              value={startsAt}
            />
          </label>
        ) : null}
      </fieldset>
      {result?.ok === false ? (
        <p className="gt-error-summary" role="alert">
          {result.message}
        </p>
      ) : null}
      {result?.ok === true ? (
        <output className="gt-success-message">Cronograma salvo.</output>
      ) : null}{" "}
      <div className="gt-form-actions">
        <Button disabled={archived || pending} type="submit">
          {pending ? (
            "Salvando…"
          ) : (
            <>
              <CheckIcon aria-hidden="true" />
              Salvar cronograma
            </>
          )}
        </Button>
      </div>
      {archived ? (
        <p className="gt-panel-copy">
          Esta turma está arquivada. O conteúdo atual permanece disponível em
          modo de leitura até o fim do prazo.
        </p>
      ) : null}
    </form>
  );
};
