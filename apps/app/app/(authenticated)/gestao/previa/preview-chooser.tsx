"use client";

import { useActionState, useEffect, useState } from "react";
import { GestaoIcon } from "../gestao-icon";
import { type StartPreviewState, startGestaoPreview } from "./actions";

interface Person {
  readonly id: string;
  readonly name: string;
}

const idle: StartPreviewState = { error: null };

const MemberPick = ({
  member,
  onClear,
  onPick,
  onQuery,
  query,
  results,
}: {
  readonly member: Person | null;
  readonly onClear: () => void;
  readonly onPick: (person: Person) => void;
  readonly onQuery: (value: string) => void;
  readonly query: string;
  readonly results: readonly Person[];
}) => {
  if (member) {
    return (
      <span className="gk-pickchip">
        {member.name}
        <button aria-label="Trocar aluno" onClick={onClear} type="button">
          <GestaoIcon name="x" size={12} />
        </button>
      </span>
    );
  }
  return (
    <>
      <input
        autoComplete="off"
        className="gk-input"
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Buscar aluno pelo nome"
        value={query}
      />
      {results.length > 0 ? (
        <div className="gk-pickmenu gk-pickmenu--inline">
          {results.map((person) => (
            <button
              className="gk-pickmenu-row"
              key={person.id}
              onClick={() => onPick(person)}
              type="button"
            >
              <span>{person.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
};

export const PreviewChooser = ({
  cohorts,
  from,
}: {
  readonly cohorts: readonly { readonly id: string; readonly name: string }[];
  readonly from: string;
}) => {
  const [kind, setKind] = useState<"cohort" | "member">(
    cohorts.length > 0 ? "cohort" : "member"
  );
  const [state, formAction, pending] = useActionState(startGestaoPreview, idle);
  const [member, setMember] = useState<Person | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly Person[]>([]);

  useEffect(() => {
    if (state.goto) {
      window.location.assign(state.goto);
    }
  }, [state.goto]);

  useEffect(() => {
    const term = query.trim();
    if (kind !== "member" || term.length < 2) {
      setResults([]);
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
          setResults(
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
  }, [kind, query]);

  return (
    <form action={formAction} className="gk-card gk-form-card">
      <input name="from" type="hidden" value={from} />
      <input name="kind" type="hidden" value={kind} />
      <input name="memberId" type="hidden" value={member?.id ?? ""} />
      <fieldset className="gk-previewopts">
        <legend className="gk-card-title">O que você quer ver?</legend>
        <label className="gk-radio" data-checked={kind === "cohort"}>
          <input
            checked={kind === "cohort"}
            disabled={cohorts.length === 0}
            onChange={() => setKind("cohort")}
            type="radio"
          />
          <span>
            <strong>Aluno de uma turma</strong>
            <small>O que a turma recebe (conteúdo, cronograma, avisos).</small>
          </span>
        </label>
        {kind === "cohort" ? (
          <select className="gk-input" name="cohortId" required>
            <option value="">Escolha a turma</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </select>
        ) : null}
        <label className="gk-radio" data-checked={kind === "member"}>
          <input
            checked={kind === "member"}
            onChange={() => setKind("member")}
            type="radio"
          />
          <span>
            <strong>Um aluno específico</strong>
            <small>Inclui atribuições e acessos individuais.</small>
          </span>
        </label>
        {kind === "member" ? (
          <MemberPick
            member={member}
            onClear={() => setMember(null)}
            onPick={(person) => {
              setMember(person);
              setQuery("");
            }}
            onQuery={setQuery}
            query={query}
            results={results}
          />
        ) : null}
      </fieldset>
      <div className="gk-info-box">
        <GestaoIcon name="eye" size={20} />
        <div>
          <strong>Nada aqui altera dados.</strong>
          <span>
            Na prévia, envios, respostas e marcações ficam bloqueados. A prévia
            termina sozinha em 30 minutos e fica registrada no registro de
            atividades.
          </span>
        </div>
      </div>
      {state.error ? (
        <p className="gk-error-box" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="gk-link-actions">
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending}
          type="submit"
        >
          {pending ? "Abrindo…" : "Abrir prévia"}
        </button>
      </div>
    </form>
  );
};
