"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { PlusIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { searchGestaoActivityMembers } from "./actions";

interface RubricRow {
  readonly key: string;
  readonly title: string;
  readonly weight: string;
}

export const RubricCriteriaEditor = ({
  initial,
}: {
  readonly initial?: readonly {
    readonly id: string;
    readonly title: string;
    readonly weight: number;
  }[];
}) => {
  const [rows, setRows] = useState<RubricRow[]>(() => {
    const saved = (initial ?? []).map((item, index) => ({
      key: `${item.id}-${index}`,
      title: item.title,
      weight: String(item.weight),
    }));
    return saved.length
      ? [...saved, { key: "blank-after-saved", title: "", weight: "" }]
      : [
          { key: "blank-criterion-0", title: "", weight: "" },
          { key: "blank-criterion-1", title: "", weight: "" },
        ];
  });
  const total = rows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
  const activeRows = rows.filter(
    (row) => row.title.trim() || row.weight.trim()
  );

  return (
    <fieldset className="ga-rubric-editor">
      <legend>Critérios de avaliação</legend>
      <p>
        Defina o peso de cada critério. Os pesos precisam somar 100% antes da
        publicação.
      </p>
      <div className="ga-rubric-rows">
        {rows.map((row, index) => (
          <div className="ga-rubric-row" key={row.key}>
            <label htmlFor={`rubric-title-${row.key}`}>
              <span className="sr-only">Critério {index + 1}</span>
              <Input
                id={`rubric-title-${row.key}`}
                maxLength={120}
                name="rubricTitle"
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item) =>
                      item.key === row.key
                        ? { ...item, title: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="Ex.: Clareza do raciocínio"
                value={row.title}
              />
            </label>
            <label
              className="ga-rubric-weight"
              htmlFor={`rubric-weight-${row.key}`}
            >
              <span className="sr-only">
                Peso do critério {index + 1} em porcentagem
              </span>
              <Input
                id={`rubric-weight-${row.key}`}
                max="100"
                min="0"
                name="rubricWeight"
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item) =>
                      item.key === row.key
                        ? { ...item, weight: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="0"
                type="number"
                value={row.weight}
              />
              <span aria-hidden="true">%</span>
            </label>
            <Button
              aria-label={`Remover critério ${index + 1}`}
              className="ga-icon-button"
              disabled={rows.length <= 1}
              onClick={() =>
                setRows((current) =>
                  current.filter((item) => item.key !== row.key)
                )
              }
              type="button"
              variant="ghost"
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      <div className="ga-rubric-footer">
        <Button
          disabled={rows.length >= 12}
          onClick={() =>
            setRows((current) => [
              ...current,
              { key: crypto.randomUUID(), title: "", weight: "" },
            ])
          }
          type="button"
          variant="outline"
        >
          <PlusIcon aria-hidden="true" /> Adicionar critério
        </Button>
        <output aria-live="polite" data-valid={total === 100}>
          {activeRows.length ? `${total}%` : "Sem critérios"}
        </output>
      </div>
    </fieldset>
  );
};

interface ActivityMemberOption {
  readonly id: string;
  readonly label: string;
}

export const ActivityMemberPicker = ({
  initialSelected,
}: {
  readonly initialSelected: readonly ActivityMemberOption[];
}) => {
  const [selected, setSelected] = useState(initialSelected);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState<ActivityMemberOption[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      searchGestaoActivityMembers(query, page)
        .then((result) => {
          if (!controller.signal.aborted) {
            setMembers(result.members);
            setTotalPages(result.totalPages);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setError(true);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, query]);

  const toggle = (member: ActivityMemberOption) => {
    setSelected((current) => {
      if (current.some((item) => item.id === member.id)) {
        return current.filter((item) => item.id !== member.id);
      }
      if (current.length >= 200) {
        return current;
      }
      return [...current, member];
    });
  };

  return (
    <div className="ga-member-picker">
      <input name="memberIdsMode" type="hidden" value="SET" />
      {selected.map((member) => (
        <input
          key={member.id}
          name="memberIds"
          type="hidden"
          value={member.id}
        />
      ))}
      <label className="ga-member-search" htmlFor="activity-member-search">
        <span>Buscar aluno por nome ou e-mail</span>
        <Input
          autoComplete="off"
          id="activity-member-search"
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Digite para buscar"
          value={query}
        />
      </label>
      <div
        aria-busy={loading}
        aria-multiselectable="true"
        className="ga-member-results"
        role="listbox"
      >
        {loading ? <p>Buscando…</p> : null}
        {error ? (
          <p role="alert">
            Não foi possível carregar os alunos. Tente novamente.
          </p>
        ) : null}
        {!(loading || error) && members.length === 0 ? (
          <p>Nenhum aluno encontrado.</p>
        ) : null}
        {members.map((member) => {
          const isSelected = selected.some((item) => item.id === member.id);
          return (
            <button
              aria-selected={isSelected}
              className="ga-member-option"
              key={member.id}
              onClick={() => toggle(member)}
              role="option"
              type="button"
            >
              <span aria-hidden="true" className="ga-member-check">
                {isSelected ? "✓" : ""}
              </span>
              <span>{member.label}</span>
            </button>
          );
        })}
      </div>
      <div className="ga-member-pagination">
        <span>
          {selected.length} aluno{selected.length === 1 ? "" : "s"} selecionado
          {selected.length === 1 ? "" : "s"}
        </span>
        <div>
          <Button
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => current - 1)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Anterior
          </Button>
          <span>
            {page}/{totalPages}
          </span>
          <Button
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Próxima
          </Button>
        </div>
      </div>
      {selected.length >= 200 ? (
        <output className="ga-inline-warning">
          O limite de seleção direta é 200 alunos. Para alcançar mais pessoas,
          selecione uma turma.
        </output>
      ) : null}
    </div>
  );
};
