"use client";

import { useState, useTransition } from "react";
import type { CourseVerification } from "@/lib/gestao-course-verification";
import { GestaoIcon } from "../../../gestao-icon";
import { verifyGestaoCoursePublication } from "./structure-actions";

/** Confere o curso antes de publicar e lista o que ainda falta. */
export const CourseVerifyButton = ({
  courseId,
}: {
  readonly courseId: string;
}) => {
  const [result, setResult] = useState<CourseVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      try {
        const next = await verifyGestaoCoursePublication(courseId);
        setResult(next);
        if (!next) {
          setError("Curso não encontrado.");
        }
      } catch {
        setError("Não foi possível verificar agora. Tente novamente.");
      }
    });
  };

  return (
    <div className="gk-verify">
      <button
        aria-busy={pending}
        className="gk-btn"
        disabled={pending}
        onClick={run}
        type="button"
      >
        {pending ? "Verificando…" : "Verificar publicação"}
      </button>
      <div aria-live="polite" className="gk-verify-result">
        {error ? <p role="alert">{error}</p> : null}
        {result ? (
          <section className="gk-panel">
            <h2 className="gk-panel-title">{result.summary}</h2>
            <ul className="gk-ready">
              {result.items.map((item) => (
                <li data-state={item.state} key={item.key}>
                  <GestaoIcon
                    name={item.state === "ok" ? "check-circle" : "alert-circle"}
                    size={18}
                  />
                  <span>
                    {item.label}
                    {item.detail ? <small>{item.detail}</small> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
};
