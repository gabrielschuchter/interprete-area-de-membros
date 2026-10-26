"use client";

import { useActionState, useState } from "react";
import { useGestaoDirtyRegistration } from "../../../../dirty-registry";
import { GestaoIcon } from "../../../../gestao-icon";
import { type CohortNoticeState, publishCohortNotice } from "./actions";

const initial: CohortNoticeState = { done: false, error: null };
const bodyLimit = 2000;

export const CohortNoticeForm = ({
  cohortId,
  students,
}: {
  readonly cohortId: string;
  readonly students: number;
}) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState(
    async (previous: CohortNoticeState, formData: FormData) => {
      const next = await publishCohortNotice(previous, formData);
      if (next.done) {
        setTitle("");
        setBody("");
      }
      return next;
    },
    initial
  );
  const [scheduling, setScheduling] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  useGestaoDirtyRegistration(
    !state.done && (title.length > 0 || body.length > 0)
  );
  return (
    <form action={action} className="gk-card gk-notice-form">
      <h2 className="gk-panel-title">Aviso para a turma</h2>
      <input name="cohortId" type="hidden" value={cohortId} />
      <label className="gk-label">
        <span>Título</span>
        <input
          className="gk-input"
          maxLength={180}
          name="title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ex.: Mudança de horário do encontro"
          required
          value={title}
        />
      </label>
      <label className="gk-label">
        <span>Mensagem</span>
        <textarea
          maxLength={bodyLimit}
          name="body"
          onChange={(event) => setBody(event.target.value)}
          placeholder="Escreva o aviso…"
          required
          rows={5}
          value={body}
        />
        <small>
          {body.length}/{bodyLimit}
        </small>
      </label>
      <label className="gk-check">
        <input name="isPinned" type="checkbox" />
        <span>Fixar no topo dos avisos</span>
      </label>
      {scheduling ? (
        <label className="gk-label">
          <span>Publicar em</span>
          <input
            className="gk-input"
            name="startsAt"
            onChange={(event) => setStartsAt(event.target.value)}
            required
            type="datetime-local"
            value={startsAt}
          />
          <small>
            Agendado aparece para a turma na data escolhida; a notificação só é
            enviada na publicação imediata.
          </small>
        </label>
      ) : null}
      <p className="gk-hint">
        Chega a {students} {students === 1 ? "aluno ativo" : "alunos ativos"}{" "}
        desta turma hoje. Quem entrar depois não recebe este aviso.
      </p>
      {state.error ? (
        <p className="gk-alert" role="alert">
          <GestaoIcon name="alert-circle" size={16} /> {state.error}
        </p>
      ) : null}
      {state.done ? (
        <output className="gk-result">Aviso publicado para a turma.</output>
      ) : null}
      <div className="gk-form-actions">
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending}
          type="submit"
        >
          {scheduling ? "Agendar aviso" : "Publicar para a turma"}
        </button>
        <button
          className="gk-btn"
          onClick={() => {
            setScheduling((current) => !current);
            setStartsAt("");
          }}
          type="button"
        >
          {scheduling ? "Publicar agora" : "Agendar"}
        </button>
      </div>
    </form>
  );
};
