"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { PlusIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import {
  grantGestaoCourseDirectAccess,
  revokeGestaoCourseDirectAccess,
} from "../../access-actions";
import {
  CourseAccessConfirmDialog,
  CourseAccessFeedback,
  type CourseAccessMutation,
  CourseAccessPager,
  type CourseAccessPerson,
  CourseAccessSearch,
  courseAccessExpiration,
  courseAccessInitials,
  courseAccessPersonName,
  type IndividualCourseGrant,
  useCourseAccessMutation,
} from "./course-access-ui";

interface PendingConfirmation {
  readonly action: CourseAccessMutation;
  readonly description: string;
  readonly operation: string;
  readonly title: string;
  readonly values: Record<string, unknown>;
}

export const DirectCourseAccessPanel = ({
  courseId,
  directGrantCount,
  directLegacyGrantCount,
  directGrants,
  directLegacyGrantPage,
  directLegacyGrantTotalPages,
  directSourceGrantCount,
  directSourceGrantPage,
  directSourceGrantTotalPages,
  memberCount,
  memberPage,
  memberQuery,
  memberTotalPages,
  members,
}: {
  readonly courseId: string;
  readonly directGrantCount: number;
  readonly directLegacyGrantCount: number;
  readonly directGrants: readonly IndividualCourseGrant[];
  readonly directLegacyGrantPage: number;
  readonly directLegacyGrantTotalPages: number;
  readonly directSourceGrantCount: number;
  readonly directSourceGrantPage: number;
  readonly directSourceGrantTotalPages: number;
  readonly memberCount: number;
  readonly memberPage: number;
  readonly memberQuery: string;
  readonly memberTotalPages: number;
  readonly members: readonly CourseAccessPerson[];
}) => {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [granting, setGranting] = useState(Boolean(memberQuery));
  const mutation = useCourseAccessMutation();
  const coursePath = `/gestao/ensino/cursos/${encodeURIComponent(courseId)}/turmas`;

  const submitGrant = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const memberId = String(form.get("memberId") ?? "");
    const member = members.find((candidate) => candidate.id === memberId);
    if (!member) {
      return;
    }
    const expiresAt = String(form.get("expiresAt") ?? "");
    setPending({
      operation: `grant:${member.id}`,
      action: grantGestaoCourseDirectAccess,
      values: { courseId, memberId, expiresAt },
      title: "Conceder acesso individual?",
      description: expiresAt
        ? `${courseAccessPersonName(member)} receberá acesso até a data definida.`
        : `${courseAccessPersonName(member)} receberá acesso individual sem expiração.`,
    });
  };

  const requestRevoke = (grant: IndividualCourseGrant) => {
    setPending({
      operation: `revoke:${grant.kind}:${grant.id}`,
      action: revokeGestaoCourseDirectAccess,
      values: { courseId, grantId: grant.id, grantKind: grant.kind },
      title: "Revogar acesso individual?",
      description: `O acesso de ${courseAccessPersonName(grant.member)} será removido. Acessos por turma, matrícula ou outra origem permanecem ativos.`,
    });
  };

  const confirm = () => {
    if (!pending) {
      return;
    }
    mutation.run(pending.operation, pending.action, pending.values);
    setPending(null);
  };

  return (
    <section aria-labelledby="gca-direct-title" className="gca-panel">
      <CourseAccessFeedback result={mutation.result} />
      <div className="gca-panel-heading">
        <div>
          <h2 id="gca-direct-title">Acessos individuais</h2>
          <p>
            Exceções com prazo próprio, revogadas sem afetar outros acessos.
          </p>
        </div>
        <button
          aria-controls="gca-grant-form"
          aria-expanded={granting}
          className="gca-text-action"
          onClick={() => setGranting((value) => !value)}
          type="button"
        >
          <PlusIcon aria-hidden="true" /> Conceder acesso
        </button>
      </div>
      {granting ? (
        <>
          <div className="gca-table-toolbar">
            <CourseAccessSearch
              action={coursePath}
              label="Buscar membro por nome, e-mail ou usuário"
              name="membro_busca"
              pageField="membro_pagina"
              value={memberQuery}
            />
            <span className="gca-result-count">
              {directGrantCount} acesso(s) individual(is)
            </span>
          </div>

          <form
            className="gca-grant-form"
            id="gca-grant-form"
            onSubmit={submitGrant}
          >
            <label className="gca-field">
              <span>Membro</span>
              <select
                disabled={mutation.pending || members.length === 0}
                name="memberId"
                required
              >
                <option value="">Selecione um membro</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {courseAccessPersonName(member)}
                    {member.email ? ` · ${member.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="gca-field">
              <span>Expira em (opcional)</span>
              <input
                disabled={mutation.pending}
                name="expiresAt"
                type="datetime-local"
              />
            </label>
            <Button
              disabled={mutation.pending || members.length === 0}
              size="sm"
              type="submit"
            >
              Continuar
            </Button>
          </form>
        </>
      ) : null}
      {granting && members.length === 0 ? (
        <p className="gca-empty-copy">
          {memberQuery
            ? "Nenhum membro ativo corresponde à busca."
            : "Não há membros ativos disponíveis para concessão."}
        </p>
      ) : null}
      {granting ? (
        <CourseAccessPager
          field="membro_pagina"
          label="Resultados de membros"
          page={memberPage}
          totalPages={memberTotalPages}
        />
      ) : null}

      {directGrants.length ? (
        <div className="gca-grant-list">
          {directGrants.map((grant) => (
            <div className="gca-grant-row" key={`${grant.kind}:${grant.id}`}>
              <span aria-hidden="true" className="gca-avatar">
                {courseAccessInitials(courseAccessPersonName(grant.member))}
              </span>
              <span className="gca-grant-person">
                <strong>{courseAccessPersonName(grant.member)}</strong>
                <small>{courseAccessExpiration(grant.expiresAt)}</small>
              </span>
              <button
                className="gca-danger-action"
                disabled={mutation.pending}
                onClick={() => requestRevoke(grant)}
                type="button"
              >
                Revogar
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="gca-empty-state compact">
          <p>Nenhum acesso individual ativo para este curso.</p>
        </div>
      )}
      {directSourceGrantTotalPages > 1 || directLegacyGrantTotalPages > 1 ? (
        <div className="gca-grant-pagers">
          <div>
            <span>Novos acessos ({directSourceGrantCount})</span>
            <CourseAccessPager
              field="acesso_pagina"
              label="Acessos individuais recentes"
              page={directSourceGrantPage}
              totalPages={directSourceGrantTotalPages}
            />
          </div>
          <div>
            <span>Concessões anteriores ({directLegacyGrantCount})</span>
            <CourseAccessPager
              field="legado_pagina"
              label="Concessões anteriores"
              page={directLegacyGrantPage}
              totalPages={directLegacyGrantTotalPages}
            />
          </div>
        </div>
      ) : null}
      <p className="gca-footnote">
        Servem para exceções. Quem está numa turma com o curso já tem acesso.
        {granting ? ` ${memberCount} membro(s) ativo(s) disponíveis.` : ""}
      </p>
      <CourseAccessConfirmDialog
        confirmLabel="Confirmar acesso"
        description={pending?.description ?? ""}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
        open={Boolean(pending)}
        title={pending?.title ?? "Confirmar alteração"}
      />
    </section>
  );
};
