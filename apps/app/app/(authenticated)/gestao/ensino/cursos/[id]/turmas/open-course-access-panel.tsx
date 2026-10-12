"use client";

import { useState } from "react";
import { setGestaoCourseOpenAccess } from "../../access-actions";
import {
  CourseAccessConfirmDialog,
  CourseAccessFeedback,
  useCourseAccessMutation,
} from "./course-access-ui";

export const OpenCourseAccessPanel = ({
  actorRole,
  courseId,
  courseStatus,
  openAccess,
}: {
  readonly actorRole: "ADMIN" | "TEACHER";
  readonly courseId: string;
  readonly courseStatus: string;
  readonly openAccess: boolean;
}) => {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const mutation = useCourseAccessMutation();
  const isAdmin = actorRole === "ADMIN";
  const enabled = !openAccess;

  const confirm = () => {
    mutation.run(`open:${courseId}:${enabled}`, setGestaoCourseOpenAccess, {
      courseId,
      enabled,
    });
    setConfirmationOpen(false);
  };

  return (
    <section
      aria-labelledby="gca-open-title"
      className="gca-panel gca-open-panel"
    >
      <CourseAccessFeedback result={mutation.result} />
      <div className="gca-switch-row">
        <span>
          <strong id="gca-open-title">Aberto a todos os membros</strong>
          <small>Qualquer membro, em qualquer turma, vê este curso.</small>
        </span>
        <button
          aria-checked={openAccess}
          aria-label={
            openAccess
              ? "Fechar acesso para todos os membros"
              : "Abrir curso para todos os membros"
          }
          className={`gca-switch${openAccess ? "is-on" : ""}`}
          disabled={
            !isAdmin || mutation.pending || courseStatus !== "PUBLISHED"
          }
          onClick={() => setConfirmationOpen(true)}
          role="switch"
          type="button"
        >
          <span />
        </button>
      </div>
      {isAdmin ? null : (
        <p className="gca-footnote">
          A disponibilidade global é administrada por um perfil administrador.
        </p>
      )}
      {courseStatus !== "PUBLISHED" ? (
        <p className="gca-footnote">
          Publique o curso para alterar a disponibilidade global.
        </p>
      ) : null}
      <CourseAccessConfirmDialog
        confirmLabel={enabled ? "Abrir para todos" : "Fechar para todos"}
        description={
          enabled
            ? "Qualquer membro ativo poderá acessar o curso. Os acessos de turma e individuais continuarão independentes."
            : "O acesso global será revogado. Matrículas, turmas e concessões individuais continuarão ativos."
        }
        onCancel={() => setConfirmationOpen(false)}
        onConfirm={confirm}
        open={confirmationOpen}
        title={
          enabled
            ? "Abrir curso para todos os membros?"
            : "Fechar acesso global?"
        }
      />
    </section>
  );
};
