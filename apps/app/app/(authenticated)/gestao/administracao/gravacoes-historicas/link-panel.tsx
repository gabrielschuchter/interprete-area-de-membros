"use client";

import { useActionState, useEffect, useState } from "react";
import { GestaoIcon } from "../../gestao-icon";
import { type LinkRecordingState, linkGestaoRecordingGroup } from "./actions";

interface Person {
  readonly id: string;
  readonly name: string;
}

const usePeople = (query: string) => {
  const [items, setItems] = useState<readonly Person[]>([]);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/assignment-recipients?q=${encodeURIComponent(term)}`,
          { signal: controller.signal }
        );
        if (response.ok) {
          const body = (await response.json()) as {
            items?: { id: string; displayName: string }[];
          };
          setItems(
            (body.items ?? []).map((item) => ({
              id: item.id,
              name: item.displayName,
            }))
          );
        }
      } catch {
        // busca cancelada ao digitar de novo
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return items;
};

const initial: LinkRecordingState = { error: null };

export const LinkPanel = ({
  attachments,
  currentName,
  groupId,
  linked,
  skipHref,
  videos,
}: {
  readonly attachments: number;
  readonly currentName: string | null;
  readonly groupId: string;
  readonly linked: boolean;
  readonly skipHref: string | null;
  readonly videos: number;
}) => {
  const [state, formAction, pending] = useActionState(
    linkGestaoRecordingGroup,
    initial
  );
  const [member, setMember] = useState<Person | null>(null);
  const [query, setQuery] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reassign, setReassign] = useState(false);
  const results = usePeople(query);
  const title = linked ? "Reatribuir a outro membro" : "Vincular a um membro";
  return (
    <form action={formAction} className="gk-card gk-link-card">
      <h3 className="gk-card-title">{title}</h3>
      {linked ? (
        <p className="gk-hint">
          Hoje liberado para <strong>{currentName ?? "outro membro"}</strong>.
        </p>
      ) : null}
      <input name="groupId" type="hidden" value={groupId} />
      <input name="memberId" type="hidden" value={member?.id ?? ""} />
      <input
        name="confirmReassignment"
        type="hidden"
        value={linked && reassign ? "true" : "false"}
      />
      <input
        name="identityConfirmed"
        type="hidden"
        value={confirmed ? "true" : "false"}
      />
      <div className="gk-label">
        <label htmlFor="rec-member">Membro</label>
        {member ? (
          <div className="gk-pickbox">
            <span className="gk-pickchip">
              {member.name}
              <button
                aria-label="Trocar membro"
                onClick={() => setMember(null)}
                type="button"
              >
                <GestaoIcon name="x" size={12} />
              </button>
            </span>
          </div>
        ) : (
          <>
            <input
              autoComplete="off"
              className="gk-input"
              id="rec-member"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, usuário ou e-mail…"
              value={query}
            />
            {results.length > 0 ? (
              <div className="gk-pickmenu gk-pickmenu--inline">
                {results.map((person) => (
                  <button
                    className="gk-pickmenu-row"
                    key={person.id}
                    onClick={() => {
                      setMember(person);
                      setQuery("");
                    }}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="gk-avatar gk-avatar--lg"
                    >
                      {person.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span>{person.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
      <p className="gk-hint">
        Este vínculo libera {videos} gravações e {attachments} materiais somente
        para a conta escolhida.
      </p>
      <label className="gk-check-row">
        <input
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        <span>
          Confirmei a identidade da pessoa com uma fonte confiável. O nome
          histórico, sozinho, não foi usado para escolher a conta.
        </span>
      </label>
      <label className="gk-label">
        <span>Evidência consultada</span>
        <textarea
          className="gk-input gk-textarea"
          maxLength={1000}
          name="identityEvidence"
          placeholder="Registre a fonte e o critério conferido. Não inclua senhas, tokens ou dados desnecessários."
          rows={3}
        />
      </label>
      <p className="gk-hint">Fica no histórico administrativo deste grupo.</p>
      {linked ? (
        <label className="gk-check-row">
          <input
            checked={reassign}
            onChange={(event) => setReassign(event.target.checked)}
            type="checkbox"
          />
          <span>
            Entendo que a conta atual perde o acesso a {videos} gravações e{" "}
            {attachments} materiais.
          </span>
        </label>
      ) : null}
      {state.error ? (
        <p className="gk-error-box" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="gk-link-actions">
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending || !member}
          type="submit"
        >
          {linked ? "Confirmar reatribuição" : "Confirmar vínculo"}
        </button>
        {skipHref && !linked ? (
          <a className="gk-btn" href={skipHref}>
            Pular por enquanto
          </a>
        ) : null}
      </div>
    </form>
  );
};
