"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useRef, useState, useTransition } from "react";
import {
  type CohortActionResult,
  setGestaoCohortLessonRelease,
} from "../actions";

interface CohortLessonOption {
  readonly cohortLessonReleases: readonly { readonly releaseAt: Date }[];
  readonly id: string;
  readonly module: {
    readonly course: { readonly id: string; readonly title: string };
    readonly title: string;
  };
  readonly title: string;
}

export const CohortLessonReleaseEditor = ({
  archived,
  cohortId,
  expectedVersion,
  lessons,
}: {
  readonly archived: boolean;
  readonly cohortId: string;
  readonly expectedVersion: number;
  readonly lessons: readonly CohortLessonOption[];
}) => {
  const router = useRouter();
  const keys = useRef<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [dates, setDates] = useState(() =>
    Object.fromEntries(
      lessons.map((lesson) => [
        lesson.id,
        lesson.cohortLessonReleases[0]?.releaseAt.toISOString().slice(0, 10) ??
          "",
      ])
    )
  );
  const [results, setResults] = useState<
    Readonly<Record<string, CohortActionResult | undefined>>
  >({});

  const submit = (lessonId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    keys.current[lessonId] ??= crypto.randomUUID();
    startTransition(async () => {
      const result = await setGestaoCohortLessonRelease({
        cohortId,
        lessonId,
        expectedVersion,
        releaseAt: dates[lessonId] ?? "",
        idempotencyKey: keys.current[lessonId],
      });
      setResults((current) => ({ ...current, [lessonId]: result }));
      if (result.ok) {
        delete keys.current[lessonId];
        router.refresh();
      }
    });
  };

  return (
    <section className="gt-panel gt-lesson-release-panel">
      <div className="gt-panel-heading">
        <div>
          <h2>Liberação por aula</h2>
          <p>
            Uma data futura adia a aula para esta turma. Deixe em branco para
            liberar assim que o curso estiver disponível.
          </p>
        </div>
        <span>{lessons.length} aulas publicadas</span>
      </div>
      {lessons.length ? (
        <div className="gt-lesson-release-list">
          {lessons.map((lesson) => {
            const result = results[lesson.id];
            return (
              <form
                className="gt-lesson-release-row"
                key={lesson.id}
                onSubmit={(event) => submit(lesson.id, event)}
              >
                <div className="gt-lesson-release-title">
                  <span>
                    {lesson.module.course.title} · {lesson.module.title}
                  </span>
                  <strong>{lesson.title}</strong>
                </div>
                <label className="gt-field">
                  <span>Disponível em</span>
                  <input
                    aria-label={`Data de liberação de ${lesson.title}`}
                    disabled={archived || pending}
                    onChange={(event) =>
                      setDates((current) => ({
                        ...current,
                        [lesson.id]: event.target.value,
                      }))
                    }
                    type="date"
                    value={dates[lesson.id] ?? ""}
                  />
                </label>
                <Button
                  disabled={archived || pending}
                  type="submit"
                  variant="outline"
                >
                  {pending ? (
                    "Salvando…"
                  ) : (
                    <>
                      <CheckIcon aria-hidden="true" /> Salvar
                    </>
                  )}
                </Button>
                {result?.ok === false ? (
                  <p className="gt-error-summary" role="alert">
                    {result.message}
                  </p>
                ) : null}
                {result?.ok === true ? (
                  <output className="gt-success-message">Salvo.</output>
                ) : null}
              </form>
            );
          })}
        </div>
      ) : (
        <p className="gt-panel-empty">
          Libere um curso publicado para configurar as datas das aulas.
        </p>
      )}
      {archived ? (
        <p className="gt-panel-copy">
          A turma está arquivada. O cronograma permanece em modo de leitura.
        </p>
      ) : null}
    </section>
  );
};
